// Step 2a · Uniqueness constraints = the primary keys of the RDBMS tables.
// They also create the index that makes MERGE/MATCH on the id fast.
CREATE CONSTRAINT location_id IF NOT EXISTS FOR (n:Location) REQUIRE n.location_id IS UNIQUE;
CREATE CONSTRAINT commodity_id IF NOT EXISTS FOR (n:Commodity) REQUIRE n.commodity_id IS UNIQUE;
CREATE CONSTRAINT unit_id IF NOT EXISTS FOR (n:Unit) REQUIRE n.unit_id IS UNIQUE;
CREATE CONSTRAINT item_id IF NOT EXISTS FOR (n:Item) REQUIRE n.item_id IS UNIQUE;
CREATE CONSTRAINT release_id IF NOT EXISTS FOR (n:Release) REQUIRE n.release_id IS UNIQUE;
