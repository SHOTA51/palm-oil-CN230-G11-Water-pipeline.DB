"""Step 1 · Export the RDBMS tables to CSV (UTF-8, no BOM) for Neo4j LOAD CSV.

Default: read straight from the team's MySQL (the Source of Truth).
    python export_csv.py
    (env: MYSQL_HOST=127.0.0.1 MYSQL_PORT=3306 MYSQL_USER=root MYSQL_PASSWORD=aaa MYSQL_DB=plam-oil)

Fallback when MySQL is not running: copy the CSVs already exported in DATA_SET/export_csv.
    python export_csv.py --from-dir ../DATA_SET/export_csv

Writes ./import/<table>.csv plus ./import/snapshot.json (row counts + time) that
`serving.py verify` uses to check the graph against the source.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "import"

# Every column of every table, including the provenance FK (release_id).
TABLES: dict[str, list[str]] = {
    "locations": ["location_id", "name_th", "name_en", "level", "parent_id"],
    "commodities": ["commodity_id", "commodity_name", "subcom_name"],
    "units": ["unit_id", "unit_name"],
    "items": ["item_id", "item_name", "unit_id"],
    "data_releases": ["release_id", "data_date", "data_date_th"],
    "production_stats": [
        "stat_id", "location_id", "commodity_id", "item_id",
        "release_id", "year", "crop_year", "value",
    ],
}


def _write(table: str, header: list[str], rows) -> int:
    n = 0
    with open(OUT / f"{table}.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        for r in rows:
            w.writerow(["" if v is None else v for v in r])
            n += 1
    return n


def from_mysql() -> dict[str, int]:
    import pymysql

    conn = pymysql.connect(
        host=os.environ.get("MYSQL_HOST", "127.0.0.1"),
        port=int(os.environ.get("MYSQL_PORT", "3306")),
        user=os.environ.get("MYSQL_USER", "root"),
        password=os.environ.get("MYSQL_PASSWORD", "aaa"),
        database=os.environ.get("MYSQL_DB", "plam-oil"),
        charset="utf8mb4",
    )
    counts = {}
    with conn, conn.cursor() as cur:
        for table, cols in TABLES.items():
            cur.execute(f"SELECT {', '.join(cols)} FROM {table} ORDER BY {cols[0]}")
            counts[table] = _write(table, cols, cur.fetchall())
    return counts


def from_dir(src: Path) -> dict[str, int]:
    counts = {}
    for table, cols in TABLES.items():
        # utf-8-sig strips the BOM that Excel/MySQL Workbench exports add.
        with open(src / f"{table}.csv", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            missing = set(cols) - set(reader.fieldnames or [])
            if missing:
                raise SystemExit(f"{table}.csv is missing columns: {sorted(missing)}")
            counts[table] = _write(table, cols, ([r[c] for c in cols] for r in reader))
    return counts


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--from-dir", type=Path, help="copy existing CSV exports instead of querying MySQL")
    args = ap.parse_args()

    OUT.mkdir(exist_ok=True)
    if args.from_dir:
        counts, source = from_dir(args.from_dir), f"csv:{args.from_dir.as_posix()}"
    else:
        counts, source = from_mysql(), "mysql:" + os.environ.get("MYSQL_DB", "plam-oil")

    snapshot = {
        "exported_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": source,
        "row_counts": counts,
    }
    (OUT / "snapshot.json").write_text(json.dumps(snapshot, indent=2, ensure_ascii=False), encoding="utf-8")
    for t, n in counts.items():
        print(f"  {t:<18} {n:>6} rows")
    print(f"Exported to {OUT} ({source})")


if __name__ == "__main__":
    main()
