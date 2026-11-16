"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "แดชบอร์ด" },
  { href: "/normalization", label: "ขั้นตอน Normalization" },
  { href: "/serving-layer", label: "กราฟ + Semantic Search" },
] as const;

export function SiteNav() {
  const path = usePathname();
  return (
    <nav className="site-nav" aria-label="เมนูหลัก">
      {LINKS.map((l) => {
        const on = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
