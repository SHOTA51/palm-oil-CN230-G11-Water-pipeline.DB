-- ============================================================
-- PLAM-OIL | STEP 10: DATA AUDIT (READ-ONLY)
-- Database: plam-oil
-- Purpose:
--   ตรวจสอบจำนวนข้อมูล ช่วงปี NULL/0/ค่าติดลบ และโครงสร้างพื้นที่
-- Safety:
--   ไฟล์นี้ใช้คำสั่ง SELECT เท่านั้น ไม่แก้ไข/ลบ/เพิ่มข้อมูล
-- Run:
--   mysql> source /path/to/STEP10_data_audit.sql
-- ============================================================

USE `plam-oil`;

-- ------------------------------------------------------------
-- 10.1 จำนวนข้อมูลในตารางหลัก
-- ------------------------------------------------------------
SELECT 'locations' AS table_name, COUNT(*) AS total FROM locations
UNION ALL
SELECT 'production_stats', COUNT(*) FROM production_stats
UNION ALL
SELECT 'commodities', COUNT(*) FROM commodities
UNION ALL
SELECT 'items', COUNT(*) FROM items
UNION ALL
SELECT 'units', COUNT(*) FROM units
UNION ALL
SELECT 'data_releases', COUNT(*) FROM data_releases;

-- ------------------------------------------------------------
-- 10.2 ช่วงปีข้อมูล
-- ------------------------------------------------------------
SELECT
    MIN(`year`) AS min_year,
    MAX(`year`) AS max_year,
    MIN(crop_year) AS min_crop_year,
    MAX(crop_year) AS max_crop_year
FROM production_stats;

-- ------------------------------------------------------------
-- 10.3 จำนวนข้อมูลแยกตามตัวชี้วัดและหน่วย
-- ------------------------------------------------------------
SELECT
    i.item_id,
    i.item_name,
    u.unit_name,
    COUNT(*) AS total_records
FROM production_stats AS p
JOIN items AS i
    ON p.item_id = i.item_id
JOIN units AS u
    ON i.unit_id = u.unit_id
GROUP BY i.item_id, i.item_name, u.unit_name
ORDER BY i.item_id;

-- ------------------------------------------------------------
-- 10.4 ตรวจสอบ NULL, 0, ค่าติดลบ และ release_id ที่หายไป
-- ------------------------------------------------------------
SELECT
    COUNT(*) AS total_records,
    SUM(p.`value` IS NULL) AS null_values,
    SUM(p.`value` = 0) AS zero_values,
    SUM(p.`value` < 0) AS negative_values,
    SUM(p.release_id IS NULL) AS missing_release
FROM production_stats AS p;

-- ------------------------------------------------------------
-- 10.5 ตรวจสอบ year แตกต่างจาก crop_year
-- ------------------------------------------------------------
SELECT
    COUNT(*) AS total_records,
    SUM(`year` <> crop_year) AS different_years
FROM production_stats;

-- ------------------------------------------------------------
-- 10.6 จำนวนข้อมูลแยกตาม crop_year
-- ------------------------------------------------------------
SELECT
    crop_year,
    COUNT(*) AS total_records
FROM production_stats
GROUP BY crop_year
ORDER BY crop_year;

-- ------------------------------------------------------------
-- 10.7 จำนวนพื้นที่แยกตามระดับ
-- ------------------------------------------------------------
SELECT
    `level`,
    COUNT(*) AS total_locations
FROM locations
GROUP BY `level`
ORDER BY FIELD(`level`, 'country', 'region', 'province');

-- ------------------------------------------------------------
-- 10.8 ตรวจสอบความสัมพันธ์ Parent-Child ของพื้นที่
-- ผลลัพธ์ที่ถูกต้องควรได้ 0 แถว
-- ------------------------------------------------------------
SELECT
    child.location_id,
    child.name_th AS child_name,
    child.`level` AS child_level,
    child.parent_id,
    parent.name_th AS parent_name,
    parent.`level` AS parent_level
FROM locations AS child
LEFT JOIN locations AS parent
    ON child.parent_id = parent.location_id
WHERE
       (child.`level` = 'country' AND child.parent_id IS NOT NULL)
    OR (child.`level` = 'region'
        AND (parent.`level` <> 'country' OR parent.location_id IS NULL))
    OR (child.`level` = 'province'
        AND (parent.`level` <> 'region' OR parent.location_id IS NULL));

-- ------------------------------------------------------------
-- 10.9 พื้นที่ที่ไม่มีข้อมูลใน production_stats
-- หมายเหตุ: ตรวจพบแถวแล้วต้องพิจารณาตามระดับพื้นที่ ไม่ได้แปลว่าผิดเสมอไป
-- ------------------------------------------------------------
SELECT
    l.location_id,
    l.name_th,
    l.`level`
FROM locations AS l
LEFT JOIN production_stats AS p
    ON l.location_id = p.location_id
WHERE p.location_id IS NULL
ORDER BY FIELD(l.`level`, 'country', 'region', 'province'), l.name_th;

-- ------------------------------------------------------------
-- 10.10 ตรวจสอบ orphan references เพิ่มเติม
-- ปกติ Foreign Key ควรป้องกันกรณีเหล่านี้อยู่แล้ว
-- ผลลัพธ์ของแต่ละ query ควรได้ 0 แถว
-- ------------------------------------------------------------

-- production_stats -> locations
SELECT p.stat_id, p.location_id
FROM production_stats AS p
LEFT JOIN locations AS l ON p.location_id = l.location_id
WHERE l.location_id IS NULL;

-- production_stats -> items
SELECT p.stat_id, p.item_id
FROM production_stats AS p
LEFT JOIN items AS i ON p.item_id = i.item_id
WHERE i.item_id IS NULL;

-- production_stats -> commodities
SELECT p.stat_id, p.commodity_id
FROM production_stats AS p
LEFT JOIN commodities AS c ON p.commodity_id = c.commodity_id
WHERE c.commodity_id IS NULL;

-- production_stats -> data_releases (NULL release_id is allowed by schema)
SELECT p.stat_id, p.release_id
FROM production_stats AS p
LEFT JOIN data_releases AS d ON p.release_id = d.release_id
WHERE p.release_id IS NOT NULL
  AND d.release_id IS NULL;

-- items -> units
SELECT i.item_id, i.unit_id
FROM items AS i
LEFT JOIN units AS u ON i.unit_id = u.unit_id
WHERE u.unit_id IS NULL;

-- ============================================================
-- END OF STEP 10
-- ส่งผลลัพธ์ทั้งหมดกลับมาตรวจสอบก่อนทำ Data Cleaning หรือ Views
-- ============================================================
