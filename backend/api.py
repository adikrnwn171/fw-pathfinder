from __future__ import annotations

import itertools
import csv
import pandas as pd
import io
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, date
from typing import Any, Dict, List, Literal, Optional

import config
from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile, Form, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from fastapi.encoders import jsonable_encoder

from database import get_db, get_engine
from db_repository import (
    get_request_by_id,
    get_stats,
    list_requests,
    save_request,
    update_request_status,
    get_users
)
from schemas import (
    HopRowOut,
    RequestDetailOut,
    RequestListOut,
    RequestSummaryOut,
    StatusPatchRequest,
    StatsOut,
    IPResolveResponse,
    UserCreate,
    LoginRequest,
    AdminResetPasswordRequest,
    UserResponse,
    CidrEntryBase,
    TopologyGraphResponse,
    FirewallCreate,
    FirewallVSysReplace,
    ConnectionCreate
)
from service import PathFinderService

from ip_parser import parse_ip

from fastapi.security import OAuth2PasswordBearer
import jwt
from service import AuthService, SECRET_KEY, ALGORITHM
import db_repository as repo
from models import RoleEnum, User
from app.middleware import audit_context_middleware
import app.listeners
from app.context import current_user_id
from openpyxl import load_workbook

logger = logging.getLogger(__name__)


# ── Pydantic input models ─────────────────────────────────────────────────────

class ResolveRequest(BaseModel):
    source_ip: str = Field(..., min_length=1)
    destination_ip: str = Field(..., min_length=1)
    service: str = ""
    ticket_number: str = ""


class BatchResolveRequest(BaseModel):
    rows: List[ResolveRequest]
    ticket_number: str = ""


class IPResolveRequest(BaseModel):
    ip: str


# ── App setup ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    get_engine()  # initialise once at startup; logs warning if URL not set
    yield


app = FastAPI(title="FWPathfinder API", version="0.2.0", lifespan=lifespan)

# FRONTEND_URL = "http://localhost:5173"
FRONTEND_URL = "http://localhost"

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_service = PathFinderService()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _to_engine_row(row: ResolveRequest) -> Dict[str, Any]:
    return {
        config.COL_SOURCE_IP: row.source_ip,
        config.COL_DEST_IP: row.destination_ip,
        config.COL_SERVICE: row.service,
    }


def _summarize(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    unique_firewalls = sorted(
        {
            r.get("Firewall Name", "")
            for r in rows
            if r.get("Firewall Name", "") not in ("", config.UNRESOLVED_LABEL)
        }
    )
    unique_vsys = sorted(
        {
            r.get("VSys", "")
            for r in rows
            if r.get("VSys", "") not in ("", config.UNRESOLVED_LABEL)
        }
    )
    return {
        "total_rows": len(rows),
        "total_nodes": len(unique_firewalls),
        "nodes": unique_firewalls,
        "total_vsys": len(unique_vsys),
        "vsys": unique_vsys,
    }


async def _try_save(
    db: Optional[AsyncSession],
    source_type: str,
    source_filename: Optional[str],
    raw_inputs: list,
    rows_out: list,
    summary: dict,
    ticket_number: Optional[str],
    submitted_by: Optional[str],
) -> None:
    if db is None:
        return
    try:
        await save_request(db, source_type, source_filename, raw_inputs, rows_out, summary, ticket_number, submitted_by)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.warning("[db] Failed to persist request (%s): %s", source_type, exc)

def _recover_collapsed_row(row: dict, fieldnames: list) -> Optional[dict]:
    filled = [(k, v) for k, v in row.items() if v is not None]
    if len(filled) != 1:
        return None
    _, value = filled[0]
    if "," not in value:
        return None
    sub_fields = next(csv.reader(io.StringIO(value)), None)
    if not sub_fields or len(sub_fields) != len(fieldnames):
        return None
    return dict(zip(fieldnames, [f.strip() for f in sub_fields]))

def validate_hop_row_length(rows: list[dict]) -> None:
    limits = {
        "Source IP": 500,
        "Destination IP": 500,
        "Src Segment": 500,
        "Dst Segment": 500,
        "Services": 256,
    }

    for index, row in enumerate(rows, start=1):
        for field, limit in limits.items():
            value = row.get(field)

            if value is None:
                continue

            value = str(value)

            if len(value) > limit:
                raise ValueError(
                    f"Row {index}: {field} exceeds maximum length of "
                    f"{limit} characters "
                    f"(received {len(value)} characters)"
                )

# ── Dependencies Security (Authentication & Authorization) ────────────────────
async def get_current_user(
    request: Request,
    db: Optional[AsyncSession] = Depends(get_db)
) -> User:
    if db is None:
        raise HTTPException(status_code=500, detail="Database is required")

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="The token is invalid, expired, or you haven't logged in",
    )
    
    token = request.cookies.get("access_token")
    if not token:
        raise credentials_exception
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception

        user_id_int = int(user_id)
    except jwt.PyJWTError:
        raise credentials_exception

    user = await repo.get_user_by_id(db, int(user_id_int))
    if user is None or not user.is_active:
        raise credentials_exception

    current_user_id.set(user.id)
        
    return user


