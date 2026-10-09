"""
config.py — Central configuration for PathFinder Phase 1
Edit the paths below to match your environment.
"""

import os
from dotenv import load_dotenv

load_dotenv()


def _env_str(name: str, default: str) -> str:
	value = os.getenv(name)
	return value if value not in (None, "") else default


def _env_int(name: str, default: int) -> int:
	value = os.getenv(name)
	if value in (None, ""):
		return default
	try:
		return int(value)
	except ValueError:
		return default

# ─── Input / Output ───────────────────────────────────────────────────────────

# Folder containing the traffic CSV files to process (*.csv)
INPUT_FOLDER = _env_str("FWPATHFINDER_INPUT_FOLDER", "./input")

# Folder where *_result.csv files will be written
OUTPUT_FOLDER = _env_str("FWPATHFINDER_OUTPUT_FOLDER", "./output")

# ─── Reference Files ──────────────────────────────────────────────────────────

# CIDR database file — CSV or Excel (.csv / .xlsx)
CIDR_DB_PATH = _env_str("FWPATHFINDER_CIDR_DB_PATH", "./reference/cidr_db.csv")

# Topology map JSON file
TOPOLOGY_PATH = _env_str("FWPATHFINDER_TOPOLOGY_PATH", "./reference/topologi_map.json")

# Delimiter used in the CIDR DB if it is a CSV (ignored for Excel)
CIDR_DB_DELIMITER = _env_str("FWPATHFINDER_CIDR_DB_DELIMITER", ";")

# ─── Summary Log ──────────────────────────────────────────────────────────────

# Summary CSV — appended on every run
SUMMARY_PATH = _env_str("FWPATHFINDER_SUMMARY_PATH", "./output/Summary.csv")

# ─── Input CSV Settings ───────────────────────────────────────────────────────

# Delimiter for input traffic CSV files
INPUT_DELIMITER = _env_str("FWPATHFINDER_INPUT_DELIMITER", ",")

# API safety limits
MAX_BATCH_ROWS = _env_int("FWPATHFINDER_MAX_BATCH_ROWS", 2000)

# Column name mappings — adjust if your headers differ
COL_SOURCE_IP   = "Source IP"
COL_DEST_IP     = "Destination IP"
COL_SERVICE     = "Services"          # pass-through, optional

# ─── CIDR DB Column Names ─────────────────────────────────────────────────────

CIDR_COL_LOCATION   = "Location"
CIDR_COL_FIREWALL1  = "Firewall1"
CIDR_COL_VSYS       = "VSys"
CIDR_COL_ZONE       = "Zone"
CIDR_COL_SEGMENT    = "Segment"
CIDR_COL_IN_GATES   = "Exist in Gates?"

# ─── Behaviour ────────────────────────────────────────────────────────────────

# Label written to Notes when an IP cannot be matched to any CIDR
UNRESOLVED_LABEL            = "Unknown"
MULTI_SEGMENT_LABEL         = "Unresolved - spans multiple segments"
NO_MATCH_LABEL              = "No match in CIDR DB"

# ─── Database ─────────────────────────────────────────────────────────────────

# PostgreSQL connection URL — must use postgresql+asyncpg:// scheme
# Example: postgresql+asyncpg://user:pass@localhost:5432/fwpathfinder
DATABASE_URL = _env_str("FWPATHFINDER_DATABASE_URL", "")

# ─── Secret Key ─────────────────────────────────────────────────────────────────
SECRET_KEY = _env_str("SECRET_KEY", "SECRET-KEY-234")
ALGORITHM = _env_str("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = _env_int("ACCESS_TOKEN_EXPIRE", 60)