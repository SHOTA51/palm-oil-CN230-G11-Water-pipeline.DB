SET NAMES utf8mb4;
USE `plam-oil`;

-- 1. ตรวจสอบรูปแบบปี
SELECT 'Province' AS dataset,
       MIN(year_raw) AS min_year,
       MAX(year_raw) AS max_year,
       COUNT(DISTINCT year_raw) AS distinct_years
FROM stg_province

UNION ALL

SELECT 'Region', MIN(year_raw), MAX(year_raw),
       COUNT(DISTINCT year_raw)
FROM stg_region

UNION ALL

SELECT 'Country', MIN(year_raw), MAX(year_raw),
       COUNT(DISTINCT year_raw)
FROM stg_country;


-- 2. ตรวจสอบ Crop Year
SELECT 'Province' AS dataset,
       crop_year_raw,
       COUNT(*) AS total
FROM stg_province
GROUP BY crop_year_raw

UNION ALL

SELECT 'Region', crop_year_raw, COUNT(*)
FROM stg_region
GROUP BY crop_year_raw

UNION ALL

SELECT 'Country', crop_year_raw, COUNT(*)
FROM stg_country
GROUP BY crop_year_raw
ORDER BY dataset, crop_year_raw;


-- 3. ตรวจสอบค่าตัวเลขที่แปลงเป็น DECIMAL ไม่ได้
SELECT 'Province' AS dataset,
       data_raw,
       COUNT(*) AS total
FROM stg_province
WHERE TRIM(data_raw) NOT REGEXP '^[+-]?[0-9]+([.][0-9]+)?$'
GROUP BY data_raw

UNION ALL

SELECT 'Region', data_raw, COUNT(*)
FROM stg_region
WHERE TRIM(data_raw) NOT REGEXP '^[+-]?[0-9]+([.][0-9]+)?$'
GROUP BY data_raw

UNION ALL

SELECT 'Country', data_raw, COUNT(*)
FROM stg_country
WHERE TRIM(data_raw) NOT REGEXP '^[+-]?[0-9]+([.][0-9]+)?$'
GROUP BY data_raw;


-- 4. ตรวจสอบรูปแบบวันที่
SELECT 'Province' AS dataset,
       data_date_raw,
       COUNT(*) AS total
FROM stg_province
GROUP BY data_date_raw

UNION ALL

SELECT 'Region', data_date_raw, COUNT(*)
FROM stg_region
GROUP BY data_date_raw

UNION ALL

SELECT 'Country', data_date_raw, COUNT(*)
FROM stg_country
GROUP BY data_date_raw
ORDER BY dataset, data_date_raw;