def require_roles(allowed_roles: list[RoleEnum]):
    """A closure to check if the user has an allowed Role"""
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="You don't have access rights to this endpoint."
            )
        return current_user
    return role_checker

async def read_csv_file(
    file: UploadFile,
    delimiter: str,
    ) -> List[ResolveRequest]:
    """
    Read CSV upload and convert every valid row into ResolveRequest.

    CSV-specific behavior:
    - UTF-8 BOM is supported
    - Uses config-defined delimiter
    - Supports collapsed CSV rows through _recover_collapsed_row()
    - Source/Destination IP are mandatory
    """

    try:
        content = await file.read()
        text_content = content.decode("utf-8-sig")

        reader = csv.DictReader(
            io.StringIO(text_content),
            delimiter=delimiter,
        )

        fieldnames = reader.fieldnames or []

        if not fieldnames:
            raise HTTPException(
                status_code=400,
                detail="CSV has no header row",
            )

        rows_in: List[ResolveRequest] = []

        for idx, row in enumerate(reader, start=2):
            required_missing = (
                row.get(config.COL_SOURCE_IP) is None
                or row.get(config.COL_DEST_IP) is None
            )

            if required_missing:
                recovered = _recover_collapsed_row(row, fieldnames)

                if recovered is None:
                    raise HTTPException(
                        status_code=400,
                        detail=f"CSV line {idx}: format invalid — {row}",
                    )

                row = recovered

            src = (row.get(config.COL_SOURCE_IP) or "").strip()
            dst = (row.get(config.COL_DEST_IP) or "").strip()
            svc = (row.get(config.COL_SERVICE) or "").strip()

            if not src or not dst:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Missing Source/Destination IP at CSV line {idx}. "
                        f"Expected columns: "
                        f"{config.COL_SOURCE_IP}, {config.COL_DEST_IP}"
                    ),
                )

            rows_in.append(
                ResolveRequest(
                    source_ip=src,
                    destination_ip=dst,
                    service=svc,
                )
            )

        if len(rows_in) > config.MAX_BATCH_ROWS:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"CSV rows exceeds max limit "
                    f"({config.MAX_BATCH_ROWS})"
                ),
            )

        if not rows_in:
            raise HTTPException(
                status_code=400,
                detail="CSV has no data rows",
            )

        return rows_in

    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="CSV file must be UTF-8 encoded",
        )

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to read CSV file: {exc}",
        )

