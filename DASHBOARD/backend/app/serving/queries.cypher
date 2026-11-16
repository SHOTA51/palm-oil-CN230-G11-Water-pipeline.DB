// Step 4 · Semantic search + multi-hop query (Section 6.x Serving Layer).
// Used as-is by the API (app/serving/graph.py) and by SERVING_LAYER/serving.py.
// $queryVector = embedding of the user's question from the SAME model as the stored texts
// (Gemini gemini-embedding-001, task RETRIEVAL_QUERY, 768 dims, normalized). $k = how many nodes.
// In Neo4j Browser:  :param k => 5   and   :param queryVector => [...]  (python serving.py vector "คำถาม")

// Q-A · Semantic search over locations (top $k by cosine similarity)
CALL db.index.vector.queryNodes('location_desc', $k, $queryVector)
YIELD node, score
RETURN node.location_id AS location_id, node.name_th AS location, node.level AS level,
       round(score, 4) AS score, node.description AS description
ORDER BY score DESC;

// Q-B · Semantic search over items (which measure does the question mean?)
CALL db.index.vector.queryNodes('item_desc', 4, $queryVector)
YIELD node, score
RETURN node.item_id AS item_id, node.item_name AS item, round(score, 4) AS score
ORDER BY score DESC;

// Q-C · Multi-hop: question -> similar locations (vector) + best-matching item (vector)
//       -> HAS_STAT for the latest crop year -> parent region (PART_OF) -> unit -> Release (provenance)
// The index is approximate (HNSW): asking it for k=1 can miss the true best item,
// so fetch all 4 items and keep the highest score.
CALL db.index.vector.queryNodes('item_desc', 4, $queryVector)
YIELD node, score
WITH node AS item ORDER BY score DESC LIMIT 1
CALL db.index.vector.queryNodes('location_desc', $k, $queryVector)
YIELD node AS loc, score
MATCH (loc)-[s:HAS_STAT]->(item)-[:MEASURED_IN]->(u:Unit)
OPTIONAL MATCH (loc)-[:PART_OF]->(parent:Location)
WITH loc, parent, item, u, score, s ORDER BY s.crop_year DESC
WITH loc, parent, item, u, score, collect(s)[0] AS latest
OPTIONAL MATCH (r:Release {release_id: latest.release_id})
RETURN loc.name_th AS location, parent.name_th AS part_of, item.item_name AS item,
       latest.crop_year AS crop_year, latest.value AS value, u.unit_name AS unit,
       latest.stat_id AS stat_id, toString(r.data_date) AS release_date, round(score, 4) AS score
ORDER BY score DESC;
