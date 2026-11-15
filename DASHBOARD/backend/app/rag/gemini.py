"""Minimal Gemini REST client: embeddings + text generation.

Configured from the environment (the key lives in the project's .env, never in code):
  GEMINI_API_KEY       required for semantic search and AI answers
  GEMINI_EMBED_MODEL   default gemini-embedding-001
  GEMINI_CHAT_MODEL    comma-separated, tried in order (a busy or retired model falls through
                       to the next); default gemini-3.6-flash,gemini-3.5-flash,gemini-3.1-flash-lite
  GEMINI_EMBED_DIM     default 768
"""
from __future__ import annotations

import logging
import math
import os
import time
from typing import Callable

import httpx

log = logging.getLogger("gemini")

BASE = "https://generativelanguage.googleapis.com/v1beta"
API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
EMBED_MODEL = os.environ.get("GEMINI_EMBED_MODEL", "gemini-embedding-001").strip()
CHAT_MODELS = [
    m.strip()
    for m in os.environ.get("GEMINI_CHAT_MODEL", "gemini-3.6-flash,gemini-3.5-flash,gemini-3.1-flash-lite").split(",")
    if m.strip()
]
CHAT_MODEL = CHAT_MODELS[0] if CHAT_MODELS else ""
EMBED_DIM = int(os.environ.get("GEMINI_EMBED_DIM", "768"))


class GeminiError(RuntimeError):
    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status


def enabled() -> bool:
    return bool(API_KEY)


def _post(path: str, body: dict, timeout: float = 60.0, retries: int = 4) -> dict:
    if not API_KEY:
        raise GeminiError("ยังไม่ได้ตั้งค่า GEMINI_API_KEY")
    delay = 2.0
    for attempt in range(retries + 1):
        try:
            res = httpx.post(f"{BASE}/{path}", json=body, headers={"x-goog-api-key": API_KEY}, timeout=timeout)
        except httpx.HTTPError as exc:
            if attempt == retries:
                raise GeminiError(f"เชื่อมต่อ Gemini ไม่ได้: {exc}") from exc
            time.sleep(delay)
            delay *= 2
            continue
        if res.status_code == 200:
            return res.json()
        # 429 / 5xx are worth retrying; everything else is a configuration problem.
        if res.status_code in (429, 500, 502, 503, 504) and attempt < retries:
            wait = _retry_delay(res) or delay
            log.info("Gemini HTTP %s, waiting %.0fs (attempt %d/%d)", res.status_code, wait, attempt + 1, retries)
            time.sleep(wait)
            delay = min(delay * 2, 60.0)
            continue
        try:
            msg = res.json().get("error", {}).get("message", res.text)
        except ValueError:
            msg = res.text
        raise GeminiError(f"Gemini HTTP {res.status_code}: {msg[:300]}", res.status_code)
    raise GeminiError("Gemini ไม่ตอบสนอง")


def _retry_delay(res: httpx.Response) -> float | None:
    """Seconds Google asks us to wait (RetryInfo.retryDelay, e.g. "37s"), capped at 90."""
    try:
        for d in res.json().get("error", {}).get("details", []):
            if str(d.get("@type", "")).endswith("RetryInfo") and d.get("retryDelay"):
                return min(90.0, float(str(d["retryDelay"]).rstrip("s")) + 1)
    except (ValueError, AttributeError):
        pass
    return None


def _normalize(v: list[float]) -> list[float]:
    # Truncated (non-3072) Gemini embeddings are not unit length; cosine needs them to be.
    norm = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / norm for x in v]


def embed(
    texts: list[str],
    task: str,
    titles: list[str] | None = None,
    batch: int = 20,
    on_batch: Callable[[int, list[list[float]]], None] | None = None,
) -> list[list[float]]:
    """task: RETRIEVAL_DOCUMENT for chunks, RETRIEVAL_QUERY for questions.

    Small batches + waiting out 429s keeps a big first indexing run inside
    free-tier per-minute limits. `on_batch(start, vectors)` lets the caller
    save progress after every batch.
    """
    out: list[list[float]] = []
    model = f"models/{EMBED_MODEL}"
    many = len(texts) > batch
    for start in range(0, len(texts), batch):
        reqs = []
        for k, text in enumerate(texts[start : start + batch]):
            req = {"model": model, "content": {"parts": [{"text": text}]}, "taskType": task, "outputDimensionality": EMBED_DIM}
            if titles and task == "RETRIEVAL_DOCUMENT":
                req["title"] = titles[start + k]
            reqs.append(req)
        data = _post(f"{model}:batchEmbedContents", {"requests": reqs}, retries=12 if many else 2)
        vecs = [_normalize(e["values"]) for e in data["embeddings"]]
        out.extend(vecs)
        if on_batch:
            on_batch(start, vecs)
        if many:
            log.info("embedded %d/%d", min(start + batch, len(texts)), len(texts))
    return out


def generate(system: str, prompt: str, temperature: float = 0.2) -> tuple[str, str]:
    """Returns (answer, model). Tries each model in CHAT_MODELS until one answers."""
    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": temperature, "maxOutputTokens": 2048},
    }
    errors: list[str] = []
    for model in CHAT_MODELS:
        try:
            # Short timeout, no long retry chain: an overloaded model should hand over quickly.
            data = _post(f"models/{model}:generateContent", body, timeout=40.0, retries=0)
        except GeminiError as exc:
            if exc.status in (400, 401, 403):  # key/billing problem: other models won't help
                raise
            errors.append(f"{model}: {exc}")
            continue
        candidates = data.get("candidates") or []
        if not candidates:
            reason = data.get("promptFeedback", {}).get("blockReason", "ไม่มีคำตอบ")
            raise GeminiError(f"Gemini ไม่ได้ส่งคำตอบกลับ ({reason})")
        parts = candidates[0].get("content", {}).get("parts", [])
        # Thinking models may return thought parts first; keep only the visible answer text.
        text = "".join(p.get("text", "") for p in parts if not p.get("thought"))
        if text.strip():
            return text.strip(), model
        errors.append(f"{model}: คำตอบว่าง (finishReason={candidates[0].get('finishReason')})")
    raise GeminiError("ทุกโมเดลไม่ว่างหรือใช้ไม่ได้ในขณะนี้ กรุณาลองใหม่: " + " | ".join(errors)[:400])
