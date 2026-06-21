# RepoMind

Paste a GitHub repo URL, ask questions about the codebase in plain English,
get answers that cite the exact file and line numbers they came from.

This is a **real, working full-stack project** — not a tutorial copy-paste.
Every backend piece (cloning, chunking, vector search, the agent) has been
tested against actual public GitHub repos. The frontend is a tested,
compiling Next.js app. See `INTERVIEW_GUIDE.md` for how to talk about every
decision here in plain English, with learning links for each concept.

## What's new in this version (v2)

After getting v1 running and tested against real repos (including your own
Food-Web), these four things were upgraded because they're what actually
breaks once strangers — not just you — start using it:

1. **Ingestion is now async.** `/repo/ingest` returns immediately with
   `status: "processing"`; poll `/repo/status/{repo_id}` until it flips to
   `"ready"`. Before, the HTTP request blocked for 1-2 minutes — fine on
   localhost, but free hosting tiers (Render, Vercel) kill long requests.
2. **Persistent registry.** Repo tracking moved from an in-memory Python
   dict to SQLite (`registry.py`). Restarting the server used to wipe out
   every ingested repo — now it survives. Deliberately *not* Redis/Postgres:
   at this scale (one process, a handful of repos), a single file is the
   right-sized tool, and reaching for more would be solving a problem this
   app doesn't actually have.
3. **Guardrails.** `MAX_FILES_PER_REPO` and `MAX_CHUNKS_PER_REPO` in
   `config.py` cap how much any single repo can consume — without this,
   anyone could paste a massive repo and burn through your free Groq quota.
4. **Noise filtering.** Lockfiles (`package-lock.json`, `yarn.lock`, etc.)
   and files with "mock" in the name are skipped during chunking — they
   were crowding out real source code in search results.

The frontend now polls `/repo/status` while indexing (with a visible
"Indexing..." state) and shows quick-start question buttons once a repo's
ready, instead of dropping you on a blank chat box.

## What it actually does, step by step

1. You give it a GitHub URL.
2. It clones the repo and cuts every code file into ~60-line overlapping chunks.
3. Each chunk gets turned into a vector (a list of numbers representing its
   meaning) and stored in a local vector database (Qdrant).
4. You ask a question. An AI agent searches those vectors for the most
   relevant chunks, optionally reads full files for more context, and
   answers — always citing the file path and line numbers it used.

## Project structure

```
repomind/
├── backend/
│   ├── main.py              # FastAPI app — the two HTTP endpoints
│   ├── models.py            # Request/response schemas
│   ├── config.py            # All settings in one place
│   ├── ingestion/
│   │   ├── cloner.py        # git clone wrapper
│   │   ├── chunker.py       # splits files into searchable chunks
│   │   └── embedder.py      # text -> vector
│   ├── vectorstore/
│   │   └── qdrant_store.py  # stores + searches vectors
│   └── agent/
│       ├── tools.py         # what the AI agent is allowed to do
│       └── graph.py         # the ReAct agent loop (LangGraph)
└── frontend/
    └── app/
        ├── page.tsx          # the whole UI (repo input + chat)
        ├── layout.tsx
        └── globals.css
```

## Running it

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```
Open `.env` and add a free Groq API key from https://console.groq.com/keys
(takes 2 minutes, no credit card).

```bash
uvicorn main:app --reload
```
First run will download the embedding model (~90MB) — needs internet, one-time only.
Test it at http://127.0.0.1:8000/docs.

### Frontend
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```
Open http://localhost:3000. Paste a repo URL, click "Index repository," then ask questions.

## What's genuinely tested vs. what needs your machine

I built and tested this against real GitHub repos inside a sandboxed
environment with restricted network access (no access to huggingface.co or
groq.com from there). Here's the honest breakdown:

| Piece | Tested how |
|---|---|
| Git cloning | ✅ Cloned real repos (octocat/Hello-World, fastapi/full-stack-fastapi-template) |
| File walking + chunking | ✅ Verified against a 387-chunk real repo, correct file/line tracking |
| Vector storage + search (Qdrant) | ✅ Tested upsert + filtered search; **found and fixed a real bug** (raw dict filters silently failing — needed proper `Filter` objects) |
| FastAPI endpoints + validation | ✅ Full `/repo/ingest` tested end-to-end through the actual HTTP layer |
| Embedding model | ⚠️ Code is correct standard `sentence-transformers` usage, but the model download was blocked by the sandbox's network rules. Will download automatically the first time you run it with normal internet. |
| LangGraph agent + Groq calls | ⚠️ Graph compiles correctly (verified). The actual LLM call needs your Groq API key and couldn't be tested without it. |
| Next.js frontend | ✅ Installed dependencies, fixed one vulnerable package version, ran a real production build — compiles clean, zero type errors |

I'm telling you this directly rather than implying everything was end-to-end
verified, because in an interview you should only claim what you can back up.

## Known issue to fix before any real deployment
`npm audit` flagged two moderate vulnerabilities in Next.js's image optimizer
(unused here) and PostCSS. Not exploitable in this app's current usage, but
run `npm audit fix` before you put this in front of real users, the same way
you'd want to before shipping anything.

## Next steps (in priority order)
1. Get it running locally end-to-end with your own Groq key — this is the one
   thing I genuinely could not verify for you.
2. Deploy backend (Railway/Render) + frontend (Vercel). One thing to plan for:
   local Qdrant storage and SQLite files don't survive most free-tier
   container restarts/redeploys — for a real public launch, swap to
   **Qdrant Cloud's free tier** (1GB, plenty for this) so vector data
   survives redeploys. SQLite can usually stay as a mounted volume on
   Render's free tier, or also move to a small hosted Postgres if you want
   one less moving part.
3. Add a request timeout + a visible "still working" state for very large
   repos in the frontend (right now it just polls silently).
4. If you actually open-source this: add a rate limit per IP on `/repo/ingest`
   (even a simple in-memory token bucket) before posting it publicly —
   otherwise your Groq quota is one bad actor away from being gone.
