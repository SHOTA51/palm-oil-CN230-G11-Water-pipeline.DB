// Step 3 · Vector indexes (Neo4j 5.x syntax, slide W13 p.33).
// $dims = output size of the embedding model: Gemini gemini-embedding-001 with
// outputDimensionality 768 (GEMINI_EMBED_DIM). serving.py substitutes the number before running.
// serving.py writes n.description (the text that was embedded) and n.embedding first.
CREATE VECTOR INDEX location_desc IF NOT EXISTS
FOR (l:Location) ON l.embedding
OPTIONS { indexConfig: {
  `vector.dimensions`: $dims,
  `vector.similarity_function`: 'cosine'
}};

CREATE VECTOR INDEX item_desc IF NOT EXISTS
FOR (i:Item) ON i.embedding
OPTIONS { indexConfig: {
  `vector.dimensions`: $dims,
  `vector.similarity_function`: 'cosine'
}};
