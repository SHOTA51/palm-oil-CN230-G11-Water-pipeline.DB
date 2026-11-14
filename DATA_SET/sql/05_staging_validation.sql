-- Read-only checks to run after CSV import and before dimension/fact loading.
-- Expected: no missing fields, year mismatches or invalid numeric values.
USE `plam-oil`;

-- Row counts and missing required values by source level.
SELECT 'province' AS dataset, COUNT(*) AS rows_total,
       SUM(year_raw IS NULL OR TRIM(year_raw) = '') AS missing_year,
       SUM(crop_year_raw IS NULL OR TRIM(crop_year_raw) = '') AS missing_crop_year,
       SUM(location_name IS NULL OR TRIM(location_name) = '') AS missing_location,
       SUM(item_name IS NULL OR TRIM(item_name) = '') AS missing_item,
       SUM(data_raw IS NULL OR TRIM(data_raw) = '') AS missing_data,
       SUM(unit_name IS NULL OR TRIM(unit_name) = '') AS missing_unit,
       SUM(year_raw <> crop_year_raw) AS year_mismatch
FROM stg_province
UNION ALL
SELECT 'region', COUNT(*),
       SUM(year_raw IS NULL OR TRIM(year_raw) = ''),
       SUM(crop_year_raw IS NULL OR TRIM(crop_year_raw) = ''),
       SUM(location_name IS NULL OR TRIM(location_name) = ''),
       SUM(item_name IS NULL OR TRIM(item_name) = ''),
       SUM(data_raw IS NULL OR TRIM(data_raw) = ''),
       SUM(unit_name IS NULL OR TRIM(unit_name) = ''),
       SUM(year_raw <> crop_year_raw)
FROM stg_region
UNION ALL
SELECT 'country', COUNT(*),
       SUM(year_raw IS NULL OR TRIM(year_raw) = ''),
       SUM(crop_year_raw IS NULL OR TRIM(crop_year_raw) = ''),
       SUM(location_name IS NULL OR TRIM(location_name) = ''),
       SUM(item_name IS NULL OR TRIM(item_name) = ''),
       SUM(data_raw IS NULL OR TRIM(data_raw) = ''),
       SUM(unit_name IS NULL OR TRIM(unit_name) = ''),
       SUM(year_raw <> crop_year_raw)
FROM stg_country;

-- Invalid numeric values; commas are accepted as thousands separators.
SELECT 'province' AS dataset, COUNT(*) AS invalid_numeric_rows
FROM stg_province
WHERE TRIM(data_raw) NOT REGEXP '^[+-]?[0-9]+(,[0-9]{3})*(\\.[0-9]+)?$'
UNION ALL
SELECT 'region', COUNT(*) FROM stg_region
WHERE TRIM(data_raw) NOT REGEXP '^[+-]?[0-9]+(,[0-9]{3})*(\\.[0-9]+)?$'
UNION ALL
SELECT 'country', COUNT(*) FROM stg_country
WHERE TRIM(data_raw) NOT REGEXP '^[+-]?[0-9]+(,[0-9]{3})*(\\.[0-9]+)?$';

-- Distinct publication labels are few; inspect labels before loading releases.
SELECT data_date_raw, COUNT(*) AS rows_with_date
FROM (
    SELECT data_date_raw FROM stg_province
    UNION ALL SELECT data_date_raw FROM stg_region
    UNION ALL SELECT data_date_raw FROM stg_country
) AS source_dates
GROUP BY data_date_raw
ORDER BY data_date_raw;

-- Confirm the source item/unit combinations before building dimensions.
SELECT item_name, unit_name, COUNT(*) AS source_rows
FROM (
    SELECT item_name, unit_name FROM stg_province
    UNION ALL SELECT item_name, unit_name FROM stg_region
    UNION ALL SELECT item_name, unit_name FROM stg_country
) AS source_items
GROUP BY item_name, unit_name
ORDER BY item_name, unit_name;

-- The fact table accepts one row per level/name/item/crop year.
-- This query should return no rows before loading the fact table.
SELECT location_level, location_name, commodity, subcom, item_name, crop_year_raw,
       COUNT(*) AS duplicate_rows
FROM (
    SELECT 'province' AS location_level, location_name, commodity, subcom, item_name, crop_year_raw FROM stg_province
    UNION ALL SELECT 'region', location_name, commodity, subcom, item_name, crop_year_raw FROM stg_region
    UNION ALL SELECT 'country', location_name, commodity, subcom, item_name, crop_year_raw FROM stg_country
) AS source_grain
GROUP BY location_level, location_name, commodity, subcom, item_name, crop_year_raw
HAVING COUNT(*) > 1
ORDER BY location_level, location_name, crop_year_raw, item_name;
