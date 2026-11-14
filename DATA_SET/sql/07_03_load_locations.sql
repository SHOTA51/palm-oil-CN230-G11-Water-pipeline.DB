-- =========================================================
-- 07_03_load_locations.sql
-- Oil Palm Production Dashboard | MySQL 8.4
-- Load hierarchy: Country -> Region -> Province
-- Based on the 76 province-level names present in stg_province.
-- Region grouping: 4-region grouping; Bangkok is grouped in Central.
-- Safe to rerun: inserts only rows that do not already exist.
-- =========================================================

USE `plam-oil`;

-- Correct the Thai release label if the earlier placeholder was used.
UPDATE data_releases
SET data_date_th = '16 ตุลาคม 2568'
WHERE data_date = '2025-10-16';

-- 1) Country
INSERT INTO locations (name_th, name_en, level, parent_id)
SELECT DISTINCT
    TRIM(s.location_name),
    NULL,
    'country',
    NULL
FROM stg_country AS s
WHERE TRIM(s.location_name) <> ''
  AND NOT EXISTS (
      SELECT 1
      FROM locations AS l
      WHERE l.name_th = TRIM(s.location_name)
        AND l.level = 'country'
        AND l.parent_id IS NULL
  );

-- 2) Regions
INSERT INTO locations (name_th, name_en, level, parent_id)
SELECT DISTINCT
    TRIM(s.location_name),
    NULL,
    'region',
    c.location_id
FROM stg_region AS s
JOIN locations AS c
  ON c.level = 'country'
 AND c.name_th = 'ประเทศไทย'
WHERE TRIM(s.location_name) <> ''
  AND NOT EXISTS (
      SELECT 1
      FROM locations AS existing
      WHERE existing.name_th = TRIM(s.location_name)
        AND existing.level = 'region'
        AND existing.parent_id = c.location_id
  );

-- 3) Explicit province-to-region mapping.
-- This mapping covers the 76 distinct province names in stg_province.
DROP TEMPORARY TABLE IF EXISTS tmp_province_region;
CREATE TEMPORARY TABLE tmp_province_region (
    province_name VARCHAR(100) NOT NULL PRIMARY KEY,
    region_name   VARCHAR(100) NOT NULL
);

INSERT INTO tmp_province_region (province_name, region_name) VALUES
-- North (17)
('กำแพงเพชร', 'ภาคเหนือ'),
('ตาก', 'ภาคเหนือ'),
('นครสวรรค์', 'ภาคเหนือ'),
('น่าน', 'ภาคเหนือ'),
('พะเยา', 'ภาคเหนือ'),
('พิจิตร', 'ภาคเหนือ'),
('พิษณุโลก', 'ภาคเหนือ'),
('เพชรบูรณ์', 'ภาคเหนือ'),
('แพร่', 'ภาคเหนือ'),
('แม่ฮ่องสอน', 'ภาคเหนือ'),
('ลำปาง', 'ภาคเหนือ'),
('ลำพูน', 'ภาคเหนือ'),
('สุโขทัย', 'ภาคเหนือ'),
('อุตรดิตถ์', 'ภาคเหนือ'),
('อุทัยธานี', 'ภาคเหนือ'),
('เชียงราย', 'ภาคเหนือ'),
('เชียงใหม่', 'ภาคเหนือ'),

-- Northeast (20)
('กาฬสินธุ์', 'ภาคตะวันออกเฉียงเหนือ'),
('ขอนแก่น', 'ภาคตะวันออกเฉียงเหนือ'),
('ชัยภูมิ', 'ภาคตะวันออกเฉียงเหนือ'),
('นครพนม', 'ภาคตะวันออกเฉียงเหนือ'),
('นครราชสีมา', 'ภาคตะวันออกเฉียงเหนือ'),
('บึงกาฬ', 'ภาคตะวันออกเฉียงเหนือ'),
('บุรีรัมย์', 'ภาคตะวันออกเฉียงเหนือ'),
('มหาสารคาม', 'ภาคตะวันออกเฉียงเหนือ'),
('มุกดาหาร', 'ภาคตะวันออกเฉียงเหนือ'),
('ยโสธร', 'ภาคตะวันออกเฉียงเหนือ'),
('ร้อยเอ็ด', 'ภาคตะวันออกเฉียงเหนือ'),
('เลย', 'ภาคตะวันออกเฉียงเหนือ'),
('ศรีสะเกษ', 'ภาคตะวันออกเฉียงเหนือ'),
('สกลนคร', 'ภาคตะวันออกเฉียงเหนือ'),
('สุรินทร์', 'ภาคตะวันออกเฉียงเหนือ'),
('หนองคาย', 'ภาคตะวันออกเฉียงเหนือ'),
('หนองบัวลำภู', 'ภาคตะวันออกเฉียงเหนือ'),
('อำนาจเจริญ', 'ภาคตะวันออกเฉียงเหนือ'),
('อุดรธานี', 'ภาคตะวันออกเฉียงเหนือ'),
('อุบลราชธานี', 'ภาคตะวันออกเฉียงเหนือ'),

