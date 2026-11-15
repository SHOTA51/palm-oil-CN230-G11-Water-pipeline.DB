"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { AskResponse, RagStatus, SearchHit } from "@/lib/types";

const KIND_TH: Record<SearchHit["kind"], string> = {
  profile: "ภาพรวมพื้นที่",
  series: "ข้อมูลรายปี",
  ranking: "อันดับรายปี",
  schema: "โครงสร้างข้อมูล",
};

const EXAMPLES = [
  "จังหวัดไหนผลิตปาล์มน้ำมันมากที่สุดในปี 2567",
  "ผลผลิตต่อไร่ของภาคใต้เปลี่ยนไปอย่างไรใน 10 ปีที่ผ่านมา",
  "ภาคอีสานปลูกปาล์มน้ำมันกี่ไร่",
  "ตาราง production_stats เก็บข้อมูลอะไร",
];

interface Props {
  /** Jump the dashboard to a hit's location / year. */
  onOpen: (locationId: number | null, year: number | null) => void;
}

export function AskPanel({ onOpen }: Props) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<RagStatus | null>(null);
  const [busy, setBusy] = useState<"search" | "ask" | null>(null);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [mode, setMode] = useState<"semantic" | "keyword" | null>(null);
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lit, setLit] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = () =>
      api
        .ragStatus()
        .then((s) => {
          if (!alive) return;
          setStatus(s);
          if (s.status === "starting" || s.status === "embedding") timer = setTimeout(poll, 5000); // index still building
        })
        .catch(() => alive && (timer = setTimeout(poll, 5000)));
    poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  const run = async (kind: "search" | "ask", text = q) => {
    const question = text.trim();
    if (question.length < 2 || busy) return;
    setQ(question);
    setBusy(kind);
    setError(null);
    setLit(null);
    try {
      if (kind === "search") {
        const r = await api.search(question);
        setHits(r.results);
        setMode(r.mode);
        setAnswer(null);
      } else {
        const r = await api.ask(question);
        setAnswer(r);
        setHits(r.sources);
        setMode(r.mode);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    run("ask");
  };

  const modeLabel =
    status?.status === "starting"
      ? "กำลังสร้างดัชนีค้นหา…"
      : status?.status === "embedding"
        ? "กำลังเตรียมค้นหาเชิงความหมาย (ใช้ค้นหาด้วยคำไปก่อน)…"
        : status?.semantic
        ? `ค้นหาเชิงความหมาย · ${status.embedModel}`
        : "ค้นหาด้วยคำ (ยังไม่ได้เชื่อม Gemini)";

  return (
    <section className="card ask" aria-label="ค้นหาและถามผู้ช่วย AI">
      <header className="card-head ask-head">
        <div>
          <h2>ค้นหาและถามผู้ช่วย AI</h2>
          <p className="muted">ถามเป็นภาษาไทยได้เลย ระบบจะค้นข้อมูลที่เกี่ยวข้องจากฐานข้อมูล แล้วให้ Gemini สรุปคำตอบพร้อมอ้างอิงแหล่งที่มา</p>
        </div>
        <span className={`badge${status && !status.semantic && status.status !== "starting" && status.status !== "embedding" ? " badge-warn" : ""}`} title={status?.error ?? undefined}>
          <span className="badge-dot" aria-hidden />
          {status ? modeLabel : "กำลังตรวจสอบ…"}
        </span>
      </header>

      <form className="ask-form" onSubmit={onSubmit}>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="เช่น จังหวัดไหนผลิตปาล์มน้ำมันมากที่สุดในปี 2567"
          aria-label="คำถามหรือคำค้นหา"
          maxLength={500}
        />
        <button type="button" className="btn btn-ghost" onClick={() => run("search")} disabled={!!busy || q.trim().length < 2}>
          {busy === "search" ? "กำลังค้นหา…" : "ค้นหา"}
        </button>
        <button type="submit" className="btn" disabled={!!busy || q.trim().length < 2}>
          {busy === "ask" ? "กำลังคิด…" : "ถาม AI"}
        </button>
      </form>

      {!hits && !answer && !error && (
        <div className="examples">
          <span className="muted">ลองถาม:</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="chip" onClick={() => run("ask", ex)} disabled={!!busy}>
              {ex}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div aria-live="polite" style={{ opacity: busy ? 0.55 : 1 }}>
        {answer && (
          <div className="answer">
            <p className="eyebrow">คำตอบจากผู้ช่วย AI{answer.model ? ` · ${answer.model}` : ""}</p>
            {answer.answer ? (
              <div className="answer-body">{renderAnswer(answer.answer, setLit)}</div>
            ) : (
              <div className="notice">
                <strong>ยังสร้างคำตอบด้วย Gemini ไม่ได้</strong>
                <p>{answer.error}</p>
                <p className="muted">ด้านล่างคือข้อมูลที่ค้นเจอจากฐานข้อมูล ซึ่งยังใช้งานได้ตามปกติ</p>
              </div>
            )}
          </div>
        )}

        {hits && (
          <div className="hits">
            <p className="eyebrow">
              {answer ? "แหล่งข้อมูลที่ใช้ตอบ" : "ผลการค้นหา"} · {hits.length} รายการ
              {mode === "keyword" ? " · จับคู่ด้วยคำ" : mode === "semantic" ? " · เชิงความหมาย" : ""}
            </p>
            {hits.length === 0 && <p className="empty">ไม่พบข้อมูลที่เกี่ยวข้อง</p>}
            <ol>
              {hits.map((h, i) => (
                <li key={h.id} id={`src-${i + 1}`} className={lit === i + 1 ? "lit" : ""}>
                  <details>
                    <summary>
                      <span className="hit-no">{i + 1}</span>
                      <span className="hit-title">{h.title}</span>
                      <span className="hit-kind">{KIND_TH[h.kind]}</span>
                    </summary>
                    <pre className="hit-text">{h.text}</pre>
                  </details>
                  {(h.location_id || h.kind === "ranking") && (
                    <button type="button" className="link-btn" onClick={() => onOpen(h.location_id, h.kind === "profile" ? null : h.year_to)}>
                      ดูบนแดชบอร์ด
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}

/** Tiny, safe renderer for the model's answer: paragraphs, "-" lists, **bold**, [n] citations. */
function renderAnswer(text: string, onCite: (n: number) => void): ReactNode {
  const inline = (line: string, key: string) =>
    line.split(/(\*\*[^*]+\*\*|\[\d+\])/g).map((part, i) => {
      const k = `${key}-${i}`;
      if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={k}>{part.slice(2, -2)}</strong>;
      const cite = part.match(/^\[(\d+)\]$/);
      if (cite) {
        const n = Number(cite[1]);
        return (
          <a
            key={k}
            href={`#src-${n}`}
            className="cite"
            onClick={() => onCite(n)}
            aria-label={`แหล่งข้อมูลที่ ${n}`}
          >
            {n}
          </a>
        );
      }
      return part;
    });

  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) blocks.push(<ul key={`ul-${blocks.length}`}>{list.map((l, i) => <li key={i}>{inline(l, `li-${blocks.length}-${i}`)}</li>)}</ul>);
    list = [];
  };
  text.split("\n").forEach((raw) => {
    const line = raw.trim();
    const bullet = line.match(/^(?:[-*•]|\d+\.)\s+(.*)$/);
    if (bullet) return void list.push(bullet[1]);
    flush();
    if (!line) return;
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    blocks.push(heading ? <h3 key={`h-${blocks.length}`}>{inline(heading[1], `h${blocks.length}`)}</h3> : <p key={`p-${blocks.length}`}>{inline(line, `p${blocks.length}`)}</p>);
  });
  flush();
  return blocks;
}
