# What is: ฐานข้อมูล `plam-oil`

ฐานข้อมูลนี้มาจาก repo ของทีม <https://github.com/SHOTA51/palm-oil-CN230-G11-Water-pipeline.DB>
ทีมนำเข้าข้อมูลดิบจาก Excel/CSV เข้าตาราง staging (`stg_*`) ตรวจสอบความถูกต้อง แล้วโหลดเข้า **star schema** ที่เว็บใช้

## แหล่งที่มาของข้อมูล

ชุดข้อมูล **“ปริมาณการผลิตปาล์มน้ำมัน”** (`dataoae1504`) ของศูนย์สารสนเทศการเกษตร สำนักงานเศรษฐกิจการเกษตร (สศก.)
<https://catalog.oae.go.th/en/dataset/dataoae1504> · สัญญาอนุญาต Open Data Common · ปรับปรุงปีละครั้ง

| ไฟล์ | ระดับ | แถว | คอลัมน์พื้นที่ |
|---|---|---:|---|
| [oil_palm_production_wholecountry.xlsx](https://catalog.oae.go.th/en/dataset/dataoae1504/resource/88dfeaf6-3d8a-4ffb-956e-68becc9d7074) | ประเทศ | 172 | `province` |
| [oil_palm_production_region.xlsx](https://catalog.oae.go.th/en/dataset/dataoae1504/resource/1d6e4b0a-47dc-4094-8aab-838a23acb379) | ภาค | 480 | `province_name` |
| [oil_palm_production_province.xlsx](https://catalog.oae.go.th/en/dataset/dataoae1504/resource/65e0ccac-87ac-4a4d-9eb7-5611cccd78c6) | จังหวัด | 6,308 | `province_name` |

ทั้ง 3 ไฟล์มี 9 คอลัมน์เหมือนกัน (`year, crop_year, province/province_name, commodity, subcom, item, data, unit, data_date`) รวม 6,960 แถว = จำนวนแถวของ `production_stats`
ขั้นตอน normalization ทั้งหมด (ไฟล์ดิบ → 1NF → 2NF → 3NF → schema จริง) ดูได้ที่หน้า **ขั้นตอน Normalization** ของเว็บ (<http://localhost:3000/normalization>)

## Star schema คืออะไร

การออกแบบฐานข้อมูลสำหรับงานวิเคราะห์ที่มี

- **ตารางข้อเท็จจริง (fact table)** 1 ตาราง เก็บตัวเลขที่วัดได้ ในที่นี้คือ `production_stats`
- **ตารางมิติ (dimension tables)** ล้อมรอบ เก็บคำอธิบายของตัวเลข เช่น ที่ไหน อะไร หน่วยอะไร มาจากรอบเผยแพร่ไหน

```
              locations ──┐ (self-reference: parent_id)
                          │
 commodities ──► production_stats ◄── items ──► units
                          ▲
                   data_releases
```

## ตารางทั้ง 6

| ตาราง | แถว | เก็บอะไร |
|---|---:|---|
| `locations` | 81 | พื้นที่ 1 ประเทศ + 4 ภาค + 76 จังหวัด |
| `commodities` | 1 | ชนิดสินค้า: ปาล์มน้ำมัน |
| `units` | 3 | ไร่, ตัน, กิโลกรัมต่อไร่ |
| `items` | 4 | ตัวชี้วัดและหน่วยของมัน |
| `data_releases` | 9 | วันที่เผยแพร่ข้อมูลจากแหล่งที่มา (2552–2569) |
| `production_stats` | 6,960 | ค่าสถิติ 1 แถว = 1 พื้นที่ × 1 ตัวชี้วัด × 1 ปีเพาะปลูก |

### `locations`

| คอลัมน์ | ความหมาย |
|---|---|
| `location_id` | รหัสพื้นที่ (PK) |
| `name_th` | ชื่อภาษาไทย |
| `name_en` | ชื่อภาษาอังกฤษ (ยังว่างทั้งหมด) |
| `level` | `country`, `region` หรือ `province` |
| `parent_id` | พื้นที่แม่ (จังหวัด → ภาค → ประเทศ) อ้างอิงตารางตัวเอง |

### `items`

| item_id | item_name | หน่วย | ความหมาย |
|---|---|---|---|
| 1 | เนื้อที่ยืนต้น | ไร่ | พื้นที่ปลูกปาล์มทั้งหมด รวมต้นที่ยังเล็ก |
| 2 | เนื้อที่ให้ผล | ไร่ | พื้นที่ที่ต้นปาล์มโตพอให้ผลผลิตแล้ว |
| 3 | ผลผลิต | ตัน | น้ำหนักผลปาล์มที่เก็บได้ทั้งปี |
| 4 | ผลผลิตต่อเนื้อที่ให้ผล | กิโลกรัมต่อไร่ | ผลผลิต ÷ เนื้อที่ให้ผล (เช่น ปี 2567 ทั้งประเทศ 18,551,998 ตัน ÷ 6,323,317 ไร่ ≈ 2,934 กก./ไร่) |

### `production_stats`

| คอลัมน์ | ความหมาย |
|---|---|
| `stat_id` | รหัสแถว (PK) |
| `location_id`, `commodity_id`, `item_id`, `release_id` | foreign key ไปยังตารางมิติ |
| `year`, `crop_year` | ปีเพาะปลูก พ.ศ. (ในข้อมูลชุดนี้สองคอลัมน์มีค่าเท่ากัน) |
| `value` | ตัวเลข `DECIMAL(15,2)` |

Unique key `uq_stats (location_id, commodity_id, item_id, crop_year)` รับประกันว่าแต่ละพื้นที่/ตัวชี้วัด/ปี มีค่าเดียว

## ความครอบคลุมของข้อมูล

- ปีเพาะปลูก พ.ศ. 2525–2567 รวม 43 ปี
- ระดับประเทศและภาคมีครบทุกปี
- ระดับจังหวัด ปี 2525 มีเพียง 8 จังหวัด และเพิ่มขึ้นเป็น 76 จังหวัดในปีหลัง ๆ ตามการขยายพื้นที่ปลูก

## ข้อควรระวัง

1. **ห้ามบวกรวมข้ามระดับ** ข้อมูลประเทศ ภาค และจังหวัดซ้อนกัน ถ้าบวกทั้งหมดจะนับซ้ำ
2. **ผลผลิตต่อไร่เป็นอัตราส่วน** ห้ามบวกรวม และไม่มีความหมายในรูปสัดส่วนต่อประเทศ
3. ผลรวมจังหวัดอาจไม่เท่ากับตัวเลขประเทศพอดี เพราะแหล่งข้อมูลปัดเศษหรือเผยแพร่คนละรอบ เว็บจึงใช้ตัวเลขระดับประเทศโดยตรงเมื่อคำนวณสัดส่วน

## ตัวอย่าง SQL ที่เว็บใช้

**แปลงแถวเป็นคอลัมน์ (pivot)** ค่าทั้ง 4 ตัวชี้วัดต่อปีของพื้นที่หนึ่ง

```sql
SELECT ps.crop_year AS year,
       MAX(CASE WHEN ps.item_id = 1 THEN ps.value END) AS planted,
       MAX(CASE WHEN ps.item_id = 3 THEN ps.value END) AS production
FROM production_stats AS ps
WHERE ps.location_id = :location_id
GROUP BY ps.crop_year
ORDER BY ps.crop_year;
```

**จัดอันดับด้วย window function และเทียบปีก่อนด้วย self-join**

```sql
SELECT l.name_th, ps.value, prev.value AS prev_value,
       RANK() OVER (ORDER BY ps.value DESC) AS rank_no
FROM production_stats AS ps
JOIN locations AS l ON l.location_id = ps.location_id
LEFT JOIN production_stats AS prev
       ON prev.location_id = ps.location_id
      AND prev.item_id = ps.item_id
      AND prev.crop_year = ps.crop_year - 1
WHERE ps.crop_year = 2567 AND ps.item_id = 3 AND l.level = 'province';
```

คำสั่งเต็มอยู่ใน `backend/app/queries.py` และดูได้บนเว็บจากปุ่ม "ดูคำสั่ง SQL ที่ใช้" ใต้ทุกการ์ด