async def read_excel_file(
    file: UploadFile,
    ) -> List[ResolveRequest]:
    """
    Read XLSX upload and convert every valid row into ResolveRequest.

    Excel-specific behavior:
    - First worksheet is used
    - First row is treated as header
    - Completely empty rows are ignored
    - Cell values are converted into the same dictionary-style
    structure used by the CSV parser
    """

    workbook = None

    try:
        content = await file.read()

        workbook = load_workbook(
            filename=io.BytesIO(content),
            read_only=True,
            data_only=True,
        )

        worksheet = workbook.active
        rows_iter = worksheet.iter_rows(values_only=True)

        # ==========================================================
        # Header
        # ==========================================================

        try:
            header_row = next(rows_iter)
        except StopIteration:
            raise HTTPException(
                status_code=400,
                detail="Excel file is empty",
            )

        fieldnames = [
            str(value).strip() if value is not None else ""
            for value in header_row
        ]

        # Remove empty columns from the end of the header
        while fieldnames and fieldnames[-1] == "":
            fieldnames.pop()

        if not fieldnames:
            raise HTTPException(
                status_code=400,
                detail="Excel file has no header row",
            )

        # ==========================================================
        # Data rows
        # ==========================================================

        rows_in: List[ResolveRequest] = []

        for idx, row in enumerate(rows_iter, start=2):

            # Ignore completely empty rows
            if not any(value is not None for value in row):
                continue

            row_values = list(row[:len(fieldnames)])

            # Make row length equal to header length
            if len(row_values) < len(fieldnames):
                row_values.extend(
                    [None] * (len(fieldnames) - len(row_values))
                )

            row_dict = dict(zip(fieldnames, row_values))

            # ======================================================
            # Same validation logic as CSV
            # ======================================================

            src_value = row_dict.get(config.COL_SOURCE_IP)
            dst_value = row_dict.get(config.COL_DEST_IP)

            required_missing = (
                src_value is None
                or dst_value is None
            )

            if required_missing:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Excel row {idx}: format invalid — "
                        f"missing required columns "
                        f"{config.COL_SOURCE_IP}, "
                        f"{config.COL_DEST_IP}"
                    ),
                )

            # Excel cells can contain non-string values.
            # Convert them to string before .strip().
            src = str(src_value).strip() if src_value is not None else ""
            dst = str(dst_value).strip() if dst_value is not None else ""
            svc_value = row_dict.get(config.COL_SERVICE)

            svc = (
                str(svc_value).strip()
                if svc_value is not None
                else ""
            )

            if not src or not dst:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Missing Source/Destination IP at "
                        f"Excel row {idx}. "
                        f"Expected columns: "
                        f"{config.COL_SOURCE_IP}, "
                        f"{config.COL_DEST_IP}"
                    ),
                )

            rows_in.append(
                ResolveRequest(
                    source_ip=src,
                    destination_ip=dst,
                    service=svc,
                )
            )

        if len(rows_in) > config.MAX_BATCH_ROWS:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Excel rows exceeds max limit "
                    f"({config.MAX_BATCH_ROWS})"
                ),
            )

        if not rows_in:
            raise HTTPException(
                status_code=400,
                detail="Excel has no data rows",
            )

        return rows_in

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to read Excel file: {exc}",
        )

    finally:
        if workbook is not None:
            workbook.close()

# ── Existing endpoints ────────────────────────────────────────────────────────

@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/resolve")
async def resolve_one(
    payload: ResolveRequest,
    current_user: User = Depends(require_roles([RoleEnum.ADMIN, RoleEnum.ENGINEER])),
    db: Optional[AsyncSession] = Depends(get_db),
) -> Dict[str, Any]:
    try:
        rows = _service.resolve_row(_to_engine_row(payload))        
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Resolve failed: {error}") from error

    summary = _summarize(rows)
    await _try_save(db, "single", None, [payload.model_dump()], rows, summary, payload.ticket_number, current_user.email)

    return {
        "input": payload.model_dump(),
        "rows": rows,
        "summary": summary,
    }


@app.post("/resolve/batch")
async def resolve_batch(
    payload: BatchResolveRequest,
    current_user: User = Depends(require_roles([RoleEnum.ADMIN, RoleEnum.ENGINEER])),
    db: Optional[AsyncSession] = Depends(get_db),
) -> Dict[str, Any]:
    if not payload.rows:
        raise HTTPException(status_code=400, detail="rows must not be empty")
    if len(payload.rows) > config.MAX_BATCH_ROWS:
        raise HTTPException(
            status_code=400,
            detail=f"rows exceeds max limit ({config.MAX_BATCH_ROWS})",
        )

    try:
        engine_rows = [_to_engine_row(row) for row in payload.rows]
        rows = _service.resolve_rows(engine_rows)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Batch resolve failed: {error}") from error

    summary = _summarize(rows)
    raw_inputs = [r.model_dump() for r in payload.rows]
    await _try_save(db, "batch", None, raw_inputs, rows, summary, payload.ticket_number, current_user.email)

    return {
        "inputs": len(payload.rows),
        "rows": rows,
        "summary": summary,
    }


