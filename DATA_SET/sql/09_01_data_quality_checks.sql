-- =========================================================
-- 09_01_data_quality_checks.sql
-- Oil Palm Production Dashboard | MySQL 8.4
-- Post-load row-count, duplicate, orphan and null checks.
-- =========================================================

USE `plam-oil`;

-- 1) Fact row count. Expected 6,960 after a clean first load.
SELECT COUNT(*) AS production_stats_total
FROM production_stats;

-- 2) Fact distribution by geographic level.
SELECT
    l.level,
    COUNT(*) AS total_rows
FROM production_stats AS ps
JOIN locations AS l
  ON l.location_id = ps.location_id
GROUP BY l.level
ORDER BY FIELD(l.level, 'country', 'region', 'province');

-- 3) Duplicate business grain. Expected 0 rows.
SELECT
    location_id,
    commodity_id,
    item_id,
    crop_year,
    COUNT(*) AS duplicate_count
FROM production_stats
GROUP BY location_id, commodity_id, item_id, crop_year
HAVING COUNT(*) > 1;

-- 4) Orphan foreign keys. Expected all zeros.
SELECT
    SUM(l.location_id IS NULL) AS missing_location,
    SUM(c.commodity_id IS NULL) AS missing_commodity,
    SUM(i.item_id IS NULL) AS missing_item,
    SUM(dr.release_id IS NULL) AS missing_release
FROM production_stats AS ps
LEFT JOIN locations AS l ON l.location_id = ps.location_id
LEFT JOIN commodities AS c ON c.commodity_id = ps.commodity_id
LEFT JOIN items AS i ON i.item_id = ps.item_id
LEFT JOIN data_releases AS dr ON dr.release_id = ps.release_id;

-- 5) NULL checks. Expected all zeros.
SELECT
    SUM(location_id IS NULL) AS null_location_id,
    SUM(commodity_id IS NULL) AS null_commodity_id,
    SUM(item_id IS NULL) AS null_item_id,
    SUM(year IS NULL) AS null_year,
    SUM(crop_year IS NULL) AS null_crop_year,
    SUM(value IS NULL) AS null_value
FROM production_stats;

-- 6) Summary by item and unit.
SELECT
    i.item_name,
    u.unit_name,
    COUNT(*) AS total_rows,
    MIN(ps.value) AS min_value,
    MAX(ps.value) AS max_value,
    SUM(ps.value = 0) AS zero_value_rows
FROM production_stats AS ps
JOIN items AS i ON i.item_id = ps.item_id
JOIN units AS u ON u.unit_id = i.unit_id
GROUP BY i.item_id, i.item_name, u.unit_name
ORDER BY i.item_id;
