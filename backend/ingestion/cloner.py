"""
Cloner — pulls a public GitHub repo down to local disk.

Real-world analogy for interviews: this is the "intake desk." Before a
librarian can help you find a book, the books have to be on the shelves.
This module is what gets the repo onto our shelves.
"""
import subprocess
import hashlib
import os
import shutil
from pathlib import Path

from config import CLONE_DIR


def _repo_id_for(repo_url: str) -> str:
    """
    Turn a URL into a short, filesystem-safe folder name.
    Hashing means the same repo always maps to the same folder
    (so we don't re-clone something we already have).
    """
    return hashlib.sha256(repo_url.encode()).hexdigest()[:16]


def clone_repo(repo_url: str, force: bool = False) -> tuple[str, str]:
    """
    Clones repo_url into CLONE_DIR/<repo_id>.
    Returns (repo_id, local_path).

    force=True deletes any existing copy first (useful if the repo
    changed and you want a fresh pull rather than reusing the old clone).
    """
    repo_id = _repo_id_for(repo_url)
    local_path = os.path.join(CLONE_DIR, repo_id)

    if os.path.exists(local_path):
        if force:
            shutil.rmtree(local_path)
        else:
            return repo_id, local_path  # already cloned, reuse it

    os.makedirs(CLONE_DIR, exist_ok=True)

    # --depth 1: shallow clone. We only need the current files, not the
    # entire commit history, so this is much faster and lighter.
    result = subprocess.run(
        ["git", "clone", "--depth", "1", repo_url, local_path],
        capture_output=True,
        text=True,
        timeout=120,
    )

    if result.returncode != 0:
        raise RuntimeError(f"git clone failed: {result.stderr.strip()}")

    return repo_id, local_path
