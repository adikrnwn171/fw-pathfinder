"""
main.py — PathFinder Phase 2 entry point.

Pipeline:
  1. Load CIDR DB once
  2. Load & precompute topology graph once
  3. Scan INPUT_FOLDER for *.csv files
  4. For each file: resolve every row → write *_result.csv → append Summary.csv
  5. Print run summary to console

Usage:
    python main.py

All paths and settings are in config.py.
"""

import os
import sys
import glob
import traceback
from datetime import datetime

import config
from loader       import load_cidr_db, load_input_csv
from cidr_matcher import CIDRMatcher
from graph        import TopologyGraph
from resolver     import resolve_row
from writer       import write_result, append_summary


def main():
    print("=" * 60)
    print("  PathFinder — Phase 2: IP Lookup + Path Finder")
    print(f"  Started : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # ── Step 1: Load CIDR DB ──────────────────────────────────────────────
    try:
        records = load_cidr_db(config.CIDR_DB_PATH)
        matcher = CIDRMatcher(records)
    except (FileNotFoundError, ValueError) as e:
        print(f"\n[ERROR] Failed to load CIDR DB:\n  {e}")
        sys.exit(1)

    # ── Step 2: Load & precompute topology graph ──────────────────────────
    try:
        graph = TopologyGraph()
        graph.load(config.TOPOLOGY_PATH)
        graph.precompute_paths()
    except (FileNotFoundError, ValueError) as e:
        print(f"\n[ERROR] Failed to load topology:\n  {e}")
        sys.exit(1)

    # ── Step 3: Discover input files ──────────────────────────────────────
    pattern     = os.path.join(config.INPUT_FOLDER, "*.csv")
    input_files = sorted(glob.glob(pattern))

    if not input_files:
        print(f"\n[WARNING] No CSV files found in: {config.INPUT_FOLDER}")
        print("  Create the folder and place your traffic CSV files there.")
        sys.exit(0)

    print(f"\nFound {len(input_files)} input file(s):\n")
    for f in input_files:
        print(f"  • {os.path.basename(f)}")

    # ── Step 4: Process each file ─────────────────────────────────────────
    total_files_ok  = 0
    total_files_err = 0

    for file_path in input_files:
        print(f"\n{'─' * 60}")
        print(f"Processing: {os.path.basename(file_path)}")
        print(f"{'─' * 60}")

        try:
            df   = load_input_csv(file_path)
            rows = []

            for idx, row in df.iterrows():
                try:
                    result_rows = resolve_row(row.to_dict(), matcher, graph)
                    rows.extend(result_rows)
                except Exception as e:
                    print(f"  [WARNING] Row {idx + 2} skipped: {e}")
                    rows.append({
                        "Firewall Name"  : config.UNRESOLVED_LABEL,
                        "VSys"           : config.UNRESOLVED_LABEL,
                        "Src Zone"       : config.UNRESOLVED_LABEL,
                        "Source IP"      : str(row.get(config.COL_SOURCE_IP, "")),
                        "Src Segment"    : config.UNRESOLVED_LABEL,
                        "Dst Zone"       : config.UNRESOLVED_LABEL,
                        "Destination IP" : str(row.get(config.COL_DEST_IP,   "")),
                        "Dst Segment"    : config.UNRESOLVED_LABEL,
                        "Services"       : str(row.get(config.COL_SERVICE,    "")),
                        "Notes"          : f"Processing error: {e}",
                    })

            write_result(file_path, rows)
            append_summary(file_path, rows)
            total_files_ok += 1

        except Exception as e:
            print(f"\n[ERROR] Could not process {os.path.basename(file_path)}:")
            traceback.print_exc()
            total_files_err += 1

    # ── Step 5: Final summary ─────────────────────────────────────────────
    print(f"\n{'=' * 60}")
    print(f"  Run complete.")
    print(f"  Files processed  : {total_files_ok}")
    if total_files_err:
        print(f"  Files with errors: {total_files_err}")
    print(f"  Output folder    : {os.path.abspath(config.OUTPUT_FOLDER)}")
    print(f"  Summary log      : {os.path.abspath(config.SUMMARY_PATH)}")
    print(f"{'=' * 60}\n")


if __name__ == "__main__":
    main()
