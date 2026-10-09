import config
from pathlib import Path
import shutil
import csv
from loader import REQUIRED_COLS
from datetime import datetime, timezone
import json

CSV_PATH = Path(config.CIDR_DB_PATH)
CIDR_DIR = CSV_PATH.parent / "versions" / "cidr_db"
DELIMITER = config.CIDR_DB_DELIMITER
FIELDS = ["Location", "Firewall1", "Firewall2", "VSys", "Zone", "Segment", "Exist in Gates?"]

JSON_PATH = Path(config.TOPOLOGY_PATH)
TOPOLOGY_DIR = JSON_PATH.parent / "versions" / "topologi"


def _row_to_entry(row: dict) -> dict:
    return {
        "location": row["Location"],
        "firewall1": row["Firewall1"],
        "firewall2": row.get("Firewall2") or None,
        "vsys": row["VSys"],
        "zone": row["Zone"],
        "segment": row[config.CIDR_COL_SEGMENT],
        "exist_in_gates": row["Exist in Gates?"].strip().upper() == "TRUE",
    }
 
 
def _entry_to_row(entry: dict) -> dict:
    return {
        "Location": entry["location"],
        "Firewall1": entry["firewall1"],
        "Firewall2": entry.get("firewall2") or "",
        "VSys": entry["vsys"],
        "Zone": entry["zone"],
        config.CIDR_COL_SEGMENT: entry["segment"],
        "Exist in Gates?": "TRUE" if entry["exist_in_gates"] else "FALSE",
    }
 
 
def load_all() -> list[dict]:
    if not CSV_PATH.exists():
        return []
    with CSV_PATH.open(newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f, delimiter=DELIMITER))
    return [_row_to_entry(r) for r in rows]

 
def save_all(entries: list[dict]) -> None:
    if CSV_PATH.exists():
        CIDR_DIR.mkdir(parents=True, exist_ok=True)
        ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
        shutil.copy(CSV_PATH, CIDR_DIR / f"cidr_db_{ts}.csv")
    
    CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = CSV_PATH.with_suffix(".tmp")
    with tmp_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS, delimiter=DELIMITER)
        writer.writeheader()
        writer.writerows(_entry_to_row(e) for e in entries)
    tmp_path.replace(CSV_PATH)

 
 
def load_raw() -> dict:
    if not JSON_PATH.exists():
        return {"physicals": {}, "connections": []}
    return json.loads(JSON_PATH.read_text(encoding="utf-8-sig"))
 
 
def save_raw(data: dict) -> None:
    if JSON_PATH.exists():
        TOPOLOGY_DIR.mkdir(parents=True, exist_ok=True)
        ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
        shutil.copy(JSON_PATH, TOPOLOGY_DIR / f"topologi_{ts}.json")
 
    JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = JSON_PATH.with_suffix(".tmp")
    tmp_path.write_text(json.dumps(data, indent=2), encoding="utf-8-sig")
    tmp_path.replace(JSON_PATH)
