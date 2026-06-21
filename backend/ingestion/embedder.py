"""
Embedder — turns text into vectors (lists of numbers) that capture meaning.

Real-world analogy for interviews: think of it like GPS coordinates, but for
meaning instead of location. Two pieces of code that do similar things
("validate a JWT token" and "check if auth token is expired") end up as
nearby points in this space, even though they don't share many exact words.
That's what makes semantic search possible — keyword search would miss the
connection, vector search finds it.

We run this model locally (not an API call) — it's free, has no per-request
cost, and means RepoMind doesn't depend on a third-party embeddings API
being up. First run downloads ~90MB; after that it's cached locally.
"""
from sentence_transformers import SentenceTransformer

from config import EMBEDDING_MODEL_NAME

_model = None  # lazy-loaded singleton — don't reload the model on every call


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Batch-embeds a list of strings. Returns one vector per input string."""
    model = _get_model()
    vectors = model.encode(texts, show_progress_bar=False, convert_to_numpy=True)
    return vectors.tolist()


def embed_one(text: str) -> list[float]:
    return embed_texts([text])[0]
