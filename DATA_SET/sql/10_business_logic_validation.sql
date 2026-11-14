-- ============================================================
-- STEP 10: BUSINESS LOGIC VALIDATION
-- Project: Oil Palm Production Dashboard
-- Dialect: MySQL 8.4
-- Source of truth: _DBML_dbdiagram.io.txt (1 fact + 5 dimensions)
--
-- IMPORTANT:
--   * Read-only audit queries only; this script does not INSERT,
--     UPDATE, DELETE, ALTER, or DROP anything.
--   * Run after Step 9 has completed.
--   * Review actual item/unit labels before interpreting yield ratios.
-- ============================================================

USE `plam-oil`;

-- ------------------------------------------------------------
-- 10.1 Confirm the ERD tables and their row counts
-- ------------------------------------------------------------
SELECT 'locations' AS table_name, COUNT(*) AS row_count FROM locations
UNION ALL
SELECT 'commodities', COUNT(*) FROM commodities
UNION ALL
SELECT 'units', COUNT(*) FROM units
UNION ALL
SELECT 'items', COUNT(*) FROM items
UNION ALL
SELECT 'data_releases', COUNT(*) FROM data_releases
UNION ALL
SELECT 'production_stats', COUNT(*) FROM production_stats;


-- ------------------------------------------------------------
-- 10.2 Review item-to-unit mapping (important before KPI formulas)
-- ------------------------------------------------------------
SELECT
    i.item_id,
    i.item_name,
    u.unit_id,
    u.unit_name
FROM items AS i
JOIN units AS u
    ON u.unit_id = i.unit_id
ORDER BY i.item_id;


-- ------------------------------------------------------------
-- 10.3 Check NULL values in the fact table
-- value and release_id are nullable in the ERD; this query reports
-- them for review rather than assuming every NULL is a constraint error.
-- ------------------------------------------------------------
SELECT
    COUNT(*) AS total_rows,
    SUM(CASE WHEN location_id IS NULL THEN 1 ELSE 0 END) AS null_location_id,
    SUM(CASE WHEN commodity_id IS NULL THEN 1 ELSE 0 END) AS null_commodity_id,
    SUM(CASE WHEN item_id IS NULL THEN 1 ELSE 0 END) AS null_item_id,
    SUM(CASE WHEN release_id IS NULL THEN 1 ELSE 0 END) AS null_release_id,
    SUM(CASE WHEN value IS NULL THEN 1 ELSE 0 END) AS null_value
FROM production_stats;


-- ------------------------------------------------------------
-- 10.4 Check negative and zero values by indicator
-- Negative values should be investigated.
-- Zero values are reported separately and are not automatically errors.
-- ------------------------------------------------------------
SELECT
    i.item_name,
    u.unit_name,
    COUNT(*) AS row_count,
    SUM(CASE WHEN p.value < 0 THEN 1 ELSE 0 END) AS negative_rows,
    SUM(CASE WHEN p.value = 0 THEN 1 ELSE 0 END) AS zero_rows,
    MIN(p.value) AS min_value,
    MAX(p.value) AS max_value
FROM production_stats AS p
JOIN items AS i
    ON i.item_id = p.item_id
JOIN units AS u
    ON u.unit_id = i.unit_id
GROUP BY i.item_name, u.unit_name
ORDER BY i.item_name;


-- ------------------------------------------------------------
-- 10.5 Check duplicate business keys from the ERD
-- Expected result: no rows.
-- ERD unique key: location_id + commodity_id + item_id + crop_year
-- ------------------------------------------------------------
SELECT
    location_id,
    commodity_id,
    item_id,
    crop_year,
    COUNT(*) AS duplicate_count
FROM production_stats
GROUP BY
    location_id,
    commodity_id,
    item_id,
    crop_year
HAVING COUNT(*) > 1;


-- ------------------------------------------------------------
-- 10.6 Validate the location hierarchy
-- Expected structure:
--   country  -> parent_id IS NULL
--   region   -> parent is country
--   province -> parent is region
-- Expected result: no rows, after confirming the intended hierarchy.
-- ------------------------------------------------------------
SELECT
    child.location_id,
    child.name_th AS location_name,
    child.level AS location_level,
    child.parent_id,
    parent.name_th AS parent_name,
    parent.level AS parent_level
FROM locations AS child
LEFT JOIN locations AS parent
    ON parent.location_id = child.parent_id
WHERE
       (child.level = 'country' AND child.parent_id IS NOT NULL)
    OR (child.level = 'region'
        AND (child.parent_id IS NULL OR parent.level <> 'country' OR parent.location_id IS NULL))
    OR (child.level = 'province'
        AND (child.parent_id IS NULL OR parent.level <> 'region' OR parent.location_id IS NULL))
ORDER BY child.level, child.location_id;


-- ------------------------------------------------------------
-- 10.7 Check location counts by hierarchy level
-- ------------------------------------------------------------
SELECT
    level,
    COUNT(*) AS location_count,
    SUM(CASE WHEN parent_id IS NULL THEN 1 ELSE 0 END) AS no_parent_count
