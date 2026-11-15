# ปัญหาที่พบบ่อยและวิธีแก้

## หน้าเว็บขึ้นว่า "เชื่อมต่อฐานข้อมูลไม่ได้"

หน้าเว็บติดต่อ API ไม่ได้

1. เปิด Docker Desktop แล้วหรือยัง
2. รัน `docker compose ps` ต้องเห็น `api` สถานะ running ถ้าไม่เห็นให้รัน `docker compose up -d`
3. เปิด <http://localhost:8000/api/health> ต้องได้ `{"ok":true}`
4. ตรวจ `frontend/.env.local` ว่า `NEXT_PUBLIC_API_URL=http://localhost:8000` (แก้แล้วต้องรัน `npm run dev` ใหม่)
5. ดู log ของ API: `docker compose logs api`

## `docker compose` ขึ้น error เรื่อง `dockerDesktopLinuxEngine`

Docker Desktop ยังไม่ได้เปิด ให้เปิดโปรแกรมแล้วรอจนขึ้นว่า Engine running

## พอร์ต 3307 หรือ 8000 ถูกใช้อยู่

แก้ฝั่งซ้ายของ `ports` ใน `docker-compose.yml` เช่น `"3308:3306"` หรือ `"8001:8000"`
ถ้าเปลี่ยนพอร์ต API ต้องแก้ `NEXT_PUBLIC_API_URL` ใน `frontend/.env.local` ด้วย

## ตัวอักษรไทยเป็นเครื่องหมาย ? หรืออ่านไม่ออก

- ฐานข้อมูลต้องเป็น `utf8mb4` (`docker-compose.yml` ตั้งไว้แล้ว)
- เข้า MySQL ด้วย `--default-character-set=utf8mb4`
- ถ้าทดสอบ API ด้วย `curl` บน Git Bash ของ Windows ภาษาไทยในพารามิเตอร์อาจเพี้ยนก่อนถึงเซิร์ฟเวอร์ ให้ทดสอบจากเบราว์เซอร์ หรือจาก <http://localhost:8000/docs> แทน

## ป้ายในกล่องถาม AI ขึ้นว่า "ค้นหาด้วยคำ (ยังไม่ได้เชื่อม Gemini)"

เอาเมาส์ชี้ที่ป้ายเพื่อดูสาเหตุ หรือเปิด <http://localhost:8000/api/rag/status>

| ข้อความใน `error` | วิธีแก้ |
|---|---|
| `ยังไม่ได้ตั้งค่า GEMINI_API_KEY` | ใส่คีย์ในไฟล์ `.env` แล้วรัน `docker compose up -d api` |
| `Gemini HTTP 403: ... free tier is not available for this project` | เปิด billing หรือใช้คีย์จากโปรเจกต์อื่น ดู [how-to-set-up-gemini.md](how-to-set-up-gemini.md) |
| `Gemini HTTP 400: API key not valid` | คีย์ผิดหรือถูกลบไปแล้ว สร้างคีย์ใหม่ |
| `Gemini HTTP 429` | เกินโควตา ระบบรอและลองใหม่เองระหว่างสร้างดัชนี ถ้ายังหยุดอยู่ (เช่นโควตารายวันหมด) รอแล้วรัน `docker compose restart api` จะทำต่อจากที่ค้างไว้ |
| `Gemini HTTP 404` | ชื่อโมเดลใน `GEMINI_EMBED_MODEL` / `GEMINI_CHAT_MODEL` ไม่มีแล้ว เปลี่ยนเป็นรุ่นที่มี |

หลังแก้แล้วต้องรีสตาร์ต API เสมอ (`docker compose restart api`) เพราะดัชนีสร้างตอนเริ่มทำงาน

## ถาม AI แล้วขึ้นว่า "ใช้งานบ่อยเกินไป"

ถึงขีดจำกัด 20 ครั้งต่อนาทีต่อ IP รอ 1 นาที หรือเพิ่มค่า `AI_RATE_LIMIT_PER_MIN` ใน `docker-compose.yml`

## ป้ายขึ้นว่า "กำลังสร้างดัชนีค้นหา…" นาน

ครั้งแรกที่ฝังเวกเตอร์ด้วย Gemini ใช้เวลาหลายนาที (free tier จำกัดจำนวนต่อนาที ระบบจะรอเป็นช่วง ๆ) ระหว่างนี้ค้นหาด้วยคำได้ตามปกติ ดูความคืบหน้าด้วย `docker compose logs -f api`

## ข้อมูลบนเว็บไม่ตรงกับ CSV ใหม่

ฐานข้อมูลใน Docker สร้างจาก `db/seed.sql` แค่ครั้งแรก ต้องสร้าง seed ใหม่และลบ volume ก่อน ดู [how-to-update-data.md](how-to-update-data.md)

## `npm run dev` error เรื่อง `LayoutProps` หรือ type

ลบโฟลเดอร์ `frontend/.next` แล้วรันใหม่
