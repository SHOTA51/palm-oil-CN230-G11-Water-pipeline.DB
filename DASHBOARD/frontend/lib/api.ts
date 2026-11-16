import type {
  AskResponse,
  GraphHopResponse,
  GraphSearchResponse,
  GraphStatus,
  Meta,
  RagStatus,
  RankingRow,
  RegionRow,
  SearchResponse,
  TrendRow,
  WithSql,
} from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

type Params = Record<string, string | number | null | undefined>;

async function request<T>(path: string, params: Params, timeoutMs: number, body?: unknown): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined) qs.set(k, String(v));
  const url = `${API_URL}${path}${qs.size ? `?${qs}` : ""}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      ...(body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
    if (!res.ok) {
      // FastAPI errors carry a Thai `detail` message for the reader.
      const detail = await res.json().then((d) => (typeof d?.detail === "string" ? d.detail : null)).catch(() => null);
      throw new Error(detail ?? `${path} → HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw new Error("หมดเวลารอการตอบกลับ");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

const get = <T,>(path: string, params: Params = {}, timeoutMs = 8000) => request<T>(path, params, timeoutMs);

export const api = {
  meta: () => get<Meta>("/api/meta", {}, 15000),
  trend: (locationId: number) => get<WithSql<TrendRow>>("/api/trend", { location_id: locationId }),
  ranking: (year: number, itemId: number, level: "province" | "region", regionId: number | null) =>
    get<WithSql<RankingRow>>("/api/ranking", { year, item_id: itemId, level, region_id: regionId }),
  regions: (itemId: number) => get<WithSql<RegionRow>>("/api/regions", { item_id: itemId }),
  ragStatus: () => get<RagStatus>("/api/rag/status"),
  search: (q: string, k = 8) => get<SearchResponse>("/api/search", { q, k }, 20000),
  ask: (question: string) => request<AskResponse>("/api/ask", {}, 100000, { question }),
  graphStatus: () => get<GraphStatus>("/api/graph/status", {}, 20000),
  graphSearch: (q: string) => get<GraphSearchResponse>("/api/graph/search", { q }, 30000),
  graphHop: (q: string) => get<GraphHopResponse>("/api/graph/hop", { q }, 30000),
};
