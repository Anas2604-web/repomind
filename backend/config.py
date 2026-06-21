"""
Config — all environment-driven settings in one place.

Why a separate config file instead of os.getenv() scattered everywhere?
Same reason you'd centralize env vars in a Node project: one source of truth,
easy to see what the app needs to run, easy to swap providers later.
"""
import os
from dotenv import load_dotenv

load_dotenv()  # reads .env file in local dev, no-op in production if vars are set by the host

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "sentence-transformers/all-MiniLM-L6-v2")
EMBEDDING_DIM = 384  # output dimension of all-MiniLM-L6-v2 — must match what we tell Qdrant

QDRANT_STORAGE_PATH = os.getenv("QDRANT_STORAGE_PATH", "./qdrant_data")
CLONE_DIR = os.getenv("CLONE_DIR", "./cloned_repos")

CHUNK_SIZE_LINES = 60      # how many lines of code per chunk
CHUNK_OVERLAP_LINES = 10   # overlap between consecutive chunks, so context isn't cut mid-function

# File extensions RepoMind will actually read. Skips binaries, images, lockfiles, etc.
ALLOWED_EXTENSIONS = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".go", ".rb", ".php",
    ".c", ".cpp", ".h", ".hpp", ".cs", ".rs", ".md", ".json", ".yaml", ".yml",
}

# Directories to skip entirely while walking a cloned repo
IGNORED_DIRS = {".git", "node_modules", "venv", "__pycache__", "dist", "build", ".next"}

# Filenames that are technically code/data but never useful to search —
# generated lockfiles and bulk mock data just waste embedding budget and
# crowd out real source chunks in search results.
IGNORED_FILENAMES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock",
    "Cargo.lock", "composer.lock", "Gemfile.lock",
}
IGNORED_FILENAME_SUBSTRINGS = ("mock", ".min.")  # e.g. mock.json, data.mock.json, app.min.js

# Guardrails — without these, anyone can paste a huge repo and burn your
# Groq/embedding quota for free. Tune these based on what your free tier allows.
MAX_FILES_PER_REPO = 800
MAX_CHUNKS_PER_REPO = 1500