@app.post("/resolve/csv")
async def resolve_csv(
    ticket_number: Optional[str] = Form(None),
    current_user: User = Depends(require_roles([RoleEnum.ADMIN, RoleEnum.ENGINEER])),
    file: UploadFile = File(...),
    db: Optional[AsyncSession] = Depends(get_db),
) -> Dict[str, Any]:
    filename = file.filename or "uploaded.csv"
    # if not filename.lower().endswith(".csv"):
    #     raise HTTPException(status_code=400, detail="Only .csv is supported for this endpoint")

    try:
        # content = await file.read()
        # text_content = content.decode("utf-8-sig")
        # reader = csv.DictReader(io.StringIO(text_content), delimiter=config.INPUT_DELIMITER)
        # fieldnames = reader.fieldnames or []

        # rows_in: List[ResolveRequest] = []
        # for idx, row in enumerate(reader, start=2):
        #     # span = reader.line_num - prev_line
        #     # prev_line = reader.line_num

        #     required_missing = (
        #         row.get(config.COL_SOURCE_IP) is None
        #         or row.get(config.COL_DEST_IP) is None
        #     )

        #     if required_missing:
        #         recovered = _recover_collapsed_row(row, fieldnames)
        #         if recovered is None:
        #             raise HTTPException(
        #                 status_code=400,
        #                 detail=f"CSV line {idx}: format invalid — {row}",
        #             )
        #         row = recovered

        #     src = (row.get(config.COL_SOURCE_IP) or "").strip()
        #     dst = (row.get(config.COL_DEST_IP) or "").strip()
        #     svc = (row.get(config.COL_SERVICE) or "").strip()

        #     if not src or not dst:
        #         raise HTTPException(
        #             status_code=400,
        #             detail=(
        #                 f"Missing Source/Destination IP at CSV line {idx}. "
        #                 f"Expected columns: {config.COL_SOURCE_IP}, {config.COL_DEST_IP}"
        #             ),
        #         )

        #     rows_in.append(ResolveRequest(source_ip=src, destination_ip=dst, service=svc))

        # if len(rows_in) > config.MAX_BATCH_ROWS:
        #     raise HTTPException(
        #         status_code=400,
        #         detail=f"CSV rows exceeds max limit ({config.MAX_BATCH_ROWS})",
        #     )

        # if not rows_in:
        #     raise HTTPException(status_code=400, detail="CSV has no data rows")

        if filename.endswith(".csv"):
            file_type = "csv"
            rows_in = await read_csv_file(
                file,
                delimiter=config.INPUT_DELIMITER,
            )

        elif filename.endswith(".xlsx"):
            file_type = "xlsx"
            rows_in = await read_excel_file(file)

        else:
            raise HTTPException(
                status_code=400,
                detail="Only .csv or .xlsx is supported",
            )

        engine_rows = [_to_engine_row(row) for row in rows_in]
        rows_out = _service.resolve_rows(engine_rows)

        validate_hop_row_length(rows_out)

        summary = _summarize(rows_out)
        raw_inputs = [r.model_dump() for r in rows_in]
        await _try_save(db, file_type, filename, raw_inputs, rows_out, summary, ticket_number, current_user.email)

        return {
            "source_file": filename,
            "inputs": len(rows_in),
            "rows": rows_out,
            "summary": summary,
        }
    except HTTPException:
        raise
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"CSV resolve failed: {error}") from error


# ── New endpoints ─────────────────────────────────────────────────────────────

@app.get("/requests", response_model=RequestListOut)
async def list_requests_endpoint(
    status: Optional[str] = Query(None, description="Filter by status: PENDING, IN_REVIEW, RESOLVED, REJECTED, PARTIAL"),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    db: Optional[AsyncSession] = Depends(get_db),
) -> RequestListOut:
    if db is None:
        raise HTTPException(status_code=503, detail="Database not configured")
    items, total = await list_requests(db, status, date_from, date_to, page, page_size)
    return RequestListOut(
        total=total,
        page=page,
        page_size=page_size,
        items=[RequestSummaryOut.model_validate(item) for item in items],
    )


