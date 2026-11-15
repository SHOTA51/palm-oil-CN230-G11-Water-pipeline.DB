import { fmt } from "@/lib/format";
import { SOURCE } from "@/lib/source";

const LEVEL_TH = { country: "ประเทศ", region: "ภาค", province: "จังหวัด" } as const;

/** Citation of the OAE open dataset and the three xlsx files the database was built from. */
export function SourceCard({ className = "" }: { className?: string }) {
  return (
    <section className={`card source ${className}`} aria-labelledby="source-title">
      <header className="card-head">
        <h2 id="source-title">แหล่งที่มาของข้อมูล</h2>
        <p className="muted">ฐานข้อมูลทั้งหมดสร้างจากชุดข้อมูลเปิดของสำนักงานเศรษฐกิจการเกษตร 3 ไฟล์ด้านล่าง</p>
      </header>

      <div className="source-grid">
        <dl className="source-meta">
          <div>
            <dt>ชุดข้อมูล</dt>
            <dd>
              <a href={SOURCE.url} target="_blank" rel="noreferrer">
                {SOURCE.title}
              </a>{" "}
              <span className="muted">({SOURCE.code})</span>
            </dd>
          </div>
          <div>
            <dt>ผู้เผยแพร่</dt>
            <dd>{SOURCE.publisher}</dd>
          </div>
          <div>
            <dt>ช่วงข้อมูล</dt>
            <dd>
              {SOURCE.years} · ปรับปรุง{SOURCE.frequency}
            </dd>
          </div>
          <div>
            <dt>ประเภท</dt>
            <dd>{SOURCE.kind}</dd>
          </div>
          <div>
            <dt>สัญญาอนุญาต</dt>
            <dd>{SOURCE.license}</dd>
          </div>
        </dl>

        <ol className="source-files">
          {SOURCE.files.map((f) => (
            <li key={f.level}>
              <span className="file-tag" aria-hidden>
                XLSX
              </span>
              <div className="file-body">
                <a href={f.pageUrl} target="_blank" rel="noreferrer" className="file-title">
                  {f.title}
                </a>
                <span className="file-meta">
                  <code>{f.fileName}</code> · ระดับ{LEVEL_TH[f.level]} · {fmt(f.rows)} แถว
                </span>
              </div>
              <a href={f.downloadUrl} className="file-dl" aria-label={`ดาวน์โหลด ${f.fileName}`}>
                ดาวน์โหลด
              </a>
            </li>
          ))}
        </ol>
      </div>

      <p className="note">
        ที่มา: {SOURCE.publisher}, ชุดข้อมูล “{SOURCE.title}” ({SOURCE.url}) รวม{" "}
        {fmt(SOURCE.files.reduce((s, f) => s + f.rows, 0))} แถว นำมา normalize เป็นฐานข้อมูล <code>plam-oil</code> ในโปรเจกต์
        palm-oil-CN230-G11
      </p>
    </section>
  );
}
