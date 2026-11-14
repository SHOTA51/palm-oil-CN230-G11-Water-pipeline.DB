SET NAMES utf8mb4;

SELECT
    'Province' AS dataset,
    COUNT(*) AS total,
    SUM(year_raw IS NULL OR TRIM(year_raw) = '') AS missing_year,
    SUM(location_name IS NULL OR TRIM(location_name) = '') AS missing_location,
    SUM(item_name IS NULL OR TRIM(item_name) = '') AS missing_item,
    SUM(data_raw IS NULL OR TRIM(data_raw) = '') AS missing_data,
    SUM(unit_name IS NULL OR TRIM(unit_name) = '') AS missing_unit
FROM stg_province

UNION ALL

SELECT
    'Region',
    COUNT(*),
    SUM(year_raw IS NULL OR TRIM(year_raw) = ''),
    SUM(location_name IS NULL OR TRIM(location_name) = ''),
    SUM(item_name IS NULL OR TRIM(item_name) = ''),
    SUM(data_raw IS NULL OR TRIM(data_raw) = ''),
    SUM(unit_name IS NULL OR TRIM(unit_name) = '')
FROM stg_region

UNION ALL

SELECT
    'Country',
    COUNT(*),
    SUM(year_raw IS NULL OR TRIM(year_raw) = ''),
    SUM(location_name IS NULL OR TRIM(location_name) = ''),
    SUM(item_name IS NULL OR TRIM(item_name) = ''),
    SUM(data_raw IS NULL OR TRIM(data_raw) = ''),
    SUM(unit_name IS NULL OR TRIM(unit_name) = '')
FROM stg_country;

SELECT DISTINCT year_raw
FROM stg_province
ORDER BY year_raw;

SELECT DISTINCT commodity
FROM stg_province;

SELECT DISTINCT item_name
FROM stg_province
ORDER BY item_name;

SELECT
    unit_name,
    COUNT(*) AS total
FROM stg_province
GROUP BY unit_name
ORDER BY total DESC;

-- Duplicate Records
SELECT
    year_raw,
    crop_year_raw,
    location_name,
    commodity,
    subcom,
    item_name,
    data_raw,
    unit_name,
    data_date_raw,
    COUNT(*) AS duplicate_count
FROM stg_province
GROUP BY
    year_raw,
    crop_year_raw,
    location_name,
    commodity,
    subcom,
    item_name,
    data_raw,
    unit_name,
    data_date_raw
HAVING COUNT(*) > 1;