# palm-oil-CN230-G11-Water-pipeline.DB

สำหรับรัน SQL

docker compose -f .\DATA_SET\docker-compose.yaml up -d    
docker ps         
docker exec -it plam-oil bash                  
mysql -p

------------------------------
1. 
SOURCE /docker-entrypoint-initdb.d/01_create_tables.sql;

#check
USE plam-oil;
SHOW TABLES;

------------------------------
2. ทำไมต้องสร้าง Staging 3 ตาราง?
เพราะเราต้องการเก็บข้อมูลดิบแยกตามระดับพื้นที่ เพื่อป้องกันการนำข้อมูลระดับจังหวัด ภาค และประเทศมาปะปนกัน

3 ตารางที่เราเพิ่งสร้างเพิ่ม ได้แก่
- stg_province
- stg_region
- stg_country
ทั้ง 3 ตารางนี้ไม่มีอยู่ใน ERD 
แต่ผมตั้งใจเพิ่มเข้ามาเพื่อเป็นพื้นที่พักข้อมูลก่อนนำเข้าสู่ Database หลัก

SOURCE /docker-entrypoint-initdb.d/02_create_staging.sql;

#check
USE plam-oil;
SHOW TABLES;

------------------------------
3. python -m pip install pandas openpyxl

cd .\DATA_SET
python convert_to_csv.py