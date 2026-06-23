"""
Main API — endpoints that tie the whole pipeline together.

  POST /repo/ingest     -> clone + chunk + embed + store a GitHub repo
  POST /chat            -> ask a question (full response, no streaming)
  GET  /chat/stream     -> ask a question with SSE token-by-token streaming
"""
import re
import os
import json
import logging

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from models import IngestRequest, IngestResponse, ChatRequest, ChatResponse, Citation, StatusResponse
from ingestion.cloner import clone_repo
from ingestion.chunker import chunk_repo
from ingestion.embedder import embed_texts
from ingestion.file_tree import build_tree
from vectorstore.qdrant_store import get_store
from agent.graph import ask, ask_stream
from auth import get_current_user_id
import registry

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("repomind")

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="RepoMind API", version="0.4.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_store = get_store()


@app.get("/health")
async def health_check():
    return {"status": "ok"}


def _run_ingestion(repo_id: str, repo_path: str, user_id: str):
    try:
        chunks = chunk_repo(repo_path, repo_id)
        if not chunks:
            registry.mark_failed(repo_id, "No supported source files found in this repo")
            return
        logger.info(f"Embedding {len(chunks)} chunks for repo {repo_id}...")
        vectors = embed_texts([c.content for c in chunks])
        _store.upsert_chunks(chunks, vectors)
        registry.mark_done(repo_id, len(chunks))
        registry.log_event(user_id, "repo_ingest_completed", repo_id)
    except Exception as e:
        logger.exception(f"Ingestion failed for {repo_id}")
        registry.mark_failed(repo_id, str(e))
        registry.log_event(user_id, "repo_ingest_failed", repo_id)


@app.post("/repo/ingest", response_model=IngestResponse)
@limiter.limit("5/minute")
async def ingest_repo(
    payload: IngestRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
):
    if "github.com" not in payload.repo_url:
        raise HTTPException(status_code=400, detail="Only GitHub URLs are supported right now")

    try:
        repo_id, repo_path = clone_repo(payload.repo_url)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    registry.create_pending(repo_id, payload.repo_url, repo_path)
    registry.log_event(user_id, "repo_ingest_started", repo_id)
    background_tasks.add_task(_run_ingestion, repo_id, repo_path, user_id)

    return IngestResponse(repo_id=repo_id, repo_url=payload.repo_url, status="processing")


@app.get("/repo/status/{repo_id}", response_model=StatusResponse)
async def repo_status(repo_id: str):
    row = registry.get(repo_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Unknown repo_id")
    return StatusResponse(
        repo_id=repo_id,
        status=row["status"],
        chunks_indexed=row["chunks_indexed"],
        error=row["error"],
    )


@app.get("/repo/files/{repo_id}")
async def repo_files(repo_id: str):
    row = registry.get(repo_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Unknown repo_id")
    return build_tree(row["repo_path"])


@app.get("/repo/files/{repo_id}/content")
async def repo_file_content(repo_id: str, path: str):
    row = registry.get(repo_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Unknown repo_id")
    full_path = os.path.normpath(os.path.join(row["repo_path"], path))
    if not full_path.startswith(os.path.normpath(row["repo_path"])):
        raise HTTPException(status_code=400, detail="Invalid path")
    if not os.path.isfile(full_path):
        raise HTTPException(status_code=404, detail="File not found")
    with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
        return {"path": path, "content": f.read(20000)}


@app.post("/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
async def chat(payload: ChatRequest, request: Request, user_id: str = Depends(get_current_user_id)):
    row = registry.get(payload.repo_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Unknown repo_id — ingest the repo first via /repo/ingest")
    if row["status"] != "ready":
        raise HTTPException(status_code=409, detail=f"Repo is not ready yet (status: {row['status']})")

    registry.log_event(user_id, "question_asked", payload.repo_id)
    result = ask(payload.repo_id, row["repo_path"], payload.question)

    citations = []
    seen = set()
    for msg in result["messages"]:
        content = getattr(msg, "content", "")
        if not isinstance(content, str):
            continue
        for match in re.finditer(r"FILE: (.+?) \(lines (\d+)-(\d+)\)", content):
            file_path, start, end = match.group(1), int(match.group(2)), int(match.group(3))
            key = (file_path, start, end)
            if key not in seen:
                seen.add(key)
                citations.append(Citation(file_path=file_path, start_line=start, end_line=end))

    return ChatResponse(answer=result["answer"], citations=citations)


@app.get("/chat/stream")
@limiter.limit("20/minute")
async def chat_stream(
    repo_id: str,
    question: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    """
    SSE endpoint — streams the answer token by token.
    Uses GET so the frontend can use fetch() with a ReadableStream reader.
    Auth token is passed as ?token=... query param since EventSource
    doesn't support custom headers.

    SSE format:
      data: <text chunk>\n\n         <- regular token
      data: __CITATIONS__[...]\n\n   <- final citations JSON
      data: __DONE__\n\n             <- stream complete
      data: __ERROR__ <msg>\n\n      <- something went wrong
    """
    row = registry.get(repo_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Unknown repo_id")
    if row["status"] != "ready":
        raise HTTPException(status_code=409, detail=f"Repo not ready (status: {row['status']})")

    registry.log_event(user_id, "question_asked_stream", repo_id)

    def event_generator():
        try:
            for chunk in ask_stream(repo_id, row["repo_path"], question):
                # Each chunk is either a text token or the __CITATIONS__ line
                yield f"data: {chunk}\n\n"
            yield "data: __DONE__\n\n"
        except Exception as e:
            logger.exception("Streaming chat failed")
            yield f"data: __ERROR__ {str(e)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disables Nginx buffering on Render
        },
    )