"""
File tree — builds a nested folder/file structure for a cloned repo, so the
frontend can show a real VS-Code-style sidebar instead of just raw citations.

This is deliberately separate from chunker.py's file list: chunker only
keeps files RepoMind can search (allowed extensions). This tree shows the
*actual* repo structure so users get visual context, even for files we
don't chunk (images, configs, etc).
"""
import os
from config import IGNORED_DIRS

MAX_NODES = 2000  # safety cap so a huge repo can't blow up the response


def build_tree(repo_path: str) -> dict:
    """Returns a nested dict: {name, path, type, children?}."""
    root = {"name": os.path.basename(repo_path.rstrip("/")) or "repo", "path": "", "type": "dir", "children": []}
    node_count = 0

    def walk(dir_path: str, dir_node: dict, rel_prefix: str):
        nonlocal node_count
        try:
            entries = sorted(os.listdir(dir_path), key=lambda n: (not os.path.isdir(os.path.join(dir_path, n)), n.lower()))
        except OSError:
            return
        for entry in entries:
            if node_count >= MAX_NODES:
                return
            if entry in IGNORED_DIRS:
                continue
            full = os.path.join(dir_path, entry)
            rel = f"{rel_prefix}{entry}"
            node_count += 1
            if os.path.isdir(full):
                child = {"name": entry, "path": rel, "type": "dir", "children": []}
                dir_node["children"].append(child)
                walk(full, child, rel + "/")
            else:
                dir_node["children"].append({"name": entry, "path": rel, "type": "file"})

    walk(repo_path, root, "")
    return root
