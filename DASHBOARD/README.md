# แดชบอร์ดปาล์มน้ำมันประเทศไทย

เว็บแดชบอร์ดภาษาไทยแสดงเนื้อที่ยืนต้น เนื้อที่ให้ผล ผลผลิต และผลผลิตต่อไร่ของปาล์มน้ำมัน ระดับประเทศ ภาค และจังหวัด (ปีเพาะปลูก พ.ศ. 2525–2567)
ดึงข้อมูลสดจากฐานข้อมูล MySQL `plam-oil` ของ [palm-oil-CN230-G11](https://github.com/SHOTA51/palm-oil-CN230-G11-Water-pipeline.DB) และมีผู้ช่วย AI (Gemini) ตอบคำถามจากข้อมูลด้วยการค้นหาเชิงความหมาย + RAG
หน้า `/normalization` แสดงขั้นตอน normalization ตั้งแต่ไฟล์ดิบจนถึง star schema 6 ตาราง

**แหล่งที่มาของข้อมูล:** ชุดข้อมูล “ปริมาณการผลิตปาล์มน้ำมัน” ของศูนย์สารสนเทศการเกษตร สำนักงานเศรษฐกิจการเกษตร (สศก.)
<https://catalog.oae.go.th/en/dataset/dataoae1504> 3 ไฟล์: ระดับประเทศ (`oil_palm_production_wholecountry.xlsx`), ระดับภาค (`oil_palm_production_region.xlsx`) และระดับจังหวัด (`oil_palm_production_province.xlsx`)

```
frontend/  Next.js 16: หน้าแดชบอร์ดภาษาไทย
backend/   FastAPI: SQL ของแดชบอร์ด + ค้นหาเชิงความหมาย/RAG ด้วย Gemini
db/        schema.sql + seed.sql ของฐานข้อมูล plam-oil (สร้างจาก db/csv ด้วย build_seed.py)
Manual/    คู่มือการใช้งานและคำอธิบายระบบ (เริ่มที่ Manual/README.md)
archive/   โค้ดสไลด์ normalization เดิม (ไม่ได้ใช้แล้ว)
```

## เริ่มใช้งาน

```powershell
copy .env.example .env              # ใส่ GEMINI_API_KEY (ไม่บังคับ)
docker compose up -d --build        # MySQL (พอร์ต 3307) + API http://localhost:8000
cd frontend
npm install
npm run dev                         # http://localhost:3000
```

อ่านต่อใน [Manual/README.md](Manual/README.md)
