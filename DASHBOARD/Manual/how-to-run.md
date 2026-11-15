# How to: รันเว็บไซต์บนเครื่องตัวเอง

เว็บไซต์มี 3 ส่วนที่ต้องรันพร้อมกัน:

1. **MySQL** (ฐานข้อมูล `plam-oil`) ทำงานใน Docker
2. **API** (FastAPI, Python) ทำงานใน Docker ที่ <http://localhost:8000>
3. **หน้าเว็บ** (Next.js) รันด้วย Node.js ที่ <http://localhost:3000>

## 1. สิ่งที่ต้องติดตั้งก่อน

| โปรแกรม | เวอร์ชันที่ใช้ทดสอบ | ใช้ทำอะไร |
|---|---|---|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | 29.x | รัน MySQL และ API |
| [Node.js](https://nodejs.org/) | 20 ขึ้นไป (ทดสอบกับ 24) | รันหน้าเว็บ |
| Git (ไม่บังคับ) | ใดก็ได้ | ดึงโค้ด |

> ไม่ต้องติดตั้ง MySQL หรือ Python ลงเครื่อง เพราะ Docker จัดการให้ทั้งหมด

## 2. ตั้งค่า API key ของ Gemini (ไม่บังคับ)

ถ้าต้องการให้ช่อง "ถาม AI" ใช้ Gemini ได้ ให้สร้างไฟล์ `.env` ไว้ที่โฟลเดอร์หลักของโปรเจกต์ (ที่เดียวกับ `docker-compose.yml`):

```
GEMINI_API_KEY=ใส่คีย์ของคุณตรงนี้
```

มีไฟล์ตัวอย่างให้คัดลอกคือ `.env.example` (ในเครื่องนี้ไฟล์ `.env` ถูกสร้างไว้ให้แล้ว)
ถ้าไม่ใส่คีย์ เว็บยังใช้งานได้ทุกส่วน แต่การค้นหาจะเป็นแบบจับคู่คำ และจะยังไม่มีคำตอบจาก AI ดูรายละเอียดใน [how-to-set-up-gemini.md](how-to-set-up-gemini.md)

## 3. เปิดฐานข้อมูลและ API

1. เปิดโปรแกรม **Docker Desktop** แล้วรอจนขึ้นว่า *Engine running*
2. เปิด PowerShell ที่โฟลเดอร์โปรเจกต์ แล้วรัน:

   ```powershell
   docker compose up -d --build
   ```

   ครั้งแรกจะใช้เวลา 1–3 นาที เพราะต้องดาวน์โหลด MySQL และสร้างตารางพร้อมใส่ข้อมูล 6,960 แถว

3. ตรวจว่าทำงานแล้ว:

   ```powershell
   docker compose ps                       # ต้องเห็น db (healthy) และ api (running)
   curl http://localhost:8000/api/health   # ต้องได้ {"ok":true}
   ```

   หรือเปิด <http://localhost:8000/docs> ในเบราว์เซอร์ จะเห็นหน้ารวม API ทั้งหมด

## 4. เปิดหน้าเว็บ

```powershell
cd frontend
npm install      # ครั้งแรกครั้งเดียว
npm run dev      # โหมดพัฒนา แก้โค้ดแล้วหน้าเว็บรีเฟรชเอง
```

เปิด <http://localhost:3000>

มุมขวาบนจะมีป้าย **"ข้อมูลสด · MySQL"** สีเขียว แปลว่าเว็บดึงข้อมูลจากฐานข้อมูลได้แล้ว

### รันแบบ production (เร็วกว่า เหมือนตอนขึ้นเว็บจริง)

```powershell
cd frontend
npm run build
npm run start
```

## 5. ปิดระบบ

```powershell
# หยุดหน้าเว็บ: กด Ctrl + C ในหน้าต่างที่รัน npm
docker compose down        # หยุด MySQL และ API (ข้อมูลยังอยู่)
docker compose down -v     # หยุดและลบข้อมูลทั้งหมด ครั้งหน้าจะสร้างฐานข้อมูลใหม่จาก db/seed.sql
```

## 6. ค่าเริ่มต้นที่ควรรู้

| รายการ | ค่า |
|---|---|
| หน้าเว็บ | <http://localhost:3000> |
| API | <http://localhost:8000> (เอกสาร API: `/docs`) |
| MySQL จากเครื่องเรา | `localhost:3307` (ใช้ 3307 เพื่อไม่ชนกับ MySQL หรือ container `plam-oil` ของทีมที่ใช้ 3306) |
| ชื่อฐานข้อมูล | `plam-oil` |
| ผู้ใช้ของ API | `dashboard_app` / `dashboard_app_pw` (มีสิทธิ์ SELECT อย่างเดียว) |
| ผู้ใช้ root (สำหรับพัฒนาเท่านั้น) | `root` / `root_dev_only` |

เข้า MySQL ด้วยมือ:

```powershell
docker compose exec db mysql -uroot -proot_dev_only --default-character-set=utf8mb4 plam-oil
```

## รันโดยไม่ใช้ Docker สำหรับ API (ทางเลือก)

ถ้ามี MySQL อยู่แล้วและอยากรัน API ด้วย Python ตรง ๆ:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
$env:DATABASE_URL = "mysql+pymysql://USER:PASS@localhost:3306/plam-oil"
$env:GEMINI_API_KEY = "คีย์ของคุณ"    # ไม่บังคับ
uvicorn app.main:app --reload --port 8000
```
