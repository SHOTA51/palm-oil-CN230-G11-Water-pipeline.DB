"use client";

import { useEffect, useState } from "react";

/** Sticky step bar; marks the step whose section is currently in view. */
export function StepNav({ steps }: { steps: { id: string; no: string; label: string }[] }) {
  const [active, setActive] = useState(steps[0]?.id);

  useEffect(() => {
    const els = steps.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [steps]);

  return (
    <nav className="steps" aria-label="ขั้นตอน">
      <ol>
        {steps.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} className={active === s.id ? "on" : ""} aria-current={active === s.id ? "step" : undefined}>
              <span className="step-no">{s.no}</span>
              <span className="step-label">{s.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
