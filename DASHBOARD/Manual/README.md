# คู่มือแดชบอร์ดปาล์มน้ำมัน (Manual)

คู่มือนี้แบ่งเป็นไฟล์ย่อยตามหัวข้อ แยกเป็น 2 กลุ่ม:

- **How to (วิธีทำ):** ทำตามทีละขั้นเพื่อให้ได้ผลลัพธ์
- **What is (คืออะไร):** อธิบายว่าแต่ละส่วนของระบบคืออะไรและทำงานอย่างไร

## How to (วิธีทำ)

| ไฟล์ | เนื้อหา |
|---|---|
| [how-to-run.md](how-to-run.md) | ติดตั้งและรันเว็บไซต์บนเครื่องตัวเองตั้งแต่เริ่ม |
| [how-to-use-the-website.md](how-to-use-the-website.md) | ใช้งานหน้าแดชบอร์ด ตัวกรอง กราฟ และช่องถาม AI |
| [how-to-set-up-gemini.md](how-to-set-up-gemini.md) | ใส่ API key ของ Gemini และเปิดการค้นหาเชิงความหมาย + RAG |
| [how-to-update-data.md](how-to-update-data.md) | อัปเดตข้อมูลเมื่อทีมฐานข้อมูลส่งข้อมูลชุดใหม่มา หรือต่อกับฐานข้อมูลของทีม |
| [how-to-deploy.md](how-to-deploy.md) | นำเว็บขึ้นออนไลน์ให้คนอื่นเปิดดูได้ |
| [troubleshooting.md](troubleshooting.md) | ปัญหาที่พบบ่อยและวิธีแก้ |

## What is (คืออะไร)

| ไฟล์ | เนื้อหา |
|---|---|
| [what-is-the-project.md](what-is-the-project.md) | ภาพรวมระบบ สถาปัตยกรรม และหน้าที่ของทุกโฟลเดอร์/ไฟล์ |
| [what-is-the-database.md](what-is-the-database.md) | ฐานข้อมูล `plam-oil`: star schema, ตาราง, คอลัมน์ และข้อควรระวัง |
| [what-is-the-api.md](what-is-the-api.md) | API ทุกเส้นที่เว็บเรียกใช้ พร้อมตัวอย่าง |
| [what-is-semantic-search-and-rag.md](what-is-semantic-search-and-rag.md) | การค้นหาเชิงความหมาย (semantic search) และ RAG คืออะไร ทำงานอย่างไรในโปรเจกต์นี้ |

## สรุปสั้นที่สุด

```powershell
# 1) เปิด Docker Desktop ก่อน แล้วรันที่โฟลเดอร์โปรเจกต์
docker compose up -d --build

# 2) รันหน้าเว็บ
cd frontend
npm install
npm run dev
```

เปิด <http://localhost:3000> ก็จะเห็นแดชบอร์ด
