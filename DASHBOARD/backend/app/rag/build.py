"""Rebuild the retrieval index (re-embeds every chunk with Gemini).

    docker compose exec api python -m app.rag.build           # reuse cached vectors if data unchanged
    docker compose exec api python -m app.rag.build --force   # always re-embed
    docker compose exec api python -m app.rag.build --dump /srv/data/chunks.jsonl
"""
from __future__ import annotations

import argparse
import json
import logging

from .index import dump_chunks, index

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    p = argparse.ArgumentParser()
    p.add_argument("--force", action="store_true", help="ignore the cached vectors")
    p.add_argument("--dump", metavar="PATH", help="also write every chunk as JSON lines")
    args = p.parse_args()
    index.build(force=args.force)
    print(json.dumps(index.info(), ensure_ascii=False, indent=2))
    if args.dump:
        dump_chunks(args.dump)
        print(f"chunks written to {args.dump}")
