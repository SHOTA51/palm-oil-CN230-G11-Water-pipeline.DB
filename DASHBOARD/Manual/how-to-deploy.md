# How to: นำเว็บขึ้นออนไลน์

ตัวอย่างนี้ใช้ **Railway** สำหรับ MySQL + API และ **Vercel** สำหรับหน้าเว็บ (ใช้ผู้ให้บริการอื่นที่รองรับ MySQL 8 และ Docker ได้เหมือนกัน)

## 1. ฐานข้อมูล MySQL

1. สร้าง MySQL 8 บน Railway (หรือ Aiven / ผู้ให้บริการอื่น)
2. รันไฟล์ตามลำดับด้วย MySQL client

   ```sql
   SOURCE db/schema.sql;
   SOURCE db/seed.sql;
   ```

3. สร้างผู้ใช้สำหรับ API ที่มีสิทธิ์อ่านอย่างเดียว (ดูตัวอย่างใน `db/dev-user.sql` แล้ว**เปลี่ยนรหัสผ่าน**)

   ```sql
   CREATE USER 'dashboard_app'@'%' IDENTIFIED BY 'รหัสผ่านที่ยาวและเดายาก';
   GRANT SELECT ON `plam-oil`.* TO 'dashboard_app'@'%';
   ```

## 2. API

สร้าง service จากโฟลเดอร์ `backend/` (มี `Dockerfile` อยู่แล้ว) แล้วตั้ง environment variables

| ตัวแปร | ค่า |
|---|---|
| `DATABASE_URL` | `mysql://dashboard_app:รหัสผ่าน@host:port/plam-oil` (ขึ้นต้น `mysql://` ได้ ระบบแปลงให้เอง) |
| `ALLOWED_ORIGINS` | URL ของหน้าเว็บ เช่น `https://palm-dashboard.vercel.app` (หลายค่าคั่นด้วย `,`) |
| `GEMINI_API_KEY` | คีย์ Gemini (ใส่ในหน้าตั้งค่า secret ของผู้ให้บริการ ห้ามใส่ในโค้ด) |
| `RAG_INDEX_PATH` | (ไม่บังคับ) ที่เก็บเวกเตอร์ เช่น `/srv/data/rag_index.npz` บน volume ถาวร เพื่อไม่ต้องฝังใหม่ทุกครั้งที่ deploy |

ตรวจด้วย `https://<api>/api/health` และ `https://<api>/api/rag/status`

## 3. หน้าเว็บ

1. Import โปรเจกต์ใน Vercel โดยตั้ง Root Directory เป็น `frontend`
2. ตั้ง environment variable `NEXT_PUBLIC_API_URL=https://<api ของคุณ>`
3. Deploy แล้วเปิด URL ที่ได้จากเครื่องอื่นเพื่อทดสอบ

## ก่อนนำเสนอ

- เปิด `https://<api>/api/health` ก่อนเริ่มสักครู่ เพื่อปลุกเซิร์ฟเวอร์ฟรีที่หลับอยู่
- ลองถาม AI หนึ่งคำถาม เพื่อยืนยันว่าคีย์และโควตาใช้ได้
