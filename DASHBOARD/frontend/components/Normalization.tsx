import type { ReactNode } from "react";
import { fmt } from "@/lib/format";
import { SOURCE } from "@/lib/source";
import { SiteNav } from "./SiteNav";
import { SourceCard } from "./SourceCard";
import { StepNav } from "./StepNav";

/*
 * Every number on this page was checked against the three OAE xlsx files
 * (6,960 rows) and against db/csv. Functional dependencies were tested on all
 * rows, and joining the six tables back together rebuilds all 6,960 source rows.
 */

/** Column color = the final table the column ends up in. */
type Group = "loc" | "com" | "item" | "rel" | "fact";
const GROUPS: { g: Group; label: string }[] = [
  { g: "loc", label: "locations" },
  { g: "com", label: "commodities" },
  { g: "item", label: "items / units" },
  { g: "rel", label: "data_releases" },
  { g: "fact", label: "production_stats" },
];

type Col = { name: string; g: Group; pk?: boolean; fk?: string; num?: boolean; flag?: boolean };
type Cell = string | number | null;
type Rel = { name: string; rows: number; cols: Col[]; data: Cell[][]; caption?: string };

const STEPS = [
  { id: "s0", no: "0", label: "ข้อมูลต้นทาง" },
  { id: "s1", no: "1", label: "1NF" },
  { id: "s2", no: "2", label: "2NF" },
  { id: "s3", no: "3", label: "3NF" },
  { id: "s4", no: "4", label: "Schema จริง" },
  { id: "s5", no: "5", label: "ตรวจสอบ" },
];

const PALM = "ปาล์มน้ำมัน";
const R2569 = "7 กรกฎาคม 2569";
const SRT = "สุราษฎร์ธานี";

/* ---------- step 0: raw file ---------- */
const RAW: Rel = {
  name: "oil_palm_production_province.xlsx",
  rows: 6308,
  caption: "ตัวอย่าง 4 แถวจากไฟล์ระดับจังหวัด (สุราษฎร์ธานี ปี 2567) เป็นค่าจริงจากไฟล์",
  cols: [
    { name: "year", g: "fact", num: true },
    { name: "crop_year", g: "fact", num: true },
    { name: "province_name", g: "loc" },
    { name: "commodity", g: "com" },
    { name: "subcom", g: "com" },
    { name: "item", g: "item" },
    { name: "data", g: "fact", num: true },
    { name: "unit", g: "item" },
    { name: "data_date", g: "rel" },
  ],
  data: [
    [2567, 2567, SRT, PALM, PALM, "เนื้อที่ยืนต้น", 1520416, "ไร่", R2569],
    [2567, 2567, SRT, PALM, PALM, "เนื้อที่ให้ผล", 1413336, "ไร่", R2569],
    [2567, 2567, SRT, PALM, PALM, "ผลผลิต", 4541860, "ตัน", R2569],
    [2567, 2567, SRT, PALM, PALM, "ผลผลิตต่อเนื้อที่ให้ผล", 3214, "กิโลกรัมต่อไร่", R2569],
  ],
};

/* ---------- step 1: one table, atomic values, a primary key ---------- */
const NF1: Rel = {
  name: "oil_palm_1nf",
  rows: 6960,
  caption: "รวมทั้ง 3 ไฟล์ไว้ในตารางเดียว มีคอลัมน์ level และคีย์หลัก 4 คอลัมน์",
  cols: [
    { name: "location_name", g: "loc", pk: true, flag: true },
    { name: "level", g: "loc", flag: true },
    { name: "commodity", g: "com", pk: true },
    { name: "subcom", g: "com" },
    { name: "item", g: "item", pk: true },
    { name: "unit", g: "item" },
    { name: "crop_year", g: "fact", pk: true, num: true },
    { name: "year", g: "fact", num: true },
    { name: "data_date", g: "rel" },
    { name: "value", g: "fact", num: true },
  ],
  data: [
    ["ประเทศไทย", "country", PALM, PALM, "ผลผลิต", "ตัน", 2567, 2567, R2569, 18551998],
    ["ภาคใต้", "region", PALM, PALM, "ผลผลิต", "ตัน", 2567, 2567, R2569, 16762740],
    [SRT, "province", PALM, PALM, "ผลผลิต", "ตัน", 2567, 2567, R2569, 4541860],
    [SRT, "province", PALM, PALM, "ผลผลิตต่อเนื้อที่ให้ผล", "กิโลกรัมต่อไร่", 2567, 2567, R2569, 3214],
    [SRT, "province", PALM, PALM, "ผลผลิต", "ตัน", 2566, 2566, "16 ตุลาคม 2568", 4420016],
  ],
};

