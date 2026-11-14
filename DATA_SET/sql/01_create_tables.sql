
-- =====================================
-- OIL PALM DASHBOARD
-- MySQL 8.4
-- STEP 3: CREATE TABLES
-- =====================================

CREATE DATABASE IF NOT EXISTS `plam-oil`
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE `plam-oil`;


-- 1. LOCATIONS

CREATE TABLE IF NOT EXISTS locations (
    location_id INT AUTO_INCREMENT PRIMARY KEY,
    name_th VARCHAR(100) NOT NULL,
    name_en VARCHAR(100),
    level ENUM('country','region','province') NOT NULL,
    parent_id INT,

    FOREIGN KEY (parent_id)
        REFERENCES locations(location_id),

    INDEX idx_loc_name_th (name_th),
    INDEX idx_loc_name_en (name_en),
    INDEX idx_loc_level_parent (level, parent_id)
) ENGINE=InnoDB;


-- 2. COMMODITIES

CREATE TABLE IF NOT EXISTS commodities (
    commodity_id INT AUTO_INCREMENT PRIMARY KEY,
    commodity_name VARCHAR(100) NOT NULL,
    subcom_name VARCHAR(100)
) ENGINE=InnoDB;


-- 3. UNITS

CREATE TABLE IF NOT EXISTS units (
    unit_id INT AUTO_INCREMENT PRIMARY KEY,
    unit_name VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;


-- 4. ITEMS

CREATE TABLE IF NOT EXISTS items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    item_name VARCHAR(100) NOT NULL UNIQUE,
    unit_id INT NOT NULL,

    FOREIGN KEY (unit_id)
        REFERENCES units(unit_id)
) ENGINE=InnoDB;


-- 5. DATA RELEASES

CREATE TABLE IF NOT EXISTS data_releases (
    release_id INT AUTO_INCREMENT PRIMARY KEY,
    data_date DATE NOT NULL UNIQUE,
    data_date_th VARCHAR(50)
) ENGINE=InnoDB;


-- 6. PRODUCTION STATS

CREATE TABLE IF NOT EXISTS production_stats (
    stat_id BIGINT AUTO_INCREMENT PRIMARY KEY,

    location_id INT NOT NULL,
    commodity_id INT NOT NULL,
    item_id INT NOT NULL,
    release_id INT,

    year SMALLINT NOT NULL,
    crop_year SMALLINT NOT NULL,
    value DECIMAL(15,2),

    CONSTRAINT fk_stats_location
        FOREIGN KEY (location_id)
        REFERENCES locations(location_id),

    CONSTRAINT fk_stats_commodity
        FOREIGN KEY (commodity_id)
        REFERENCES commodities(commodity_id),

    CONSTRAINT fk_stats_item
        FOREIGN KEY (item_id)
        REFERENCES items(item_id),

    CONSTRAINT fk_stats_release
        FOREIGN KEY (release_id)
        REFERENCES data_releases(release_id),

    UNIQUE KEY uq_stats (
        location_id,
        commodity_id,
        item_id,
        crop_year
    ),

    INDEX idx_stats_year_loc (crop_year, location_id),
    INDEX idx_stats_item (item_id)
) ENGINE=InnoDB;


