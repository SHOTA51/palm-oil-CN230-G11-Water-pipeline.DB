"""Neo4j serving layer for the dashboard retrieval chunks."""
from __future__ import annotations

import logging
import os
from typing import Any

import numpy as np
from neo4j import GraphDatabase
from neo4j.exceptions import Neo4jError

from .rag.documents import Chunk

log = logging.getLogger("neo4j")

URI = os.environ.get("NEO4J_URI", "").strip()
USERNAME = os.environ.get("NEO4J_USERNAME", "neo4j").strip()
PASSWORD = os.environ.get("NEO4J_PASSWORD", "").strip()
DATABASE = os.environ.get("NEO4J_DATABASE", "neo4j").strip()
INDEX_NAME = os.environ.get("NEO4J_VECTOR_INDEX", "search_chunk_embedding").strip()
EMBED_DIM = int(os.environ.get("GEMINI_EMBED_DIM", "768"))

_driver = GraphDatabase.driver(URI, auth=(USERNAME, PASSWORD)) if URI and PASSWORD else None
_ready = False
_last_error: str | None = None


def configured() -> bool:
    return _driver is not None


def _ensure_schema(session: Any) -> None:
    session.run(
        "CREATE CONSTRAINT search_chunk_id IF NOT EXISTS "
        "FOR (n:SearchChunk) REQUIRE n.id IS UNIQUE"
    ).consume()
    session.run(
        f"CREATE VECTOR INDEX `{INDEX_NAME}` IF NOT EXISTS "
        "FOR (n:SearchChunk) ON (n.embedding) "
        f"OPTIONS {{indexConfig: {{`vector.dimensions`: {EMBED_DIM}, "
        "`vector.similarity_function`: 'cosine'}}}}"
    ).consume()


def sync(chunks: list[Chunk], vectors: np.ndarray) -> bool:
    """Replace the serving projection with the current embedded chunks."""
    global _ready, _last_error
    if _driver is None:
        return False
    try:
        with _driver.session(database=DATABASE) as session:
            _ensure_schema(session)
            rows = [
                {
                    "id": chunk.id,
                    "kind": chunk.kind,
                    "title": chunk.title,
                    "text": chunk.text,
                    "location_id": chunk.location_id,
                    "year_from": chunk.year_from,
                    "year_to": chunk.year_to,
                    "embedding": vector.tolist(),
                }
                for chunk, vector in zip(chunks, vectors, strict=True)
            ]
            session.run(
                "UNWIND $rows AS row "
                "MERGE (n:SearchChunk {id: row.id}) "
                "SET n.kind = row.kind, n.title = row.title, n.text = row.text, "
                "n.location_id = row.location_id, n.year_from = row.year_from, "
                "n.year_to = row.year_to, n.embedding = row.embedding",
                rows=rows,
            ).consume()
            session.run(
                "MATCH (n:SearchChunk) WHERE NOT n.id IN $ids DETACH DELETE n",
                ids=[chunk.id for chunk in chunks],
            ).consume()
        _ready = True
        _last_error = None
        log.info("Neo4j serving index ready: %d chunks", len(chunks))
        return True
    except (Neo4jError, OSError, ValueError) as exc:
        _ready = False
        _last_error = str(exc)
        log.warning("Neo4j sync failed; local retrieval remains available: %s", exc)
        return False


def search(vector: np.ndarray, limit: int) -> list[dict]:
    if _driver is None or not _ready:
        return []
    try:
        with _driver.session(database=DATABASE) as session:
            result = session.run(
                f"CALL db.index.vector.queryNodes(`{INDEX_NAME}`, $limit, $vector) "
                "YIELD node, score "
                "RETURN node.id AS id, score",
                limit=limit,
                vector=vector.tolist(),
            )
            return [{"id": record["id"], "score": float(record["score"])} for record in result]
    except (Neo4jError, OSError, ValueError) as exc:
        log.warning("Neo4j vector search failed; local retrieval remains available: %s", exc)
        return []


def info() -> dict[str, object]:
    return {
        "configured": configured(),
        "ready": _ready,
        "index": INDEX_NAME if configured() else None,
        "error": _last_error,
    }
