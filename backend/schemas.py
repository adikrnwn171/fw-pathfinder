from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator, Field
from models import RoleEnum

import ipaddress

class HopRowOut(BaseModel):
    firewall_name: str = ""
    vsys: str = ""
    src_zone: str = ""
    source_ip: str = ""
    src_segment: str = ""
    dst_zone: str = ""
    destination_ip: str = ""
    dst_segment: str = ""
    services: str = ""
    notes: str = ""

    @classmethod
    def from_resolver_dict(cls, d: Dict[str, Any]) -> "HopRowOut":
        return cls(
            firewall_name=d.get("Firewall Name", ""),
            vsys=d.get("VSys", ""),
            src_zone=d.get("Src Zone", ""),
            source_ip=d.get("Source IP", ""),
            src_segment=d.get("Src Segment", ""),
            dst_zone=d.get("Dst Zone", ""),
            destination_ip=d.get("Destination IP", ""),
            dst_segment=d.get("Dst Segment", ""),
            services=d.get("Services", ""),
            notes=d.get("Notes", ""),
        )

    model_config = {"populate_by_name": True}


class RequestSummaryOut(BaseModel):
    id: uuid.UUID
    submitted_at: datetime
    source_type: str
    source_filename: Optional[str]
    input_count: int
    hop_count: int
    status: str
    engineer_notes: Optional[str]
    updated_at: Optional[datetime]
    summary: Dict[str, Any]
    ticket_number: Optional[str]
    submitted_by: Optional[str]
    updated_by: Optional[str]
    configured_firewall: List[str] | None = None

    model_config = {"from_attributes": True}


class RequestDetailOut(RequestSummaryOut):
    hops: List[HopRowOut] = []

    model_config = {"from_attributes": True}


class RequestListOut(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[RequestSummaryOut]


class StatusPatchRequest(BaseModel):
    status: Literal["PENDING", "IN_REVIEW", "RESOLVED", "REJECTED", "PARTIAL"]
    engineer_notes: Optional[str] = None
    configured_firewall: Optional[List[str]] = None


class StatsBucket(BaseModel):
    period_label: str
    request_count: int
    hop_count: int
    unique_firewalls: int
    impacted_firewalls: int


class StatsOut(BaseModel):
    period: str
    total_requests: int
    total_hops: int
    total_impacted_firewalls: int
    impacted_firewall_names: List
    buckets: List[StatsBucket]


class IPResolveResponse(BaseModel):
    ip: str
    matched: bool
    segment: Optional[str] = None
    firewall: Optional[str] = None
    vsys: Optional[str] = None
    zone: Optional[str] = None
    location: Optional[str] = None
    in_gates: Optional[Any] = None
    notes: Optional[str] = None
    is_fallback: bool = False


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: RoleEnum = RoleEnum.ENGINEER


# --- Schemas Auth & Token ---
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# --- Schemas Audit Log ---
class AuditLogCreate(BaseModel):
    user_id: Optional[int] = None
    method: str
    endpoint: str
    status_code: int
    ip_address: Optional[str] = None


class AdminResetPasswordRequest(BaseModel):
    user_id: int
    new_password: str 


class UserResponse(BaseModel):
    id: int
    email: str
    role: RoleEnum

    model_config = ConfigDict(from_attributes=True)



class CidrEntryBase(BaseModel):
    location: str
    firewall1: str
    firewall2: str | None = None
    vsys: str
    zone: str
    segment: str  # CIDR
    exist_in_gates: bool
 
    @field_validator("segment")
    @classmethod
    def valid_cidr(cls, v: str) -> str:
        ipaddress.ip_network(v, strict=False)  # raise ValueError kalau invalid
        return v

 
 
class CidrEntryUpdate(BaseModel):
    location: str | None = None
    firewall1: str | None = None
    firewall2: str | None = None
    vsys: str | None = None
    zone: str | None = None
    segment: str | None = None
    exist_in_gates: bool | None = None
 
    @field_validator("segment")
    @classmethod
    def valid_cidr(cls, v: str | None) -> str | None:
        if v is not None:
            ipaddress.ip_network(v, strict=False)
        return v
 
 
# class CidrDiffResult(BaseModel):
#     added: list[CidrEntry]
#     modified: list[dict]  # {"before": CidrEntry, "after": CidrEntry}
#     removed: list[CidrEntry]
#     errors: list[str]
#     token: str | None = None


MAX_GATES_PER_VSYS = 2
 
 
class VSysPayload(BaseModel):
    name: str
    gates: list[str]
    zones: list[str]
 
 
class FirewallPayload(BaseModel):
    name: str
    vsys: list[VSysPayload]
 
 
class ConnectionEndpoint(BaseModel):
    firewall: str
    vsys: str
    gate: str
 
 
class ConnectionPayload(BaseModel):
    id: str
    from_: ConnectionEndpoint = Field(alias="from", serialization_alias="from")
    to: ConnectionEndpoint
 
    model_config = {"populate_by_name": True}
 
 
class TopologyGraphResponse(BaseModel):
    firewalls: list[FirewallPayload]
    connections: list[ConnectionPayload]
 
 
# ---- Write models ----
class VSysCreate(BaseModel):
    name: str
    gates: list[str]
    zones: list[str]


class FirewallCreate(BaseModel):
    name: str
    vsys: list[VSysCreate] = []


class FirewallVSysReplace(BaseModel):
    vsys: list[VSysCreate]

 
class ConnectionCreate(BaseModel):
    from_: ConnectionEndpoint = Field(alias="from")
    to: ConnectionEndpoint
 
    model_config = {"populate_by_name": True}