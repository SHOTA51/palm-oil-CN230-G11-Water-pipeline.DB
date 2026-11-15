# What is: API ของแดชบอร์ด

API เขียนด้วย FastAPI อยู่ที่ <http://localhost:8000>
เปิด <http://localhost:8000/docs> เพื่อดูและทดลองเรียกทุกเส้นจากเบราว์เซอร์ (Swagger UI)

ทุกเส้นที่ดึงข้อมูลแดชบอร์ดส่ง `sql` กลับมาด้วย คือคำสั่ง SQL ที่ใช้จริง

## แดชบอร์ด

### `GET /api/health`
ตรวจว่า API และ MySQL ทำงาน คืนค่า `{"ok": true}`

### `GET /api/meta`
ข้อมูลตั้งต้นของหน้าเว็บ: รายชื่อพื้นที่ทั้งหมด, ตัวชี้วัดและหน่วย, ช่วงปี, รอบการเผยแพร่ และจำนวนแถวของแต่ละตาราง

### `GET /api/trend?location_id=1`
ค่าทั้ง 4 ตัวชี้วัดของพื้นที่หนึ่ง ทุกปี (1 แถวต่อปี)

```json
{"rows": [{"year": 2567, "planted": 6751370.0, "harvested": 6323317.0, "production": 18551998.0, "yield": 2934.0, "release_th": "7 กรกฎาคม 2569"}], "sql": "..."}
```

### `GET /api/ranking?year=2567&item_id=3&level=province&region_id=3`
อันดับพื้นที่ในปีที่เลือก

| พารามิเตอร์ | ค่า |
|---|---|
| `year` | ปี พ.ศ. |
| `item_id` | 1–4 |
| `level` | `province` (ค่าเริ่มต้น) หรือ `region` |
| `region_id` | (ไม่บังคับ) กรองเฉพาะจังหวัดในภาคนี้ |

แต่ละแถวมี `rank_no`, `value`, `prev_value` (ค่าปีก่อน) และ `national_share` (สัดส่วนต่อประเทศ, เป็น `null` สำหรับผลผลิตต่อไร่)

### `GET /api/regions?item_id=3`
ค่าของ 4 ภาค ทุกปี สำหรับกราฟเปรียบเทียบรายภาค

## ค้นหาและ AI

### `GET /api/rag/status`
สถานะดัชนีค้นหา

| ฟิลด์ | ความหมาย |
|---|---|
| `status` | `starting` (กำลังสร้าง), `semantic` (ใช้ Gemini), `keyword` (จับคู่คำอย่างเดียว), `error` |
| `chunks` | จำนวนข้อความในดัชนี (ปัจจุบัน 344) |
| `geminiConfigured` | มี `GEMINI_API_KEY` หรือไม่ |
| `error` | สาเหตุที่ใช้ Gemini ไม่ได้ (ถ้ามี) |

### `GET /api/search?q=ผลผลิตกระบี่ปี 2560&k=8`
คืนข้อความที่เกี่ยวข้องที่สุด `k` ชิ้น (สูงสุด 20) พร้อมคะแนน

```json
{"query": "...", "mode": "semantic", "results": [{"id": "series-13-2560", "kind": "series", "title": "จังหวัดกระบี่ (ภาคใต้) ปี 2560–2567", "text": "...", "location_id": 13, "year_from": 2560, "year_to": 2567, "score": 1.49}]}
```

### `POST /api/ask`
ถามคำถามแล้วให้ Gemini ตอบจากข้อมูลที่ค้นเจอ (RAG)

```json
// request body
{"question": "จังหวัดไหนผลิตปาล์มน้ำมันมากที่สุดในปี 2567"}

// response
{"answer": "สุราษฎร์ธานีผลิตมากที่สุด 4,541,860 ตัน [1] ...", "sources": [...], "mode": "semantic", "model": "gemini-flash-latest"}
```

ถ้า Gemini ใช้ไม่ได้ `answer` จะเป็น `null`, มี `error` บอกสาเหตุ และยังคืน `sources` ที่ค้นเจอมาให้

`/api/search` และ `/api/ask` จำกัดรวมกัน 20 ครั้งต่อนาทีต่อ IP (เกินจะได้ HTTP 429)

## ความปลอดภัย

- เบราว์เซอร์ส่งได้แค่พารามิเตอร์ ไม่สามารถส่ง SQL ได้ ทุกคำสั่งเป็น parameterized query
- ผู้ใช้ฐานข้อมูลของ API มีสิทธิ์ `SELECT` อย่างเดียว
- CORS อนุญาตเฉพาะ origin ใน `ALLOWED_ORIGINS`
- API key ของ Gemini อยู่ในตัวแปรสภาพแวดล้อมฝั่งเซิร์ฟเวอร์เท่านั้น
