"""
loader.py — Loads and validates the CIDR database from CSV or Excel.

Supports:
  - .csv  (with configurable delimiter, defaults to ";")
  - .xlsx / .xls

Returns a list of clean dicts ready for CIDRMatcher.
"""

import os
import pandas as pd
from typing import List, Dict

import config

import csv

# Columns we care about — trailing junk columns are dropped automatically
REQUIRED_COLS = [
    config.CIDR_COL_LOCATION,
    config.CIDR_COL_FIREWALL1,
    config.CIDR_COL_VSYS,
    config.CIDR_COL_ZONE,
    config.CIDR_COL_SEGMENT,
    config.CIDR_COL_IN_GATES,
]


def load_cidr_db(path: str = config.CIDR_DB_PATH) -> List[Dict]:
    """
    Load the CIDR database from a CSV or Excel file.
    Returns a list of row dicts containing only the relevant columns.
    Raises FileNotFoundError or ValueError on fatal issues.
    """
    if not os.path.exists(path):
        raise FileNotFoundError(f"CIDR DB not found: {path}")

    ext = os.path.splitext(path)[1].lower()

    if ext == ".csv":
        df = pd.read_csv(path, sep=config.CIDR_DB_DELIMITER, dtype=str)
    elif ext in (".xlsx", ".xls"):
        engine = "openpyxl" if ext == ".xlsx" else "xlrd"
        df = pd.read_excel(path, engine=engine, dtype=str)
    else:
        raise ValueError(f"Unsupported CIDR DB format: {ext}. Use .csv or .xlsx")

    # Drop unnamed / empty trailing columns
    df = df.loc[:, ~df.columns.str.startswith("Unnamed")]

    # Strip whitespace from all column names
    df.columns = df.columns.str.strip()

    # Check required columns exist
    missing = [c for c in REQUIRED_COLS if c not in df.columns]
    if missing:
        raise ValueError(f"CIDR DB is missing columns: {missing}\n"
                         f"Found columns: {df.columns.tolist()}")

    # Keep only relevant columns, strip whitespace from string values
    df = df[REQUIRED_COLS].copy()
    for col in df.select_dtypes(include="object").columns:
        df[col] = df[col].str.strip()

    # Drop rows with no Segment (unusable)
    before = len(df)
    df = df.dropna(subset=[config.CIDR_COL_SEGMENT])
    dropped = before - len(df)
    if dropped:
        print(f"[loader] Dropped {dropped} rows with empty Segment.")

    records = df.to_dict(orient="records")
    print(f"[loader] Loaded {len(records)} CIDR entries from: {path}")
    return records


def load_input_csv(path: str) -> pd.DataFrame:
    """
    Load a traffic input CSV. Returns a DataFrame.
    Tolerates missing optional columns (e.g. Services).
    Raises on missing Source IP or Destination IP columns.
    """
    if not os.path.exists(path):
        raise FileNotFoundError(f"Input file not found: {path}")

    ext = os.path.splitext(path)[1].lower()
    if ext == ".csv":
        df = pd.read_csv(path, sep=config.INPUT_DELIMITER, dtype=str)
    elif ext in (".xlsx", ".xls"):
        engine = "openpyxl" if ext == ".xlsx" else "xlrd"
        df = pd.read_excel(path, engine=engine, dtype=str)
    else:
        raise ValueError(f"Unsupported input format: {ext}")

    # Strip column name whitespace
    df.columns = df.columns.str.strip()

    # Validate mandatory columns
    for col in [config.COL_SOURCE_IP, config.COL_DEST_IP]:
        if col not in df.columns:
            raise ValueError(
                f"Input file '{path}' is missing required column: '{col}'\n"
                f"Found columns: {df.columns.tolist()}"
            )

    # Fill missing optional Service column with empty string
    if config.COL_SERVICE not in df.columns:
        df[config.COL_SERVICE] = ""

    # Strip whitespace from IP values
    df[config.COL_SOURCE_IP] = df[config.COL_SOURCE_IP].fillna("").str.strip()
    df[config.COL_DEST_IP]   = df[config.COL_DEST_IP].fillna("").str.strip()
    df[config.COL_SERVICE]   = df[config.COL_SERVICE].fillna("").str.strip()

    print(f"[loader] Loaded {len(df)} rows from: {path}")
    return df

