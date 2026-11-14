-- ============================================================
-- PLAM-OIL | STEP 11: ZERO-VALUE & DATA-COVERAGE AUDIT
-- Database: plam-oil
-- Purpose:
--   ตรวจสอบค่า 0 และความครอบคลุมของข้อมูลรายปี/พื้นที่/ตัวชี้วัด
-- Safety:
--   ใช้คำสั่ง SELECT เท่านั้น ไม่มี INSERT/UPDATE/DELETE/DDL
-- Requirement:
--   MySQL 8.0+
-- ============================================================

USE `plam-oil`;

-- ------------------------------------------------------------
-- 11.1 สรุปจำนวนค่า 0 แยกตามตัวชี้วัด
-- ใช้ระบุว่าค่า 0 กระจุกตัวอยู่ใน item ใด
-- ------------------------------------------------------------
SELECT
    i.item_id,
    i.item_name,
    u.unit_name,
    COUNT(*) AS total_records,
    SUM(p.`value` = 0) AS zero_records,
    ROUND(100 * SUM(p.`value` = 0) / COUNT(*), 2) AS zero_percent
FROM production_stats AS p
JOIN items AS i ON p.item_id = i.item_id
JOIN units AS u ON i.unit_id = u.unit_id
GROUP BY i.item_id, i.item_name, u.unit_name
ORDER BY i.item_id;

-- ------------------------------------------------------------
-- 11.2 สรุปจำนวนค่า 0 แยกตามปีเพาะปลูกและตัวชี้วัด
-- ------------------------------------------------------------
SELECT
    p.crop_year,
    i.item_name,
    COUNT(*) AS total_records,
    SUM(p.`value` = 0) AS zero_records
FROM production_stats AS p
JOIN items AS i ON p.item_id = i.item_id
GROUP BY p.crop_year, i.item_id, i.item_name
HAVING SUM(p.`value` = 0) > 0
ORDER BY p.crop_year, i.item_id;

-- ------------------------------------------------------------
-- 11.3 สรุปจำนวนค่า 0 แยกตามระดับพื้นที่
-- ------------------------------------------------------------
SELECT
    l.`level`,
    COUNT(*) AS total_records,
    SUM(p.`value` = 0) AS zero_records,
    ROUND(100 * SUM(p.`value` = 0) / COUNT(*), 2) AS zero_percent
FROM production_stats AS p
JOIN locations AS l ON p.location_id = l.location_id
GROUP BY l.`level`
ORDER BY FIELD(l.`level`, 'country', 'region', 'province');

-- ------------------------------------------------------------
-- 11.4 แสดงรายละเอียดทุกแถวที่มีค่า 0
-- ใช้ตรวจสอบปี พื้นที่ ตัวชี้วัด และวันเผยแพร่
-- ------------------------------------------------------------
SELECT
    p.stat_id,
    p.year,
    p.crop_year,
    l.name_th AS location_name,
    l.`level` AS location_level,
    i.item_name,
    u.unit_name,
    p.`value`,
    d.data_date,
    d.data_date_th
FROM production_stats AS p
JOIN locations AS l ON p.location_id = l.location_id
JOIN items AS i ON p.item_id = i.item_id
JOIN units AS u ON i.unit_id = u.unit_id
LEFT JOIN data_releases AS d ON p.release_id = d.release_id
WHERE p.`value` = 0
ORDER BY p.crop_year, l.`level`, l.name_th, p.item_id;

-- ------------------------------------------------------------
-- 11.5 ตรวจสอบความครอบคลุมของตัวชี้วัดในแต่ละพื้นที่และปี
-- แสดงจำนวน item ที่มีข้อมูลต่อ location + crop_year
-- โดยทั่วไป item_count ควรไม่เกิน 4 ตามรายการตัวชี้วัดปัจจุบัน
-- ------------------------------------------------------------
SELECT
    p.crop_year,
    l.location_id,
    l.name_th AS location_name,
    l.`level` AS location_level,
    COUNT(DISTINCT p.item_id) AS item_count,
    COUNT(*) AS record_count,
    SUM(p.`value` = 0) AS zero_count
FROM production_stats AS p
JOIN locations AS l ON p.location_id = l.location_id
GROUP BY
    p.crop_year,
    l.location_id,
    l.name_th,
    l.`level`
ORDER BY p.crop_year, FIELD(l.`level`, 'country', 'region', 'province'), l.name_th
LIMIT 100;

-- ------------------------------------------------------------
-- 11.6 ตรวจสอบ location + crop_year ที่มีตัวชี้วัดไม่ครบ 4 ประเภท
-- เป็นรายการสำหรับตรวจสอบ ไม่ได้สรุปว่าเป็นข้อมูลผิด
-- ------------------------------------------------------------
SELECT
    p.crop_year,
    l.location_id,
    l.name_th AS location_name,
    l.`level` AS location_level,
    COUNT(DISTINCT p.item_id) AS item_count,
    GROUP_CONCAT(DISTINCT p.item_id ORDER BY p.item_id) AS item_ids
FROM production_stats AS p
JOIN locations AS l ON p.location_id = l.location_id
GROUP BY p.crop_year, l.location_id, l.name_th, l.`level`
HAVING COUNT(DISTINCT p.item_id) < 4
ORDER BY p.crop_year, FIELD(l.`level`, 'country', 'region', 'province'), l.name_th;

-- ------------------------------------------------------------
-- 11.7 สรุปจำนวนข้อมูลตามปีและระดับพื้นที่
-- ใช้ดูว่าข้อมูลแต่ละปีครอบคลุม country/region/province เท่าใด
-- ------------------------------------------------------------
SELECT
    p.crop_year,
    l.`level` AS location_level,
    COUNT(DISTINCT p.location_id) AS locations_with_data,
    COUNT(*) AS total_records
FROM production_stats AS p
JOIN locations AS l ON p.location_id = l.location_id
GROUP BY p.crop_year, l.`level`
ORDER BY p.crop_year, FIELD(l.`level`, 'country', 'region', 'province');

-- ------------------------------------------------------------
-- 11.8 สรุปข้อมูลตามวันที่เผยแพร่
-- ใช้ตรวจสอบจำนวน record ต่อ release
-- ------------------------------------------------------------
SELECT
    d.release_id,
    d.data_date,
    d.data_date_th,
    COUNT(p.stat_id) AS total_records,
    MIN(p.crop_year) AS min_crop_year,
    MAX(p.crop_year) AS max_crop_year
FROM data_releases AS d
LEFT JOIN production_stats AS p ON p.release_id = d.release_id
GROUP BY d.release_id, d.data_date, d.data_date_th
ORDER BY d.data_date;

-- ------------------------------------------------------------
-- 11.9 ตรวจสอบค่าติดลบอีกครั้ง แยกตามตัวชี้วัด
-- ผลลัพธ์ควรไม่พบแถว
-- ------------------------------------------------------------
SELECT
    p.stat_id,
    p.crop_year,
    l.name_th AS location_name,
    i.item_name,
    p.`value`
FROM production_stats AS p
JOIN locations AS l ON p.location_id = l.location_id
JOIN items AS i ON p.item_id = i.item_id
WHERE p.`value` < 0
ORDER BY p.crop_year, l.name_th, p.item_id;

-- ============================================================
-- END OF STEP 11
-- ส่งผลลัพธ์กลับมาตรวจสอบก่อนตัดสินใจจัดการค่า 0 หรือสร้าง Views
-- ห้ามลบหรือแทนที่ค่า 0 จนกว่าจะตีความที่มาของข้อมูลได้
-- ============================================================
