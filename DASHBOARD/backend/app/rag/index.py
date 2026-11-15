"""Hybrid retrieval index + RAG answering.

Retrieval = Gemini embedding cosine similarity (semantic)
          + BM25 over character n-grams (exact names and numbers; Thai has no spaces)
          + small boosts when the question names a location or a year.
If Gemini is unavailable the index still works in keyword-only mode.
Vectors are cached on disk and rebuilt only when the chunk text changes.
"""
from __future__ import annotations

import hashlib
import json
import logging
import math
import os
import re
import threading
from collections import Counter
from pathlib import Path

import numpy as np

from ..db import engine
from . import gemini
from .documents import Chunk, build_chunks

log = logging.getLogger("rag")
INDEX_PATH = Path(os.environ.get("RAG_INDEX_PATH", Path(__file__).resolve().parents[2] / "data" / "rag_index.npz"))

RANK_WORDS = re.compile(r"อันดับ|มากที่สุด|สูงสุด|น้อยที่สุด|ต่ำสุด|ที่สุด|top|เยอะ")
SCHEMA_WORDS = re.compile(r"ตาราง|ฐานข้อมูล|schema|คอลัมน์|database|table|หน่วย|ความหมาย|คืออะไร")
YEAR_RE = re.compile(r"25[0-9]{2}")
# Everyday names that differ from the official ones in `locations`.
ALIASES = {
    "อีสาน": "ภาคตะวันออกเฉียงเหนือ",
    "ภาคอีสาน": "ภาคตะวันออกเฉียงเหนือ",
    "กรุงเทพ": "กรุงเทพมหานคร",
    "กทม": "กรุงเทพมหานคร",
    "อยุธยา": "พระนครศรีอยุธยา",
    "โคราช": "นครราชสีมา",
    "ทั้งประเทศ": "ประเทศไทย",
}

SYSTEM_PROMPT = """คุณคือผู้ช่วยวิเคราะห์ข้อมูลปาล์มน้ำมันของประเทศไทย
- ตอบเป็นภาษาไทยเสมอ กระชับ ตรงคำถาม
- ใช้เฉพาะข้อมูลใน "แหล่งข้อมูล" ที่ให้มาเท่านั้น ห้ามเดาหรือใช้ความรู้ภายนอก
- ทุกตัวเลขที่ยกมาต้องอ้างอิงหมายเลขแหล่งข้อมูลในวงเล็บเหลี่ยม เช่น [1] หรือ [2][3]
- ถ้าแหล่งข้อมูลไม่พอจะตอบ ให้บอกตรง ๆ ว่าไม่พบข้อมูลในฐานข้อมูล
- ใส่หน่วยทุกครั้ง (ไร่, ตัน, กิโลกรัมต่อไร่) และใช้ปี พ.ศ. ตามข้อมูล
- ถ้าต้องคำนวณ (เช่น ร้อยละการเปลี่ยนแปลง) ให้แสดงวิธีคิดสั้น ๆ
- ห้ามบวกรวมข้อมูลระดับประเทศ ภาค และจังหวัดเข้าด้วยกัน"""


def _norm_text(s: str) -> str:
    return re.sub(r"[\s,.:;|()\[\]/\-–]+", "", s.lower())


def _grams(s: str) -> list[str]:
    t = _norm_text(s)
    return [t[i : i + n] for n in (2, 3) for i in range(len(t) - n + 1)]


class Bm25:
    def __init__(self, docs: list[str], k1: float = 1.4, b: float = 0.6):
        self.tfs = [Counter(_grams(d)) for d in docs]
        self.lens = [sum(tf.values()) for tf in self.tfs]
        self.avg = (sum(self.lens) / len(self.lens)) if self.lens else 1.0
        df: Counter = Counter()
        for tf in self.tfs:
            df.update(tf.keys())
        n = len(docs)
        self.idf = {g: math.log(1 + (n - c + 0.5) / (c + 0.5)) for g, c in df.items()}
        self.k1, self.b = k1, b

    def scores(self, q: str) -> np.ndarray:
        qg = Counter(_grams(q))
        out = np.zeros(len(self.tfs))
        for i, tf in enumerate(self.tfs):
            s = 0.0
            denom_base = self.k1 * (1 - self.b + self.b * self.lens[i] / self.avg)
            for g in qg:
                f = tf.get(g)
                if f:
                    s += self.idf[g] * f * (self.k1 + 1) / (f + denom_base)
            out[i] = s
        return out


