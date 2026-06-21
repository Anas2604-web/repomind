"""
Agent graph — wires the LLM + tools into a ReAct loop using LangGraph.

Real-world analogy for interviews: ReAct = "Reason then Act, repeat."
The agent reads the question, THINKS about what it needs ("I should search
the codebase for auth logic"), ACTS (calls search_codebase), reads the
result, and decides: answer now, or take another action first (e.g. read_file
for more detail). This loop continues until it's confident enough to answer.

This is the same core pattern used in AgenticRAG, just expressed through
LangGraph's prebuilt ReAct agent instead of a hand-rolled LangChain agent —
LangGraph gives you the explicit state graph, which makes it much easier to
add steps later (e.g. a verification node, a "did I actually answer the
question" check) without rewriting the whole flow.
"""
from langchain_groq import ChatGroq
from langgraph.prebuilt import create_react_agent

from agent.tools import make_tools
from config import GROQ_API_KEY, GROQ_MODEL

SYSTEM_PROMPT = """You are RepoMind, an expert assistant that answers questions about a \
specific GitHub codebase using the tools provided.

Rules:
- Always use search_codebase before answering, even if you think you know the answer.
- If the first search doesn't give enough context, use read_file to see the full file.
- Every answer MUST cite the specific file path and line numbers you used.
- If you genuinely cannot find relevant code after searching, say so plainly \
instead of guessing.
- Be concise. Answer like a senior engineer explaining to a teammate, not a textbook.
"""


def build_agent(repo_id: str, repo_path: str):
    llm = ChatGroq(api_key=GROQ_API_KEY, model=GROQ_MODEL, temperature=0)
    tools = make_tools(repo_id, repo_path)
    agent = create_react_agent(llm, tools, state_modifier=SYSTEM_PROMPT)
    return agent


def ask(repo_id: str, repo_path: str, question: str, max_retries: int = 3) -> dict:
    """
    Runs the agent on one question. Returns the final answer text plus
    the raw message trace (useful for showing "reasoning steps" in the UI,
    same idea as the reasoning trace panel in your AgenticRAG project).

    Retries on Groq's known intermittent tool-calling bug: the model
    occasionally emits a malformed <function=...> string instead of a
    proper tool call, which Groq rejects with a 400. Same input can succeed
    on the very next attempt — this is a documented Groq-side issue, not
    something wrong with our code.
    """
    from groq import BadRequestError

    agent = build_agent(repo_id, repo_path)
    last_error = None
    for attempt in range(max_retries):
        try:
            result = agent.invoke({"messages": [{"role": "user", "content": question}]})
            messages = result["messages"]
            final_answer = messages[-1].content
            return {"answer": final_answer, "messages": messages}
        except BadRequestError as e:
            if "tool_use_failed" in str(e):
                last_error = e
                continue
            raise
    raise last_error