FROM locations
GROUP BY level
ORDER BY CASE level
    WHEN 'country' THEN 1
    WHEN 'region' THEN 2
    WHEN 'province' THEN 3
    ELSE 4
END;


-- ------------------------------------------------------------
-- 10.8 Check fact-table coverage by crop year, location level, and item
-- ------------------------------------------------------------
SELECT
    p.crop_year,
    l.level AS location_level,
    i.item_name,
    u.unit_name,
    COUNT(*) AS fact_rows,
    COUNT(DISTINCT p.location_id) AS locations_covered,
    COUNT(DISTINCT p.commodity_id) AS commodities_covered,
    SUM(CASE WHEN p.value IS NULL THEN 1 ELSE 0 END) AS null_value_rows
FROM production_stats AS p
JOIN locations AS l
    ON l.location_id = p.location_id
JOIN items AS i
    ON i.item_id = p.item_id
JOIN units AS u
    ON u.unit_id = i.unit_id
GROUP BY
    p.crop_year,
    l.level,
    i.item_name,
    u.unit_name
ORDER BY
    p.crop_year,
    CASE l.level
        WHEN 'country' THEN 1
        WHEN 'region' THEN 2
        WHEN 'province' THEN 3
        ELSE 4
    END,
    i.item_name;


-- ------------------------------------------------------------
-- 10.9 Review release-date coverage
-- release_id is nullable in the ERD, so missing releases are reported.
-- ------------------------------------------------------------
SELECT
    p.crop_year,
    p.year AS buddhist_year,
    d.release_id,
    d.data_date,
    d.data_date_th,
    COUNT(*) AS fact_rows
FROM production_stats AS p
LEFT JOIN data_releases AS d
    ON d.release_id = p.release_id
GROUP BY
    p.crop_year,
    p.year,
    d.release_id,
    d.data_date,
    d.data_date_th
ORDER BY p.crop_year, d.data_date;


-- ------------------------------------------------------------
-- 10.10 Compare reported production/area indicators with a raw ratio
-- This is a diagnostic only. Do NOT treat it as a pass/fail test until
-- the units and conversion convention in the source data are confirmed.
-- The ERD lists units such as rai, ton, and kilogram per rai.
-- ------------------------------------------------------------
SELECT
    p.location_id,
    l.name_th AS location_name,
    p.commodity_id,
    c.commodity_name,
    p.crop_year,
    MAX(CASE WHEN i.item_name = 'ผลผลิต'
             THEN p.value END) AS reported_production,
    MAX(CASE WHEN i.item_name = 'เนื้อที่ให้ผล'
             THEN p.value END) AS bearing_area,
    MAX(CASE WHEN i.item_name = 'ผลผลิตต่อเนื้อที่ให้ผล'
             THEN p.value END) AS reported_yield,
    MAX(CASE WHEN i.item_name = 'ผลผลิต'
             THEN u.unit_name END) AS production_unit,
    MAX(CASE WHEN i.item_name = 'เนื้อที่ให้ผล'
             THEN u.unit_name END) AS area_unit,
    MAX(CASE WHEN i.item_name = 'ผลผลิตต่อเนื้อที่ให้ผล'
             THEN u.unit_name END) AS yield_unit,
    ROUND(
        MAX(CASE WHEN i.item_name = 'ผลผลิต' THEN p.value END)
        / NULLIF(MAX(CASE WHEN i.item_name = 'เนื้อที่ให้ผล' THEN p.value END), 0),
        4
    ) AS raw_production_per_area
FROM production_stats AS p
JOIN locations AS l
    ON l.location_id = p.location_id
JOIN commodities AS c
    ON c.commodity_id = p.commodity_id
JOIN items AS i
    ON i.item_id = p.item_id
JOIN units AS u
    ON u.unit_id = i.unit_id
GROUP BY
    p.location_id,
    l.name_th,
    p.commodity_id,
    c.commodity_name,
    p.crop_year
HAVING
       SUM(CASE WHEN i.item_name = 'ผลผลิต' THEN 1 ELSE 0 END) > 0
   AND SUM(CASE WHEN i.item_name = 'เนื้อที่ให้ผล' THEN 1 ELSE 0 END) > 0
ORDER BY p.crop_year, l.name_th, c.commodity_name;


-- ------------------------------------------------------------
-- 10.11 Check for facts whose release_id does not match a release row
-- Expected result: no rows. NULL release_id values are excluded.
-- ------------------------------------------------------------
SELECT
    p.stat_id,
    p.release_id
FROM production_stats AS p
LEFT JOIN data_releases AS d
    ON d.release_id = p.release_id
WHERE p.release_id IS NOT NULL
  AND d.release_id IS NULL;


-- ============================================================
-- END OF STEP 10
--
-- Save query outputs/screenshots for the audit record.
-- Resolve any unexpected findings before creating Step 13 views.
-- Do not change the ERD or infer unit conversions without checking
-- the source workbook/data dictionary.
-- ============================================================