/* ---------- step 2: remove partial dependencies ---------- */
const NF2: Rel[] = [
  {
    name: "production",
    rows: 6960,
    cols: [
      { name: "location_name", g: "loc", pk: true, fk: "locations" },
      { name: "commodity", g: "com", pk: true, fk: "commodities" },
      { name: "item", g: "item", pk: true, fk: "items" },
      { name: "crop_year", g: "fact", pk: true, fk: "crop_years", num: true },
      { name: "value", g: "fact", num: true },
    ],
    data: [
      ["ประเทศไทย", PALM, "ผลผลิต", 2567, 18551998],
      [SRT, PALM, "ผลผลิต", 2567, 4541860],
      [SRT, PALM, "ผลผลิต", 2566, 4420016],
    ],
  },
  {
    name: "locations",
    rows: 81,
    cols: [
      { name: "location_name", g: "loc", pk: true },
      { name: "level", g: "loc" },
    ],
    data: [
      ["ประเทศไทย", "country"],
      ["ภาคใต้", "region"],
      [SRT, "province"],
    ],
  },
  {
    name: "items",
    rows: 4,
    cols: [
      { name: "item", g: "item", pk: true },
      { name: "unit", g: "item" },
    ],
    data: [
      ["เนื้อที่ยืนต้น", "ไร่"],
      ["เนื้อที่ให้ผล", "ไร่"],
      ["ผลผลิต", "ตัน"],
      ["ผลผลิตต่อเนื้อที่ให้ผล", "กิโลกรัมต่อไร่"],
    ],
  },
  {
    name: "crop_years",
    rows: 43,
    cols: [
      { name: "crop_year", g: "fact", pk: true, num: true },
      { name: "year", g: "fact", num: true },
      { name: "data_date", g: "rel", flag: true },
    ],
    data: [
      [2525, 2525, "23 กันยายน 2552"],
      [2526, 2526, "23 กันยายน 2552"],
      [2550, 2550, "23 กันยายน 2552"],
      [2567, 2567, R2569],
    ],
  },
  {
    name: "commodities",
    rows: 1,
    cols: [
      { name: "commodity", g: "com", pk: true },
      { name: "subcom", g: "com" },
    ],
    data: [[PALM, PALM]],
  },
];

/* ---------- step 3: remove transitive dependencies ---------- */
const NF3: Rel[] = [
  {
    name: "data_releases",
    rows: 9,
    cols: [
      { name: "data_date", g: "rel", pk: true },
      { name: "data_date_th", g: "rel" },
    ],
    data: [
      ["2009-09-23", "23 กันยายน 2552"],
      ["2025-10-16", "16 ตุลาคม 2568"],
      ["2026-07-07", R2569],
    ],
  },
  {
    name: "crop_years",
    rows: 43,
    cols: [
      { name: "crop_year", g: "fact", pk: true, num: true },
      { name: "year", g: "fact", num: true },
      { name: "data_date", g: "rel", fk: "data_releases" },
    ],
    data: [
      [2525, 2525, "2009-09-23"],
      [2550, 2550, "2009-09-23"],
      [2567, 2567, "2026-07-07"],
    ],
  },
  {
    name: "units",
    rows: 3,
    cols: [{ name: "unit_name", g: "item", pk: true }],
    data: [["ไร่"], ["ตัน"], ["กิโลกรัมต่อไร่"]],
  },
  {
    name: "items",
    rows: 4,
    cols: [
      { name: "item", g: "item", pk: true },
      { name: "unit_name", g: "item", fk: "units" },
    ],
    data: [
      ["เนื้อที่ยืนต้น", "ไร่"],
      ["เนื้อที่ให้ผล", "ไร่"],
      ["ผลผลิต", "ตัน"],
    ],
  },
  {
    name: "locations",
    rows: 81,
    cols: [
      { name: "location_name", g: "loc", pk: true },
      { name: "level", g: "loc" },
      { name: "parent_name", g: "loc", fk: "locations", flag: true },
    ],
    data: [
      ["ประเทศไทย", "country", null],
      ["ภาคใต้", "region", "ประเทศไทย"],
      [SRT, "province", "ภาคใต้"],
    ],
  },
];

const DDL = `CREATE TABLE production_stats (
    stat_id      BIGINT AUTO_INCREMENT PRIMARY KEY,
    location_id  INT NOT NULL,       -- FK → locations
    commodity_id INT NOT NULL,       -- FK → commodities
    item_id      INT NOT NULL,       -- FK → items (→ units)
    release_id   INT,                -- FK → data_releases
    year         SMALLINT NOT NULL,
    crop_year    SMALLINT NOT NULL,
    value        DECIMAL(15,2),
    UNIQUE KEY uq_stats (location_id, commodity_id, item_id, crop_year),
    INDEX idx_stats_year_loc (crop_year, location_id),
    INDEX idx_stats_item (item_id)
);`;

const UNION_SQL = `-- รวม 3 ไฟล์เป็นตารางเดียว เปลี่ยนชื่อคอลัมน์พื้นที่ให้ตรงกัน และเติมระดับพื้นที่
SELECT province      AS location_name, 'country'  AS level, commodity, subcom, item, unit,
       crop_year, year, data_date, data AS value FROM wholecountry_xlsx
UNION ALL
SELECT province_name, 'region',   commodity, subcom, item, unit, crop_year, year, data_date, data FROM region_xlsx
UNION ALL
SELECT province_name, 'province', commodity, subcom, item, unit, crop_year, year, data_date, data FROM province_xlsx;
-- คีย์หลัก: (location_name, commodity, item, crop_year) ไม่ซ้ำเลยทั้ง 6,960 แถว`;

