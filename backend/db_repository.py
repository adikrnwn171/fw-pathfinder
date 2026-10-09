from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone, date
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, Session

from models import FWHopRow, FWRequest, User
# , AuditLog
from schemas import UserCreate, AuditLogCreate

import hashlib
import ipaddress
import reference_repo as ref
from app.decorators import audit_file_mutation


async def save_request(
    session: AsyncSession,
    source_type: str,
    source_filename: Optional[str],
    raw_inputs: List[Dict[str, Any]],
    rows_out: List[Dict[str, Any]],
    summary: Dict[str, Any],
    ticket_number: Optional[str],
    submitted_by: Optional[str],
) -> uuid.UUID:
    request = FWRequest(
        id=uuid.uuid4(),
        source_type=source_type,
        source_filename=source_filename,
        input_count=len(raw_inputs),
        hop_count=len(rows_out),
        status="PENDING",
        raw_inputs=raw_inputs,
        summary=summary,
        ticket_number=ticket_number,
        submitted_by=submitted_by,
    )
    session.add(request)
    await session.flush()  # get the ID assigned before bulk insert

    hops = [
        FWHopRow(
            request_id=request.id,
            hop_index=i,
            firewall_name=row.get("Firewall Name"),
            vsys=row.get("VSys"),
            src_zone=row.get("Src Zone"),
            source_ip=row.get("Source IP"),
            src_segment=row.get("Src Segment"),
            dst_zone=row.get("Dst Zone"),
            destination_ip=row.get("Destination IP"),
            dst_segment=row.get("Dst Segment"),
            services=row.get("Services"),
            notes=row.get("Notes"),
        )
        for i, row in enumerate(rows_out)
    ]
    session.add_all(hops)
    return request.id


