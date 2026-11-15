from __future__ import annotations

import logging
import os
import threading
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import text

from . import queries
from .db import engine
from .rag.index import index

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    index.build_in_background()  # dashboard endpoints serve immediately; search comes online when ready
    yield


app = FastAPI(title="Palm oil dashboard API", version="2.0.0", lifespan=lifespan)

origins = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    """Warm-up ping: also touches MySQL so a sleeping database wakes up."""
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"ok": True}


@app.get("/api/meta")
def meta():
    """Locations, items, year range, data releases and table row counts."""
    with engine.connect() as conn:
        return queries.meta(conn)


@app.get("/api/trend")
def trend(location_id: int = Query(..., ge=1)):
    with engine.connect() as conn:
        return queries.trend(conn, location_id)


@app.get("/api/ranking")
def ranking(
    year: int = Query(..., ge=2400, le=2700),
    item_id: int = Query(..., ge=1),
    level: Literal["province", "region"] = "province",
    region_id: int | None = Query(None, ge=1),
):
    with engine.connect() as conn:
        return queries.ranking(conn, year, item_id, level, region_id)


@app.get("/api/regions")
def regions(item_id: int = Query(..., ge=1)):
    with engine.connect() as conn:
        return queries.regions(conn, item_id)


# ---------- semantic search + RAG ----------
# Every search/ask can spend Gemini quota, so each client IP gets a small budget.
RATE_LIMIT = int(os.environ.get("AI_RATE_LIMIT_PER_MIN", "20"))
_hits: dict[str, deque] = defaultdict(deque)
_hits_lock = threading.Lock()


def _check_rate(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    with _hits_lock:
        q = _hits[ip]
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= RATE_LIMIT:
            raise HTTPException(status_code=429, detail="ใช้งานบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่")
        q.append(now)


@app.get("/api/rag/status")
def rag_status():
    return index.info()


@app.get("/api/search")
def search(request: Request, q: str = Query(..., min_length=1, max_length=300), k: int = Query(8, ge=1, le=20)):
    _check_rate(request)
    try:
        results, mode = index.search(q, k)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"query": q, "mode": mode, "results": results}


class AskBody(BaseModel):
    question: str = Field(..., min_length=2, max_length=500)


@app.post("/api/ask")
def ask(body: AskBody, request: Request):
    _check_rate(request)
    try:
        return index.ask(body.question.strip())
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
