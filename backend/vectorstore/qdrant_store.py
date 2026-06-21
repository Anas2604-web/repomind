"""
Vector store — stores chunk embeddings and lets us search "find chunks
similar in meaning to this query" in milliseconds, even across thousands
of chunks.

Real-world analogy for interviews: a library's card catalog, except instead
of being indexed alphabetically by title, it's indexed by *meaning*. You
hand it a question, it hands back the index cards (chunks) most relevant
to that question — each card still pointing back to the exact shelf and
page (file_path + line numbers) it came from.

We use Qdrant in LOCAL mode here (no separate server to run) — it persists
to a folder on disk. Same client API as Qdrant Cloud, so swapping to a
hosted cluster later is a one-line change, not a rewrite.
"""
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue

from config import QDRANT_STORAGE_PATH, EMBEDDING_DIM

COLLECTION_NAME = "code_chunks"


class CodeVectorStore:
    def __init__(self):
        self.client = QdrantClient(path=QDRANT_STORAGE_PATH)
        self._ensure_collection()

    def _ensure_collection(self):
        existing = [c.name for c in self.client.get_collections().collections]
        if COLLECTION_NAME not in existing:
            self.client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(size=EMBEDDING_DIM, distance=Distance.COSINE),
            )

    def upsert_chunks(self, chunks, vectors: list[list[float]]):
        """
        chunks: list of CodeChunk (from ingestion.chunker)
        vectors: matching list of embedding vectors, same order/length as chunks
        """
        points = []
        for chunk, vector in zip(chunks, vectors):
            # Hash the string chunk_id into a positive int — Qdrant point IDs
            # must be int or UUID, but our IDs are human-readable strings.
            point_id = abs(hash(chunk.chunk_id())) % (2**63)
            points.append(
                PointStruct(
                    id=point_id,
                    vector=vector,
                    payload={
                        "repo_id": chunk.repo_id,
                        "file_path": chunk.file_path,
                        "content": chunk.content,
                        "start_line": chunk.start_line,
                        "end_line": chunk.end_line,
                    },
                )
            )
        self.client.upsert(collection_name=COLLECTION_NAME, points=points)

    def search(self, query_vector: list[float], repo_id: str, top_k: int = 5):
        """Returns the top_k most relevant chunks for this repo, with similarity scores."""
        results = self.client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            query_filter=Filter(
                must=[FieldCondition(key="repo_id", match=MatchValue(value=repo_id))]
            ),
            limit=top_k,
        ).points
        return [
            {
                "file_path": r.payload["file_path"],
                "content": r.payload["content"],
                "start_line": r.payload["start_line"],
                "end_line": r.payload["end_line"],
                "score": r.score,
            }
            for r in results
        ]


_singleton_store: "CodeVectorStore | None" = None


def get_store() -> CodeVectorStore:
    """
    Shared singleton. Qdrant's local (embedded) mode locks the storage folder —
    only one CodeVectorStore instance may open it per process. Every part of
    the app (main.py, agent/tools.py) must go through this function instead
    of constructing CodeVectorStore() directly, or you'll hit a file-lock error.
    """
    global _singleton_store
    if _singleton_store is None:
        _singleton_store = CodeVectorStore()
    return _singleton_store
