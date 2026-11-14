
LOAD DATA LOCAL INFILE '/data/csv/oil_palm_country.csv'
INTO TABLE stg_country
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ','
OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(
    @year,
    @crop_year,
    @location,
    @commodity,
    @subcom,
    @item,
    @data,
    @unit,
    @data_date
)
SET
    year_raw      = TRIM(@year),
    crop_year_raw = TRIM(@crop_year),
    location_name = TRIM(@location),
    commodity     = TRIM(@commodity),
    subcom        = TRIM(@subcom),
    item_name     = TRIM(@item),
    data_raw      = TRIM(@data),
    unit_name     = TRIM(@unit),
    data_date_raw = TRIM(@data_date);
