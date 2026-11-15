"""Every query the dashboard runs. All read-only and fully parameterized.

Item ids follow the `items` table of the palm-oil database:
  1 เนื้อที่ยืนต้น (ไร่)   2 เนื้อที่ให้ผล (ไร่)   3 ผลผลิต (ตัน)   4 ผลผลิตต่อเนื้อที่ให้ผล (กก./ไร่)
Item 4 is a ratio, so it is never summed or turned into a share.
"""
from __future__ import annotations

from sqlalchemy.engine import Connection

from .db import query, tidy

RATIO_ITEM_ID = 4

TABLE_COUNTS = """
    SELECT 'locations' AS table_name, COUNT(*) AS row_count FROM locations
    UNION ALL SELECT 'commodities', COUNT(*) FROM commodities
    UNION ALL SELECT 'units', COUNT(*) FROM units
    UNION ALL SELECT 'items', COUNT(*) FROM items
    UNION ALL SELECT 'data_releases', COUNT(*) FROM data_releases
    UNION ALL SELECT 'production_stats', COUNT(*) FROM production_stats
"""

LOCATIONS = """
    SELECT location_id, name_th, name_en, level, parent_id
    FROM locations
    ORDER BY FIELD(level, 'country', 'region', 'province'), location_id
"""

ITEMS = """
    SELECT i.item_id, i.item_name, u.unit_name
    FROM items AS i
    JOIN units AS u ON u.unit_id = i.unit_id
    ORDER BY i.item_id
"""

YEARS = """
    SELECT MIN(crop_year) AS first_year, MAX(crop_year) AS last_year
    FROM production_stats
"""

RELEASES = """
    SELECT release_id, data_date, data_date_th
    FROM data_releases
    ORDER BY data_date
"""

COMMODITY = """
    SELECT commodity_id, commodity_name FROM commodities ORDER BY commodity_id LIMIT 1
"""

# One row per crop year for one location: the four items pivoted into columns.
TREND = """
    SELECT
        ps.crop_year AS year,
        MAX(CASE WHEN ps.item_id = 1 THEN ps.value END) AS planted,
        MAX(CASE WHEN ps.item_id = 2 THEN ps.value END) AS harvested,
        MAX(CASE WHEN ps.item_id = 3 THEN ps.value END) AS production,
        MAX(CASE WHEN ps.item_id = 4 THEN ps.value END) AS yield,
        MAX(dr.data_date_th) AS release_th
    FROM production_stats AS ps
    LEFT JOIN data_releases AS dr ON dr.release_id = ps.release_id
    WHERE ps.location_id = :location_id
    GROUP BY ps.crop_year
    ORDER BY ps.crop_year
"""

# Every province (or region) in one year for one item, with its rank,
# the previous year's value and its share of the national figure.
RANKING = """
    SELECT
        l.location_id,
        l.name_th,
        parent.location_id AS region_id,
        parent.name_th AS region_th,
        ps.value,
        prev.value AS prev_value,
        RANK() OVER (ORDER BY ps.value DESC) AS rank_no,
        CASE WHEN ps.item_id = :ratio_item THEN NULL
             ELSE ps.value / NULLIF(nation.value, 0) END AS national_share
    FROM production_stats AS ps
    JOIN locations AS l ON l.location_id = ps.location_id
    LEFT JOIN locations AS parent ON parent.location_id = l.parent_id
    LEFT JOIN production_stats AS prev
        ON prev.location_id = ps.location_id
       AND prev.commodity_id = ps.commodity_id
       AND prev.item_id = ps.item_id
       AND prev.crop_year = ps.crop_year - 1
    LEFT JOIN production_stats AS nation
        ON nation.location_id = (SELECT location_id FROM locations WHERE level = 'country' LIMIT 1)
       AND nation.commodity_id = ps.commodity_id
       AND nation.item_id = ps.item_id
       AND nation.crop_year = ps.crop_year
    WHERE ps.crop_year = :year
      AND ps.item_id = :item_id
      AND l.level = :level
      AND (:region_id IS NULL OR l.parent_id = :region_id)
    ORDER BY ps.value DESC, l.location_id
"""

# The four regions across every year for one item.
REGIONS = """
    SELECT ps.crop_year AS year, l.location_id, l.name_th, ps.value
    FROM production_stats AS ps
    JOIN locations AS l ON l.location_id = ps.location_id
    WHERE l.level = 'region'
      AND ps.item_id = :item_id
    ORDER BY ps.crop_year, l.location_id
"""


def meta(conn: Connection) -> dict:
    years = query(conn, YEARS)[0]
    commodity = query(conn, COMMODITY)
    return {
        "commodity": commodity[0] if commodity else None,
        "locations": query(conn, LOCATIONS),
        "items": query(conn, ITEMS),
        "firstYear": years["first_year"],
        "lastYear": years["last_year"],
        "releases": query(conn, RELEASES),
        "tables": query(conn, TABLE_COUNTS),
        "sql": tidy(TABLE_COUNTS),
    }


def trend(conn: Connection, location_id: int) -> dict:
    return {"rows": query(conn, TREND, location_id=location_id), "sql": tidy(TREND)}


def ranking(conn: Connection, year: int, item_id: int, level: str, region_id: int | None) -> dict:
    rows = query(
        conn,
        RANKING,
        year=year,
        item_id=item_id,
        level=level,
        region_id=region_id,
        ratio_item=RATIO_ITEM_ID,
    )
    return {"rows": rows, "sql": tidy(RANKING)}


def regions(conn: Connection, item_id: int) -> dict:
    return {"rows": query(conn, REGIONS, item_id=item_id), "sql": tidy(REGIONS)}
