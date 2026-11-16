# Serving Layer evidence

Run: 2026-11-16T16:19:10 · RDBMS snapshot: 2026-11-16T09:00:59+00:00 (mysql:plam-oil) · model: gemini-embedding-001 · dims 768 · cosine

Neo4j reports cosine scores scaled to 0..1 as (1 + cosine) / 2.

Expected top-5 southern provinces by ผลผลิต (SQL in README, from the snapshot): สุราษฎร์ธานี 4,541,860 ตัน, กระบี่ 3,839,879 ตัน, ชุมพร 2,966,944 ตัน, นครศรีธรรมราช 2,159,168 ตัน, ตรัง 895,358 ตัน

## Q1 (search) — จังหวัดที่เป็นแหล่งปลูกปาล์มน้ำมันหลักทางภาคใต้

Expected (from RDBMS): Top provinces by ผลผลิต in the latest crop year, region = ภาคใต้

| location | level | score |
|---|---|---|
| ตรัง | province | 0.8808 |
| นครศรีธรรมราช | province | 0.8764 |
| ระนอง | province | 0.8743 |
| พัทลุง | province | 0.8719 |
| ชุมพร | province | 0.8719 |

| item | score |
|---|---|
| เนื้อที่ยืนต้น | 0.8053 |
| ผลผลิต | 0.8002 |
| เนื้อที่ให้ผล | 0.7897 |
| ผลผลิตต่อเนื้อที่ให้ผล | 0.7858 |

Check: 3/5 of the SQL top-5 found (ตรัง, นครศรีธรรมราช, ชุมพร) · item = เนื้อที่ยืนต้น

## Q2 (search) — How productive are the palm plantations per rai?

Expected (from RDBMS): item = ผลผลิตต่อเนื้อที่ให้ผล (กิโลกรัมต่อไร่)

| location | level | score |
|---|---|---|
| ระยอง | province | 0.8231 |
| ราชบุรี | province | 0.822 |
| เชียงราย | province | 0.8212 |
| ระนอง | province | 0.8187 |
| หนองคาย | province | 0.8158 |

| item | score |
|---|---|
| ผลผลิตต่อเนื้อที่ให้ผล | 0.8543 |
| ผลผลิต | 0.8411 |
| เนื้อที่ให้ผล | 0.8316 |
| เนื้อที่ยืนต้น | 0.8261 |

Check: top item = ผลผลิตต่อเนื้อที่ให้ผล → match

## Q3 (hop) — ผลผลิตปาล์มน้ำมันของจังหวัดแหล่งผลิตหลักในภาคใต้

Expected (from RDBMS): ผลผลิต (ตัน) of the main southern provinces, latest crop year, with release date

| location | part_of | item | crop_year | value | unit | stat_id | release_date | score |
|---|---|---|---|---|---|---|---|---|
| ตรัง | ภาคใต้ | ผลผลิต | 2567 | 895358.0 | ตัน | 6686 | 2026-07-07 | 0.8767 |
| ภาคใต้ | ประเทศไทย | ผลผลิต | 2567 | 16762740.0 | ตัน | 6642 | 2026-07-07 | 0.8757 |
| นครศรีธรรมราช | ภาคใต้ | ผลผลิต | 2567 | 2159168.0 | ตัน | 6682 | 2026-07-07 | 0.8691 |
| ระนอง | ภาคใต้ | ผลผลิต | 2567 | 493423.0 | ตัน | 6706 | 2026-07-07 | 0.8687 |
| พัทลุง | ภาคใต้ | ผลผลิต | 2567 | 274419.0 | ตัน | 6678 | 2026-07-07 | 0.8686 |

Check: 2/5 of the SQL top-5 found (ตรัง, นครศรีธรรมราช) · item = ผลผลิต
