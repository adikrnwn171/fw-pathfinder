"""
writer.py — Writes *_result.csv output files and appends to Summary.csv.

Result columns (one or two rows per input row):
  Firewall Name | VSys | Src Zone | Source IP | Src Segment |
  Dst Zone | Destination IP | Dst Segment | Services | Notes

Summary.csv columns (appended, never overwritten):
  Timestamp | Source File | Total Rows | Total Nodes | Nodes Name |
  Total VSys | VSys Name | Resolved Date | Notes
  (Total VSys / VSys Name filled in Phase 2)
"""

import os
import csv
from datetime import datetime
from typing import List, Dict, Any

import config


# ─── Result columns (ordered) ─────────────────────────────────────────────────
RESULT_COLUMNS = [
    "Firewall Name",
    "VSys",
    "Src Zone",
    "Source IP",
    "Src Segment",
    "Dst Zone",
    "Destination IP",
    "Dst Segment",
    "Services",
    "Notes",
]

# ─── Summary columns ──────────────────────────────────────────────────────────
SUMMARY_COLUMNS = [
    "Timestamp", "Source File", "Total Rows", "Total Nodes",
    "Nodes Name", "Total VSys", "VSys Name", "Resolved Date", "Notes",
]


def write_result(source_path: str, rows: List[Dict[str, Any]]) -> str:
    """
    Write rows to <source_basename>_result.csv in the output folder.
    Returns the output file path.
    """
    os.makedirs(config.OUTPUT_FOLDER, exist_ok=True)

    base     = os.path.splitext(os.path.basename(source_path))[0]
    out_path = os.path.join(config.OUTPUT_FOLDER, f"{base}_result.csv")

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=RESULT_COLUMNS,
                                extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    print(f"[writer] Result written : {out_path}  ({len(rows)} rows)")
    return out_path


def append_summary(source_path: str, rows: List[Dict[str, Any]]) -> None:
    """
    Append one summary row to Summary.csv.
    Creates the file with header if it does not exist yet.
    Total VSys / VSys Name are left blank — populated in Phase 2.
    """
    os.makedirs(config.OUTPUT_FOLDER, exist_ok=True)

    summary_exists = os.path.exists(config.SUMMARY_PATH)

    # Unique firewall nodes from resolved rows
    nodes = sorted({
        r["Firewall Name"]
        for r in rows
        if r.get("Firewall Name") not in ("", config.UNRESOLVED_LABEL)
    })

    # Unique VSys values from resolved rows
    vsys_names = sorted({
        r["VSys"]
        for r in rows
        if r.get("VSys") not in ("", config.UNRESOLVED_LABEL)
    })

    resolved_count = sum(
        1 for r in rows
        if not r.get("Notes", "")
    )

    summary_row = {
        "Timestamp"    : datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "Source File"  : os.path.basename(source_path),
        "Total Rows"   : len(rows),
        "Total Nodes"  : len(nodes),
        "Nodes Name"   : ", ".join(nodes),
        "Total VSys"   : len(vsys_names),
        "VSys Name"    : ", ".join(vsys_names),
        "Resolved Date": "",    # manual
        "Notes"        : "",    # manual
    }

    with open(config.SUMMARY_PATH, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=SUMMARY_COLUMNS)
        if not summary_exists:
            writer.writeheader()
        writer.writerow(summary_row)

    print(f"[writer] Summary appended: {config.SUMMARY_PATH}")
    print(f"         Input rows: {len(rows)} | Resolved: {resolved_count} | "
          f"Nodes: {len(nodes)}")