class RagIndex:
    def __init__(self):
        self.lock = threading.Lock()
        self.chunks: list[Chunk] = []
        self.vectors: np.ndarray | None = None
        self.bm25: Bm25 | None = None
        self.locations: list[tuple[str, int]] = []  # (name, id), longest first
        self.status = "starting"
        self.embedding_error: str | None = None

    # ---------- build ----------
    def build(self, force: bool = False) -> None:
        with engine.connect() as conn:
            chunks = build_chunks(conn)
            locs = conn.exec_driver_sql("SELECT name_th, location_id FROM locations").fetchall()
        bm25 = Bm25([f"{c.title}\n{c.text}" for c in chunks])

        # Keyword search is usable right away; semantic search joins once vectors exist.
        names = [(str(n), int(i)) for n, i in locs]
        # Strip the "ภาค" prefix too so "ภาคใต้" and "ใต้" both match, plus everyday aliases.
        names += [(n.removeprefix("ภาค"), i) for n, i in names if n.startswith("ภาค")]
        by_name = dict(names)
        names += [(alias, by_name[canon]) for alias, canon in ALIASES.items() if canon in by_name]
        with self.lock:
            self.chunks, self.vectors, self.bm25 = chunks, None, bm25
            self.locations = sorted(names, key=lambda t: -len(t[0]))
            self.status = "embedding" if gemini.enabled() else "keyword"
            self.embedding_error = None if gemini.enabled() else "ยังไม่ได้ตั้งค่า GEMINI_API_KEY"

        if not gemini.enabled():
            log.info("rag index ready: %d chunks, mode=keyword (no GEMINI_API_KEY)", len(chunks))
            return

        # Vectors are cached per chunk (keyed by model + text), so changed data only
        # re-embeds the chunks that changed, and an interrupted run resumes.
        keys = [hashlib.sha1(f"{gemini.EMBED_MODEL}|{gemini.EMBED_DIM}|{c.title}|{c.text}".encode()).hexdigest() for c in chunks]
        cache = {} if force else self._load_cache()
        missing = [i for i, k in enumerate(keys) if k not in cache]
        error = None
        if missing:
            log.info("embedding %d of %d chunks with %s", len(missing), len(chunks), gemini.EMBED_MODEL)

            def save_batch(start: int, vecs: list[list[float]]) -> None:
                for offset, v in enumerate(vecs):
                    cache[keys[missing[start + offset]]] = np.asarray(v, dtype=np.float32)
                self._save_cache(cache)

            try:
                gemini.embed(
                    [chunks[i].text for i in missing],
                    "RETRIEVAL_DOCUMENT",
                    titles=[chunks[i].title for i in missing],
                    on_batch=save_batch,
                )
            except gemini.GeminiError as exc:
                error = str(exc)
                log.warning("embedding stopped (%d/%d cached), keyword-only for now: %s", sum(k in cache for k in keys), len(keys), exc)

        vectors = np.stack([cache[k] for k in keys]) if all(k in cache for k in keys) else None
        with self.lock:
            self.vectors = vectors
            self.embedding_error = error
            self.status = "semantic" if vectors is not None else "keyword"
        log.info("rag index ready: %d chunks, mode=%s", len(chunks), self.status)

    def _load_cache(self) -> dict[str, np.ndarray]:
        try:
            data = np.load(INDEX_PATH, allow_pickle=False)
            return {str(k): v for k, v in zip(data["keys"], data["vectors"])}
        except (OSError, KeyError, ValueError):
            return {}

    def _save_cache(self, cache: dict[str, np.ndarray]) -> None:
        try:
            INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
            tmp = INDEX_PATH.with_suffix(".tmp.npz")
            np.savez_compressed(tmp, keys=np.array(list(cache.keys())), vectors=np.stack(list(cache.values())))
            os.replace(tmp, INDEX_PATH)  # atomic: a crash never leaves a half-written cache
        except OSError as exc:
            log.warning("could not cache vectors at %s: %s", INDEX_PATH, exc)

    def build_in_background(self) -> None:
        def run():
            try:
                self.build()
            except Exception as exc:  # noqa: BLE001 - the API must keep serving the dashboard
                log.exception("rag build failed")
                with self.lock:
                    self.status = "error"
                    self.embedding_error = str(exc)

        threading.Thread(target=run, name="rag-build", daemon=True).start()

    # ---------- search ----------
    def info(self) -> dict:
        return {
            "status": self.status,
            "chunks": len(self.chunks),
            "semantic": self.vectors is not None,
            "embedModel": gemini.EMBED_MODEL if self.vectors is not None else None,
            "chatModel": gemini.CHAT_MODEL if gemini.enabled() else None,
            "chatModels": gemini.CHAT_MODELS if gemini.enabled() else [],
            "geminiConfigured": gemini.enabled(),
            "error": self.embedding_error,
        }

    def search(self, q: str, k: int = 8) -> tuple[list[dict], str]:
        with self.lock:
            chunks, vectors, bm25, locations = self.chunks, self.vectors, self.bm25, self.locations
        if not chunks or bm25 is None:
            raise RuntimeError("ดัชนีค้นหายังไม่พร้อม กรุณารอสักครู่")

        lex = bm25.scores(q)
        lex = lex / lex.max() if lex.max() > 0 else lex
        mode = "keyword"
        score = lex.copy()
        if vectors is not None:
            try:
                qv = np.asarray(gemini.embed([q], "RETRIEVAL_QUERY")[0], dtype=np.float32)
                cos = vectors @ qv
                lo, hi = float(cos.min()), float(cos.max())
                sem = (cos - lo) / (hi - lo) if hi > lo else cos
                score = 0.65 * sem + 0.35 * lex
                mode = "semantic"
            except gemini.GeminiError as exc:
                log.warning("query embedding failed, keyword fallback: %s", exc)

        # Entity boosts: named location, named year, ranking/schema intent.
        qn = q.replace(" ", "")
        named: set[int] = set()
        rest = qn
        for name, lid in locations:
            if name and name in rest:
                named.add(lid)
                rest = rest.replace(name, " ")
        years = {int(y) for y in YEAR_RE.findall(q)}
        rank_intent = bool(RANK_WORDS.search(q))
        schema_intent = bool(SCHEMA_WORDS.search(q))
        for i, c in enumerate(chunks):
            b = 0.0
            if named and c.location_id in named:
                b += 0.5
            if years and c.year_from is not None and any(c.year_from <= y <= (c.year_to or c.year_from) for y in years):
                b += 0.2 if c.kind != "profile" else 0.05
            if rank_intent and c.kind == "ranking":
                b += 0.2
            if schema_intent and c.kind == "schema":
                b += 0.3
            score[i] += b

        top = np.argsort(-score)[:k]
        return [{**chunks[i].to_dict(), "score": round(float(score[i]), 4)} for i in top if score[i] > 0], mode

    def ask(self, question: str, k: int = 8) -> dict:
        sources, mode = self.search(question, k)
        if not sources:
            return {"answer": "ไม่พบข้อมูลที่เกี่ยวข้องในฐานข้อมูล", "sources": [], "mode": mode, "model": None}
        context = "\n\n".join(f"[{n}] {s['title']}\n{s['text']}" for n, s in enumerate(sources, 1))
        prompt = f"แหล่งข้อมูล:\n{context}\n\nคำถาม: {question}"
        try:
            answer, model = gemini.generate(SYSTEM_PROMPT, prompt)
            return {"answer": answer, "sources": sources, "mode": mode, "model": model}
        except gemini.GeminiError as exc:
            return {"answer": None, "error": str(exc), "sources": sources, "mode": mode, "model": None}


index = RagIndex()


def dump_chunks(path: str) -> None:
    """Debug helper: write every chunk as JSON lines."""
    with open(path, "w", encoding="utf-8") as fh:
        for c in index.chunks:
            fh.write(json.dumps(c.to_dict(), ensure_ascii=False) + "\n")
