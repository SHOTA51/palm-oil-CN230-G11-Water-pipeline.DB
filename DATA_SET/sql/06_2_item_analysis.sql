SET NAMES utf8mb4;
USE `plam-oil`;

-- Province
SELECT
    item_name,
    unit_name,
    COUNT(*) AS total_records,
    MIN(CAST(data_raw AS DECIMAL(20,4))) AS min_value,
    MAX(CAST(data_raw AS DECIMAL(20,4))) AS max_value,
    SUM(CAST(data_raw AS DECIMAL(20,4)) = 0) AS zero_count
FROM stg_province
GROUP BY item_name, unit_name
ORDER BY item_name, unit_name;


-- Region
SELECT
    item_name,
    unit_name,
    COUNT(*) AS total_records,
    MIN(CAST(data_raw AS DECIMAL(20,4))) AS min_value,
    MAX(CAST(data_raw AS DECIMAL(20,4))) AS max_value,
    SUM(CAST(data_raw AS DECIMAL(20,4)) = 0) AS zero_count
FROM stg_region
GROUP BY item_name, unit_name
ORDER BY item_name, unit_name;


-- Country
SELECT
    item_name,
    unit_name,
    COUNT(*) AS total_records,
    MIN(CAST(data_raw AS DECIMAL(20,4))) AS min_value,
    MAX(CAST(data_raw AS DECIMAL(20,4))) AS max_value,
    SUM(CAST(data_raw AS DECIMAL(20,4)) = 0) AS zero_count
FROM stg_country
GROUP BY item_name, unit_name
ORDER BY item_name, unit_name;