async def list_requests(
    session: AsyncSession,
    status: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    page: int = 1,
    page_size: int = 20,
) -> Tuple[List[FWRequest], int]:
    base_q = select(FWRequest).where(FWRequest.deleted_at.is_(None))

    if status:
        base_q = base_q.where(FWRequest.status == status)
    if date_from:
        base_q = base_q.where(FWRequest.submitted_at >= date_from)
    if date_to:
        base_q = base_q.where(FWRequest.submitted_at <= date_to)

    count_q = select(func.count()).select_from(base_q.subquery())
    total: int = (await session.execute(count_q)).scalar_one()

    items_q = (
        base_q.order_by(FWRequest.submitted_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = list((await session.execute(items_q)).scalars().all())
    return items, total


async def get_request_by_id(
    session: AsyncSession, request_id: uuid.UUID
) -> Optional[FWRequest]:
    q = (
        select(FWRequest)
        .options(selectinload(FWRequest.hops))
        .where(FWRequest.id == request_id)
        .where(FWRequest.deleted_at.is_(None))
    )
    return (await session.execute(q)).scalar_one_or_none()


async def update_request_status(
    session: AsyncSession,
    request_id: uuid.UUID,
    status: str,
    engineer_notes: Optional[str],
    updated_by: Optional[str],
    configured_firewall: Optional[list[str]] = None,
) -> Optional[FWRequest]:
    record = await get_request_by_id(session, request_id)
    if record is None:
        return None
    record.status = status
    record.updated_at = datetime.now(tz=timezone.utc)
    if engineer_notes is not None:
        record.engineer_notes = engineer_notes
    record.updated_by = updated_by
    if configured_firewall is not None:
        record.configured_firewall = configured_firewall
    await session.flush()
    return record


async def soft_delete_request(
    session: AsyncSession,
    request_id: uuid.UUID,
) -> Optional[FWRequest]:
    stmt = select(FWRequest).where(
        FWRequest.id == request_id,
        FWRequest.deleted_at.is_(None)
    )
    result = await session.execute(stmt)
    record = result.scalar_one_or_none()

    if record is None:
        return None

    record.deleted_at = datetime.now(tz=timezone.utc)

    return record


_PERIOD_CONFIG: Dict[str, Tuple[str, timedelta, str]] = {
    # period: (date_trunc unit, lookback, label format)
    "daily":     ("day",     timedelta(days=90),     "YYYY-MM-DD"),
    "weekly":    ("week",    timedelta(weeks=52),     'IYYY-"W"IW'),
    "monthly":   ("month",   timedelta(days=730),    "YYYY-MM"),
    "quarterly": ("quarter", timedelta(days=730 * 2), 'YYYY-"Q"Q'),
}


async def get_stats(session: AsyncSession, period: str, start_date: Optional[date] = None, end_date: Optional[date] = None) -> Dict[str, Any]:
    trunc_unit, lookback, label_fmt = _PERIOD_CONFIG.get(
        period, _PERIOD_CONFIG["daily"]
    )

    params: Dict[str, Any] = {
        "trunc_unit": trunc_unit,
        "label_fmt": label_fmt,
    }

    if start_date and end_date:
        where_clause = (
            "r.submitted_at >= :start_date AND r.submitted_at < :end_date_exclusive"
        )
        params["start_date"] = start_date
        params["end_date_exclusive"] = end_date + timedelta(days=1)
    else:
        where_clause = (
            "r.submitted_at >= now() - CAST(CAST(:lookback AS TEXT) AS INTERVAL)"
        )
        params["lookback"] = f"{int(lookback.total_seconds())} seconds"

    sql = text(f"""
        WITH firewall_stats AS (
            SELECT 
                request_id,
                COUNT(DISTINCT firewall_name) FILTER (
                    WHERE firewall_name IS NOT NULL AND firewall_name != 'Unknown' AND firewall_name != 'other'
                ) AS unique_firewalls
            FROM fw_hop_rows
            GROUP BY request_id
        ),
        period_firewall_stats AS (
            SELECT 
                to_char(date_trunc(:trunc_unit, r.submitted_at), :label_fmt) AS period_label,
                COUNT(DISTINCT h.firewall_name) AS impacted_firewalls
            FROM fw_requests r
            JOIN fw_hop_rows h ON h.request_id = r.id
            WHERE {where_clause}
            AND r.deleted_at IS NULL
            AND h.firewall_name IS NOT NULL 
            AND LOWER(h.firewall_name) NOT IN ('unknown', 'other')
            GROUP BY 1
        )
        SELECT
            to_char(date_trunc(:trunc_unit, r.submitted_at), :label_fmt) AS period_label,
            COUNT(r.id)                                                 AS request_count,
            COALESCE(SUM(r.hop_count), 0)                               AS hop_count,
            COALESCE(SUM(fs.unique_firewalls), 0)                       AS unique_firewalls,
            
            COALESCE(pfs.impacted_firewalls, 0)              AS impacted_firewalls

        FROM fw_requests r
        LEFT JOIN firewall_stats fs ON fs.request_id = r.id
        LEFT JOIN period_firewall_stats pfs 
            ON pfs.period_label = to_char(date_trunc(:trunc_unit, r.submitted_at), :label_fmt)
        WHERE {where_clause}
        AND r.deleted_at IS NULL
        GROUP BY 1, pfs.impacted_firewalls
        ORDER BY 1 DESC;
        """)

    summary_sql = text(f"""
        SELECT 
            (
                SELECT COUNT(r.id) 
                FROM fw_requests r 
                WHERE {where_clause} AND r.deleted_at IS NULL
            ) AS total_requests,
            
            (
                SELECT COALESCE(SUM(r.hop_count), 0) 
                FROM fw_requests r 
                WHERE {where_clause} AND r.deleted_at IS NULL
            ) AS total_hops,
            
            (
                SELECT COUNT(DISTINCT h.firewall_name) 
                FROM fw_hop_rows h
                JOIN fw_requests r ON h.request_id = r.id
                WHERE {where_clause} 
                AND r.deleted_at IS NULL
                AND h.firewall_name IS NOT NULL 
                AND LOWER(h.firewall_name) NOT IN ('unknown', 'other')
            ) AS total_impacted_firewalls,

            (
                SELECT COALESCE(array_agg(DISTINCT h.firewall_name), ARRAY[]::text[])
                FROM fw_hop_rows h
                JOIN fw_requests r ON h.request_id = r.id
                WHERE {where_clause} 
                AND r.deleted_at IS NULL
                AND h.firewall_name IS NOT NULL 
                AND LOWER(h.firewall_name) NOT IN ('unknown', 'other')
            ) AS impacted_firewall_names;
    """)

    summary_result = await session.execute(summary_sql, params)
    summary_row = summary_result.fetchone()

    result = await session.execute(
        sql,
        params
    )
    return {
        "total_requests": summary_row.total_requests if summary_row else 0,
        "total_hops": summary_row.total_hops if summary_row else 0,
        "total_impacted_firewalls": summary_row.total_impacted_firewalls if summary_row else 0,
        "impacted_firewall_names": list(summary_row.impacted_firewall_names) if summary_row else [],
        "buckets": [
        {
            "period_label": row.period_label,
            "request_count": row.request_count,
            "hop_count": row.hop_count,
            "unique_firewalls": row.unique_firewalls,
            "impacted_firewalls": row.impacted_firewalls,
        }
        for row in result
        ]
    }



async def get_user_by_email(session: AsyncSession, email: str) -> Optional[User]:
    stmt = select(User).where(User.email == email)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()

async def get_user_by_id(session: AsyncSession, user_id: int) -> Optional[User]:
    stmt = select(User).where(User.id == user_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()

async def create_user_db(session: AsyncSession, user_data: UserCreate, hashed_password: str) -> User:
    db_user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        role=user_data.role
    )
    session.add(db_user)
    await session.commit()
    await session.refresh(db_user)
    return db_user

# async def create_audit_log_db(session: AsyncSession, log_data: AuditLogCreate) -> AuditLog:
#     db_log = AuditLog(
#         user_id=log_data.user_id,
#         method=log_data.method,
#         endpoint=log_data.endpoint,
#         status_code=log_data.status_code,
#         ip_address=log_data.ip_address
#     )
#     session.add(db_log)
#     await session.commit()
#     return db_log

async def update_user_password(db: AsyncSession, user_id: int, new_hashed_password: str) -> bool:
    """
    Update password user in DB
    """
    user = await db.get(User, user_id)
    
    if not user:
        return False
        
    user.hashed_password = new_hashed_password
    
    await db.commit()
    return True

async def get_users(db: AsyncSession) -> List[User]:
    """
    Get all data user from database
    """
    result = await db.execute(select(User))
    return list(result.scalars().all())



def _short_hash(*parts: str) -> str:
    return hashlib.sha1("|".join(parts).encode()).hexdigest()[:12]
 
 
# =========================================================================
# ==== CIDR ====
# =========================================================================
 
async def list_cidr_entries(
    location: str | None = None,
    firewall: str | None = None,
    zone: str | None = None,
    q: str | None = None,
) -> list[dict]:
    entries = ref.load_all()
    if location:
        entries = [e for e in entries if e["location"] == location]
    if firewall:
        entries = [e for e in entries if firewall in (e["firewall1"], e["firewall2"])]
    if zone:
        entries = [e for e in entries if e["zone"] == zone]
    if q:
        entries = [e for e in entries if q.lower() in e["segment"].lower()]
    return entries


async def get_cidr_entry(zone: str, segment: str) -> dict | None:
    return next(
        (e for e in ref.load_all() if e["zone"] == zone and e["segment"] == segment),
        None,
    )


@audit_file_mutation(target_table="cidr_references", action="CREATE")
async def create_cidr_entry(data: dict) -> dict:
    entries = ref.load_all()
    _assert_no_duplicate_cidr(entries, data)
    entries.append(data)
    ref.save_all(entries)
    return data


@audit_file_mutation(target_table="cidr_references", action="UPDATE")
def update_cidr_entry(zone: str, segment: str, patch: dict) -> dict | None:
    entries = ref.load_all()
    idx = next(
        (i for i, e in enumerate(entries) if e["zone"] == zone and e["segment"] == segment),
        None,
    )
    if idx is None:
        return None
    updated = {**entries[idx], **{k: v for k, v in patch.items() if v is not None}}
    entries[idx] = updated
    ref.save_all(entries)
    return updated
 

@audit_file_mutation(target_table="cidr_references", action="DELETE")
async def delete_cidr_entry(zone: str, segment: str) -> bool:
    entries = ref.load_all()
    filtered = [e for e in entries if not (e["zone"] == zone and e["segment"] == segment)]
    if len(filtered) == len(entries):
        return False
    ref.save_all(filtered)
    return True
 
 
def _assert_no_duplicate_cidr(entries: list[dict], candidate: dict) -> None:
    for e in entries:
        if e["segment"] == candidate["segment"] and e["zone"] == candidate["zone"]:
            raise ValueError(
                f"Segment {candidate['segment']} already exist in zone {candidate['zone']}"
            )
 
 
def compute_cidr_diff(new_entries: list[dict]) -> dict:
    current = {e["segment"]: e for e in ref.load_all()}
    incoming = {e["segment"]: e for e in new_entries}
 
    added = [v for k, v in incoming.items() if k not in current]
    removed = [v for k, v in current.items() if k not in incoming]
    modified = [
        {"before": current[k], "after": incoming[k]}
        for k in incoming
        if k in current and _cidr_entry_changed(current[k], incoming[k])
    ]
 
    return {
        "added": added,
        "modified": modified,
        "removed": removed,
        "errors": _validate_cidr_bulk(new_entries),
    }
 
 
def _cidr_entry_changed(a: dict, b: dict) -> bool:
    keys = ["location", "firewall1", "firewall2", "vsys", "zone", "exist_in_gates"]
    return any(a.get(k) != b.get(k) for k in keys)
 
 
def _validate_cidr_bulk(entries: list[dict]) -> list[str]:
    errors: list[str] = []
    seen: set[tuple[str, str]] = set()
    for e in entries:
        try:
            ipaddress.ip_network(e["segment"], strict=False)
        except ValueError:
            errors.append(f"CIDR invalid: {e['segment']}")
        key = (e["segment"], e["zone"])
        if key in seen:
            errors.append(f"Duplicate segment {e['segment']} in zone {e['zone']}")
        seen.add(key)
    return errors
 
 
# =========================================================================
# ==== TOPOLOGY ====
# =========================================================================
 
# MAX_GATES_PER_VSYS = 2


# def _build_vsys_map(vsys_list: list[dict]) -> dict:
#     vmap: dict[str, dict] = {}
#     for v in vsys_list:
#         if len(v["gates"]) > MAX_GATES_PER_VSYS:
#             raise ValueError(f"VSys '{v['name']}': maksimal {MAX_GATES_PER_VSYS} gate")
#         if v["name"] in vmap:
#             raise ValueError(f"VSys '{v['name']}' duplikat dalam 1 request")
#         vmap[v["name"]] = {"gates": v["gates"], "zones": v["zones"]}
#     return vmap

def _build_vsys_map(vsys_list: list[dict]) -> dict: 
    vmap: dict[str, dict] = {}

    for v in vsys_list: 
        if v["name"] in vmap: 
            raise ValueError(f"VSys '{v['name']}' duplicate in 1 request") 

        vmap[v["name"]] = { "gates": list(v["gates"]), "zones": list(v["zones"]), } 

    return vmap
 
 
def _endpoint_str(ep: dict) -> str:
    return f"{ep['firewall']}.{ep['vsys']}.{ep['gate']}"
 
 
def _parse_endpoint(value: str) -> dict:
    fw, vsys, gate = value.split(".", 2)
    return {"firewall": fw, "vsys": vsys, "gate": gate}
 

async def get_topology_graph() -> dict:
    raw = ref.load_raw()
 
    firewalls = [
        {
            "name": fw,
            "vsys": [
                {"name": v, "gates": e["gates"], "zones": e["zones"]}
                for v, e in vmap.items()
            ],
        }
        for fw, vmap in raw["physicals"].items()
    ]
 
    connections = [
        {"id": _short_hash(a, b), "from": _parse_endpoint(a), "to": _parse_endpoint(b)}
        for a, b in raw["connections"]
    ]
 
    return {"firewalls": firewalls, "connections": connections}
 
 
# def add_firewall(name: str, vsys_list: list[dict]) -> None:
#     raw = ref.load_raw()
#     # if name in raw["physicals"]:
#     #     raise ValueError(f"Firewall '{name}' already exist")

#     vmap = _build_vsys_map(vsys_list)
#     raw["physicals"][name] = vmap
#     ref.save_raw(raw)

@audit_file_mutation(target_table="firewall_references", action="CREATE")
async def add_firewall(name: str, vsys_list: list[dict]) -> None:
    raw = ref.load_raw()

    new_vmap = _build_vsys_map(vsys_list)
    if name not in raw["physicals"]: 
        raw["physicals"][name] = new_vmap 
        ref.save_raw(raw) 
        return

    existing_vmap = raw["physicals"][name]
    for vsys_name, new_vsys in new_vmap.items():
        if vsys_name not in existing_vmap:
            existing_vmap[vsys_name] = { 
                "gates": list(new_vsys["gates"]), 
                "zones": list(new_vsys["zones"]), 
                } 
            continue

        existing_vsys = existing_vmap[vsys_name] 
        existing_vsys["gates"] = list( 
            dict.fromkeys( 
                existing_vsys.get("gates", []) + new_vsys.get("gates", []) 
                ) 
            )

        existing_vsys["zones"] = list( 
            dict.fromkeys( 
                existing_vsys.get("zones", []) + new_vsys.get("zones", []) 
                ) 
            ) 

    ref.save_raw(raw)
 

@audit_file_mutation(target_table="firewall_references", action="UPDATE")
async def replace_firewall_vsys(name: str, vsys_list: list[dict]) -> dict:
    raw = ref.load_raw()
    if name not in raw["physicals"]:
        raise KeyError(f"Firewall '{name}' not found")
 
    vmap = _build_vsys_map(vsys_list)
    raw["physicals"][name] = vmap
 
    def endpoint_still_valid(value: str) -> bool:
        parsed = _parse_endpoint(value)
        if parsed["firewall"] != name:
            return True  # bukan endpoint di firewall ini, ga relevan buat dicek
        entry = vmap.get(parsed["vsys"])
        return entry is not None and parsed["gate"] in entry["gates"]
 
    kept, dropped = [], []
    for a, b in raw["connections"]:
        (kept if endpoint_still_valid(a) and endpoint_still_valid(b) else dropped).append([a, b])
    raw["connections"] = kept
 
    ref.save_raw(raw)
    return {"dropped_connections": dropped}


@audit_file_mutation(target_table="firewall_references", action="DELETE")
async def delete_firewall(name: str) -> bool:
    raw = ref.load_raw()
    if name not in raw["physicals"]:
        return False
    del raw["physicals"][name]
    raw["connections"] = [
        [a, b] for a, b in raw["connections"]
        if _parse_endpoint(a)["firewall"] != name and _parse_endpoint(b)["firewall"] != name
    ]
    ref.save_raw(raw)
    return True
 

@audit_file_mutation(target_table="connection_references", action="CREATE")
async def add_connection(from_ep: dict, to_ep: dict) -> dict:
    raw = ref.load_raw()
 
    for ep in (from_ep, to_ep):
        entry = raw["physicals"].get(ep["firewall"], {}).get(ep["vsys"])
        if entry is None or ep["gate"] not in entry["gates"]:
            raise ValueError(f"Endpoint invalid, not found in topology: {ep}")
 
    from_str, to_str = _endpoint_str(from_ep), _endpoint_str(to_ep)
    if [from_str, to_str] in raw["connections"]:
        raise ValueError("This connection already exist")
 
    raw["connections"].append([from_str, to_str])
    ref.save_raw(raw)
    return {"id": _short_hash(from_str, to_str), "from": from_ep, "to": to_ep}
 

@audit_file_mutation(target_table="connection_references", action="DELETE")
async def delete_connection(conn_id: str) -> bool:
    raw = ref.load_raw()
    before = len(raw["connections"])
    raw["connections"] = [[a, b] for a, b in raw["connections"] if _short_hash(a, b) != conn_id]
    if len(raw["connections"]) == before:
        return False
    ref.save_raw(raw)
    return True