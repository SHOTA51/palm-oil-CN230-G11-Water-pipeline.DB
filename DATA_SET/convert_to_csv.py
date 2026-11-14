
import pandas as pd
from pathlib import Path

# Project paths
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "dataset"
OUTPUT_DIR = DATA_DIR / "csv"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Excel files and expected records
files = {
    "province": {
        "file": "oil_palm_production_province.xlsx",
        "rows": 6308
    },
    "region": {
        "file": "oil_palm_production_region.xlsx",
        "rows": 480
    },
    "country": {
        "file": "oil_palm_production_wholecountry.xlsx",
        "rows": 172
    }
}

# Standard column names for MySQL staging
columns = [
    "year",
    "crop_year",
    "location_name",
    "commodity",
    "subcom",
    "item_name",
    "data",
    "unit_name",
    "data_date"
]

for name, info in files.items():

    input_path = DATA_DIR / info["file"]

    print(f"\nProcessing: {info['file']}")

    # Read Excel
    df = pd.read_excel(input_path)

    # Normalize location column
    if "province_name" in df.columns:
        df = df.rename(
            columns={"province_name": "location_name"}
        )
    elif "province" in df.columns:
        df = df.rename(
            columns={"province": "location_name"}
        )
    else:
        raise ValueError("Location column not found")

    # Normalize other columns
    df = df.rename(columns={
        "item": "item_name",
        "unit": "unit_name"
    })

    # Check required columns
    missing = set(columns) - set(df.columns)

    if missing:
        raise ValueError(f"Missing columns: {missing}")

    # Keep consistent column order
    df = df[columns]

    # Check row count
    if len(df) != info["rows"]:
        raise ValueError(
            f"Expected {info['rows']} rows, got {len(df)}"
        )

    # Export CSV with Thai UTF-8 support
    output_path = OUTPUT_DIR / f"oil_palm_{name}.csv"

    df.to_csv(
        output_path,
        index=False,
        encoding="utf-8-sig"
    )

    print(f"Exported: {output_path}")
    print(f"Records: {len(df)}")
    print(f"Columns: {len(df.columns)}")

print("\nAll datasets converted successfully!")
