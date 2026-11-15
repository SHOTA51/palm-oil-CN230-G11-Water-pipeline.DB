# How to: อัปเดตข้อมูล หรือต่อกับฐานข้อมูลของทีม

ข้อมูลของเว็บมาจาก repo ของทีมฐานข้อมูล
<https://github.com/SHOTA51/palm-oil-CN230-G11-Water-pipeline.DB> (โฟลเดอร์ `DATA_SET/export_csv`)

มี 2 วิธีให้เลือก

## วิธี A: ใช้สำเนาข้อมูลในโปรเจกต์นี้ (ค่าเริ่มต้น)

โปรเจกต์นี้เก็บสำเนา CSV ไว้ที่ `db/csv/` และแปลงเป็น `db/seed.sql` ไว้แล้ว เมื่อมีข้อมูลชุดใหม่ ทำตามนี้

1. ดึง CSV ล่าสุดจาก repo ของทีม

   ```powershell
   git clone https://github.com/SHOTA51/palm-oil-CN230-G11-Water-pipeline.DB.git palm-src
   Copy-Item palm-src\DATA_SET\export_csv\*.csv db\csv\ -Force
   ```

2. ถ้าทีมแก้โครงสร้างตาราง ให้คัดลอก `DATA_SET/sql/01_create_tables.sql` มาทับ `db/schema.sql` ด้วย

3. สร้าง `db/seed.sql` ใหม่

   ```powershell
   python db/build_seed.py
   ```

4. ลบฐานข้อมูลเดิมแล้วสร้างใหม่ (MySQL จะรัน `schema.sql` → `seed.sql` → `dev-user.sql` ให้อัตโนมัติ)

   ```powershell
   docker compose down -v
   docker compose up -d --build
   ```

   คำสั่ง `down -v` จะลบเวกเตอร์ที่เก็บไว้ด้วย ระบบจะฝังเวกเตอร์ใหม่ตอนเริ่ม (ถ้าตั้งค่า Gemini ไว้) และจะทำแบบนี้อยู่แล้วเมื่อข้อความของข้อมูลเปลี่ยน

5. ตรวจจำนวนแถว

   ```powershell
   docker compose exec db mysql -uroot -proot_dev_only plam-oil -e "SELECT COUNT(*) FROM production_stats"
   ```

## วิธี B: ต่อกับ container `plam-oil` ที่ทีมรันอยู่แล้ว

ถ้าเปิด container `plam-oil` ตาม `DATA_SET/docker-compose.yaml` ของทีมไว้แล้ว (พอร์ต 3306) ให้ API ชี้ไปที่ฐานข้อมูลนั้นแทน

1. แก้ `docker-compose.yml` ที่ service `api`

   ```yaml
   DATABASE_URL: mysql+pymysql://aaa:aaa@host.docker.internal:3306/plam-oil
   ```

   (`aaa`/`aaa` คือผู้ใช้ในไฟล์ compose ของทีม แก้ให้ตรงกับที่ใช้จริง)

2. รันเฉพาะ API

   ```powershell
   docker compose up -d --build --no-deps api
   ```

ไม่ต้องแก้โค้ดใด ๆ เพราะชื่อฐานข้อมูลและตารางตรงกันอยู่แล้ว
API ใช้แค่คำสั่ง `SELECT` จึงไม่แก้ไขข้อมูลของทีม

## ข้อมูลที่ API ต้องการ

API อ่านเฉพาะตาราง ERD 6 ตาราง (`locations`, `commodities`, `units`, `items`, `data_releases`, `production_stats`)
ตาราง staging (`stg_*`) ไม่จำเป็น

API ถือว่า `item_id` เป็นแบบนี้ (ตรงกับข้อมูลปัจจุบัน) ถ้าทีมเปลี่ยนเลข id ต้องแก้ใน `backend/app/queries.py`, `backend/app/rag/documents.py` และ `frontend/lib/format.ts`

| item_id | ตัวชี้วัด | หน่วย |
|---|---|---|
| 1 | เนื้อที่ยืนต้น | ไร่ |
| 2 | เนื้อที่ให้ผล | ไร่ |
| 3 | ผลผลิต | ตัน |
| 4 | ผลผลิตต่อเนื้อที่ให้ผล | กิโลกรัมต่อไร่ |
