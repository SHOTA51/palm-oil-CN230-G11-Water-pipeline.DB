-- Import the CSV exports into an empty database created with 01_create_tables.sql.
-- Replace C:/path/to/DATA_SET/export_csv with the actual absolute folder path.
-- Run with a MySQL client that has LOCAL INFILE enabled.
USE `plam-oil`;

LOAD DATA LOCAL INFILE 'C:/path/to/DATA_SET/export_csv/locations.csv'
INTO TABLE locations
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(@location_id, @name_th, @name_en, @level, @parent_id)
SET location_id = @location_id,
    name_th = @name_th,
    name_en = NULLIF(@name_en, ''),
    level = @level,
    parent_id = NULLIF(@parent_id, '');

LOAD DATA LOCAL INFILE 'C:/path/to/DATA_SET/export_csv/commodities.csv'
INTO TABLE commodities
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(@commodity_id, @commodity_name, @subcom_name)
SET commodity_id = @commodity_id,
    commodity_name = @commodity_name,
    subcom_name = NULLIF(@subcom_name, '');

LOAD DATA LOCAL INFILE 'C:/path/to/DATA_SET/export_csv/units.csv'
INTO TABLE units
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(unit_id, unit_name);

LOAD DATA LOCAL INFILE 'C:/path/to/DATA_SET/export_csv/items.csv'
INTO TABLE items
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(item_id, item_name, unit_id);

LOAD DATA LOCAL INFILE 'C:/path/to/DATA_SET/export_csv/data_releases.csv'
INTO TABLE data_releases
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(@release_id, @data_date, @data_date_th)
SET release_id = @release_id,
    data_date = @data_date,
    data_date_th = NULLIF(@data_date_th, '');

LOAD DATA LOCAL INFILE 'C:/path/to/DATA_SET/export_csv/production_stats.csv'
INTO TABLE production_stats
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(@stat_id, @location_id, @commodity_id, @item_id, @release_id, @year, @crop_year, @value)
SET stat_id = @stat_id,
    location_id = @location_id,
    commodity_id = @commodity_id,
    item_id = @item_id,
    release_id = NULLIF(@release_id, ''),
    year = @year,
    crop_year = @crop_year,
    value = NULLIF(@value, '');

-- Expected table counts: locations 81, commodities 1, units 3, items 4,
-- data_releases 9, production_stats 6960.
