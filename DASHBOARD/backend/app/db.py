"""Database engine + JSON helpers."""
from __future__ import annotations

import datetime as dt
import decimal
import os

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Connection, Engine


def _database_url() -> str:
    url = os.environ.get(
        "DATABASE_URL",
        "mysql+pymysql://dashboard_app:dashboard_app_pw@localhost:3307/plam-oil",
    )
    # Hosted providers (Railway, Aiven, ...) hand out plain mysql:// URLs.
    if url.startswith("mysql://"):
        url = "mysql+pymysql://" + url[len("mysql://") :]
    if "charset=" not in url:
        url += ("&" if "?" in url else "?") + "charset=utf8mb4"  # Thai text
    return url


engine: Engine = create_engine(
    _database_url(),
    pool_pre_ping=True,  # survive hosted MySQL idle disconnects
    pool_recycle=280,
    pool_size=5,
    max_overflow=5,
)


def to_json(value):
    if isinstance(value, decimal.Decimal):
        return float(value)
    if isinstance(value, (dt.date, dt.datetime, dt.time)):
        return value.isoformat()
    if isinstance(value, bytes):
        return value.decode("utf-8", "replace")
    return value


def query(conn: Connection, sql: str, **params) -> list[dict]:
    result = conn.execute(text(sql), params)
    cols = list(result.keys())
    return [{c: to_json(v) for c, v in zip(cols, row)} for row in result]


def tidy(sql: str) -> str:
    """The SQL as shown to the reader: dedented, no blank edges."""
    lines = sql.strip("\n").splitlines()
    pad = min((len(l) - len(l.lstrip()) for l in lines if l.strip()), default=0)
    return "\n".join(l[pad:] for l in lines).strip()
