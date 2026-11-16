// Step 2b · LOAD CSV ... MERGE: one node per row of each dimension table,
// one relationship per foreign key. MERGE makes the load idempotent (re-run = no duplicates).
//
// FK in MySQL                         -> Graph
// locations.parent_id -> locations    -> (:Location)-[:PART_OF]->(:Location)        province->region->country
// items.unit_id -> units              -> (:Item)-[:MEASURED_IN]->(:Unit)
// production_stats (location, item)   -> (:Location)-[:HAS_STAT {...}]->(:Item)     fact table (M:N) becomes a relationship with properties
// production_stats.release_id         -> property release_id on HAS_STAT            provenance: trace back to (:Release)
// production_stats.commodity_id       -> property commodity_id on HAS_STAT          only 1 commodity (oil palm)

// ---- dimension nodes ----
LOAD CSV WITH HEADERS FROM 'file:///locations.csv' AS row
MERGE (l:Location {location_id: toInteger(row.location_id)})
SET l.name_th = row.name_th,
    l.name_en = CASE WHEN row.name_en = '' THEN null ELSE row.name_en END,
    l.level   = row.level;

LOAD CSV WITH HEADERS FROM 'file:///commodities.csv' AS row
MERGE (c:Commodity {commodity_id: toInteger(row.commodity_id)})
SET c.commodity_name = row.commodity_name, c.subcom_name = row.subcom_name;

LOAD CSV WITH HEADERS FROM 'file:///units.csv' AS row
MERGE (u:Unit {unit_id: toInteger(row.unit_id)})
SET u.unit_name = row.unit_name;

LOAD CSV WITH HEADERS FROM 'file:///data_releases.csv' AS row
MERGE (r:Release {release_id: toInteger(row.release_id)})
SET r.data_date = date(row.data_date), r.data_date_th = row.data_date_th;

LOAD CSV WITH HEADERS FROM 'file:///items.csv' AS row
MERGE (i:Item {item_id: toInteger(row.item_id)})
SET i.item_name = row.item_name, i.unit_id = toInteger(row.unit_id);

// ---- relationships from foreign keys ----
LOAD CSV WITH HEADERS FROM 'file:///locations.csv' AS row
WITH row WHERE row.parent_id IS NOT NULL AND row.parent_id <> ''
MATCH (child:Location {location_id: toInteger(row.location_id)})
MATCH (parent:Location {location_id: toInteger(row.parent_id)})
MERGE (child)-[:PART_OF]->(parent);

LOAD CSV WITH HEADERS FROM 'file:///items.csv' AS row
MATCH (i:Item {item_id: toInteger(row.item_id)})
MATCH (u:Unit {unit_id: toInteger(row.unit_id)})
MERGE (i)-[:MEASURED_IN]->(u);

// Fact table: 1 row of production_stats = 1 HAS_STAT relationship (stat_id kept for traceability).
LOAD CSV WITH HEADERS FROM 'file:///production_stats.csv' AS row
MATCH (l:Location {location_id: toInteger(row.location_id)})
MATCH (i:Item {item_id: toInteger(row.item_id)})
MERGE (l)-[s:HAS_STAT {stat_id: toInteger(row.stat_id)}]->(i)
SET s.year         = toInteger(row.year),
    s.crop_year    = toInteger(row.crop_year),
    s.value        = toFloat(row.value),
    s.commodity_id = toInteger(row.commodity_id),
    s.release_id   = toInteger(row.release_id);
