SET NAMES utf8mb4;
USE `plam-oil`;

-- ==========================================
-- STEP 7.2 : CREATE DIMENSION TABLES
-- MySQL 8.4
-- ==========================================

-- 1. Locations
CREATE TABLE IF NOT EXISTS locations (
    location_id INT AUTO_INCREMENT PRIMARY KEY,
    name_th VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NULL,
    level ENUM('country', 'region', 'province') NOT NULL,
    parent_id INT NULL,

    INDEX idx_loc_name_th (name_th),
    INDEX idx_loc_name_en (name_en),
    INDEX idx_loc_level_parent (level, parent_id),

    CONSTRAINT fk_locations_parent
        FOREIGN KEY (parent_id)
        REFERENCES locations(location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 2. Commodities
CREATE TABLE IF NOT EXISTS commodities (
    commodity_id INT AUTO_INCREMENT PRIMARY KEY,
    commodity_name VARCHAR(100) NOT NULL,
    subcom_name VARCHAR(100) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 3. Units
CREATE TABLE IF NOT EXISTS units (
    unit_id INT AUTO_INCREMENT PRIMARY KEY,
    unit_name VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 4. Items
CREATE TABLE IF NOT EXISTS items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    item_name VARCHAR(100) NOT NULL UNIQUE,
    unit_id INT NOT NULL,

    CONSTRAINT fk_items_unit
        FOREIGN KEY (unit_id)
        REFERENCES units(unit_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 5. Data Releases
CREATE TABLE IF NOT EXISTS data_releases (
    release_id INT AUTO_INCREMENT PRIMARY KEY,
    data_date DATE NOT NULL UNIQUE,
    data_date_th VARCHAR(50) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ==========================================
-- STEP 7.3 : LOAD COMMODITIES
-- ==========================================

INSERT INTO commodities (commodity_name, subcom_name)
SELECT DISTINCT
    TRIM(commodity),
    NULLIF(TRIM(subcom), '')
FROM stg_province s
WHERE NOT EXISTS (
    SELECT 1
    FROM commodities c
    WHERE c.commodity_name = TRIM(s.commodity)
      AND c.subcom_name <=> NULLIF(TRIM(s.subcom), '')
);


-- ==========================================
-- STEP 7.4 : LOAD UNITS
-- ==========================================

INSERT IGNORE INTO units (unit_name)
SELECT TRIM(unit_name) FROM stg_province

UNION

SELECT TRIM(unit_name) FROM stg_region

UNION

SELECT TRIM(unit_name) FROM stg_country;


-- ==========================================
-- STEP 7.5 : LOAD ITEMS
-- ==========================================

INSERT INTO items (item_name, unit_id)
SELECT DISTINCT
    TRIM(s.item_name),
    u.unit_id
FROM stg_province s
JOIN units u
    ON u.unit_name = TRIM(s.unit_name)
WHERE NOT EXISTS (
    SELECT 1
    FROM items i
    WHERE i.item_name = TRIM(s.item_name)
);


-- ==========================================
-- STEP 7.6 : LOAD DATA RELEASES
-- Convert Thai Buddhist Era to Gregorian Date
-- ==========================================

INSERT IGNORE INTO data_releases (
    data_date,
    data_date_th
)
SELECT DISTINCT
    STR_TO_DATE(mapped.mapped_date, '%Y-%m-%d'),
    mapped.normalized_date
FROM (
    SELECT
        raw_dates.normalized_date,

        CASE raw_dates.normalized_date
            WHEN '1 พฤศจิกายน 2566' THEN '2023-11-01'
            WHEN '13 มิถุนายน 2557' THEN '2014-06-13'
            WHEN '16 กุมภาพันธ์ 2568' THEN '2025-02-16'
            WHEN '23 กันยายน 2552' THEN '2009-09-23'
            WHEN '27 มกราคม 2559' THEN '2016-01-27'
            WHEN '29 ธันวาคม 2553' THEN '2010-12-29'
            WHEN '3 กุมภาพันธ์ 2566' THEN '2023-02-03'
            WHEN '4 มกราคม 2553' THEN '2010-01-04'
            WHEN '7 กรกฎาคม 2569' THEN '2026-07-07'
            ELSE NULL
        END AS mapped_date

    FROM (
        SELECT TRIM(REPLACE(data_date_raw, CHAR(13), ''))
            AS normalized_date
        FROM stg_province

        UNION

        SELECT TRIM(REPLACE(data_date_raw, CHAR(13), ''))
        FROM stg_region

        UNION

        SELECT TRIM(REPLACE(data_date_raw, CHAR(13), ''))
        FROM stg_country
    ) raw_dates
) mapped
WHERE mapped.mapped_date IS NOT NULL;
