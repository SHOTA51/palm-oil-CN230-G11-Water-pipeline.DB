export type Level = "country" | "region" | "province";

export interface Location {
  location_id: number;
  name_th: string;
  name_en: string | null;
  level: Level;
  parent_id: number | null;
}

export interface Item {
  item_id: number;
  item_name: string;
  unit_name: string;
}

export interface Release {
  release_id: number;
  data_date: string;
  data_date_th: string;
}

export interface Meta {
  commodity: { commodity_id: number; commodity_name: string } | null;
  locations: Location[];
  items: Item[];
  firstYear: number;
  lastYear: number;
  releases: Release[];
  tables: { table_name: string; row_count: number }[];
  sql: string;
}

export interface TrendRow {
  year: number;
  planted: number | null;
  harvested: number | null;
  production: number | null;
  yield: number | null;
  release_th: string | null;
}

export interface RankingRow {
  location_id: number;
  name_th: string;
  region_id: number | null;
  region_th: string | null;
  value: number;
  prev_value: number | null;
  rank_no: number;
  national_share: number | null;
}

export interface RegionRow {
  year: number;
  location_id: number;
  name_th: string;
  value: number;
}

export interface WithSql<T> {
  rows: T[];
  sql: string;
}

export interface SearchHit {
  id: string;
  kind: "profile" | "series" | "ranking" | "schema";
  title: string;
  text: string;
  location_id: number | null;
  year_from: number | null;
  year_to: number | null;
  score: number;
}

export interface SearchResponse {
  query: string;
  mode: "semantic" | "keyword";
  results: SearchHit[];
}

export interface AskResponse {
  answer: string | null;
  error?: string;
  sources: SearchHit[];
  mode: "semantic" | "keyword";
  model: string | null;
}

export interface RagStatus {
  status: "starting" | "embedding" | "semantic" | "keyword" | "error";
  chunks: number;
  semantic: boolean;
  embedModel: string | null;
  chatModel: string | null;
  chatModels?: string[];
  geminiConfigured: boolean;
  error: string | null;
}

/* ---------- Serving Layer (Neo4j graph + vector search) ---------- */
export interface GraphStatus {
  enabled: boolean;
  error: string | null;
  exported_at?: string | null;
  source?: string | null;
  locations?: number;
  stats?: number;
  embedded?: number;
  model?: string | null;
  embedded_at?: string | null;
}

export interface GraphLocationHit {
  location_id: number;
  location: string;
  level: Level;
  score: number;
  description: string;
}

export interface GraphItemHit {
  item_id: number;
  item: string;
  score: number;
}

export interface GraphSearchResponse {
  query: string;
  locations: GraphLocationHit[];
  items: GraphItemHit[];
}

export interface GraphHopRow {
  location: string;
  part_of: string | null;
  item: string;
  crop_year: number;
  value: number | null;
  unit: string;
  stat_id: number;
  release_date: string | null;
  score: number;
}

export interface GraphHopResponse {
  query: string;
  rows: GraphHopRow[];
}
