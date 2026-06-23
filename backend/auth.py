"""
Auth — verifies Clerk-issued session JWTs.

Real-world analogy: Clerk hands every signed-in user a sealed, tamper-proof
envelope (the JWT) when they log in. We don't manage passwords or sessions
ourselves — we just check the seal is genuine (verify the signature against
Clerk's public key) and read the name on the envelope (the `sub` claim,
Clerk's user id).

If CLERK_JWT_KEY isn't set, auth is skipped entirely (everyone is treated as
"anonymous") — same pattern as the Groq key: the app keeps working in local
dev before you've set up a Clerk account, and you turn enforcement on by
just adding the env var, no code change needed.

Where to get CLERK_JWT_KEY: Clerk Dashboard -> API Keys -> "Show JWT
public key" -> PEM Public Key. Paste it into .env with literal \n for
line breaks (see .env.example) — this code unescapes them below.
"""
import os
import jwt
from fastapi import Header, HTTPException, Query

CLERK_JWT_KEY = os.getenv("CLERK_JWT_KEY", "").replace("\\n", "\n")

async def get_current_user_id(
    authorization: str | None = Header(default=None),
    token: str | None = Query(default=None),   # ← add this
) -> str:
    if not CLERK_JWT_KEY:
        return "anonymous"

    # Accept token from query param (SSE can't send headers)
    raw = token or (authorization.removeprefix("Bearer ") if authorization and authorization.startswith("Bearer ") else None)

    if not raw:
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    try:
        payload = jwt.decode(raw, CLERK_JWT_KEY, algorithms=["RS256"], options={"verify_aud": False}, leeway=30)
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid session token: {e}")

    return payload["sub"]
