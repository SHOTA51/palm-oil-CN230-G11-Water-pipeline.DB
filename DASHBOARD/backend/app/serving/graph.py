"""Serving Layer (report Section 6.x): semantic search over the Neo4j graph built from MySQL.

MySQL stays the Source of Truth. SERVING_LAYER/serving.py exports it to CSV, loads the graph,
embeds a description of every Location/Item with Gemini and builds the vector indexes.
This module only reads that graph, so the API keeps working (search returns 503) when Neo4j is off.

Env: NEO4J_URI (e.g. neo4j+s://xxxx.databases.neo4j.io), NEO4J_USER, NEO4J_PASSWORD,
     GEMINI_API_KEY (+ GEMINI_EMBED_MODEL / GEMINI_EMBED_DIM, shared with app.rag).
"""
from __future__ import annotations

import os
import re
import threading
from pathlib import Path

from neo4j import Driver, GraphDatabase

from ..rag import gemini

QUERIES_FILE = Path(__file__).with_name("queries.cypher")


def statements(path: Path) -> list[str]:
    """Split a .cypher file into statements (drop // comment lines, split on ';' at line end)."""
    body = "\n".join(l for l in path.read_text(encoding="utf-8").splitlines() if not l.strip().startswith("//"))
    return [s.strip() for s in re.split(r";\s*(?:\n|$)", body) if s.strip()]


SEARCH_LOCATIONS, SEARCH_ITEMS, MULTI_HOP = statements(QUERIES_FILE)

_driver: Driver | None = None
_lock = threading.Lock()


class GraphUnavailable(RuntimeError):
    """Neo4j or Gemini is not configured / not reachable. Message is Thai, shown to the reader."""


def configured() -> bool:
    return bool(os.environ.get("NEO4J_URI", "").strip())


def driver() -> Driver:
    global _driver
    if not configured():
        raise GraphUnavailable("ยังไม่ได้ตั้งค่า Neo4j (NEO4J_URI) ให้ API นี้")
    with _lock:
        if _driver is None:
            _driver = GraphDatabase.driver(
                os.environ["NEO4J_URI"].strip(),
                auth=(os.environ.get("NEO4J_USER", "neo4j"), os.environ.get("NEO4J_PASSWORD", "")),
                notifications_min_severity="OFF",  # e.g. "name_en does not exist" while that column is empty
                connection_timeout=15,
            )
        return _driver


def embed_query(question: str) -> list[float]:
    if not gemini.enabled():
        raise GraphUnavailable("ยังไม่ได้ตั้งค่า GEMINI_API_KEY จึงแปลงคำถามเป็นเวกเตอร์ไม่ได้")
    try:
        return gemini.embed([question], "RETRIEVAL_QUERY")[0]
    except gemini.GeminiError as exc:
        raise GraphUnavailable(str(exc)) from exc


def embed_documents(texts: list[str], titles: list[str]) -> list[list[float]]:
    return gemini.embed(texts, "RETRIEVAL_DOCUMENT", titles=titles)


def _run(query: str, **params) -> list[dict]:
    try:
        with driver().session() as s:
            return s.run(query, **params).data()
    except GraphUnavailable:
        raise
    except Exception as exc:  # ServiceUnavailable, AuthError, paused Aura instance, missing index...
        raise GraphUnavailable(f"เชื่อมต่อ Neo4j ไม่ได้: {exc}") from exc


def search(question: str, k: int = 5) -> dict:
    vec = embed_query(question)
    return {
        "locations": _run(SEARCH_LOCATIONS, queryVector=vec, k=k),
        "items": _run(SEARCH_ITEMS, queryVector=vec),
    }


def hop(question: str, k: int = 5) -> list[dict]:
    return _run(MULTI_HOP, queryVector=embed_query(question), k=k)


def status() -> dict:
    """What the page shows next to the search box: is it live, and built from which snapshot."""
    if not configured():
        return {"enabled": False, "error": "ยังไม่ได้ตั้งค่า Neo4j"}
    try:
        rows = _run(
            """
            OPTIONAL MATCH (m:Meta {key: 'snapshot'})
            CALL () { MATCH (n:Location) RETURN count(n) AS locations }
            CALL () { MATCH ()-[r:HAS_STAT]->() RETURN count(r) AS stats }
            CALL () { MATCH (n) WHERE n.embedding IS NOT NULL
                      RETURN count(n) AS embedded, max(n.embedding_model) AS model, max(n.embedded_at) AS embedded_at }
            RETURN m.exported_at AS exported_at, m.source AS source, locations, stats, embedded, model, embedded_at
            """
        )
    except GraphUnavailable as exc:
        return {"enabled": False, "error": str(exc)}
    info = rows[0] if rows else {}
    return {"enabled": bool(info.get("embedded")) and gemini.enabled(), "error": None if gemini.enabled() else "ยังไม่ได้ตั้งค่า GEMINI_API_KEY", **info}
