SET NAMES utf8mb4;
USE `plam-oil`;

-- ตรวจสอบค่าที่ไม่ซ้ำของวันที่ทั้ง 3 Dataset
SELECT
    'Province' AS dataset,
    data_date_raw,
    HEX(data_date_raw) AS date_hex,
    LENGTH(data_date_raw) AS byte_length,
    COUNT(*) AS total
FROM stg_province
GROUP BY data_date_raw

UNION ALL

SELECT
    'Region',
    data_date_raw,
    HEX(data_date_raw),
    LENGTH(data_date_raw),
    COUNT(*)
FROM stg_region
GROUP BY data_date_raw

UNION ALL

SELECT
    'Country',
    data_date_raw,
    HEX(data_date_raw),
    LENGTH(data_date_raw),
    COUNT(*)
FROM stg_country
GROUP BY data_date_raw
ORDER BY dataset, data_date_raw;


-- ตรวจสอบปีข้อมูลกับปีเพาะปลูก
SELECT
    'Province' AS dataset,
    COUNT(*) AS total,
    SUM(year_raw <> crop_year_raw) AS year_mismatch
FROM stg_province

UNION ALL

SELECT
    'Region',
    COUNT(*),
    SUM(year_raw <> crop_year_raw)
FROM stg_region

UNION ALL

SELECT
    'Country',
    COUNT(*),
    SUM(year_raw <> crop_year_raw)
FROM stg_country;


-- ตรวจสอบค่าต่ำสุดและสูงสุดของตัวเลข
SELECT
    'Province' AS dataset,
    MIN(CAST(data_raw AS DECIMAL(20,4))) AS min_value,
    MAX(CAST(data_raw AS DECIMAL(20,4))) AS max_value
FROM stg_province

UNION ALL

SELECT
    'Region',
    MIN(CAST(data_raw AS DECIMAL(20,4))),
    MAX(CAST(data_raw AS DECIMAL(20,4)))
FROM stg_region

UNION ALL

SELECT
    'Country',
    MIN(CAST(data_raw AS DECIMAL(20,4))),
    MAX(CAST(data_raw AS DECIMAL(20,4)))
FROM stg_country;
