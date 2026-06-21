from pydantic import BaseModel, Field


class IngestRequest(BaseModel):
    repo_url: str = Field(..., examples=["https://github.com/fastapi/fastapi"])


class IngestResponse(BaseModel):
    repo_id: str
    repo_url: str
    status: str


class StatusResponse(BaseModel):
    repo_id: str
    status: str  # "processing" | "ready" | "failed"
    chunks_indexed: int
    error: str | None = None


class ChatRequest(BaseModel):
    repo_id: str
    question: str = Field(..., examples=["How does authentication work in this repo?"])


class Citation(BaseModel):
    file_path: str
    start_line: int
    end_line: int


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]
