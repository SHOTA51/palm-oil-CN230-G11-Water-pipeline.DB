"""Serving Layer CLI (Section 6.x): MySQL CSV snapshot -> Neo4j graph -> Gemini embeddings -> semantic search.

    python serving.py load              # Step 2: constraints + LOAD CSV ... MERGE
    python serving.py verify            # count check: graph vs. source rows (import/snapshot.json)
    python serving.py embed             # Step 3: description text -> Gemini embedding -> vector indexes
    python serving.py search "คำถาม"     # Step 4: semantic search (locations + items)
    python serving.py hop "คำถาม"        # Step 4: multi-hop (vector -> HAS_STAT -> PART_OF -> Release)
    python serving.py evidence          # run the 3 report questions, save evidence/results.md
    python serving.py vector "คำถาม"     # print :param lines to paste into Neo4j Browser
    python serving.py all               # load + embed + verify

Settings come from the environment, then SERVING_LAYER/.env, then DASHBOARD/.env:
  NEO4J_URI (default bolt://localhost:7687), NEO4J_USER (neo4j), NEO4J_PASSWORD (palmoil-dev),
  GEMINI_API_KEY (required for embed/search), GEMINI_EMBED_MODEL, GEMINI_EMBED_DIM.

Local Neo4j (docker compose here) reads the CSVs with LOAD CSV from ./import.
A cloud instance (Neo4j AuraDB) cannot see local files, so for any non-localhost NEO4J_URI the
same Cypher runs with `LOAD CSV ... AS row` swapped for `UNWIND $rows AS row` (rows read here).
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent / "DASHBOARD" / "backend"
CYPHER = HERE / "cypher"
IMPORT = HERE / "import"
SNAPSHOT = IMPORT / "snapshot.json"


def _load_env_files() -> None:
    for path in (HERE / ".env", HERE.parent / "DASHBOARD" / ".env"):
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            m = re.match(r"\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$", line)
            if m and not line.lstrip().startswith("#"):
                os.environ.setdefault(m.group(1), m.group(2).strip("'\""))


_load_env_files()
os.environ.setdefault("NEO4J_URI", "bolt://localhost:7687")
os.environ.setdefault("NEO4J_PASSWORD", "palmoil-dev")

# The API and this CLI share one module: same queries, same embedding model/dims/task types.
sys.path.insert(0, str(BACKEND))
from app.rag import gemini  # noqa: E402
from app.serving import graph as sg  # noqa: E402

# Team-written context (the PDF allows "คำอธิบายที่ทีมเขียนเพิ่ม"): names alone are too short to embed well.
REGION_EN = {
    "ภาคกลาง": "Central region",
    "ภาคใต้": "Southern region (South)",
    "ภาคเหนือ": "Northern region (North)",
    "ภาคตะวันออกเฉียงเหนือ": "Northeastern region (Isan)",
}
ITEM_GLOSSARY = {
    "เนื้อที่ยืนต้น": "พื้นที่ปลูกปาล์มน้ำมันทั้งหมดที่มีต้นปาล์มยืนต้นอยู่ รวมต้นที่ยังไม่ให้ผล (planted area, total plantation area)",
    "เนื้อที่ให้ผล": "พื้นที่ที่ต้นปาล์มโตพอและเก็บเกี่ยวผลได้แล้ว (harvested area, bearing area)",
    "ผลผลิต": "ปริมาณผลปาล์มน้ำมันที่เก็บเกี่ยวได้ทั้งปี (total production, output quantity, how much palm was produced)",
    "ผลผลิตต่อเนื้อที่ให้ผล": "ผลผลิตเฉลี่ยต่อไร่ ประสิทธิภาพหรือผลิตภาพของสวนปาล์ม (yield per rai, productivity)",
}
PRODUCTION_ITEM = "ผลผลิต"

# The three questions recorded in the report's evidence table.
EVIDENCE = [
    ("Q1", "search", "จังหวัดที่เป็นแหล่งปลูกปาล์มน้ำมันหลักทางภาคใต้",
     "Top provinces by ผลผลิต in the latest crop year, region = ภาคใต้"),
    ("Q2", "search", "How productive are the palm plantations per rai?",
     "item = ผลผลิตต่อเนื้อที่ให้ผล (กิโลกรัมต่อไร่)"),
    ("Q3", "hop", "ผลผลิตปาล์มน้ำมันของจังหวัดแหล่งผลิตหลักในภาคใต้",
     "ผลผลิต (ตัน) of the main southern provinces, latest crop year, with release date"),
]

LOAD_CSV_RE = re.compile(r"LOAD CSV WITH HEADERS FROM 'file:///([\w.-]+)' AS row")


# ---------- helpers ----------

def is_local() -> bool:
    return re.match(r"^(bolt|neo4j)://(localhost|127\.0\.0\.1)(:|$)", os.environ["NEO4J_URI"]) is not None


def read_rows(name: str) -> list[dict]:
    # LOAD CSV turns an empty field into null; do the same so both paths store identical data.
    with open(IMPORT / name, encoding="utf-8", newline="") as f:
        return [{k: (v if v != "" else None) for k, v in r.items()} for r in csv.DictReader(f)]


def run_file(session, name: str, push: bool = False) -> None:
    for stmt in sg.statements(CYPHER / name):
        params = {}
        m = LOAD_CSV_RE.search(stmt)
        if push and m:
            params["rows"] = read_rows(m.group(1))
            stmt = LOAD_CSV_RE.sub("UNWIND $rows AS row", stmt)
        c = session.run(stmt, **params).consume().counters
        print(f"  {stmt.splitlines()[0][:70]:<70} nodes+{c.nodes_created} rels+{c.relationships_created} props={c.properties_set}")


def need_gemini() -> None:
    if not gemini.enabled():
        sys.exit("GEMINI_API_KEY is not set. Put it in DASHBOARD/.env (gitignored) or the environment.")


# ---------- Step 2: load ----------

def cmd_load(_args) -> None:
    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    push = not is_local()
    print(f"Neo4j {os.environ['NEO4J_URI']} · mode: {'UNWIND rows (cloud)' if push else 'LOAD CSV from ./import'}")
    with sg.driver().session() as s:
        print("01_constraints.cypher")
        run_file(s, "01_constraints.cypher")
        print("02_load_csv.cypher")
        run_file(s, "02_load_csv.cypher", push=push)
        # Which RDBMS snapshot this graph was built from (shown by the API and the web page).
        s.run("MERGE (m:Meta {key: 'snapshot'}) SET m.exported_at = $t, m.source = $src",
              t=snap["exported_at"], src=snap["source"]).consume()


def cmd_verify(_args) -> None:
    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    rc = snap["row_counts"]
    with_parent = sum(1 for r in read_rows("locations.csv") if r["parent_id"])
    checks = [
        ("(:Location)", rc["locations"], "MATCH (n:Location) RETURN count(n)"),
        ("(:Commodity)", rc["commodities"], "MATCH (n:Commodity) RETURN count(n)"),
        ("(:Unit)", rc["units"], "MATCH (n:Unit) RETURN count(n)"),
        ("(:Item)", rc["items"], "MATCH (n:Item) RETURN count(n)"),
        ("(:Release)", rc["data_releases"], "MATCH (n:Release) RETURN count(n)"),
        ("[:PART_OF]", with_parent, "MATCH ()-[r:PART_OF]->() RETURN count(r)"),
        ("[:MEASURED_IN]", rc["items"], "MATCH ()-[r:MEASURED_IN]->() RETURN count(r)"),
        ("[:HAS_STAT]", rc["production_stats"], "MATCH ()-[r:HAS_STAT]->() RETURN count(r)"),
    ]
    ok = True
    print(f"Snapshot {snap['exported_at']} from {snap['source']}")
    print(f"  {'element':<16}{'source rows':>12}{'graph':>10}  status")
    with sg.driver().session() as s:
        for name, expected, cypher in checks:
            got = s.run(cypher).single()[0]
            ok &= got == expected
            print(f"  {name:<16}{expected:>12}{got:>10}  {'OK' if got == expected else 'MISMATCH'}")
        orphans = s.run(
            "MATCH ()-[s:HAS_STAT]->() WHERE NOT EXISTS { MATCH (r:Release {release_id: s.release_id}) } "
            "RETURN count(s)").single()[0]
        emb = s.run("MATCH (n) WHERE n.embedding IS NOT NULL RETURN labels(n)[0] AS l, count(n) AS c").data()
    print(f"  HAS_STAT whose release_id has no (:Release): {orphans}")
    print("  nodes with embedding: " + (", ".join("%s=%s" % (e["l"], e["c"]) for e in emb) or "none (run embed)"))
    print("ALL COUNTS MATCH" if ok else "COUNT MISMATCH - check the load")


# ---------- Step 3: embed ----------

def describe_locations(session) -> list[tuple[int, str, str]]:
    """One descriptive sentence per Location, built from the graph itself (so it is rebuildable)."""
    year = session.run(
        "MATCH ()-[s:HAS_STAT]->(:Item {item_name: $item}) RETURN max(s.crop_year)", item=PRODUCTION_ITEM
    ).single()[0]
    rows = session.run(
        """
        MATCH (l:Location)
        OPTIONAL MATCH (l)-[:PART_OF]->(p:Location)
        OPTIONAL MATCH (l)-[s:HAS_STAT {crop_year: $year}]->(:Item {item_name: $item})
        OPTIONAL MATCH (child:Location)-[:PART_OF]->(l)
        RETURN l.location_id AS id, l.name_th AS name, l.name_en AS name_en, l.level AS level,
               p.name_th AS parent, coalesce(s.value, 0) AS prod, count(child) AS children
        """, year=year, item=PRODUCTION_ITEM).data()

    provinces = sorted((r for r in rows if r["level"] == "province"), key=lambda r: -r["prod"])
    rank = {r["id"]: i + 1 for i, r in enumerate(provinces)}
    national = next((r["prod"] for r in rows if r["level"] == "country"), 0) or 1
    top_by_region: dict[str, list[str]] = {}
    for r in provinces:
        top_by_region.setdefault(r["parent"], []).append(r["name"])

    out = []
    for r in rows:
        en = f" ({r['name_en']})" if r["name_en"] else ""
        if r["level"] == "province":
            k = rank[r["id"]]
            if k <= 5:
                tier = "แหล่งปลูกปาล์มน้ำมันหลักของประเทศ ผลผลิตสูงมาก"
            elif k <= 15:
                tier = "แหล่งปลูกปาล์มน้ำมันสำคัญ ผลผลิตปานกลางถึงสูง"
            elif r["prod"] > 0:
                tier = "ปลูกปาล์มน้ำมันน้อย ผลผลิตต่ำ"
            else:
                tier = "แทบไม่มีการปลูกปาล์มน้ำมัน"
            text = (f"จังหวัด{r['name']}{en} อยู่ใน{r['parent']} {REGION_EN.get(r['parent'], '')} ประเทศไทย. "
                    f"{tier}. ผลผลิตปาล์มน้ำมันปี {year} อันดับ {k} จาก {len(provinces)} จังหวัด")
        elif r["level"] == "region":
            share = 100 * r["prod"] / national
            top = ", ".join(top_by_region.get(r["name"], [])[:3])
            text = (f"{r['name']}{en} {REGION_EN.get(r['name'], '')} ภูมิภาคหนึ่งของประเทศไทย มี {r['children']} จังหวัด. "
                    f"ผลผลิตปาล์มน้ำมันปี {year} คิดเป็น {share:.1f}% ของประเทศ. จังหวัดที่ผลิตมาก: {top}")
        else:
            text = f"{r['name']}{en} ภาพรวมทั้งประเทศ (Thailand, whole country) รวมทุกภาคและทุกจังหวัด"
        out.append((r["id"], r["name"], text))
    return out


def describe_items(session) -> list[tuple[int, str, str]]:
    rows = session.run(
        "MATCH (i:Item)-[:MEASURED_IN]->(u:Unit) RETURN i.item_id AS id, i.item_name AS name, u.unit_name AS unit"
    ).data()
    return [(r["id"], r["name"], f"{r['name']} หน่วย {r['unit']}: {ITEM_GLOSSARY.get(r['name'], '')}") for r in rows]


def cmd_embed(_args) -> None:
    need_gemini()
    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    model = f"{gemini.EMBED_MODEL} ({gemini.EMBED_DIM} dims)"
    with sg.driver().session() as s:
        for label, key, docs in (
            ("Location", "location_id", describe_locations(s)),
            ("Item", "item_id", describe_items(s)),
        ):
            vecs = sg.embed_documents([t for _, _, t in docs], titles=[n for _, n, _ in docs])
            s.run(
                f"""UNWIND $rows AS row
                MATCH (n:{label} {{{key}: row.id}})
                SET n.description = row.text, n.embedding = row.vec,
                    n.embedding_model = $model, n.embedded_at = $stamp""",
                rows=[{"id": i, "text": t, "vec": v} for (i, _, t), v in zip(docs, vecs)],
                model=model, stamp=stamp,
            ).consume()
            print(f"  embedded {len(docs)} {label} nodes, e.g. {docs[0][2][:90]}...")
        # A vector index's dimensions can't change; recreate it if the model/dims changed.
        for idx in s.run("SHOW VECTOR INDEXES YIELD name, options RETURN name, options").data():
            dims = idx["options"]["indexConfig"].get("vector.dimensions")
            if dims != gemini.EMBED_DIM:
                print(f"  dropping {idx['name']} ({dims} dims) -> rebuilt with {gemini.EMBED_DIM}")
                s.run(f"DROP INDEX {idx['name']}").consume()
        print("03_vector_index.cypher")
        for stmt in sg.statements(CYPHER / "03_vector_index.cypher"):
            s.run(stmt.replace("$dims", str(gemini.EMBED_DIM))).consume()
            print(f"  {stmt.splitlines()[0]}")
        s.run("CALL db.awaitIndexes(300)").consume()
    print(f"model={model} similarity=cosine embedded_at={stamp}")


# ---------- Step 4: search ----------

def _table(rows: list[dict], cols: list[str]) -> str:
    head = "| " + " | ".join(cols) + " |\n|" + "---|" * len(cols) + "\n"
    return head + "".join("| " + " | ".join(str(r.get(c, "")) for c in cols) + " |\n" for r in rows)


HOP_COLS = ["location", "part_of", "item", "crop_year", "value", "unit", "stat_id", "release_date", "score"]


def cmd_search(args) -> None:
    need_gemini()
    r = sg.search(args.question)
    print(f"Q: {args.question}\n\nLocations (vector index location_desc):")
    print(_table(r["locations"], ["location", "level", "score"]))
    print("Items (vector index item_desc):")
    print(_table(r["items"], ["item", "score"]))


def cmd_hop(args) -> None:
    need_gemini()
    print(f"Q: {args.question}\n")
    print(_table(sg.hop(args.question), HOP_COLS))


def cmd_vector(args) -> None:
    need_gemini()
    print(":param k => 5")
    print(f":param queryVector => {json.dumps(sg.embed_query(args.question))}")


def south_top5() -> list[tuple[str, float]]:
    """Ground truth from the RDBMS snapshot, same as the SQL in README:
    southern provinces ordered by ผลผลิต in the latest crop year."""
    locs = {r["location_id"]: r for r in read_rows("locations.csv")}
    south = next(k for k, r in locs.items() if r["name_th"] == "ภาคใต้")
    item = next(r["item_id"] for r in read_rows("items.csv") if r["item_name"] == PRODUCTION_ITEM)
    stats = read_rows("production_stats.csv")
    year = max(int(r["crop_year"]) for r in stats)
    rows = [(locs[r["location_id"]]["name_th"], float(r["value"])) for r in stats
            if r["item_id"] == item and int(r["crop_year"]) == year and locs[r["location_id"]]["parent_id"] == south]
    return sorted(rows, key=lambda x: -x[1])[:5]


def cmd_evidence(_args) -> None:
    need_gemini()
    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    truth = south_top5()
    truth_names = {n for n, _ in truth}
    out = [f"# Serving Layer evidence\n\nRun: {datetime.now().isoformat(timespec='seconds')} · "
           f"RDBMS snapshot: {snap['exported_at']} ({snap['source']}) · "
           f"model: {gemini.EMBED_MODEL} · dims {gemini.EMBED_DIM} · cosine\n\n"
           "Neo4j reports cosine scores scaled to 0..1 as (1 + cosine) / 2.\n\n"
           "Expected top-5 southern provinces by ผลผลิต (SQL in README, from the snapshot): "
           + ", ".join(f"{n} {v:,.0f} ตัน" for n, v in truth) + "\n"]
    for qid, kind, q, expected in EVIDENCE:
        out.append(f"\n## {qid} ({kind}) — {q}\n\nExpected (from RDBMS): {expected}\n\n")
        if kind == "search":
            r = sg.search(q)
            out.append(_table(r["locations"], ["location", "level", "score"]))
            out.append("\n" + _table(r["items"], ["item", "score"]))
            got = [x["location"] for x in r["locations"]]
            top_item = r["items"][0]["item"] if r["items"] else None
        else:
            rows = sg.hop(q)
            out.append(_table(rows, HOP_COLS))
            got = [x["location"] for x in rows]
            top_item = rows[0]["item"] if rows else None
        if qid == "Q2":
            out.append(f"\nCheck: top item = {top_item} → {'match' if top_item == 'ผลผลิตต่อเนื้อที่ให้ผล' else 'no match'}\n")
        else:
            hit = [n for n in got if n in truth_names]
            out.append(f"\nCheck: {len(hit)}/5 of the SQL top-5 found ({', '.join(hit) or '-'}) · item = {top_item}\n")
    path = HERE / "evidence" / "results.md"
    path.parent.mkdir(exist_ok=True)
    path.write_text("".join(out), encoding="utf-8")
    print("".join(out))
    print(f"\nSaved {path}")


def cmd_all(args) -> None:
    cmd_load(args)
    cmd_embed(args)
    cmd_verify(args)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")  # Thai output on Windows consoles
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name, fn in (("load", cmd_load), ("verify", cmd_verify), ("embed", cmd_embed),
                     ("evidence", cmd_evidence), ("all", cmd_all)):
        sub.add_parser(name).set_defaults(fn=fn)
    for name, fn in (("search", cmd_search), ("hop", cmd_hop), ("vector", cmd_vector)):
        p = sub.add_parser(name)
        p.add_argument("question")
        p.set_defaults(fn=fn)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
