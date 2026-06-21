"""
Persistent registry — tracks which repos have been ingested, their status,
and where they live on disk. Backed by SQLite, not an in-memory dict.

Why SQLite and not Redis/Postgres: at this scale (one backend process,
a handful of repos at a time), a single file is the right-sized tool.
Reaching for Redis here would be solving a problem this app doesn't have —
the kind of over-engineering that's worse than the bug it's fixing.

Real-world analogy for interviews: a in-memory dict is a sticky note —
gone the moment the server restarts. SQLite is a filing cabinet — slower
to set up than a sticky note, but still there tomorrow.
"""
import sqlite3
import os
import time
from contextlib import contextmanager

DB_PATH = os.getenv("REGISTRY_DB_PATH", "./repomind.db")


def _init_db():
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS repos (
                repo_id TEXT PRIMARY KEY,
                repo_url TEXT NOT NULL,
                repo_path TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'processing',
                chunks_indexed INTEGER DEFAULT 0,
                error TEXT,
                created_at REAL NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                event TEXT NOT NULL,
                repo_id TEXT,
                created_at REAL NOT NULL
            )
            """
        )


def log_event(user_id: str, event: str, repo_id: str | None = None):
    """
    Real user-activity tracking, separate from PostHog: this is the
    source-of-truth log of who did what, on your own infra, queryable
    with plain SQL — e.g. "how many distinct users actually asked a
    question after indexing a repo" (the real signal of whether this
    is useful, not just "how many people opened the page").
    """
    with _connect() as conn:
        conn.execute(
            "INSERT INTO events (user_id, event, repo_id, created_at) VALUES (?, ?, ?, ?)",
            (user_id, event, repo_id, time.time()),
        )


@contextmanager
def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def create_pending(repo_id: str, repo_url: str, repo_path: str):
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO repos (repo_id, repo_url, repo_path, status, created_at)
            VALUES (?, ?, ?, 'processing', ?)
            ON CONFLICT(repo_id) DO UPDATE SET status='processing', error=NULL
            """,
            (repo_id, repo_url, repo_path, time.time()),
        )


def mark_done(repo_id: str, chunks_indexed: int):
    with _connect() as conn:
        conn.execute(
            "UPDATE repos SET status='ready', chunks_indexed=? WHERE repo_id=?",
            (chunks_indexed, repo_id),
        )


def mark_failed(repo_id: str, error: str):
    with _connect() as conn:
        conn.execute(
            "UPDATE repos SET status='failed', error=? WHERE repo_id=?",
            (error, repo_id),
        )


def get(repo_id: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM repos WHERE repo_id=?", (repo_id,)).fetchone()
        return dict(row) if row else None


_init_db()
