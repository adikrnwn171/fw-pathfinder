"""
resolver.py — Phase 2: IP parsing + CIDR matching + path traversal.

Special cases:
  - CORE in cidr_db is normalised to other/unconfigured by CIDRMatcher
  - Unmatched private IP  → other/unconfigured/Core   (is_fallback=True)
  - Unmatched public IP   → other/unconfigured/Internet (is_fallback=True)
  - Fallback nodes are valid path endpoints; other/unconfigured is filtered
    from output rows but used for BFS traversal
  - Hostname / parse error → single Unknown row

Output rules (one row per hop):
  - First hop  : Src Zone = real segment zone (or fallback gate), Dst Zone = exit gate
  - Middle hops: Src Zone = entry gate, Dst Zone = exit gate
  - Last hop   : Src Zone = entry gate, Dst Zone = real segment zone (or fallback gate)
"""

from typing import Dict, Any, List, Optional

import config
from ip_parser import parse_ip
from cidr_matcher import CIDRMatcher, MatchResult, FALLBACK_FW_PRIVATE, FALLBACK_VSYS
from graph import TopologyGraph, HopDetail, Node

OTHER_NODE = (FALLBACK_FW_PRIVATE, FALLBACK_VSYS)


def resolve_row(row: Dict[str, Any],
                matcher: CIDRMatcher,
                graph: TopologyGraph) -> List[Dict[str, Any]]:

    src_raw = str(row.get(config.COL_SOURCE_IP, "")).strip()
    dst_raw = str(row.get(config.COL_DEST_IP,   "")).strip()
    service = str(row.get(config.COL_SERVICE,    "")).strip()

    src_parsed = parse_ip(src_raw)
    dst_parsed = parse_ip(dst_raw)

    src_match  = matcher.match(src_parsed)
    dst_match  = matcher.match(dst_parsed)

    # ── Hard unresolved (hostname / parse error) → single Unknown row ────────
    if not src_match.matched or not dst_match.matched:
        notes = _build_notes(src_match, dst_match)
        return [_build_row(
            firewall  = src_match.firewall1 or config.UNRESOLVED_LABEL,
            vsys      = src_match.vsys      or config.UNRESOLVED_LABEL,
            src_zone  = src_match.zone      or config.UNRESOLVED_LABEL,
            source_ip = src_raw,
            src_seg   = src_match.segment   or config.UNRESOLVED_LABEL,
            dst_zone  = dst_match.zone      or config.UNRESOLVED_LABEL,
            dest_ip   = dst_raw,
            dst_seg   = dst_match.segment   or config.UNRESOLVED_LABEL,
            service   = service,
            notes     = notes,
        )]

    src_node: Node = (src_match.firewall1.strip(), src_match.vsys.strip())
    dst_node: Node = (dst_match.firewall1.strip(), dst_match.vsys.strip())

    # ── Same node → single intra-node row ────────────────────────────────────
    if src_node == dst_node:
        return [_build_row(
            firewall  = src_match.firewall1,
            vsys      = src_match.vsys,
            src_zone  = src_match.zone,
            source_ip = src_raw,
            src_seg   = src_match.segment,
            dst_zone  = dst_match.zone,
            dest_ip   = dst_raw,
            dst_seg   = dst_match.segment,
            service   = service,
            notes     = _fallback_note(src_match, dst_match),
        )]

    # ── Path traversal ────────────────────────────────────────────────────────
    hops: Optional[List[HopDetail]] = graph.get_path(src_node, dst_node)

    if hops is None:
        return [_build_row(
            firewall  = src_match.firewall1,
            vsys      = src_match.vsys,
            src_zone  = src_match.zone,
            source_ip = src_raw,
            src_seg   = src_match.segment,
            dst_zone  = dst_match.zone,
            dest_ip   = dst_raw,
            dst_seg   = dst_match.segment,
            service   = service,
            notes     = "No Path Found in topology",
        )]

    # Same node after other/unconfigured is treated as src==dst
    if len(hops) == 0:
        return [_build_row(
            firewall  = src_match.firewall1,
            vsys      = src_match.vsys,
            src_zone  = src_match.zone,
            source_ip = src_raw,
            src_seg   = src_match.segment,
            dst_zone  = dst_match.zone,
            dest_ip   = dst_raw,
            dst_seg   = dst_match.segment,
            service   = service,
            notes     = _fallback_note(src_match, dst_match),
        )]

    # ── Build one row per hop ─────────────────────────────────────────────────
    rows  = []
    total = len(hops)

    for i, hop in enumerate(hops):
        is_first = (i == 0)
        is_last  = (i == total - 1)

        # Src Zone: real segment zone (or fallback gate) on first hop
        #           entry gate on all subsequent hops
        if is_first:
            src_zone = src_match.zone      # real zone or Core/Internet for fallback
        else:
            src_zone = hop.entry_gate

        # Dst Zone: real segment zone (or fallback gate) on last hop
        #           exit gate on all preceding hops
        if is_last:
            dst_zone = dst_match.zone
        else:
            dst_zone = hop.exit_gate

        rows.append(_build_row(
            firewall  = hop.firewall,
            vsys      = hop.vsys,
            src_zone  = src_zone,
            source_ip = src_raw,
            src_seg   = src_match.segment,
            dst_zone  = dst_zone,
            dest_ip   = dst_raw,
            dst_seg   = dst_match.segment,
            service   = service,
            notes     = _fallback_note(src_match, dst_match) if (is_first and i == 0) else "",
        ))

    return rows


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_row(*, firewall, vsys, src_zone, source_ip, src_seg,
               dst_zone, dest_ip, dst_seg, service, notes) -> Dict[str, Any]:
    return {
        "Firewall Name"  : firewall,
        "VSys"           : vsys,
        "Src Zone"       : src_zone,
        "Source IP"      : source_ip,
        "Src Segment"    : src_seg,
        "Dst Zone"       : dst_zone,
        "Destination IP" : dest_ip,
        "Dst Segment"    : dst_seg,
        "Services"       : service,
        "Notes"          : notes,
    }


def _build_notes(src: MatchResult, dst: MatchResult) -> str:
    parts = []
    if not src.matched:
        parts.append(f"Src: {src.notes or config.UNRESOLVED_LABEL}")
    if not dst.matched:
        parts.append(f"Dst: {dst.notes or config.UNRESOLVED_LABEL}")
    return " | ".join(parts)


def _fallback_note(src: MatchResult, dst: MatchResult) -> str:
    """Surface fallback assumptions in Notes when either side used IP fallback."""
    parts = []
    if src.is_fallback and src.notes:
        parts.append(f"Src: {src.notes}")
    if dst.is_fallback and dst.notes:
        parts.append(f"Dst: {dst.notes}")
    return " | ".join(parts)
