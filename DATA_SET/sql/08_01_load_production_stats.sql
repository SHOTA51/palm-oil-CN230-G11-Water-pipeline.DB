-- =========================================================
-- 08_01_load_production_stats.sql
-- Oil Palm Production Dashboard | MySQL 8.4
-- Load fact rows from all three staging tables.
-- Expected source rows: 6,960 (Province 6,308 + Region 480 + Country 172)
-- Run after Step 7 dimensions have been loaded and checked.
-- =========================================================

USE `plam-oil`;

-- Build a unified source set while retaining its geographic level.
DROP TEMPORARY TABLE IF EXISTS tmp_production_source;
CREATE TEMPORARY TABLE tmp_production_source AS
SELECT
    'province' AS location_level,
    TRIM(year_raw) AS year_raw,
    TRIM(crop_year_raw) AS crop_year_raw,
    TRIM(location_name) AS location_name,
    TRIM(commodity) AS commodity_name,
    TRIM(subcom) AS subcom_name,
    TRIM(item_name) AS item_name,
    TRIM(data_raw) AS data_raw,
    TRIM(unit_name) AS unit_name,
    TRIM(REPLACE(data_date_raw, CHAR(13), '')) AS data_date_th
FROM stg_province

UNION ALL

SELECT
    'region',
    TRIM(year_raw),
    TRIM(crop_year_raw),
    TRIM(location_name),
    TRIM(commodity),
    TRIM(subcom),
    TRIM(item_name),
    TRIM(data_raw),
    TRIM(unit_name),
    TRIM(REPLACE(data_date_raw, CHAR(13), ''))
FROM stg_region

UNION ALL

SELECT
    'country',
    TRIM(year_raw),
    TRIM(crop_year_raw),
    TRIM(location_name),
    TRIM(commodity),
    TRIM(subcom),
    TRIM(item_name),
    TRIM(data_raw),
    TRIM(unit_name),
    TRIM(REPLACE(data_date_raw, CHAR(13), ''))
FROM stg_country;

-- Preflight: expected to show 6,960 source rows.
SELECT COUNT(*) AS source_rows
FROM tmp_production_source;

-- Preflight: must return 0 for every missing dimension match.
SELECT
    COUNT(*) AS rows_missing_dimension_match
FROM tmp_production_source AS s
LEFT JOIN locations AS l
  ON l.name_th = s.location_name
 AND l.level = s.location_level
LEFT JOIN commodities AS c
  ON c.commodity_name = s.commodity_name
 AND COALESCE(c.subcom_name, '') = COALESCE(s.subcom_name, '')
LEFT JOIN units AS u
  ON u.unit_name = s.unit_name
LEFT JOIN items AS i
  ON i.item_name = s.item_name
 AND i.unit_id = u.unit_id
LEFT JOIN data_releases AS dr
  ON TRIM(dr.data_date_th) = TRIM(s.data_date_th)
WHERE l.location_id IS NULL
   OR c.commodity_id IS NULL
   OR u.unit_id IS NULL
   OR i.item_id IS NULL
   OR dr.release_id IS NULL;

-- Load the fact table.
-- year and crop_year remain in Buddhist Era (พ.ศ.) as defined in the DBML.
-- Commas are removed from numeric strings before DECIMAL conversion.
INSERT INTO production_stats
    (location_id, commodity_id, item_id, release_id, year, crop_year, value)
SELECT
    l.location_id,
    c.commodity_id,
    i.item_id,
    dr.release_id,
    CAST(s.year_raw AS UNSIGNED),
    CAST(s.crop_year_raw AS UNSIGNED),
    CAST(REPLACE(REPLACE(s.data_raw, ',', ''), ' ', '') AS DECIMAL(15,2))
FROM tmp_production_source AS s
JOIN locations AS l
  ON l.name_th = s.location_name
 AND l.level = s.location_level
JOIN commodities AS c
  ON c.commodity_name = s.commodity_name
 AND COALESCE(c.subcom_name, '') = COALESCE(s.subcom_name, '')
JOIN units AS u
  ON u.unit_name = s.unit_name
JOIN items AS i
  ON i.item_name = s.item_name
 AND i.unit_id = u.unit_id
JOIN data_releases AS dr
  ON TRIM(dr.data_date_th) = TRIM(s.data_date_th)
ON DUPLICATE KEY UPDATE
    release_id = VALUES(release_id),
    year = VALUES(year),
    crop_year = VALUES(crop_year),
    value = VALUES(value);

-- A repeated load updates the current value for uq_stats instead of failing
-- on duplicate keys. Historical publication vintages require release_id to
-- be part of the unique key and a separate versioning policy.

-- Expected: 6,960 fact rows if the target table was empty before loading.
SELECT COUNT(*) AS production_stats_rows
FROM production_stats;

SELECT
    MIN(year) AS min_year_be,
    MAX(year) AS max_year_be,
    MIN(crop_year) AS min_crop_year_be,
    MAX(crop_year) AS max_crop_year_be,
    MIN(value) AS min_value,
    MAX(value) AS max_value
FROM production_stats;

DROP TEMPORARY TABLE IF EXISTS tmp_production_source;
