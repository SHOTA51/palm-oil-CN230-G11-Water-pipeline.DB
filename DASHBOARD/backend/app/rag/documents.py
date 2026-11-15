"""Turn the palm-oil star schema into Thai text chunks for retrieval.

Four kinds of chunk, all generated from SQL over the live database:
  profile  one per location: coverage, latest year, peak, 10-year change, rank
  series   one per location per decade: every yearly value of the four items
  ranking  one per crop year: top provinces by production / yield / area, region totals
  schema   how the database is organised, units and caveats
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import asdict, dataclass

from sqlalchemy.engine import Connection

from ..db import query

FACTS = """
    SELECT ps.location_id, l.name_th, l.level, l.parent_id, ps.crop_year AS year,
           ps.item_id, ps.value, dr.data_date_th
    FROM production_stats AS ps
    JOIN locations AS l ON l.location_id = ps.location_id
    LEFT JOIN data_releases AS dr ON dr.release_id = ps.release_id
    ORDER BY ps.location_id, ps.crop_year, ps.item_id
"""

ITEM_KEYS = {1: "planted", 2: "harvested", 3: "production", 4: "yield"}
LABEL = {"planted": "เนื้อที่ยืนต้น", "harvested": "เนื้อที่ให้ผล", "production": "ผลผลิต", "yield": "ผลผลิตต่อไร่"}
UNIT = {"planted": "ไร่", "harvested": "ไร่", "production": "ตัน", "yield": "กิโลกรัมต่อไร่"}
LEVEL_TH = {"country": "ประเทศ", "region": "ภาค", "province": "จังหวัด"}


@dataclass
class Chunk:
    id: str
    kind: str
    title: str
    text: str
    location_id: int | None = None
    year_from: int | None = None
    year_to: int | None = None

    def to_dict(self) -> dict:
        return asdict(self)


def n(v: float | None) -> str:
    return "ไม่มีข้อมูล" if v is None else f"{v:,.0f}"


def pct(a: float | None, b: float | None) -> str | None:
    if a is None or not b:
        return None
    d = (a / b - 1) * 100
    return f"{'+' if d >= 0 else ''}{d:.1f}%"


def build_chunks(conn: Connection) -> list[Chunk]:
    rows = query(conn, FACTS)
    loc: dict[int, dict] = {}
    data: dict[int, dict[int, dict]] = defaultdict(lambda: defaultdict(dict))  # loc -> year -> key -> value
    release: dict[tuple[int, int], str] = {}
    for r in rows:
        loc.setdefault(r["location_id"], {"name": r["name_th"], "level": r["level"], "parent": r["parent_id"]})
        data[r["location_id"]][r["year"]][ITEM_KEYS[r["item_id"]]] = r["value"]
        if r["data_date_th"]:
            release[(r["location_id"], r["year"])] = r["data_date_th"]
    for l in query(conn, "SELECT location_id, name_th, level, parent_id FROM locations"):
        loc.setdefault(l["location_id"], {"name": l["name_th"], "level": l["level"], "parent": l["parent_id"]})

    country_id = next((i for i, l in loc.items() if l["level"] == "country"), None)
    provinces = [i for i, l in loc.items() if l["level"] == "province"]
    regions = sorted(i for i, l in loc.items() if l["level"] == "region")
    all_years = sorted({y for d in data.values() for y in d})

    def where(i: int) -> str:
        l = loc[i]
        if l["level"] == "province" and l["parent"] in loc:
            return f"จังหวัด{l['name']} ({loc[l['parent']]['name']})"
        if l["level"] == "region":
            return l["name"]
        return f"{l['name']} (ทั้งประเทศ)"

    def rank_in_year(year: int, key: str, ids: list[int]) -> list[tuple[int, float]]:
        vals = [(i, data[i][year].get(key)) for i in ids if data[i].get(year, {}).get(key) is not None]
        return sorted(vals, key=lambda t: -t[1])

    chunks: list[Chunk] = []

    # ---- profile: one per location
    for i, l in loc.items():
        years = sorted(data[i])
        if not years:
            continue
        first, last = years[0], years[-1]
        latest = data[i][last]
        lines = [
            f"ข้อมูลปาล์มน้ำมันของ{where(i)} ระดับ{LEVEL_TH[l['level']]}",
            f"มีข้อมูลปีเพาะปลูก พ.ศ. {first}–{last} รวม {len(years)} ปี",
            f"ปีล่าสุด {last}: " + ", ".join(f"{LABEL[k]} {n(latest.get(k))} {UNIT[k]}" for k in LABEL),
        ]
        if l["level"] == "province":
            ranked = rank_in_year(last, "production", provinces)
            pos = next((k for k, (pid, _) in enumerate(ranked, 1) if pid == i), None)
            nat = data[country_id][last].get("production") if country_id else None
            if pos:
                share = f" คิดเป็น {latest['production'] / nat * 100:.1f}% ของผลผลิตทั้งประเทศ" if nat and latest.get("production") else ""
                lines.append(f"ผลผลิตปี {last} อยู่อันดับที่ {pos} จาก {len(ranked)} จังหวัด{share}")
        prod = [(y, data[i][y].get("production")) for y in years if data[i][y].get("production") is not None]
        if prod:
            py, pv = max(prod, key=lambda t: t[1])
            lines.append(f"ผลผลิตสูงสุดในปี {py}: {n(pv)} ตัน")
        ylds = [(y, data[i][y].get("yield")) for y in years if data[i][y].get("yield")]
        if ylds:
            yy, yv = max(ylds, key=lambda t: t[1])
            lines.append(f"ผลผลิตต่อไร่สูงสุดในปี {yy}: {n(yv)} กิโลกรัมต่อไร่")
        if last - 10 in data[i]:
            for k in ("planted", "production"):
                ch = pct(latest.get(k), data[i][last - 10].get(k))
                if ch:
                    lines.append(f"{LABEL[k]}เปลี่ยนแปลงในรอบ 10 ปี ({last - 10}–{last}): {ch}")
        if l["level"] in ("region", "country"):
            kids = [p for p in provinces if l["level"] == "country" or loc[p]["parent"] == i]
            top = rank_in_year(last, "production", kids)[:5]
            if top:
                lines.append(f"จังหวัดที่ผลผลิตสูงสุดปี {last}: " + ", ".join(f"{loc[p]['name']} {n(v)} ตัน" for p, v in top))
            if l["level"] == "region":
                lines.append(f"มีจังหวัดในภาคนี้ที่มีข้อมูลปาล์มน้ำมัน {len([p for p in kids if data[p]])} จังหวัด")
        chunks.append(Chunk(f"profile-{i}", "profile", f"ภาพรวม{where(i)}", "\n".join(lines), i, first, last))

    # ---- series: one per location per decade
    for i in loc:
        years = sorted(data[i])
        by_decade: dict[int, list[int]] = defaultdict(list)
        for y in years:
            by_decade[y // 10 * 10].append(y)
        for dec, ys in sorted(by_decade.items()):
            lines = [f"ข้อมูลรายปีปาล์มน้ำมัน {where(i)} ปีเพาะปลูก {ys[0]}–{ys[-1]}"]
            for y in ys:
                v = data[i][y]
                lines.append(f"ปี {y}: " + " | ".join(f"{LABEL[k]} {n(v.get(k))} {UNIT[k]}" for k in LABEL))
            rel = release.get((i, ys[-1]))
            if rel:
                lines.append(f"แหล่งข้อมูลเผยแพร่วันที่ {rel}")
            chunks.append(Chunk(f"series-{i}-{dec}", "series", f"{where(i)} ปี {ys[0]}–{ys[-1]}", "\n".join(lines), i, ys[0], ys[-1]))

    # ---- ranking: one per year
    for y in all_years:
        lines = [f"อันดับจังหวัดปาล์มน้ำมัน ปีเพาะปลูก {y}"]
        if country_id and y in data[country_id]:
            c = data[country_id][y]
            lines.append("ทั้งประเทศ: " + ", ".join(f"{LABEL[k]} {n(c.get(k))} {UNIT[k]}" for k in LABEL))
        nat = data[country_id][y].get("production") if country_id else None
        top = rank_in_year(y, "production", provinces)
        if top:
            lines.append(f"มีข้อมูล {len(top)} จังหวัด")
            lines.append(
                "ผลผลิตมากที่สุด 10 อันดับ: "
                + "; ".join(f"{k}. {loc[p]['name']} {n(v)} ตัน" + (f" ({v / nat * 100:.1f}%)" if nat else "") for k, (p, v) in enumerate(top[:10], 1))
            )
        for key, cnt in (("yield", 5), ("planted", 5)):
            t = [(p, v) for p, v in rank_in_year(y, key, provinces) if v > 0][:cnt]
            if t:
                lines.append(f"{LABEL[key]}สูงสุด {cnt} อันดับ: " + "; ".join(f"{k}. {loc[p]['name']} {n(v)} {UNIT[key]}" for k, (p, v) in enumerate(t, 1)))
        reg = [(r, data[r][y].get("production")) for r in regions if data[r].get(y, {}).get("production") is not None]
        if reg:
            lines.append("ผลผลิตรายภาค: " + "; ".join(f"{loc[r]['name']} {n(v)} ตัน" for r, v in sorted(reg, key=lambda t: -t[1])))
        chunks.append(Chunk(f"ranking-{y}", "ranking", f"อันดับจังหวัด ปี {y}", "\n".join(lines), None, y, y))

    # ---- schema / about
    releases = query(conn, "SELECT data_date_th FROM data_releases ORDER BY data_date")
    counts = query(
        conn,
        "SELECT (SELECT COUNT(*) FROM locations) AS locations, (SELECT COUNT(*) FROM production_stats) AS stats",
    )[0]
    chunks.append(
        Chunk(
            "schema-tables",
            "schema",
            "โครงสร้างฐานข้อมูล plam-oil",
            "\n".join(
                [
                    "ฐานข้อมูล plam-oil ออกแบบเป็น star schema มีตารางมิติ 5 ตาราง และตารางข้อเท็จจริง 1 ตาราง",
                    f"locations: พื้นที่ {counts['locations']} แห่ง เป็นลำดับชั้น ประเทศ > ภาค > จังหวัด ผ่านคอลัมน์ parent_id",
                    "commodities: ชนิดสินค้า มีปาล์มน้ำมันชนิดเดียว",
                    "items: ตัวชี้วัด 4 ตัว คือ เนื้อที่ยืนต้น (ไร่) เนื้อที่ให้ผล (ไร่) ผลผลิต (ตัน) และผลผลิตต่อเนื้อที่ให้ผล (กิโลกรัมต่อไร่)",
                    "units: หน่วยวัด ไร่ ตัน กิโลกรัมต่อไร่",
                    "data_releases: วันที่เผยแพร่ข้อมูลจากแหล่งที่มา",
                    f"production_stats: ตารางข้อเท็จจริง {counts['stats']:,} แถว หนึ่งแถวคือค่าของ 1 พื้นที่ 1 ตัวชี้วัด 1 ปีเพาะปลูก (unique key location_id, commodity_id, item_id, crop_year)",
                ]
            ),
        )
    )
    chunks.append(
        Chunk(
            "schema-caveats",
            "schema",
            "ข้อควรระวังในการอ่านข้อมูล",
            "\n".join(
                [
                    "ปีทั้งหมดเป็นปีเพาะปลูกแบบพุทธศักราช (พ.ศ.)",
                    "เนื้อที่ยืนต้นคือพื้นที่ปลูกปาล์มทั้งหมด ส่วนเนื้อที่ให้ผลคือพื้นที่ที่ต้นปาล์มโตพอให้ผลผลิตแล้ว",
                    "ผลผลิตต่อไร่คำนวณจากผลผลิตหารด้วยเนื้อที่ให้ผล เป็นอัตราส่วน ห้ามนำมาบวกรวมกัน",
                    "ข้อมูลระดับประเทศ ภาค และจังหวัดซ้อนกัน การบวกรวมทุกระดับจะนับซ้ำ",
                    "ช่วงปีแรก ๆ มีข้อมูลเพียงไม่กี่จังหวัด จำนวนจังหวัดเพิ่มขึ้นตามเวลาเมื่อมีการปลูกปาล์มขยายออกไป",
                    "วันที่เผยแพร่ข้อมูล: " + ", ".join(r["data_date_th"] for r in releases),
                ]
            ),
        )
    )
    return chunks
