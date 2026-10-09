"""
cidr_matcher.py — Matches a ParsedIP against the loaded CIDR database.

Matching rules:
  - Single IP  : must be contained in a CIDR entry (longest prefix wins)
  - CIDR input : input network must be a subnet of (or equal to) a CIDR entry
  - Range      : both first and last IP must fall inside the SAME single CIDR entry
                 If they span multiple entries → MULTI_SEGMENT_LABEL

Fallback for unmatched IPs:
  - Private IP  → mapped to other/unconfigured/Core   (matched=True, is_fallback=True)
  - Public IP   → mapped to other/unconfigured/Internet (matched=True, is_fallback=True)
  - Hostname/unparseable → Unknown (matched=False)
"""

import ipaddress
from dataclasses import dataclass
from typing import Optional, List, Dict, Any

import config
from ip_parser import parse_ip

# Sentinel firewall/vsys values that map to other/unconfigured in topology
FALLBACK_FW_PRIVATE  = "other"
FALLBACK_VSYS        = "unconfigured"
FALLBACK_ZONE_CORE   = "Core"
FALLBACK_ZONE_INET   = "Internet"

# cidr_db Firewall1 values that are aliases for other/unconfigured
CORE_ALIASES = {"core", "other"}


@dataclass
class MatchResult:
    matched    : bool
    segment    : Optional[str] = None
    firewall1  : Optional[str] = None
    vsys       : Optional[str] = None
    zone       : Optional[str] = None
    location   : Optional[str] = None
    in_gates   : Optional[Any] = None
    notes      : Optional[str] = None
    is_fallback: bool = False   # True when mapped via private/public IP rule