-- Central (25 in this dataset; Ang Thong is absent from the CSV)
('กรุงเทพมหานคร', 'ภาคกลาง'),
('กาญจนบุรี', 'ภาคกลาง'),
('จันทบุรี', 'ภาคกลาง'),
('ฉะเชิงเทรา', 'ภาคกลาง'),
('ชลบุรี', 'ภาคกลาง'),
('ชัยนาท', 'ภาคกลาง'),
('ตราด', 'ภาคกลาง'),
('นครนายก', 'ภาคกลาง'),
('นครปฐม', 'ภาคกลาง'),
('นนทบุรี', 'ภาคกลาง'),
('ปทุมธานี', 'ภาคกลาง'),
('ประจวบคีรีขันธ์', 'ภาคกลาง'),
('ปราจีนบุรี', 'ภาคกลาง'),
('เพชรบุรี', 'ภาคกลาง'),
('พระนครศรีอยุธยา', 'ภาคกลาง'),
('ราชบุรี', 'ภาคกลาง'),
('ลพบุรี', 'ภาคกลาง'),
('ระยอง', 'ภาคกลาง'),
('สมุทรปราการ', 'ภาคกลาง'),
('สมุทรสงคราม', 'ภาคกลาง'),
('สมุทรสาคร', 'ภาคกลาง'),
('สระบุรี', 'ภาคกลาง'),
('สระแก้ว', 'ภาคกลาง'),
('สิงห์บุรี', 'ภาคกลาง'),
('สุพรรณบุรี', 'ภาคกลาง'),

-- South (14)
('กระบี่', 'ภาคใต้'),
('ชุมพร', 'ภาคใต้'),
('ตรัง', 'ภาคใต้'),
('นครศรีธรรมราช', 'ภาคใต้'),
('นราธิวาส', 'ภาคใต้'),
('ปัตตานี', 'ภาคใต้'),
('พังงา', 'ภาคใต้'),
('พัทลุง', 'ภาคใต้'),
('ภูเก็ต', 'ภาคใต้'),
('ยะลา', 'ภาคใต้'),
('ระนอง', 'ภาคใต้'),
('สงขลา', 'ภาคใต้'),
('สตูล', 'ภาคใต้'),
('สุราษฎร์ธานี', 'ภาคใต้');

-- 4) Stop and inspect this result if any row is returned.
-- It should return 0 rows: every staging province must have a region mapping.
SELECT DISTINCT TRIM(s.location_name) AS unmapped_province
FROM stg_province AS s
LEFT JOIN tmp_province_region AS m
  ON m.province_name = TRIM(s.location_name)
WHERE TRIM(s.location_name) <> ''
  AND m.province_name IS NULL
ORDER BY unmapped_province;

-- 5) Load provinces, linking each to its region.
INSERT INTO locations (name_th, name_en, level, parent_id)
SELECT DISTINCT
    TRIM(s.location_name),
    NULL,
    'province',
    r.location_id
FROM stg_province AS s
JOIN tmp_province_region AS m
  ON m.province_name = TRIM(s.location_name)
JOIN locations AS r
  ON r.level = 'region'
 AND r.name_th = m.region_name
WHERE TRIM(s.location_name) <> ''
  AND NOT EXISTS (
      SELECT 1
      FROM locations AS existing
      WHERE existing.name_th = TRIM(s.location_name)
        AND existing.level = 'province'
        AND existing.parent_id = r.location_id
  );

-- 6) Expected counts: country=1, region=4, province=76, total=81.
SELECT level, COUNT(*) AS total
FROM locations
GROUP BY level
ORDER BY FIELD(level, 'country', 'region', 'province');

SELECT COUNT(*) AS total_locations
FROM locations;

DROP TEMPORARY TABLE IF EXISTS tmp_province_region;