@app.get("/requests/{request_id}", response_model=RequestDetailOut)
async def get_request_endpoint(
    request_id: uuid.UUID,
    db: Optional[AsyncSession] = Depends(get_db),
) -> RequestDetailOut:
    if db is None:
        raise HTTPException(status_code=503, detail="Database not configured")
    record = await get_request_by_id(db, request_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Request not found")

    record_dict = jsonable_encoder(record)
    out = RequestDetailOut.model_validate(record_dict)
    # out = RequestDetailOut.model_validate(record)
    out.hops = [
        HopRowOut(
            firewall_name=h.firewall_name or "",
            vsys=h.vsys or "",
            src_zone=h.src_zone or "",
            source_ip=h.source_ip or "",
            src_segment=h.src_segment or "",
            dst_zone=h.dst_zone or "",
            destination_ip=h.destination_ip or "",
            dst_segment=h.dst_segment or "",
            services=h.services or "",
            notes=h.notes or "",
        )
        for h in sorted(record.hops, key=lambda x: x.hop_index)
    ]
    return out


@app.patch("/requests/{request_id}/status", response_model=RequestSummaryOut)
async def update_status_endpoint(
    request_id: uuid.UUID,
    payload: StatusPatchRequest,
    current_user: User = Depends(require_roles([RoleEnum.ADMIN, RoleEnum.ENGINEER])),
    db: Optional[AsyncSession] = Depends(get_db),
) -> RequestSummaryOut:
    if db is None:
        raise HTTPException(status_code=503, detail="Database not configured")
    record = await update_request_status(db, request_id, payload.status, payload.engineer_notes, current_user.email, payload.configured_firewall)
    if record is None:
        raise HTTPException(status_code=404, detail="Request not found")
    await db.commit()
    return RequestSummaryOut.model_validate(record)


@app.delete("/requests/{request_id}/delete")
async def delete_request(
    request_id: uuid.UUID,
    current_user: User = Depends(require_roles([RoleEnum.ADMIN])),
    db: Optional[AsyncSession] = Depends(get_db),
):
    if db is None:
        raise HTTPException(status_code=503, detail="Database not configured")
    record = await repo.soft_delete_request(db, request_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Request not found")
    await db.commit()
    return {
        "message": "The request is successfully deleted"
    }


@app.get("/stats", response_model=StatsOut)
async def stats_endpoint(
    period: Literal["daily", "weekly", "monthly", "quarterly"] = Query("daily"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Optional[AsyncSession] = Depends(get_db),
) -> StatsOut:
    if db is None:
        raise HTTPException(status_code=503, detail="Database not configured")
    if (start_date and not end_date) or (end_date and not start_date):
        raise HTTPException(
            status_code=400,
            detail="Both parameter 'start_date' dan 'end_date' must be fill in.",
        )
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="Parameter 'start_date' cannot be later than 'end_date'.",
        )
    buckets = await get_stats(db, period, start_date, end_date)
    return StatsOut(period=period, **buckets)


@app.get("/template/csv")
def download_csv_template() -> Response:
    content = f"{config.COL_SOURCE_IP},{config.COL_DEST_IP},{config.COL_SERVICE}\n"
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=fw_request_template.csv"},
    )

@app.post("/resolve/ip", response_model=IPResolveResponse)
def resolve_ip(request: IPResolveRequest):
    parsed = parse_ip(request.ip)
    result = _service._matcher.match(parsed)

    return IPResolveResponse(
        ip=request.ip,
        matched=result.matched,
        segment=result.segment,
        firewall=result.firewall1,
        vsys=result.vsys,
        zone=result.zone,
        location=result.location,
        in_gates=result.in_gates,
        notes=result.notes,
        is_fallback=result.is_fallback,
    )



# ── Middleware Audit Logging ──────────────────────────────────────────────────
app.middleware("http")(audit_context_middleware)


# ── Router Authentication (Login & Register) ──────────────────────────────────
@app.post("/auth/register")
async def register_user(
    payload: UserCreate,
    current_admin: User = Depends(require_roles([RoleEnum.ADMIN])),
    db: Optional[AsyncSession] = Depends(get_db),
) -> Dict[str, Any]:
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    try:
        auth_service = AuthService(db)
        user = await auth_service.register(payload)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Registration failed: {error}") from error

    return {
        "id": user.id,
        "email": user.email,
        "role": user.role.value,
        "is_active": user.is_active
    }


@app.post("/auth/login")
async def login_user(
    payload: LoginRequest,
    response: Response, 
    db: Optional[AsyncSession] = Depends(get_db),
) -> Dict[str, Any]:
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    try:
        auth_service = AuthService(db)
        token_data = await auth_service.login(payload) 
        token = token_data["access_token"]
    except ValueError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,  
        secure=False,
        samesite="lax",
        max_age=86400,
    )

    return {"message": "Login successfully"} 


@app.post("/auth/logout")
async def logout_user(response: Response):
    response.delete_cookie(
        key="access_token", 
        httponly=True, 
        samesite="lax"
    )
    return {"message": "Logout successfully"}