class CIDRMatcher:
    """
    Loads the CIDR DB once and exposes a fast match() method.
    Sorted by prefix length descending — first hit = most specific.
    """

    def __init__(self, records: List[Dict]):
        self._entries = []
        for row in records:
            raw_seg = str(row.get(config.CIDR_COL_SEGMENT, "")).strip()
            if not raw_seg:
                continue
            try:
                net = ipaddress.IPv4Network(raw_seg, strict=False)
                self._entries.append((net, row))
            except ValueError:
                continue
        self._entries.sort(key=lambda x: x[0].prefixlen, reverse=True)

    # ── Public API ────────────────────────────────────────────────────────────

    def match(self, parsed_ip) -> MatchResult:
        """Match a ParsedIP. Returns MatchResult — never returns unmatched for
        valid private/public IPs; uses other/unconfigured fallback instead."""
        from ip_parser import ParsedIP

        if parsed_ip.error:
            return MatchResult(
                matched=False,
                notes=f"{config.UNRESOLVED_LABEL}: {parsed_ip.error}"
            )

        if parsed_ip.kind in ("single", "cidr"):
            result = self._match_network(parsed_ip.network)
        elif parsed_ip.kind == "range":
            result = self._match_range(parsed_ip.first, parsed_ip.last)
        elif parsed_ip.kind == "list":
            result = self._match_list(parsed_ip.ips)
        else:
            return MatchResult(matched=False, notes=config.NO_MATCH_LABEL)

        # ── Normalise CORE alias → other/unconfigured ─────────────────────
        if result.matched and result.firewall1:
            if result.firewall1.strip().lower() in CORE_ALIASES:
                result.firewall1   = FALLBACK_FW_PRIVATE
                result.vsys        = FALLBACK_VSYS
                result.is_fallback = True

        # ── Fallback for unmatched IPs ────────────────────────────────────
        if not result.matched and parsed_ip.first is not None:
            # result = self._fallback(parsed_ip.first, parsed_ip.raw)
            if result.notes == config.NO_MATCH_LABEL:
                result = self._fallback(parsed_ip.first, parsed_ip.raw)

        return result

    # ── Internal matching ─────────────────────────────────────────────────────

    def _match_network(self, query_net: ipaddress.IPv4Network) -> MatchResult:
        for db_net, row in self._entries:
            if query_net.subnet_of(db_net):
                return self._build_result(row)
        return MatchResult(matched=False, notes=config.NO_MATCH_LABEL)

    def _match_list(self, ips: List[ipaddress.IPv4Address]) -> MatchResult:
        if not ips:
            return MatchResult(matched=False, notes=config.NO_MATCH_LABEL)

        # Gunakan match() individual agar fallback berjalan jika IP tidak ada di DB
        results = [self.match(parse_ip(str(ip))) for ip in ips]

        # Ambil hasil yang berhasil match / fallback
        valid_matches = [r for r in results if r.matched]
        if not valid_matches:
            return MatchResult(matched=False, notes=config.NO_MATCH_LABEL)

        first_vsys = valid_matches[0].vsys
        is_same_vsys = all(r.vsys == first_vsys for r in valid_matches)

        if is_same_vsys and first_vsys:
            segments = list(dict.fromkeys(r.segment for r in valid_matches if r.segment))
            zones = list(dict.fromkeys(r.zone for r in valid_matches if r.zone))
            
            return MatchResult(
                matched=True,
                segment=", ".join(segments),
                firewall1=valid_matches[0].firewall1,
                vsys=first_vsys,
                zone=", ".join(zones),
                location=valid_matches[0].location,
                in_gates=valid_matches[0].in_gates,
                notes="Multiple segments matched in same VSYS"
            )

        return MatchResult(matched=False, notes=config.MULTI_SEGMENT_LABEL)

    # def _match_list(self, ips: List[ipaddress.IPv4Address]) -> MatchResult:
        # if not ips:
        #     return MatchResult(matched=False, notes=config.NO_MATCH_LABEL)

        # matches = [self._find_containing(ip) for ip in ips]

        # if all(m is None for m in matches):
        #     return MatchResult(matched=False, notes=config.NO_MATCH_LABEL)

        # if any(m is None for m in matches):
        #     return MatchResult(matched=False, notes=config.MULTI_SEGMENT_LABEL)

        # first_net, first_row = matches[0]
        # if all(net == first_net for net, _ in matches):
        #     return self._build_result(first_row)

        # # return MatchResult(matched=False, notes=config.MULTI_SEGMENT_LABEL)

        # first_vsys = str(first_row.get(config.CIDR_COL_VSYS, "")).strip()
        # first_fw = str(first_row.get(config.CIDR_COL_FIREWALL1, "")).strip()

        # is_same_vsys = all(
        #     str(row.get(config.CIDR_COL_VSYS, "")).strip() == first_vsys
        #     for _, row in matches
        # )

        # if is_same_vsys and first_vsys:
        #     segments = list(dict.fromkeys(str(r.get(config.CIDR_COL_SEGMENT, "")).strip() for _, r in matches))
        #     zones = list(dict.fromkeys(str(r.get(config.CIDR_COL_ZONE, "")).strip() for _, r in matches))
            
        #     return MatchResult(
        #         matched=True,
        #         segment=", ".join(filter(None, segments)),
        #         firewall1=first_fw,
        #         vsys=first_vsys,
        #         zone=", ".join(filter(None, zones)),
        #         location=str(first_row.get(config.CIDR_COL_LOCATION, "")).strip(),
        #         in_gates=first_row.get(config.CIDR_COL_IN_GATES),
        #         notes="Multiple segments in same VSYS"
        #     )

        # return MatchResult(matched=False, notes=config.MULTI_SEGMENT_LABEL)

    def _match_range(self,
                     first: ipaddress.IPv4Address,
                     last : ipaddress.IPv4Address) -> MatchResult:
        match_first = self._find_containing(first)
        match_last  = self._find_containing(last)

        if match_first is None and match_last is None:
            return MatchResult(matched=False, notes=config.NO_MATCH_LABEL)
        if match_first is None or match_last is None:
            return MatchResult(matched=False, notes=config.MULTI_SEGMENT_LABEL)

        # net_first, row_first = match_first
        # net_last,  _         = match_last

        # if net_first != net_last:
        #     return MatchResult(matched=False, notes=config.MULTI_SEGMENT_LABEL)

        # return self._build_result(row_first)

        net_first, row_first = match_first
        net_last,  row_last  = match_last

        if net_first == net_last:
            return self._build_result(row_first)

        vsys_first = str(row_first.get(config.CIDR_COL_VSYS, "")).strip()
        vsys_last = str(row_last.get(config.CIDR_COL_VSYS, "")).strip()

        if vsys_first == vsys_last and vsys_first:
            seg1 = str(row_first.get(config.CIDR_COL_SEGMENT, "")).strip()
            seg2 = str(row_last.get(config.CIDR_COL_SEGMENT, "")).strip()
            zone1 = str(row_first.get(config.CIDR_COL_ZONE, "")).strip()
            zone2 = str(row_last.get(config.CIDR_COL_ZONE, "")).strip()

            segments = list(dict.fromkeys(filter(None, [seg1, seg2])))
            zones = list(dict.fromkeys(filter(None, [zone1, zone2])))

            return MatchResult(
                matched=True,
                segment=", ".join(segments),
                firewall1=str(row_first.get(config.CIDR_COL_FIREWALL1, "")).strip(),
                vsys=vsys_first,
                zone=", ".join(zones),
                location=str(row_first.get(config.CIDR_COL_LOCATION, "")).strip(),
                in_gates=row_first.get(config.CIDR_COL_IN_GATES),
                notes="Range spans multiple segments in same VSYS"
            )

        return MatchResult(matched=False, notes=config.MULTI_SEGMENT_LABEL)

    def _find_containing(self, addr: ipaddress.IPv4Address):
        for db_net, row in self._entries:
            if addr in db_net:
                return (db_net, row)
        return None

    def _fallback(self, addr: ipaddress.IPv4Address, raw: str) -> MatchResult:
        """Map unmatched IP to other/unconfigured based on private/public."""
        if addr.is_private:
            zone  = FALLBACK_ZONE_CORE
            notes = f"Private IP not in CIDR DB — assumed {FALLBACK_ZONE_CORE}"
        else:
            zone  = FALLBACK_ZONE_INET
            notes = f"Public IP not in CIDR DB — assumed {FALLBACK_ZONE_INET}"

        return MatchResult(
            matched    = True,
            segment    = raw,          # use raw IP as segment placeholder
            firewall1  = FALLBACK_FW_PRIVATE,
            vsys       = FALLBACK_VSYS,
            zone       = zone,
            location   = "other",
            in_gates   = None,
            notes      = notes,
            is_fallback= True,
        )

    def _build_result(self, row: Dict) -> MatchResult:
        return MatchResult(
            matched   = True,
            segment   = str(row.get(config.CIDR_COL_SEGMENT,  "")).strip(),
            firewall1 = str(row.get(config.CIDR_COL_FIREWALL1,"")).strip(),
            vsys      = str(row.get(config.CIDR_COL_VSYS,     "")).strip(),
            zone      = str(row.get(config.CIDR_COL_ZONE,     "")).strip(),
            location  = str(row.get(config.CIDR_COL_LOCATION, "")).strip(),
            in_gates  = row.get(config.CIDR_COL_IN_GATES),
            notes     = None,
        )
