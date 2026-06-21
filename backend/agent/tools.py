"""
Tools — the actions the agent is allowed to take.

Real-world analogy for interviews: think of the agent as a new hire who
just joined the team. They don't have the whole codebase memorized — but
they know how to use two tools: (1) search the codebase for relevant
snippets, and (2) open a specific file to read more context. The agent
decides WHICH tool to use and WHEN, based on the question — that decision
-making is what makes this "agentic" rather than a fixed pipeline.
"""
import os
from langchain_core.tools import tool

from ingestion.embedder import embed_one
from vectorstore.qdrant_store import get_store
from config import CLONE_DIR

_store = get_store()


def make_tools(repo_id: str, repo_path: str):
    """
    Returns tools scoped to one specific repo/session. We build them inside
    a function (closures) so each chat session's tools only ever touch the
    repo that session is about — the agent can't accidentally search a
    different user's repo.
    """

    @tool
    def search_codebase(query: str) -> str:
        """
        Search the codebase for chunks relevant to a natural-language query.
        Use this first for almost any question — e.g. 'where is the login logic',
        'how are database connections configured'.
        """
        query_vector = embed_one(query)
        results = _store.search(query_vector, repo_id=repo_id, top_k=5)
        if not results:
            return "No relevant code found for that query."

        formatted = []
        for r in results:
            formatted.append(
                f"FILE: {r['file_path']} (lines {r['start_line']}-{r['end_line']})\n"
                f"{r['content']}\n"
            )
        return "\n---\n".join(formatted)

    @tool
    def read_file(file_path: str) -> str:
        """
        Read the full contents of a specific file by its path relative to the
        repo root (e.g. 'src/auth/login.py'). Use this when search_codebase
        returns a relevant snippet but you need to see the whole file for
        full context.
        """
        full_path = os.path.join(repo_path, file_path)
        full_path = os.path.normpath(full_path)
        # Safety check: never let the agent read outside the cloned repo folder
        if not full_path.startswith(os.path.normpath(repo_path)):
            return "Access denied: path is outside the repo."
        if not os.path.exists(full_path):
            return f"File not found: {file_path}"
        with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()[:8000]  # cap length so one file can't blow the context window

    return [search_codebase, read_file]