@app.patch("/auth/admin/reset-password")
async def admin_reset_password(
    payload: AdminResetPasswordRequest,
    current_admin: User = Depends(require_roles([RoleEnum.ADMIN])),
    db: Optional[AsyncSession] = Depends(get_db),
) -> Dict[str, Any]:
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        auth_service = AuthService(db)
        await auth_service.admin_reset_password(
            target_user_id=payload.user_id,
            new_password=payload.new_password
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    return {"message": f"The password for User ID {payload.user_id} has been successfully reset by Admin"}


@app.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@app.get("/auth/users")
async def get_all_users(
    current_admin: User = Depends(require_roles([RoleEnum.ADMIN])),
    db: Optional[AsyncSession] = Depends(get_db),
) -> List[Dict[str, Any]]:
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        users = await get_users(db)
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {error}") from error

    return [
        {
            "id": user.id,
            "email": user.email,
            "role": user.role.value if hasattr(user.role, "value") else user.role
        }
        for user in users
    ]




@app.get("/db", response_model=list[CidrEntryBase])
async def list_cidrs(
    location: str | None = None,
    firewall: str | None = None,
    zone: str | None = None,
    q: str | None = None,
    current_user: User = Depends(require_roles([RoleEnum.ADMIN, RoleEnum.ENGINEER])),
):
    return await repo.list_cidr_entries(location, firewall, zone, q)


@app.get("/db/lookup", response_model=CidrEntryBase)
async def get_cidr(zone: str, segment: str, current_user: User = Depends(require_roles([RoleEnum.ADMIN, RoleEnum.ENGINEER])),):
    entry = await repo.get_cidr_entry(zone, segment)
    if not entry:
        raise HTTPException(404, "Entry not found")
    return entry


@app.post("/db", response_model=CidrEntryBase, status_code=201)
async def create_cidr(payload: CidrEntryBase, current_user: User = Depends(require_roles([RoleEnum.ADMIN])),):
    global _service
    try:
        entry = await repo.create_cidr_entry(payload.model_dump())
    except ValueError as e:
        raise HTTPException(400, str(e))
    _service = PathFinderService()
    return entry


@app.delete("/db/lookup", status_code=204)
async def delete_cidr(zone: str, segment: str, current_user: User = Depends(require_roles([RoleEnum.ADMIN])),):
    global _service
    if not await repo.delete_cidr_entry(zone, segment):
        raise HTTPException(404, "Entry not found")
    _service = PathFinderService()


@app.get("/firewalls", response_model=TopologyGraphResponse)
async def get_graph(current_user: User = Depends(require_roles([RoleEnum.ADMIN, RoleEnum.ENGINEER])),):
    return await repo.get_topology_graph()


@app.post("/firewalls", status_code=201)
async def create_firewall(payload: FirewallCreate, current_user: User = Depends(require_roles([RoleEnum.ADMIN])),):
    global _service
    try:
        await repo.add_firewall(payload.name, [v.model_dump() for v in payload.vsys])
    except ValueError as e:
        raise HTTPException(400, str(e))
    _service = PathFinderService()
    return {"status": "created"}
 
 
@app.patch("/firewall/{firewall}")
async def replace_firewall(
    firewall: str,
    payload: FirewallVSysReplace,
    current_user: User = Depends(require_roles([RoleEnum.ADMIN])),
):
    global _service
    try:
        result = await repo.replace_firewall_vsys(firewall, [v.model_dump() for v in payload.vsys])
    except KeyError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    _service = PathFinderService()
    return {"status": "updated", **result}
 
 
@app.delete("/firewall/{firewall}", status_code=204)
async def remove_firewall(firewall: str, current_user: User = Depends(require_roles([RoleEnum.ADMIN])),):
    global _service
    if not await repo.delete_firewall(firewall):
        raise HTTPException(404, "Firewall not found")
    _service = PathFinderService()
 
 
# ---- Connections ----
 
@app.post("/connection", status_code=201)
async def create_connection(payload: ConnectionCreate, current_user: User = Depends(require_roles([RoleEnum.ADMIN])),):
    global _service
    body = payload.model_dump(by_alias=True)
    try:
        conn = await repo.add_connection(body["from"], body["to"])
    except ValueError as e:
        raise HTTPException(400, str(e))
    _service = PathFinderService()
    return conn
 
 
@app.delete("/connection/{conn_id}", status_code=204)
async def remove_connection(conn_id: str, current_user: User = Depends(require_roles([RoleEnum.ADMIN])),):
    global _service
    if not await repo.delete_connection(conn_id):
        raise HTTPException(404, "Connection not found")
    _service = PathFinderService()