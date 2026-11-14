# Palm Oil Dashboard Data Preparation (MySQL 8.4)

คู่มือนี้เป็นลำดับหลักสำหรับเตรียมข้อมูลจาก CSV ให้พร้อมใช้ในเว็บ Dashboard โดยใช้ MySQL ตาม `DATA_SET/docker-compose.yaml` ตาราง `stg_*` เป็น staging เพิ่มเติม ส่วนตารางอื่นเป็น star schema ตาม ERD

## ใน dataset มีวิธี import เข้าจาก csv โดยตรงไม่จำเป็นต้องเป็น SQL

## สถานะฐานข้อมูลปัจจุบัน

ตรวจจาก container `plam-oil` เมื่อ 14 พ.ย. 2026 พบตารางครบ 9 ตาราง:

| กลุ่ม | ตาราง | จำนวนปัจจุบัน |
|---|---|---:|
| Dimension | `locations`, `commodities`, `items`, `units`, `data_releases` | 81, 1, 4, 3, 9 |
| Fact | `production_stats` | 6,960 |
| Staging | `stg_province`, `stg_region`, `stg_country` | 6,308, 480, 172 |

การตรวจแบบอ่านอย่างเดียวพบ fact ไม่มี `release_id` ว่างและไม่พบ grain ซ้ำตาม unique key ที่กำหนด ข้อมูลในฐานที่กำลังรันยังไม่ได้ถูกลบหรือโหลดซ้ำ

## ลำดับทำงาน

1. เตรียม CSV จาก workbook หากจำเป็น:

   ```powershell
   cd DATA_SET
   python convert_to_csv.py
   ```

2. เริ่ม MySQL (volume เดิมจะถูกรักษาไว้):

   ```powershell
   docker compose -f .\DATA_SET\docker-compose.yaml up -d
   docker ps
   ```

3. เปิด MySQL client ใน container:

   ```powershell
   docker exec -it plam-oil mysql --local-infile=1 -uroot -p
   ```

   ใส่รหัสผ่านตาม `DATA_SET/docker-compose.yaml` ในฐานที่มีตารางแล้ว ให้ข้ามขั้นสร้างตาราง `01` และ `02` แล้วนำเข้า CSV ใหม่ได้เลย หากเป็นฐานว่างให้รัน `01` และ `02` ก่อน จากนั้นรัน:

   ```sql
   SOURCE /docker-entrypoint-initdb.d/01_create_tables.sql;
   SOURCE /docker-entrypoint-initdb.d/02_create_staging.sql;
   SOURCE /docker-entrypoint-initdb.d/03_import_Region_Province.sql;
   SOURCE /docker-entrypoint-initdb.d/04_import_country.sql;
   ```

   Import scripts จะล้างเฉพาะ staging table ที่เกี่ยวข้องก่อนนำเข้าใหม่ เพื่อไม่ให้การนำเข้าซ้ำเพิ่มแถวซ้ำ

4. ตรวจจำนวนแถว staging ก่อนโหลดมิติและ fact:

   ```sql
   SELECT 'province' dataset, COUNT(*) total FROM stg_province
   UNION ALL SELECT 'region', COUNT(*) FROM stg_region
   UNION ALL SELECT 'country', COUNT(*) FROM stg_country;
   ```

   ค่าที่คาดหวังจาก CSV ปัจจุบันคือ 6,308 / 480 / 172 ตามลำดับ หากไม่ตรง ให้หยุดตรวจการนำเข้าก่อน

5. รัน validation ก่อนโหลด โดยตรวจว่าไม่มีฟิลด์บังคับว่าง ปีไม่ตรงกัน หรือตัวเลขผิดรูปแบบ:

   ```sql
   SOURCE /docker-entrypoint-initdb.d/05_staging_validation.sql;
   ```

6. โหลด dimensions และตำแหน่งตามลำดับ:

   ```sql
   SOURCE /docker-entrypoint-initdb.d/07_02_load_dimensions.sql;
   SOURCE /docker-entrypoint-initdb.d/07_03_load_locations.sql;
   ```

   วันที่ `16 ตุลาคม 2568` ถูกแปลงเป็น `2025-10-16` แล้ว อย่าลบรันแก้ label ใน `07_03` เพราะชื่อไทยใน source เป็นข้อมูลที่ใช้จับคู่กับ fact

7. โหลด fact และตรวจผล:

   ```sql
   SOURCE /docker-entrypoint-initdb.d/08_01_load_production_stats.sql;
   SOURCE /docker-entrypoint-initdb.d/09_01_data_quality_checks.sql;
   ```

   จำนวน fact ที่คาดหวังคือ 6,960 แถว สคริปต์โหลด fact รองรับการรันซ้ำโดยอัปเดตแถวที่ชน `uq_stats` ซึ่งหมายถึงเก็บค่าปัจจุบันต่อพื้นที่/สินค้า/ตัวชี้วัด/ปีเพาะปลูก หากต้องเก็บข้อมูลหลาย release ของ grain เดียวกัน ต้องปรับ unique key และนโยบาย versioning ก่อน

## ไฟล์ SQL

- **ชุดทำงานหลัก:** `01`, `02`, `03`, `04`, `05_staging_validation`, `07_02`, `07_03`, `08_01`, `09_01`
- **ตรวจ business logic เพิ่มเติม (อ่านอย่างเดียว):** `10_business_logic_validation.sql`

ไฟล์ตรวจสอบที่ซ้ำกันถูกรวมเป็น `05_staging_validation.sql` และ `09_01_data_quality_checks.sql` แล้ว ส่วน `10_business_logic_validation.sql` เก็บไว้สำหรับตรวจความสมเหตุสมผลของหน่วยและอัตราผลผลิตก่อนทำ KPI

## เตรียมต่อสำหรับเว็บ

ฐานข้อมูลมี hierarchy พื้นที่สำหรับ drill-down และคอลัมน์ `name_en` สำหรับค้นหาภาษาอังกฤษ (ปัจจุบันยังไม่มีการเติมชื่ออังกฤษ) ขั้นถัดไปคือกำหนด query/view ตามตัวกรอง Dashboard ที่ต้องการ และเพิ่ม index จากรูปแบบการค้นหาจริงของเว็บ โดยยังไม่ควรสร้างสรุปที่บวกจังหวัด ภาค และประเทศรวมกัน เพราะเป็นระดับข้อมูลซ้อนกัน
