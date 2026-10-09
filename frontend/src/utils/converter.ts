import type { HopRow, HopRowDetail } from "@/types/api";

export function convertHopRowToDetail(row: HopRow): HopRowDetail {
  return {
    firewall_name: row["Firewall Name"] ?? "",
    vsys: row["VSys"] ?? "",
    src_zone: row["Src Zone"] ?? "",
    source_ip: row["Source IP"] ?? "",
    src_segment: row["Src Segment"] ?? "",
    dst_zone: row["Dst Zone"] ?? "",
    destination_ip: row["Destination IP"] ?? "",
    dst_segment: row["Dst Segment"] ?? "",
    services: row["Services"] ?? "",
    notes: row["Notes"] ?? "",
  };
}

export function normalizeHopRow(h: HopRowDetail): HopRow {
  return {
    "Firewall Name": h.firewall_name,
    "VSys": h.vsys,
    "Src Zone": h.src_zone,
    "Source IP": h.source_ip,
    "Src Segment": h.src_segment,
    "Dst Zone": h.dst_zone,
    "Destination IP": h.destination_ip,
    "Dst Segment": h.dst_segment,
    "Services": h.services,
    "Notes": h.notes,
  };
}