const JOIN_SQL = `-- ประกอบไฟล์ต้นทางกลับจาก 6 ตาราง (ระดับจังหวัด; เปลี่ยน level เป็น 'region' / 'country' ได้อีก 2 ไฟล์)
SELECT ps.year, ps.crop_year,
       l.name_th        AS province_name,
       c.commodity_name AS commodity,
       c.subcom_name    AS subcom,
       i.item_name      AS item,
       ps.value         AS data,
       u.unit_name      AS unit,
       r.data_date_th   AS data_date
FROM production_stats ps
JOIN locations     l ON l.location_id  = ps.location_id
JOIN commodities   c ON c.commodity_id = ps.commodity_id
JOIN items         i ON i.item_id      = ps.item_id
JOIN units         u ON u.unit_id      = i.unit_id
LEFT JOIN data_releases r ON r.release_id = ps.release_id
WHERE l.level = 'province';`;

export function Normalization() {
  return (
    <div className="page nf">
      <SiteNav />
      <header className="top">
        <div>
          <p className="eyebrow">ฐานข้อมูล plam-oil · การออกแบบฐานข้อมูล</p>
          <h1>จากไฟล์ Excel 3 ไฟล์ สู่ฐานข้อมูล 6 ตาราง</h1>
          <p className="lede">
            ขั้นตอน normalization ทั้งหมด ตั้งแต่ไฟล์ดิบของ สศก. ผ่าน 1NF, 2NF และ 3NF จนถึง star schema ที่แดชบอร์ดใช้งาน
            ตัวเลขและตัวอย่างทุกแถวในหน้านี้ตรวจสอบกับข้อมูลจริงครบทั้ง {fmt(6960)} แถว
          </p>
        </div>
        <a className="badge" href="#source">
          <span className="badge-dot" aria-hidden />
          ข้อมูลจาก สศก. · {SOURCE.code}
        </a>
      </header>

      <section className="nf-summary" aria-label="สรุปผล">
        <Stat label="ก่อน" value="3 ไฟล์" sub={`${fmt(6960)} แถว × 9 คอลัมน์ ไม่มีคีย์หลัก`} />
        <Stat label="หลัง" value="6 ตาราง" sub="ตารางมิติ 5 + ตารางข้อเท็จจริง 1 เชื่อมด้วยคีย์นอก" />
        <Stat label="ข้อความที่พิมพ์ซ้ำ" value={`${fmt(450396)} → ${fmt(861)}`} sub="ตัวอักษร (ชื่อพื้นที่ สินค้า ตัวชี้วัด หน่วย วันที่)" />
        <Stat label="ประกอบกลับได้" value={`${fmt(6960)} / ${fmt(6960)}`} sub="แถว ไม่มีข้อมูลสูญหาย (lossless)" good />
      </section>

      <StepNav steps={STEPS} />

      <div className="nf-legend" aria-label="คำอธิบายสีคอลัมน์">
        <span className="muted">สีของคอลัมน์ = ตารางสุดท้ายที่คอลัมน์นั้นไปอยู่:</span>
        {GROUPS.map((g) => (
          <span key={g.g} className={`legend-chip g-${g.g}`}>
            <span className="col-dot" aria-hidden />
            <code>{g.label}</code>
          </span>
        ))}
      </div>

      {/* ---------------- 0 ---------------- */}
      <Step id="s0" no="0" title="ข้อมูลต้นทาง: 3 ไฟล์จาก สศก. (ยังไม่ normalize)" rule="ไฟล์ Excel แบบแบน 1 แถว = 1 ค่าสถิติ แยกไฟล์ตามระดับพื้นที่">
        <div className="file-headers">
          {SOURCE.files.map((f) => (
            <div key={f.level} className="file-header">
              <p>
                <code>{f.fileName}</code> <span className="muted">· {fmt(f.rows)} แถว</span>
              </p>
              <div className="col-chips">
                {RAW.cols.map((c) => {
                  const name = c.name === "province_name" ? f.placeColumn : c.name;
                  return (
                    <span key={c.name} className={`col-chip g-${c.g}${name === "province" ? " is-odd" : ""}`}>
                      {name}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <RelTable rel={RAW} />

        <h3 className="nf-h">ปัญหาที่พบในไฟล์ต้นทาง</h3>
        <ol className="issues">
          <li>
            <strong>ไม่มีคีย์หลัก</strong> ไม่มีคอลัมน์ใดระบุแถวได้ด้วยตัวเอง ต้องใช้ พื้นที่ + สินค้า + ตัวชี้วัด + ปี ร่วมกัน
          </li>
          <li>
            <strong>ข้อมูลชุดเดียวแยกเป็น 3 ไฟล์ และชื่อคอลัมน์ไม่ตรงกัน</strong> ไฟล์ระดับประเทศใช้ <code>province</code> อีกสองไฟล์ใช้{" "}
            <code>province_name</code> ทั้งที่คอลัมน์นี้เก็บ “ประเทศไทย” และ “ภาคใต้” ด้วย ไม่ใช่แค่จังหวัด
          </li>
          <li>
            <strong>ระดับพื้นที่ไม่อยู่ในข้อมูล</strong> รู้ได้จากชื่อไฟล์เท่านั้น และไม่มีที่ใดบอกว่าจังหวัดไหนอยู่ภาคไหน
          </li>
          <li>
            <strong>ข้อความซ้ำทุกแถว</strong> คำว่า “ปาล์มน้ำมัน” ซ้ำ {fmt(13920)} ครั้ง (2 คอลัมน์ × {fmt(6960)} แถว) หน่วยและวันที่เผยแพร่ก็ซ้ำทุกแถว
          </li>
        </ol>

        <h3 className="nf-h">ความผิดปกติที่เกิดได้ (Anomalies)</h3>
        <div className="anomalies">
          <Anomaly kind="แก้ไข (Update)">
            ถ้าต้องแก้วันที่เผยแพร่ “23 กันยายน 2552” ต้องแก้ <b>{fmt(1868)} แถว</b> ให้ครบ ถ้าพลาดไปแถวเดียว ข้อมูลจะขัดแย้งกันเอง
          </Anomaly>
          <Anomaly kind="เพิ่ม (Insert)">
            เพิ่มจังหวัดใหม่หรือหน่วยวัดใหม่ไม่ได้ จนกว่าจะมีตัวเลขสถิติของปีนั้น เพราะทุกอย่างต้องอยู่ในแถวสถิติแถวเดียวกัน
          </Anomaly>
          <Anomaly kind="ลบ (Delete)">
            ลบสถิติปี 2567 ทั้ง {fmt(324)} แถว แล้ววันที่เผยแพร่ “{R2569}” จะหายไปจากระบบด้วย เพราะไม่มีที่อื่นเก็บไว้
          </Anomaly>
        </div>
      </Step>

      {/* ---------------- 1 ---------------- */}
      <Step id="s1" no="1" title="First Normal Form (1NF)" rule="ทุกช่องเก็บค่าเดียว (atomic) ไม่มีกลุ่มข้อมูลซ้ำ และทุกแถวระบุได้ด้วยคีย์หลัก">
        <ol className="actions">
          <li>
            <b>รวม 3 ไฟล์เป็นตารางเดียว</b> ด้วย <code>UNION ALL</code> และเปลี่ยนชื่อ <code>province</code> / <code>province_name</code> เป็น{" "}
            <code>location_name</code>
          </li>
          <li>
            <b>เพิ่มคอลัมน์ <code>level</code></b> (country / region / province) ข้อมูลที่เคยซ่อนอยู่ในชื่อไฟล์จึงมาอยู่ในตาราง
          </li>
          <li>
            <b>ตรวจว่าทุกช่องเป็นค่าเดี่ยว</b> <code>value</code> เป็นตัวเลขครบทั้ง {fmt(6960)} แถว ไม่มีค่าว่าง ไม่มีช่องที่รวมหลายค่าไว้ด้วยกัน
          </li>
          <li>
            <b>กำหนดคีย์หลัก</b> <code>(location_name, commodity, item, crop_year)</code> ตรวจแล้วไม่มีชุดค่าใดซ้ำ
          </li>
        </ol>
        <RelTable rel={NF1} />
        <SqlBlock sql={UNION_SQL} />
        <Verdict>
          ผ่าน 1NF แล้ว แต่ข้อความยังซ้ำเท่าเดิม เช่น หน่วย “ตัน” ยังผูกกับตัวชี้วัด “ผลผลิต” ซ้ำทุกแถว ปัญหานี้แก้ในขั้น 2NF
        </Verdict>
      </Step>

      {/* ---------------- 2 ---------------- */}
      <Step
        id="s2"
        no="2"
        title="Second Normal Form (2NF)"
        rule="อยู่ใน 1NF และทุกคอลัมน์ที่ไม่ใช่คีย์ต้องขึ้นกับคีย์หลักทั้งชุด ไม่ใช่แค่บางส่วนของคีย์ (ไม่มี partial dependency)"
      >
        <h3 className="nf-h">Functional dependencies ที่พบ (ทดสอบกับข้อมูลจริงทุกแถว)</h3>
        <ul className="fds">
          <Fd from={[["item", "item"]]} to={[["unit", "item"]]} kind="partial" />
          <Fd from={[["commodity", "com"]]} to={[["subcom", "com"]]} kind="partial" />
          <Fd from={[["location_name", "loc"]]} to={[["level", "loc"]]} kind="partial" />
          <Fd from={[["crop_year", "fact"]]} to={[["year", "fact"], ["data_date", "rel"]]} kind="partial" />
          <Fd
            from={[
              ["location_name", "loc"],
              ["commodity", "com"],
              ["item", "item"],
              ["crop_year", "fact"],
            ]}
            to={[["value", "fact"]]}
            kind="full"
          />
        </ul>
        <p className="note">
          4 แถวบนขึ้นกับคีย์เพียงคอลัมน์เดียว เช่น หน่วยรู้ได้จากตัวชี้วัดอย่างเดียว ไม่ต้องรู้พื้นที่หรือปี มีเพียง <code>value</code> ที่ต้องใช้คีย์ครบ 4 คอลัมน์
        </p>

        <h3 className="nf-h">แยกแต่ละกลุ่มออกเป็นตารางของตัวเอง</h3>
        <div className="rels">
          {NF2.map((r) => (
            <RelTable key={r.name} rel={r} compact />
          ))}
        </div>
        <Verdict>
          ผ่าน 2NF แล้ว แต่ใน <code>crop_years</code> วันที่เผยแพร่ “23 กันยายน 2552” ยังซ้ำ 26 แถว (ปี 2525–2550 เผยแพร่พร้อมกัน) เพราะวันที่เป็นข้อมูลของ
          “รอบการเผยแพร่” ไม่ใช่ของปี
        </Verdict>
      </Step>

      {/* ---------------- 3 ---------------- */}
      <Step
        id="s3"
        no="3"
        title="Third Normal Form (3NF)"
        rule="อยู่ใน 2NF และคอลัมน์ที่ไม่ใช่คีย์ต้องไม่ขึ้นกับคอลัมน์ที่ไม่ใช่คีย์อื่น (ไม่มี transitive dependency)"
      >
        <ul className="fds">
          <Fd from={[["crop_year", "fact"]]} via={["data_date", "rel"]} to={[["data_date_th", "rel"]]} kind="transitive" />
          <Fd from={[["item", "item"]]} to={[["unit_name", "item"]]} kind="entity" />
          <Fd from={[["province", "loc"]]} via={["region", "loc"]} to={[["country", "loc"]]} kind="hierarchy" />
        </ul>
        <ol className="actions">
          <li>
            <b>แยก <code>data_releases</code></b> เมื่อเก็บวันที่ทั้งแบบ <code>DATE</code> และข้อความภาษาไทย จะได้ crop_year → data_date → data_date_th
            ซึ่งเป็นการพึ่งพาแบบถ่ายทอด รอบการเผยแพร่จึงแยกเป็นตาราง 9 แถว (9 รอบ ตั้งแต่ 23 ก.ย. 2552 ถึง 7 ก.ค. 2569)
          </li>
          <li>
            <b>แยก <code>units</code></b> หน่วย “ไร่” ใช้กับ 2 ตัวชี้วัด การแยกหน่วยไม่ใช่ข้อบังคับของ 3NF โดยตรง แต่ทำให้ชื่อหน่วยมีที่เก็บที่เดียว
            พิมพ์ผิดไม่ได้ และเพิ่มหน่วยใหม่ได้ก่อนมีข้อมูล
          </li>
          <li>
            <b>ลำดับชั้นพื้นที่ใน <code>locations</code></b> ไฟล์ต้นทางไม่มีข้อมูลว่าจังหวัดอยู่ภาคไหน ทีมจึงเพิ่มเอง (76 จังหวัด: ภาคกลาง 25 · ภาคตะวันออกเฉียงเหนือ 20
            · ภาคเหนือ 17 · ภาคใต้ 14) โดยชี้ไปที่แถวของภาคในตารางเดียวกัน (self-reference) แทนการพิมพ์ชื่อภาคซ้ำในทุกจังหวัด
          </li>
        </ol>
        <div className="rels">
          {NF3.map((r) => (
            <RelTable key={r.name} rel={r} compact />
          ))}
          <div className="rel-ghost">
            <p>
              <code>production</code> และ <code>commodities</code>
            </p>
            <p className="muted">เหมือนขั้น 2NF ไม่มีการพึ่งพาแบบถ่ายทอด</p>
          </div>
        </div>
        <Verdict>ทุกตารางอยู่ใน 3NF แล้ว คอลัมน์ที่ไม่ใช่คีย์ทุกคอลัมน์ขึ้นกับคีย์หลักของตารางตัวเองโดยตรงเท่านั้น</Verdict>
      </Step>

      {/* ---------------- 4 ---------------- */}
      <Step id="s4" no="4" title="Schema จริงใน MySQL: star schema 6 ตาราง" rule="นำโครงสร้าง 3NF ไปสร้างตารางจริง พร้อมคีย์ตัวเลข ข้อจำกัด และดัชนี">
        <ErDiagram />
        <div className="decisions">
          <Decision title="ใช้คีย์ตัวเลขแทนข้อความ">
            <code>location_id</code>, <code>item_id</code> ฯลฯ เป็น <code>INT AUTO_INCREMENT</code> แทนชื่อภาษาไทย ตารางข้อเท็จจริงเล็กลง join เร็วขึ้น
            และเปลี่ยนชื่อพื้นที่ได้โดยไม่กระทบ {fmt(6960)} แถว
          </Decision>
          <Decision title="คงคีย์ธรรมชาติไว้เป็น UNIQUE">
            <code>uq_stats (location_id, commodity_id, item_id, crop_year)</code> คือคีย์หลักจากขั้น 1NF จึงบันทึกค่าซ้ำของพื้นที่ ตัวชี้วัด และปีเดียวกันไม่ได้
          </Decision>
          <Decision title="รวม crop_years ไว้ในตารางข้อเท็จจริง" tradeoff>
            <code>year</code> และ <code>release_id</code> เก็บในแต่ละแถวของ <code>production_stats</code> เพื่อให้แต่ละค่าชี้ไปที่รอบการเผยแพร่ของตัวเองได้
            เผื่อ สศก. แก้ตัวเลขเฉพาะบางพื้นที่ภายหลัง แต่ในข้อมูลปัจจุบัน crop_year กำหนดรอบการเผยแพร่ได้เสมอ การออกแบบนี้จึงยอมให้ซ้ำซ้อนเล็กน้อยโดยตั้งใจ
          </Decision>
          <Decision title="ชนิดข้อมูล">
            วันที่ภาษาไทยแปลงเป็น <code>DATE</code> และเก็บข้อความเดิมไว้ใน <code>data_date_th</code> ส่วนค่าสถิติใช้ <code>DECIMAL(15,2)</code>
          </Decision>
          <Decision title="ดัชนีสำหรับแดชบอร์ด">
            <code>idx_stats_year_loc (crop_year, location_id)</code> สำหรับกราฟรายปีและการจัดอันดับ <code>idx_stats_item</code> สำหรับกรองตามตัวชี้วัด
          </Decision>
          <Decision title="ฐานข้อมูลอ่านอย่างเดียว">
            แดชบอร์ดใช้ผู้ใช้ <code>dashboard_app</code> ที่มีสิทธิ์ <code>SELECT</code> เท่านั้น
          </Decision>
        </div>
        <SqlBlock sql={DDL} label="ดู CREATE TABLE ของ production_stats" />
      </Step>

      {/* ---------------- 5 ---------------- */}
      <Step id="s5" no="5" title="ตรวจสอบ: ข้อมูลไม่หาย และแก้ไขที่เดียว" rule="การแยกตารางต้องประกอบกลับได้ครบ (lossless join) และต้องลดจุดที่ต้องแก้เมื่อข้อมูลเปลี่ยน">
        <div className="checks">
          <Check value={fmt(172)} label="แถว ระดับประเทศ" />
          <Check value={fmt(480)} label="แถว ระดับภาค" />
          <Check value={fmt(6308)} label="แถว ระดับจังหวัด" />
          <Check value={`${fmt(6960)} / ${fmt(6960)}`} label="แถวตรงกับไฟล์ต้นทาง" strong />
        </div>
        <p className="note">
          Join ทั้ง 6 ตารางกลับเป็น 9 คอลัมน์เดิม ได้ครบทุกแถวของทั้ง 3 ไฟล์ ข้อแตกต่างมีเพียง 59 ค่าที่ไฟล์ต้นทางมีทศนิยม 3 ตำแหน่ง (เช่น 1,659,937.825 ไร่)
          ซึ่งถูกปัดเป็น 2 ตำแหน่งตามชนิด <code>DECIMAL(15,2)</code>
        </p>
        <SqlBlock sql={JOIN_SQL} label="ดูคำสั่ง SQL ที่ใช้ประกอบกลับ" />

        <h3 className="nf-h">ก่อนและหลัง normalize</h3>
        <div className="rel-scroll">
          <table className="tbl compare">
            <thead>
              <tr>
                <th>เมื่อต้องการ…</th>
                <th className="num">ไฟล์ต้นทาง</th>
                <th className="num">หลัง normalize</th>
              </tr>
            </thead>
            <tbody>
              <Cmp what="แก้ชื่อหน่วย “กิโลกรัมต่อไร่”" before={`${fmt(1740)} แถว`} after="1 แถวใน units" />
              <Cmp what="แก้วันที่เผยแพร่ “23 กันยายน 2552”" before={`${fmt(1868)} แถว`} after="1 แถวใน data_releases" />
              <Cmp what="เพิ่มชื่อภาษาอังกฤษของจังหวัด" before="สูงสุด 172 แถวต่อจังหวัด" after="1 แถวใน locations" />
              <Cmp what="เพิ่มจังหวัดใหม่ก่อนมีตัวเลข" before="ทำไม่ได้" after="เพิ่ม 1 แถวใน locations" />
              <Cmp what="หาว่าจังหวัดอยู่ภาคไหน" before="ไม่มีข้อมูล" after="locations.parent_id" />
              <Cmp what="บันทึกค่าซ้ำของพื้นที่-ตัวชี้วัด-ปีเดียวกัน" before="ไม่มีอะไรกันไว้" after="ถูกปฏิเสธด้วย uq_stats" />
            </tbody>
          </table>
        </div>
      </Step>

      <div id="source" className="nf-source">
        <SourceCard />
      </div>

      <footer className="foot">
        ข้อมูล: {SOURCE.publisher} · ชุดข้อมูล “{SOURCE.title}” ·{" "}
        <a href={SOURCE.url} target="_blank" rel="noreferrer">
          catalog.oae.go.th
        </a>
      </footer>
    </div>
  );
}

/* ======================================================================= */

function Stat({ label, value, sub, good }: { label: string; value: string; sub: string; good?: boolean }) {
  return (
    <div className={`kpi nf-stat${good ? " is-good" : ""}`}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      <span className="kpi-delta muted">{sub}</span>
    </div>
  );
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
            <span>กฎ</span> {rule}
          </p>
        </div>
      </header>
      {children}
    </section>
  );
}

function cell(v: Cell, col: Col) {
  if (v === null) return <span className="null">NULL</span>;
  // Years stay as 2567, not 2,567.
  return col.num && typeof v === "number" && !col.name.includes("year") ? fmt(v) : String(v);
}

function RelTable({ rel, compact }: { rel: Rel; compact?: boolean }) {
  const more = rel.rows - rel.data.length;
  return (
    <figure className={`rel${compact ? " compact" : ""}`}>
      <figcaption>
        <code className="rel-name">{rel.name}</code>
        <span className="muted">{fmt(rel.rows)} แถว</span>
      </figcaption>
      <div className="rel-scroll">
        <table className="rel-tbl">
          <thead>
            <tr>
              {rel.cols.map((c) => (
                <th key={c.name} className={`g-${c.g}${c.num ? " num" : ""}${c.flag ? " is-new" : ""}`}>
                  <span className="th-in">
                    <span className="col-dot" aria-hidden />
                    {c.name}
                    {c.pk && (
                      <abbr className="key pk" title="คีย์หลัก (primary key)">
                        PK
                      </abbr>
                    )}
                    {c.fk && (
                      <abbr className="key fk" title={`คีย์นอก (foreign key) → ${c.fk}`}>
                        FK
                      </abbr>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rel.data.map((row, i) => (
              <tr key={i}>
                {row.map((v, j) => (
                  <td key={j} className={rel.cols[j].num ? "num" : ""}>
                    {cell(v, rel.cols[j])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(more > 0 || rel.caption) && (
        <p className="rel-more">
          {more > 0 && <>… อีก {fmt(more)} แถว</>}
          {more > 0 && rel.caption && " · "}
          {rel.caption}
        </p>
      )}
    </figure>
  );
}

type Pair = [string, Group];
const FD_TAG = {
  partial: "ขึ้นกับคีย์บางส่วน",
  full: "ขึ้นกับคีย์ทั้งชุด",
  transitive: "พึ่งพาแบบถ่ายทอด",
  entity: "เป็นสิ่งของตัวเอง",
  hierarchy: "ลำดับชั้น",
} as const;

function Fd({ from, via, to, kind }: { from: Pair[]; via?: Pair; to: Pair[]; kind: keyof typeof FD_TAG }) {
  const chips = (ps: Pair[]) => ps.map(([n, g]) => <span key={n} className={`col-chip g-${g}`}>{n}</span>);
  return (
    <li className={`fd fd-${kind}`}>
      <span className="fd-side">{chips(from)}</span>
      <span className="fd-arrow" aria-label="กำหนด">
        →
      </span>
      {via && (
        <>
          <span className="fd-side">{chips([via])}</span>
          <span className="fd-arrow" aria-label="กำหนด">
            →
          </span>
        </>
      )}
      <span className="fd-side">{chips(to)}</span>
      <span className="fd-tag">{FD_TAG[kind]}</span>
    </li>
  );
}

function Anomaly({ kind, children }: { kind: string; children: ReactNode }) {
  return (
    <div className="anomaly">
      <p className="anomaly-kind">{kind}</p>
      <p>{children}</p>
    </div>
  );
}

function Verdict({ children }: { children: ReactNode }) {
  return <p className="verdict">{children}</p>;
}

function Decision({ title, children, tradeoff }: { title: string; children: ReactNode; tradeoff?: boolean }) {
  return (
    <div className={`decision${tradeoff ? " is-tradeoff" : ""}`}>
      <h3>
        {title}
        {tradeoff && <span className="tag">ข้อแลกเปลี่ยน</span>}
      </h3>
      <p>{children}</p>
    </div>
  );
}

function Check({ value, label, strong }: { value: string; label: string; strong?: boolean }) {
  return (
    <div className={`check${strong ? " is-strong" : ""}`}>
      <span className="check-mark" aria-hidden>
        ✓
      </span>
      <span className="check-value">{value}</span>
      <span className="check-label">{label}</span>
    </div>
  );
}

function Cmp({ what, before, after }: { what: string; before: string; after: string }) {
  return (
    <tr>
      <td>{what}</td>
      <td className="num cmp-before">{before}</td>
      <td className="num cmp-after">{after}</td>
    </tr>
  );
}

function SqlBlock({ sql, label = "ดูคำสั่ง SQL" }: { sql: string; label?: string }) {
  return (
    <details className="sql">
      <summary>{label}</summary>
      <pre>
        <code>{sql}</code>
      </pre>
    </details>
  );
}

/* ---------- ER diagram ---------- */

type ErCol = { n: string; k?: "PK" | "FK" };
type ErTable = { name: string; rows: number; g: Group; x: number; y: number; cols: ErCol[] };

const W = 236;
const HEAD = 34;
const ROW = 22;

const ER: Record<string, ErTable> = {
  locations: {
    name: "locations",
    rows: 81,
    g: "loc",
    x: 40,
    y: 24,
    cols: [{ n: "location_id", k: "PK" }, { n: "name_th" }, { n: "name_en" }, { n: "level" }, { n: "parent_id", k: "FK" }],
  },
  commodities: {
    name: "commodities",
    rows: 1,
    g: "com",
    x: 40,
    y: 248,
    cols: [{ n: "commodity_id", k: "PK" }, { n: "commodity_name" }, { n: "subcom_name" }],
  },
  fact: {
    name: "production_stats",
    rows: 6960,
    g: "fact",
    x: 372,
    y: 104,
    cols: [
      { n: "stat_id", k: "PK" },
      { n: "location_id", k: "FK" },
      { n: "commodity_id", k: "FK" },
      { n: "item_id", k: "FK" },
      { n: "release_id", k: "FK" },
      { n: "year" },
      { n: "crop_year" },
      { n: "value" },
    ],
  },
  items: {
    name: "items",
    rows: 4,
    g: "item",
    x: 704,
    y: 16,
    cols: [{ n: "item_id", k: "PK" }, { n: "item_name" }, { n: "unit_id", k: "FK" }],
  },
  units: {
    name: "units",
    rows: 3,
    g: "item",
    x: 704,
    y: 160,
    cols: [{ n: "unit_id", k: "PK" }, { n: "unit_name" }],
  },
  releases: {
    name: "data_releases",
    rows: 9,
    g: "rel",
    x: 704,
    y: 278,
    cols: [{ n: "release_id", k: "PK" }, { n: "data_date" }, { n: "data_date_th" }],
  },
};

const rowY = (t: ErTable, i: number) => t.y + HEAD + i * ROW + ROW / 2;

/** FK (many side, dot) → PK (one side, bar). */
function link(a: ErTable, ai: number, aSide: "l" | "r", b: ErTable, bi: number, bSide: "l" | "r", bend = 48) {
  const x1 = aSide === "l" ? a.x : a.x + W;
  const x2 = bSide === "l" ? b.x : b.x + W;
  const y1 = rowY(a, ai);
  const y2 = rowY(b, bi);
  const c1 = aSide === "l" ? x1 - bend : x1 + bend;
  const c2 = bSide === "l" ? x2 - bend : x2 + bend;
  return { d: `M${x1} ${y1} C${c1} ${y1} ${c2} ${y2} ${x2} ${y2}`, x1, y1, x2, y2, bSide };
}

function ErDiagram() {
  const { locations, commodities, fact, items, units, releases } = ER;
  const links = [
    link(fact, 1, "l", locations, 0, "r"),
    link(fact, 2, "l", commodities, 0, "r"),
    link(fact, 3, "r", items, 0, "l"),
    link(fact, 4, "r", releases, 0, "l"),
    link(items, 2, "r", units, 0, "r", 30),
    link(locations, 4, "l", locations, 0, "l", 28),
  ];
  return (
    <figure className="er">
      <div className="er-scroll">
        <svg viewBox="0 0 980 396" role="img" aria-labelledby="er-title er-desc">
          <title id="er-title">แผนภาพความสัมพันธ์ของตารางในฐานข้อมูล plam-oil</title>
          <desc id="er-desc">
            ตาราง production_stats อยู่ตรงกลาง มีคีย์นอกชี้ไปที่ locations, commodities, items และ data_releases ตาราง items ชี้ไปที่ units และ locations
            ชี้กลับมาที่ตัวเองผ่าน parent_id
          </desc>
          {links.map((l, i) => (
            <g key={i} className="er-link">
              <path d={l.d} />
              <circle cx={l.x1} cy={l.y1} r={3.5} />
              <line x1={l.x2 + (l.bSide === "l" ? -7 : 7)} x2={l.x2 + (l.bSide === "l" ? -7 : 7)} y1={l.y2 - 6} y2={l.y2 + 6} />
            </g>
          ))}
          {Object.values(ER).map((t) => (
            <g key={t.name} className={`er-table g-${t.g}`}>
              <rect className="er-box" x={t.x} y={t.y} width={W} height={HEAD + t.cols.length * ROW + 6} rx={8} />
              <rect className="er-stripe" x={t.x} y={t.y} width={W} height={4} rx={2} />
              <text className="er-name" x={t.x + 12} y={t.y + 23}>
                {t.name}
              </text>
              <text className="er-rows" x={t.x + W - 12} y={t.y + 23} textAnchor="end">
                {fmt(t.rows)} แถว
              </text>
              <line className="er-sep" x1={t.x} x2={t.x + W} y1={t.y + HEAD - 2} y2={t.y + HEAD - 2} />
              {t.cols.map((c, i) => (
                <g key={c.n}>
                  <text className={`er-col${c.k === "PK" ? " is-pk" : ""}`} x={t.x + 12} y={rowY(t, i) + 4}>
                    {c.n}
                  </text>
                  {c.k && (
                    <text className={`er-key ${c.k === "PK" ? "pk" : "fk"}`} x={t.x + W - 12} y={rowY(t, i) + 4} textAnchor="end">
                      {c.k}
                    </text>
                  )}
                </g>
              ))}
            </g>
          ))}
        </svg>
      </div>
      <figcaption className="note">
        ● ด้าน “หลายแถว” (คีย์นอก) — | ด้าน “หนึ่งแถว” (คีย์หลัก) · ตารางมิติ 5 ตารางล้อมรอบตารางข้อเท็จจริง <code>production_stats</code>
      </figcaption>
    </figure>
  );
}
