"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/lib/api";
import { fmt } from "@/lib/format";
import type { GraphHopResponse, GraphSearchResponse, GraphStatus } from "@/lib/types";
import { SiteNav } from "./SiteNav";
import { StepNav } from "./StepNav";

/*
 * Report Section 6.x · Serving Layer. MySQL stays the Source of Truth; Neo4j is a rebuildable copy
 * (SERVING_LAYER/ in the repo). Counts below are what `serving.py verify` printed for the snapshot;
 * search results are always live from the API, never hard-coded.
 */

const STEPS = [
  { id: "s1", no: "1", label: "Export CSV" },
  { id: "s2", no: "2", label: "สร้างกราฟ" },
  { id: "s3", no: "3", label: "Embedding" },
  { id: "s4", no: "4", label: "ค้นหา" },
  { id: "s5", no: "5", label: "ตรวจสอบ" },
];

const FK_MAP: { fk: string; graph: string; note: string }[] = [
  { fk: "locations.parent_id → locations", graph: "(:Location)-[:PART_OF]->(:Location)", note: "ลำดับชั้น จังหวัด → ภาค → ประเทศ" },
  { fk: "items.unit_id → units", graph: "(:Item)-[:MEASURED_IN]->(:Unit)", note: "1:N" },
  {
    fk: "production_stats (location_id, item_id)",
    graph: "(:Location)-[:HAS_STAT {stat_id, year, crop_year, value}]->(:Item)",
    note: "ตารางข้อเท็จจริง (M:N) กลายเป็นความสัมพันธ์ที่มี property",
  },
  { fk: "production_stats.release_id → data_releases", graph: "property release_id บน HAS_STAT", note: "ตรวจย้อนไปที่ (:Release) ได้ (provenance)" },
  { fk: "production_stats.commodity_id → commodities", graph: "property commodity_id บน HAS_STAT", note: "มีสินค้าเดียวคือปาล์มน้ำมัน" },
];

const COUNTS: { what: string; rows: number }[] = [
  { what: "(:Location) ← locations", rows: 81 },
  { what: "(:Commodity) ← commodities", rows: 1 },
  { what: "(:Unit) ← units", rows: 3 },
  { what: "(:Item) ← items", rows: 4 },
  { what: "(:Release) ← data_releases", rows: 9 },
  { what: "[:PART_OF] ← locations.parent_id ที่ไม่ว่าง", rows: 80 },
  { what: "[:MEASURED_IN] ← items.unit_id", rows: 4 },
  { what: "[:HAS_STAT] ← production_stats", rows: 6960 },
];

/** The three questions recorded in the report's evidence table (Q1, Q2 search · Q3 multi-hop). */
const QUESTIONS: { id: string; q: string; hop: boolean; expect: string }[] = [
  { id: "Q1", q: "จังหวัดที่เป็นแหล่งปลูกปาล์มน้ำมันหลักทางภาคใต้", hop: false, expect: "จังหวัดภาคใต้ที่ผลผลิตสูงสุดปีล่าสุด (จาก SQL)" },
  { id: "Q2", q: "How productive are the palm plantations per rai?", hop: false, expect: "ตัววัด ผลผลิตต่อเนื้อที่ให้ผล (กิโลกรัมต่อไร่)" },
  { id: "Q3", q: "ผลผลิตปาล์มน้ำมันของจังหวัดแหล่งผลิตหลักในภาคใต้", hop: true, expect: "ผลผลิต (ตัน) ของจังหวัดหลักภาคใต้ + วันที่เผยแพร่" },
];

const LOAD_CYPHER = `LOAD CSV WITH HEADERS FROM 'file:///production_stats.csv' AS row
MATCH (l:Location {location_id: toInteger(row.location_id)})
MATCH (i:Item {item_id: toInteger(row.item_id)})
MERGE (l)-[s:HAS_STAT {stat_id: toInteger(row.stat_id)}]->(i)
SET s.year = toInteger(row.year), s.crop_year = toInteger(row.crop_year),
    s.value = toFloat(row.value), s.release_id = toInteger(row.release_id);`;

const INDEX_CYPHER = `CREATE VECTOR INDEX location_desc IF NOT EXISTS
FOR (l:Location) ON l.embedding
OPTIONS { indexConfig: {
  \`vector.dimensions\`: 768,
  \`vector.similarity_function\`: 'cosine'
}};`;

