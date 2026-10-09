"""
ip_parser.py — Parses and normalizes IP input into ipaddress network/address objects.

Supported input formats:
  - Single IP     : "192.168.1.1"
  - CIDR          : "10.0.0.0/24"
  - Range         : "10.0.0.1-10.0.0.50"

Returns a ParsedIP dataclass with:
  - raw       : original string
  - kind      : "single" | "cidr" | "range"
  - network   : ipaddress.IPv4Network  (for single → host /32, for cidr → the network,
                                         for range → None if multi-segment)
  - first     : ipaddress.IPv4Address  (first address in range/single)
  - last      : ipaddress.IPv4Address  (last address in range/single)
  - error     : str | None             (set if parsing failed)
"""

import ipaddress
from dataclasses import dataclass, field
from typing import Optional, List


@dataclass
class ParsedIP:
    raw:     str
    kind:    str                              # "single" | "cidr" | "range"
    first:   Optional[ipaddress.IPv4Address] = None
    last:    Optional[ipaddress.IPv4Address] = None
    network: Optional[ipaddress.IPv4Network] = None   # None for ranges
    error:   Optional[str] = None
    ips: Optional[List[ipaddress.IPv4Address]] = (
        None  
    )


def parse_ip(raw: str) -> ParsedIP:
    """Parse any supported IP format into a ParsedIP object."""
    value = raw.strip()

    if not value:
        return ParsedIP(raw=raw, kind="unknown", error="Empty value")

    # ── List: contains "," ────────────────────────────────────────────────────
    if "," in value:
        return _parse_list(value)

    # ── Range: contains "-" and no "/" ────────────────────────────────────────
    if "-" in value and "/" not in value:
        return _parse_range(value)

    # ── CIDR: contains "/" ────────────────────────────────────────────────────
    if "/" in value:
        return _parse_cidr(value)

    # ── Single IP ─────────────────────────────────────────────────────────────
    return _parse_single(value)



# ─── Internal parsers ─────────────────────────────────────────────────────────

def _parse_single(value: str) -> ParsedIP:
    try:
        addr = ipaddress.IPv4Address(value)
        net  = ipaddress.IPv4Network(value)          # strict=True, /32
        return ParsedIP(raw=value, kind="single", first=addr, last=addr, network=net)
    except ValueError as e:
        return ParsedIP(raw=value, kind="single", error=str(e))


def _parse_cidr(value: str) -> ParsedIP:
    try:
        net   = ipaddress.IPv4Network(value, strict=False)
        first = net.network_address
        last  = net.broadcast_address
        return ParsedIP(raw=value, kind="cidr", first=first, last=last, network=net)
    except ValueError as e:
        return ParsedIP(raw=value, kind="cidr", error=str(e))


def _parse_range(value: str) -> ParsedIP:
    parts = value.split("-", 1)
    if len(parts) != 2:
        return ParsedIP(raw=value, kind="range", error=f"Invalid range format: {value}")
    try:
        first = ipaddress.IPv4Address(parts[0].strip())
        last  = ipaddress.IPv4Address(parts[1].strip())
        if first > last:
            return ParsedIP(raw=value, kind="range",
                            error=f"Range start > end: {value}")
        return ParsedIP(raw=value, kind="range", first=first, last=last, network=None)
    except ValueError as e:
        return ParsedIP(raw=value, kind="range", error=str(e))


def _parse_list(value: str) -> ParsedIP:
    raw_items = [item.strip() for item in value.split(",") if item.strip()]

    if not raw_items:
        return ParsedIP(
            raw=value, kind="list", error="Empty IP list after parsing"
        )

    parsed_addrs = []
    for item in raw_items:
        try:
            addr = ipaddress.IPv4Address(item)
            parsed_addrs.append(addr)
        except ValueError as e:
            return ParsedIP(
                raw=value,
                kind="list",
                error=f"Invalid IP '{item}' in list: {e}",
            )

    return ParsedIP(
        raw=value,
        kind="list",
        first=parsed_addrs[0],  # IP pertama digunakan untuk fallback jika butuh
        last=parsed_addrs[-1],
        ips=parsed_addrs,
        network=None,
    )