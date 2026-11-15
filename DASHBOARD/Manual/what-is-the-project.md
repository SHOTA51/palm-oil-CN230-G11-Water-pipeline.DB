# What is: ภาพรวมโปรเจกต์และหน้าที่ของทุกไฟล์

## โปรเจกต์นี้คืออะไร

**แดชบอร์ดปาล์มน้ำมันประเทศไทย** เป็นเว็บไซต์ภาษาไทยที่แสดงสถิติปาล์มน้ำมัน ได้แก่ เนื้อที่ยืนต้น เนื้อที่ให้ผล ผลผลิต และผลผลิตต่อไร่ ระดับประเทศ ภาค และจังหวัด ปีเพาะปลูก พ.ศ. 2525–2567
ข้อมูลทั้งหมดดึงสดจากฐานข้อมูล MySQL `plam-oil` ของโปรเจกต์ CN230 กลุ่ม G11 และมีผู้ช่วย AI ที่ตอบคำถามจากข้อมูลในฐานข้อมูลด้วยเทคนิค RAG

## สถาปัตยกรรม

```
 เบราว์เซอร์ (Next.js, หน้าเว็บภาษาไทย)          localhost:3000
        │  fetch JSON
        ▼
 API (FastAPI, Python)                          localhost:8000
   ├── /api/meta, /api/trend, /api/ranking, /api/regions  ──► SQL ──► MySQL plam-oil (localhost:3307)
   └── /api/search, /api/ask
          ├── ดัชนีค้นหา (สร้างจาก SQL ตอนเริ่มทำงาน)
          └── Gemini API (embedding + สร้างคำตอบ) ──► generativelanguage.googleapis.com
```

- หน้าเว็บ**ไม่เคยส่ง SQL** ไปที่เซิร์ฟเวอร์ ส่งแค่พารามิเตอร์ (เช่นปี, รหัสพื้นที่) แล้ว API ใช้ SQL ที่เขียนไว้ล่วงหน้าแบบ parameterized ป้องกัน SQL injection
- API ใช้ผู้ใช้ MySQL ที่มีสิทธิ์ `SELECT` อย่างเดียว
- API key ของ Gemini อยู่ฝั่งเซิร์ฟเวอร์เท่านั้น ไม่ถูกส่งไปที่เบราว์เซอร์

## โครงสร้างโฟลเดอร์

```
DB Dashboard/
├── Manual/                 คู่มือนี้
├── docker-compose.yml      สั่งรัน MySQL + API พร้อมกัน
├── .env                    API key ของ Gemini (ห้าม commit, อยู่ใน .gitignore)
├── .env.example            ตัวอย่างไฟล์ .env
├── README.md               สรุปโปรเจกต์สั้น ๆ
├── db/                     ฐานข้อมูล
├── backend/                API (Python)
├── frontend/               หน้าเว็บ (Next.js)
└── archive/                โค้ดเก่า (สไลด์ normalization) เก็บไว้เผื่อใช้ ลบได้
```

### `db/` ฐานข้อมูล

| ไฟล์ | หน้าที่ |
|---|---|
| `schema.sql` | สร้างฐานข้อมูล `plam-oil` และ 6 ตาราง (คัดลอกจาก `DATA_SET/sql/01_create_tables.sql` ของทีม) |
| `seed.sql` | คำสั่ง INSERT ข้อมูลทั้งหมด (สร้างอัตโนมัติจาก CSV ห้ามแก้ด้วยมือ) |
| `dev-user.sql` | สร้างผู้ใช้ `dashboard_app` ที่มีสิทธิ์ SELECT อย่างเดียว |
| `build_seed.py` | สคริปต์แปลง `csv/*.csv` เป็น `seed.sql` |
| `csv/` | สำเนา CSV จาก `DATA_SET/export_csv` ของทีม |

MySQL ใน Docker รัน 3 ไฟล์ `.sql` นี้ตามลำดับเมื่อสร้างฐานข้อมูลครั้งแรก

### `backend/` API

| ไฟล์ | หน้าที่ |
|---|---|
| `Dockerfile` | สร้าง image Python 3.12 ที่รัน uvicorn |
| `requirements.txt` | ไลบรารี: FastAPI, SQLAlchemy, PyMySQL, httpx, numpy |
| `app/main.py` | กำหนดเส้นทาง API ทั้งหมด, CORS, การจำกัดจำนวนครั้ง และสั่งสร้างดัชนีค้นหาตอนเริ่ม |
| `app/db.py` | เชื่อมต่อ MySQL (charset utf8mb4 สำหรับภาษาไทย) และแปลงผลลัพธ์เป็น JSON |
| `app/queries.py` | **คำสั่ง SQL ทุกคำสั่ง**ของแดชบอร์ด (pivot, window function, self-join) |
| `app/rag/documents.py` | แปลงข้อมูลในฐานข้อมูลเป็นข้อความภาษาไทย 344 ชิ้นสำหรับค้นหา |
| `app/rag/gemini.py` | เรียก Gemini REST API (embedding และ generateContent) |
| `app/rag/index.py` | ดัชนีค้นหาแบบผสม (เวกเตอร์ + คำ) และการตอบคำถามแบบ RAG |
| `app/rag/build.py` | คำสั่งสร้างดัชนีใหม่ด้วยมือ |

### `frontend/` หน้าเว็บ

| ไฟล์ | หน้าที่ |
|---|---|
| `app/layout.tsx` | โครงหน้า HTML, `lang="th"`, ฟอนต์ IBM Plex Sans Thai |
| `app/page.tsx` | หน้าแรก แสดงคอมโพเนนต์ `Dashboard` |
| `app/globals.css` | สไตล์ทั้งหมด ธีมสว่าง/มืด และการจัดหน้าบนมือถือ |
| `components/Dashboard.tsx` | หน้าแดชบอร์ด: ตัวกรอง การ์ดสรุป และการ์ดกราฟทั้งหมด |
| `components/AskPanel.tsx` | กล่องค้นหาและถาม AI พร้อมแหล่งอ้างอิง |
| `components/LineChart.tsx` | กราฟเส้น SVG (เขียนเอง ไม่ใช้ไลบรารี) พร้อม tooltip |
| `components/RankingBars.tsx` | ตารางอันดับพร้อมแท่งกราฟ |
| `components/useWidth.ts` | วัดความกว้างการ์ดเพื่อให้กราฟปรับตามขนาดจอ |
| `lib/api.ts` | ฟังก์ชันเรียก API ทุกเส้น |
| `lib/types.ts` | ชนิดข้อมูล (TypeScript) ของผลลัพธ์จาก API |
| `lib/format.ts` | จัดรูปแบบตัวเลขภาษาไทย (เช่น "18.6 ล้าน"), ร้อยละ, ชื่อย่อตัวชี้วัด |
| `.env.local` | `NEXT_PUBLIC_API_URL` ที่อยู่ของ API |

## เทคโนโลยีที่ใช้

| ส่วน | เทคโนโลยี |
|---|---|
| ฐานข้อมูล | MySQL 8.4 |
| API | Python 3.12, FastAPI, SQLAlchemy, PyMySQL |
| AI | Google Gemini: `gemini-embedding-001` (เวกเตอร์), `gemini-3.6-flash` → `gemini-3.5-flash` → `gemini-3.1-flash-lite` (เขียนคำตอบ, ลองตามลำดับ) |
| หน้าเว็บ | Next.js 16, React 19, TypeScript |
| รันระบบ | Docker Compose |