const SEARCH_CYPHER = `CALL db.index.vector.queryNodes('location_desc', 5, $queryVector)
YIELD node, score
RETURN node.name_th AS location, node.level AS level, score
ORDER BY score DESC;`;

const HOP_CYPHER = `CALL db.index.vector.queryNodes('item_desc', 4, $queryVector) YIELD node, score
WITH node AS item ORDER BY score DESC LIMIT 1
CALL db.index.vector.queryNodes('location_desc', 5, $queryVector) YIELD node AS loc, score
MATCH (loc)-[s:HAS_STAT]->(item)-[:MEASURED_IN]->(u:Unit)
OPTIONAL MATCH (loc)-[:PART_OF]->(parent:Location)
WITH loc, parent, item, u, score, s ORDER BY s.crop_year DESC
WITH loc, parent, item, u, score, collect(s)[0] AS latest
OPTIONAL MATCH (r:Release {release_id: latest.release_id})
RETURN loc.name_th, parent.name_th, item.item_name, latest.crop_year,
       latest.value, u.unit_name, r.data_date, score
ORDER BY score DESC;`;

const LEVEL_TH = { country: "ประเทศ", region: "ภาค", province: "จังหวัด" } as const;

export function ServingLayer() {
  return (
    <div className="page nf sv">
      <SiteNav />
      <header className="top">
        <div>
          <p className="eyebrow">รายงานบทที่ 6.x · Serving Layer</p>
          <h1>กราฟ + Semantic Search จากฐานข้อมูลของทีม</h1>
          <p className="lede">
            MySQL ยังเป็นแหล่งข้อมูลจริง (Source of Truth) ข้อมูลถูก export เป็น CSV แล้วโหลดเข้า Neo4j เป็นกราฟ ข้อความอธิบายของแต่ละโหนดถูกแปลงเป็นเวกเตอร์ด้วย
            Gemini เพื่อให้ค้นหาด้วย “ความหมาย” ได้ ชั้นนี้สร้างใหม่จาก MySQL ได้ทุกเมื่อ และไม่ใช้ RAG
          </p>
        </div>
      </header>

      <section className="sv-flow" aria-label="เส้นทางข้อมูล">
        <FlowBox title="MySQL (SoT)" sub="6 ตาราง · ACID" />
        <FlowArrow label="export_csv.py" />
        <FlowBox title="CSV snapshot" sub="UTF-8 + snapshot.json" />
        <FlowArrow label="LOAD CSV … MERGE" />
        <FlowBox title="Neo4j" sub="โหนด + ความสัมพันธ์ + vector index" />
        <FlowArrow label="Cypher" />
        <FlowBox title="เว็บ / API" sub="semantic search + หลายทอด" accent />
      </section>

      <StepNav steps={STEPS} />

      <Step id="s1" no="1" title="Export ตารางเป็น CSV" rule="ส่งออกครบทุกคอลัมน์ รวม release_id เพื่อคงที่มาของข้อมูล (provenance)">
        <p>
          สคริปต์ <code>SERVING_LAYER/export_csv.py</code> ดึงทั้ง 6 ตารางจาก MySQL เขียนเป็น CSV แบบ UTF-8 (ไม่มี BOM) และบันทึก <code>snapshot.json</code>{" "}
          ที่เก็บเวลา export กับจำนวนแถว ใช้ตรวจนับหลังโหลดและแสดงว่ากราฟสร้างจาก snapshot ไหน
        </p>
        <table className="tbl sv-tbl">
          <thead>
            <tr>
              <th>ตาราง</th>
              <th className="num">แถว</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["locations", 81],
              ["commodities", 1],
              ["units", 3],
              ["items", 4],
              ["data_releases", 9],
              ["production_stats", 6960],
            ].map(([t, n]) => (
              <tr key={t}>
                <td>
                  <code>{t}</code>
                </td>
                <td className="num">{fmt(n as number)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Step>

      <Step id="s2" no="2" title="LOAD CSV … MERGE: คีย์นอกกลายเป็นความสัมพันธ์" rule="1 แถวของตารางมิติ = 1 โหนด · 1 คีย์นอก = 1 ความสัมพันธ์ · MERGE ทำให้รันซ้ำได้ไม่ซ้ำข้อมูล">
        <table className="tbl sv-tbl">
          <thead>
            <tr>
              <th>คีย์นอกใน MySQL</th>
              <th>ในกราฟ</th>
              <th>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {FK_MAP.map((r) => (
              <tr key={r.fk}>
                <td>
                  <code>{r.fk}</code>
                </td>
                <td>
                  <code>{r.graph}</code>
                </td>
                <td>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Code code={LOAD_CYPHER} label="ดู Cypher ที่โหลดตาราง production_stats" />
        <div className="sv-figs">
          <Figure src="/serving/01_schema.png" alt="โครงสร้างกราฟจาก db.schema.visualization: Location ชี้ HAS_STAT ไป Item, Item ชี้ MEASURED_IN ไป Unit, Location ชี้ PART_OF หาตัวเอง">
            <code>CALL db.schema.visualization()</code> · Release และ Commodity ไม่มีเส้น เพราะเก็บเป็น property บน HAS_STAT
          </Figure>
          <Figure src="/serving/02_south_region.png" alt="14 จังหวัดชี้ PART_OF ไปที่ภาคใต้ และภาคใต้ชี้ PART_OF ไปที่ประเทศไทย">
            ลำดับชั้นของภาคใต้: จังหวัด → ภาคใต้ → ประเทศไทย
          </Figure>
          <Figure src="/serving/03_krabi_stats.png" alt="กระบี่เชื่อม HAS_STAT ปี 2567 ไปที่ 4 ตัววัด แต่ละตัววัดเชื่อม MEASURED_IN ไปที่หน่วย">
            กระบี่ ปี 2567: ค่าบนเส้น HAS_STAT คือค่าจริง เช่น ผลผลิต 3,839,879 ตัน
          </Figure>
        </div>
      </Step>

      <Step id="s3" no="3" title="Embedding + Vector index" rule="แปลงข้อความเป็นเวกเตอร์ด้วยโมเดลเดียวกันทั้งตอนเก็บและตอนค้น แล้วทำ index แบบ cosine">
        <table className="tbl sv-tbl">
          <tbody>
            <tr>
              <th>โหนดที่ embed</th>
              <td>
                <code>Location.description</code> (81 โหนด) และ <code>Item.description</code> (4 โหนด)
              </td>
            </tr>
            <tr>
              <th>โมเดล</th>
              <td>
                Gemini <code>gemini-embedding-001</code> · ข้อความที่เก็บใช้ task <code>RETRIEVAL_DOCUMENT</code> คำถามใช้ <code>RETRIEVAL_QUERY</code>
              </td>
            </tr>
            <tr>
              <th>จำนวนมิติ</th>
              <td>768 (ต้องตรงกับ vector index)</td>
            </tr>
            <tr>
              <th>ความคล้าย</th>
              <td>cosine</td>
            </tr>
          </tbody>
        </table>
        <p>
          <b>ทำไมไม่ embed แค่ชื่อ:</b> ชื่อจังหวัดสั้นเกินไปจนโมเดลแยกความหมายไม่ออก จึงสร้างคำอธิบายจากข้อมูลในกราฟเอง เช่น
        </p>
        <blockquote className="sv-quote">
          จังหวัดกระบี่ อยู่ในภาคใต้ Southern region (South) ประเทศไทย. แหล่งปลูกปาล์มน้ำมันหลักของประเทศ ผลผลิตสูงมาก. ผลผลิตปาล์มน้ำมันปี 2567 อันดับ 2 จาก 76
          จังหวัด
        </blockquote>
        <p className="note">ระดับ “หลัก / สำคัญ / น้อย” คำนวณจากอันดับผลผลิตปีล่าสุด จึงสร้างใหม่ได้ทุกครั้งที่ rebuild ส่วนคำอธิบายตัววัดเป็นข้อความที่ทีมเขียนเพิ่ม</p>
        <Code code={INDEX_CYPHER} label="ดู Cypher ที่สร้าง vector index" />
      </Step>

      <Step id="s4" no="4" title="Semantic search + query หลายทอด" rule="คำถาม → เวกเตอร์ → โหนดที่ใกล้ที่สุด → เดินต่อตามความสัมพันธ์ในกราฟ">
        <LiveSearch />
        <div className="sv-codes">
          <Code code={SEARCH_CYPHER} label="Cypher: ค้นด้วยความหมาย" />
          <Code code={HOP_CYPHER} label="Cypher: หลายทอด (vector → HAS_STAT → PART_OF → Release)" />
        </div>
      </Step>

      <Step id="s5" no="5" title="ตรวจสอบ ความเป็นปัจจุบัน และข้อจำกัด" rule="จำนวนโหนดและความสัมพันธ์ต้องเท่ากับจำนวนแถวต้นทาง">
        <table className="tbl sv-tbl">
          <thead>
            <tr>
              <th>ในกราฟ ← ต้นทาง</th>
              <th className="num">แถวต้นทาง</th>
              <th className="num">ในกราฟ</th>
              <th>ผล</th>
            </tr>
          </thead>
          <tbody>
            {COUNTS.map((c) => (
              <tr key={c.what}>
                <td>
                  <code>{c.what}</code>
                </td>
                <td className="num">{fmt(c.rows)}</td>
                <td className="num">{fmt(c.rows)}</td>
                <td className="sv-ok">ตรงกัน</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="note">
          ผลจาก <code>python serving.py verify</code> · ความสัมพันธ์ HAS_STAT ที่ release_id ไม่มีอยู่ใน (:Release): 0
        </p>
        <ul className="issues">
          <li>
            <strong>MySQL เป็นแหล่งจริงเสมอ</strong> แก้ข้อมูลที่ MySQL เท่านั้น แล้ว rebuild: <code>export_csv.py</code> → <code>serving.py all</code> เมื่อมีข้อมูลเผยแพร่ใหม่
          </li>
          <li>
            <strong>Eventual consistency</strong> ระหว่างยังไม่ rebuild ผลค้นหาอาจล้าหลัง ตรวจได้จากเวลา snapshot ด้านบนช่องค้นหา และ <code>serving.py verify</code>
          </li>
          <li>
            <strong>ข้อจำกัด</strong> ข้อมูลมีแค่ 81 พื้นที่ × 4 ตัววัด · โมเดลไม่เข้าใจตัวเลขมาก/น้อยจริง ๆ (จึงใส่ระดับเป็นคำ) · คะแนนของจังหวัดในภาคเดียวกันใกล้กันมาก
            อันดับจึงไม่ตรงอันดับผลผลิตเสมอ ต้องเทียบกับ SQL ทุกครั้ง
          </li>
        </ul>
      </Step>
    </div>
  );
}

function LiveSearch() {
  const [status, setStatus] = useState<GraphStatus | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<GraphSearchResponse | null>(null);
  const [hop, setHop] = useState<GraphHopResponse | null>(null);

  useEffect(() => {
    api
      .graphStatus()
      .then(setStatus)
      .catch((e) => setStatus({ enabled: false, error: e instanceof Error ? e.message : String(e) }));
  }, []);

  const run = async (text = q) => {
    const question = text.trim();
    if (question.length < 2 || busy) return;
    setQ(question);
    setBusy(true);
    setError(null);
    try {
      // Both views come from the same question: plain vector search and the multi-hop walk.
      const [s, h] = await Promise.all([api.graphSearch(question), api.graphHop(question)]);
      setRes(s);
      setHop(h);
      if (!status?.enabled) api.graphStatus().then(setStatus).catch(() => {}); // e.g. API restarted since load
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    run();
  };

  return (
    <div className="sv-live">
      <div className="ask-head">
        <p className="muted">พิมพ์คำถามภาษาไทยหรืออังกฤษ ระบบแปลงเป็นเวกเตอร์ด้วย Gemini แล้วค้นใน Neo4j</p>
        <span className={`badge${status && !status.enabled ? " badge-warn" : ""}`} title={status?.error ?? undefined}>
          <span className="badge-dot" aria-hidden />
          {!status
            ? "กำลังตรวจสอบ…"
            : status.enabled
              ? `เชื่อม Neo4j แล้ว · ${fmt(status.embedded ?? 0)} โหนดมีเวกเตอร์`
              : "ค้นหาสดยังไม่พร้อม"}
        </span>
      </div>
      {status?.enabled && status.exported_at && (
        <p className="note">
          กราฟสร้างจาก snapshot {fmtTime(status.exported_at)} ({status.source}) · embed เมื่อ {fmtTime(status.embedded_at)} · {status.model}
        </p>
      )}
      {status && !status.enabled && status.error && <p className="note">{status.error}</p>}

      <form className="ask-form" onSubmit={onSubmit}>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="เช่น ภาคอีสานปลูกปาล์มไหม"
          aria-label="คำถามสำหรับค้นหาเชิงความหมาย"
          maxLength={300}
        />
        <button type="submit" className="btn" disabled={busy || q.trim().length < 2}>
          {busy ? "กำลังค้นหา…" : "ค้นหา"}
        </button>
      </form>

      <div className="sv-questions">
        {QUESTIONS.map((x) => (
          <button key={x.id} type="button" className="sv-q" onClick={() => run(x.q)} disabled={busy}>
            <span className="sv-q-id">{x.id}</span>
            <span className="sv-q-text">{x.q}</span>
            <span className="sv-q-expect">คาดหวัง: {x.expect}</span>
          </button>
        ))}
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div aria-live="polite" className="sv-results" style={{ opacity: busy ? 0.55 : 1 }}>
        {res && (
          <>
            <div className="sv-res-col">
              <p className="eyebrow">พื้นที่ที่ใกล้เคียงที่สุด · index location_desc</p>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>พื้นที่</th>
                    <th>ระดับ</th>
                    <th className="num">score</th>
                  </tr>
                </thead>
                <tbody>
                  {res.locations.map((r, i) => (
                    <tr key={r.location_id} title={r.description}>
                      <td>{i + 1}</td>
                      <td>{r.location}</td>
                      <td>{LEVEL_TH[r.level] ?? r.level}</td>
                      <td className="num">{r.score.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="sv-res-col">
              <p className="eyebrow">ตัววัดที่คำถามหมายถึง · index item_desc</p>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>ตัววัด</th>
                    <th className="num">score</th>
                  </tr>
                </thead>
                <tbody>
                  {res.items.map((r, i) => (
                    <tr key={r.item_id}>
                      <td>{i + 1}</td>
                      <td>{r.item}</td>
                      <td className="num">{r.score.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {hop && (
          <div className="sv-res-wide">
            <p className="eyebrow">หลายทอด: พื้นที่ (vector) → HAS_STAT ปีล่าสุด → PART_OF → หน่วย → Release</p>
            {hop.rows.length === 0 ? (
              <p className="empty">ไม่พบเส้นทางในกราฟ</p>
            ) : (
              <div className="rel-scroll">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>พื้นที่</th>
                      <th>อยู่ใน</th>
                      <th>ตัววัด</th>
                      <th className="num">ปี</th>
                      <th className="num">ค่า</th>
                      <th>หน่วย</th>
                      <th className="num">stat_id</th>
                      <th>วันที่เผยแพร่</th>
                      <th className="num">score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hop.rows.map((r) => (
                      <tr key={r.stat_id}>
                        <td>{r.location}</td>
                        <td>{r.part_of ?? "—"}</td>
                        <td>{r.item}</td>
                        <td className="num">{r.crop_year}</td>
                        <td className="num">{r.value === null ? "—" : fmt(r.value)}</td>
                        <td>{r.unit}</td>
                        <td className="num">{r.stat_id}</td>
                        <td>{r.release_date ?? "—"}</td>
                        <td className="num">{r.score.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function fmtTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

function Step({ id, no, title, rule, children }: { id: string; no: string; title: string; rule: string; children: ReactNode }) {
  return (
    <section id={id} className="card nf-step" aria-labelledby={`${id}-t`}>
      <header className="nf-step-head">
        <span className="nf-no" aria-hidden>
          {no}
        </span>
        <div>
          <h2 id={`${id}-t`}>{title}</h2>
          <p className="nf-rule">
            <span>หลัก</span> {rule}
          </p>
        </div>
      </header>
      {children}
    </section>
  );
}

function FlowBox({ title, sub, accent }: { title: string; sub: string; accent?: boolean }) {
  return (
    <div className={`sv-box${accent ? " is-accent" : ""}`}>
      <strong>{title}</strong>
      <span>{sub}</span>
    </div>
  );
}

function FlowArrow({ label }: { label: string }) {
  return (
    <div className="sv-arrow" aria-hidden>
      <span>{label}</span>
    </div>
  );
}

function Figure({ src, alt, children }: { src: string; alt: string; children: ReactNode }) {
  return (
    <figure className="sv-fig">
      {/* eslint-disable-next-line @next/next/no-img-element -- static PNG exported from Neo4j Browser */}
      <img src={src} alt={alt} width={1000} height={785} loading="lazy" />
      <figcaption className="note">{children}</figcaption>
    </figure>
  );
}

function Code({ code, label }: { code: string; label: string }) {
  return (
    <details className="sql">
      <summary>{label}</summary>
      <pre>
        <code>{code}</code>
      </pre>
    </details>
  );
}
