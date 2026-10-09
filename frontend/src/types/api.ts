// ── Hop rows from /resolve endpoints (PascalCase with spaces) ──────────────

export interface HopRow {
  "Firewall Name": string;
  "VSys": string;
  "Src Zone": string;
  "Source IP": string;
  "Src Segment": string;
  "Dst Zone": string;
  "Destination IP": string;
  "Dst Segment": string;
  "Services": string;
  "Notes": string;
}

// ── Hop rows from GET /requests/{id} (snake_case) ─────────────────────────

export interface HopRowDetail {
  firewall_name: string;
  vsys: string;
  src_zone: string;
  source_ip: string;
  src_segment: string;
  dst_zone: string;
  destination_ip: string;
  dst_segment: string;
  services: string;
  notes: string;
}

// ── Summary object (inside every resolve response and request record) ──────

export interface ResolveSummary {
  total_rows: number;
  total_nodes: number;
  nodes: string[];
  total_vsys: number;
  vsys: string[];
}

// ── Resolve responses ──────────────────────────────────────────────────────

export interface SingleResolveResponse {
  input: { source_ip: string; destination_ip: string; service: string };
  rows: HopRow[];
  summary: ResolveSummary;
}

export interface BatchResolveResponse {
  inputs: number;
  rows: HopRow[];
  summary: ResolveSummary;
}

export interface CsvResolveResponse {
  source_file: string;
  inputs: number;
  rows: HopRow[];
  summary: ResolveSummary;
}

// ── Request history ────────────────────────────────────────────────────────

export type RequestStatus = "PENDING" | "IN_REVIEW" | "RESOLVED" | "REJECTED" | "PARTIAL";
export type SourceType = "single" | "batch" | "csv";

export interface RequestSummary {
  id: string;
  submitted_at: string;
  source_type: SourceType;
  source_filename: string | null;
  input_count: number;
  hop_count: number;
  status: RequestStatus;
  engineer_notes: string | null;
  updated_at: string | null;
  summary: ResolveSummary;
  ticket_number: string;
  submitted_by: string;
  updated_by: string;
  configured_firewall: string[];
}

export interface RequestDetail extends RequestSummary {
  hops: HopRowDetail[];
}

export interface RequestListResponse {
  total: number;
  page: number;
  page_size: number;
  items: RequestSummary[];
}

export interface StatusPatchRequest {
  status: RequestStatus;
  engineer_notes?: string;
  configured_firewall?: string[];
}

// ── Statistics ─────────────────────────────────────────────────────────────

export type StatsPeriod = "daily" | "weekly" | "monthly" | "quarterly";

export interface StatsBucket {
  period_label: string;
  request_count: number;
  hop_count: number;
  unique_firewalls: number;
  impacted_firewalls: number;
}

export interface StatsResponse {
  period: StatsPeriod;
  total_requests: number;
  total_hops: number;
  total_impacted_firewalls: number;
  impacted_firewall_names: [];
  buckets: StatsBucket[];
}

// ── Error ──────────────────────────────────────────────────────────────────

export interface ApiError {
  detail: string;
}


export interface IpResolve {
  ip: string;
  matched: boolean;
  segment: string;
  firewall: string;
  vsys: string;
  zone: string;
  location: string;
  in_gates: boolean;
  notes: string;
  is_fallback: boolean;
}


export interface User{
  email: string;
  id: number;
  role: "admin" | "engineer"
}

export interface CidrEntry {
  location: string;
  firewall1: string;
  firewall2: string | null;
  vsys: string;
  zone: string;
  segment: string;
  exist_in_gates: boolean;
}

export interface RowFirewall {
  firewall: string;
  vsys: string;
  gatesLabel: string;
  zone: string;
}

export interface VSysPayload {
  name: string;
  gates: string[];
  zones: string[];
}
 
export interface FirewallPayload {
  name: string;
  vsys: VSysPayload[];
}
 
export interface ConnectionEndpoint {
  firewall: string;
  vsys: string;
  gate: string;
}
 
export interface ConnectionPayload {
  id: string;
  from: ConnectionEndpoint;
  to: ConnectionEndpoint;
}

export interface TopologyGraphResponse {
  firewalls: FirewallPayload[];
  connections: ConnectionPayload[];
}

export interface CidrCreateRequest {
  location: string;
  firewall1: string;
  firewall2: string | null;
  vsys: string;
  zone: string;
  segment: string;
  exist_in_gates: string;
}

export interface VSysCreateRequest {
  name: string;
  vsys: {
      name: string;
      gates: string[];
      zones: string[];
  }[];
}

export interface UpdateFirewallRequest {
  vsys: {
    name: string;
    gates: string[];
    zones: string[];
  }[];
}

export interface payloadConnection {
    from: ConnectionEndpoint,
    to: ConnectionEndpoint
}