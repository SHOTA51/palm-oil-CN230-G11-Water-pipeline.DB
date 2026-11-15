# How to: ตั้งค่า Gemini สำหรับการค้นหาเชิงความหมายและ RAG

## 1. ใส่ API key

สร้าง (หรือแก้) ไฟล์ `.env` ที่โฟลเดอร์หลักของโปรเจกต์ ที่เดียวกับ `docker-compose.yml`

```
GEMINI_API_KEY=คีย์ของคุณ
```

> ⚠️ **ห้ามใส่คีย์ในโค้ด ใน README หรือใน commit** ไฟล์ `.env` ถูกใส่ไว้ใน `.gitignore` แล้ว จึงจะไม่ถูก push ขึ้น GitHub
> ถ้าคีย์หลุดไปที่สาธารณะ (เช่นแชตหรือ GitHub) ให้ลบคีย์เก่าและสร้างใหม่ที่ <https://aistudio.google.com/apikey>

## 2. เปิดการเรียกเก็บเงิน (Billing) ของโปรเจกต์ Google

ตอนทดสอบระบบ คีย์ที่ให้มาเรียกดูรายชื่อโมเดลได้ แต่เมื่อเรียกใช้จริงได้ error นี้

```
Gemini HTTP 403: The Gemini API free tier is not available for this project.
To use the Gemini API, please set up billing to upgrade to the paid tier
```

แปลว่าโปรเจกต์ Google Cloud ที่ผูกกับคีย์นี้ใช้ free tier ไม่ได้ วิธีแก้มี 2 ทาง

1. **เปิด billing** ที่ <https://aistudio.google.com/billing> ให้กับโปรเจกต์ของคีย์นี้ หรือ
2. **ใช้คีย์จากโปรเจกต์อื่น** ที่ใช้ free tier ได้ (สร้างได้ที่ <https://aistudio.google.com/apikey>)

ค่าใช้จ่ายโดยประมาณ: ข้อความในดัชนีมี 344 ชิ้น การฝังเวกเตอร์ (embedding) ครั้งแรกใช้ไม่กี่แสนโทเค็น และระบบเก็บผลไว้ จึงไม่ต้องจ่ายซ้ำจนกว่าข้อมูลจะเปลี่ยน

## 3. รีสตาร์ต API ให้สร้างดัชนีใหม่

```powershell
docker compose up -d api        # ใช้คำสั่งนี้ถ้าเพิ่งแก้ไฟล์ .env (เพื่ออ่านคีย์ใหม่)
docker compose restart api      # ใช้คำสั่งนี้ถ้าคีย์เดิมแต่เพิ่งเปิด billing
```

ตอนเริ่มทำงาน API จะสร้างข้อความจากฐานข้อมูล แล้วส่งให้ Gemini ฝังเป็นเวกเตอร์ ดูความคืบหน้าได้ด้วย

```powershell
docker compose logs -f api
```

ถ้าสำเร็จจะเห็นบรรทัด

```
INFO rag rag index ready: 344 chunks, mode=semantic
```

และป้ายในกล่อง "ค้นหาและถามผู้ช่วย AI" จะเปลี่ยนเป็น **ค้นหาเชิงความหมาย · gemini-embedding-001** (สีเขียว)

ตรวจสถานะผ่าน API ได้ที่ <http://localhost:8000/api/rag/status>

```json
{"status": "semantic", "chunks": 344, "semantic": true, "embedModel": "gemini-embedding-001", "chatModel": "gemini-3.6-flash", "geminiConfigured": true, "error": null}
```

## 4. เปลี่ยนโมเดล (ไม่บังคับ)

เพิ่มในไฟล์ `.env` แล้วรัน `docker compose up -d api`

```
GEMINI_EMBED_MODEL=gemini-embedding-001   # โมเดลแปลงข้อความเป็นเวกเตอร์
GEMINI_CHAT_MODEL=gemini-3.6-flash,gemini-3.5-flash,gemini-3.1-flash-lite   # โมเดลเขียนคำตอบ ลองตามลำดับ ถ้าตัวแรกไม่ว่างจะใช้ตัวถัดไป
```

- `GEMINI_CHAT_MODEL` ใส่ได้หลายตัวคั่นด้วย `,` ระบบลองตามลำดับ ถ้าโมเดลแรกตอบ 503 (คนใช้เยอะ), 404 (เลิกให้บริการ) หรือไม่ตอบใน 40 วินาที จะใช้ตัวถัดไปเอง
- เปลี่ยน `GEMINI_CHAT_MODEL` ได้ทันที ไม่ต้องสร้างดัชนีใหม่
- เปลี่ยน `GEMINI_EMBED_MODEL` แล้ว ระบบจะฝังเวกเตอร์ใหม่ทั้งหมดเองตอนเริ่ม (เวกเตอร์จากคนละโมเดลเอามาเทียบกันไม่ได้)

## 5. คำสั่งจัดการดัชนี

```powershell
# สร้างดัชนีใหม่และพิมพ์สถานะ (ใช้เวกเตอร์เดิมถ้าข้อมูลไม่เปลี่ยน)
docker compose exec api python -m app.rag.build

# บังคับฝังเวกเตอร์ใหม่ทั้งหมด
docker compose exec api python -m app.rag.build --force

# ส่งออกข้อความทุกชิ้นที่ใช้ค้นหา เพื่อตรวจดูว่า AI เห็นอะไร
docker compose exec api python -m app.rag.build --dump /srv/data/chunks.jsonl
docker compose cp api:/srv/data/chunks.jsonl .
```

คำสั่ง `build` รันเป็นโปรเซสแยก เมื่อรันเสร็จให้ `docker compose restart api` เพื่อให้เซิร์ฟเวอร์โหลดดัชนีใหม่ (เวกเตอร์ถูกเก็บไว้ใน volume `rag_data` แล้ว ตอนรีสตาร์ตจึงไม่ต้องฝังซ้ำ)

## 6. การจำกัดการใช้งาน

เพื่อไม่ให้โควตา Gemini หมดเร็ว แต่ละ IP ใช้ `/api/search` และ `/api/ask` รวมกันได้ 20 ครั้งต่อนาที เปลี่ยนได้ด้วยตัวแปร `AI_RATE_LIMIT_PER_MIN`
