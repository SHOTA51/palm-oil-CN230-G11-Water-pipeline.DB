
USE plam-oil;

-- 1. Province staging
CREATE TABLE stg_province (
    year_raw VARCHAR(50),
    crop_year_raw VARCHAR(50),
    location_name VARCHAR(255),
    commodity VARCHAR(255),
    subcom VARCHAR(255),
    item_name VARCHAR(255),
    data_raw VARCHAR(100),
    unit_name VARCHAR(100),
    data_date_raw VARCHAR(100)
);

-- 2. Region staging
CREATE TABLE stg_region LIKE stg_province;

-- 3. Whole country staging
CREATE TABLE stg_country LIKE stg_province;
