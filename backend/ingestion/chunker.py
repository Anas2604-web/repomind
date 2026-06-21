"""
Chunker — walks the cloned repo and slices files into overlapping chunks.

Real-world analogy for interviews: an LLM can't read a 5,000-line file in
one gulp any more than you'd hand someone the entire Encyclopedia Britannica
to answer one question. So we cut every file into index-card-sized pieces
(chunks), each one small enough to be a precise, retrievable unit, and each
one knows exactly which file and which lines it came from (the "citation").

Overlap matters: if a function definition gets cut exactly at the chunk
boundary, overlap means the next chunk still has enough of it to make sense
on its own.
"""
import os
from dataclasses import dataclass

from config import (
    ALLOWED_EXTENSIONS, IGNORED_DIRS, IGNORED_FILENAMES, IGNORED_FILENAME_SUBSTRINGS,
    CHUNK_SIZE_LINES, CHUNK_OVERLAP_LINES, MAX_FILES_PER_REPO, MAX_CHUNKS_PER_REPO,
)


@dataclass
class CodeChunk:
    repo_id: str
    file_path: str       # path relative to repo root, e.g. "src/auth/login.py"
    content: str
    start_line: int
    end_line: int

    def chunk_id(self) -> str:
        """Stable unique id — used as the point ID when storing in Qdrant."""
        return f"{self.repo_id}::{self.file_path}::{self.start_line}-{self.end_line}"


def _is_ignored_filename(fname: str) -> bool:
    if fname in IGNORED_FILENAMES:
        return True
    return any(sub in fname.lower() for sub in IGNORED_FILENAME_SUBSTRINGS)


def _iter_source_files(repo_path: str):
    count = 0
    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
        for fname in files:
            if count >= MAX_FILES_PER_REPO:
                return
            ext = os.path.splitext(fname)[1]
            if ext in ALLOWED_EXTENSIONS and not _is_ignored_filename(fname):
                full_path = os.path.join(root, fname)
                rel_path = os.path.relpath(full_path, repo_path)
                count += 1
                yield full_path, rel_path


def chunk_file(full_path: str, rel_path: str, repo_id: str) -> list[CodeChunk]:
    try:
        with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
    except OSError:
        return []

    if not lines:
        return []

    chunks = []
    step = CHUNK_SIZE_LINES - CHUNK_OVERLAP_LINES
    i = 0
    while i < len(lines):
        window = lines[i : i + CHUNK_SIZE_LINES]
        if not window:
            break
        chunks.append(
            CodeChunk(
                repo_id=repo_id,
                file_path=rel_path,
                content="".join(window),
                start_line=i + 1,                       # 1-indexed for humans
                end_line=min(i + len(window), len(lines)),
            )
        )
        if i + CHUNK_SIZE_LINES >= len(lines):
            break
        i += step
    return chunks


def chunk_repo(repo_path: str, repo_id: str) -> list[CodeChunk]:
    """Walks every allowed file in the repo and returns all chunks, capped at MAX_CHUNKS_PER_REPO."""
    all_chunks: list[CodeChunk] = []
    for full_path, rel_path in _iter_source_files(repo_path):
        all_chunks.extend(chunk_file(full_path, rel_path, repo_id))
        if len(all_chunks) >= MAX_CHUNKS_PER_REPO:
            return all_chunks[:MAX_CHUNKS_PER_REPO]
    return all_chunks
