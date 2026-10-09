"""
service.py — Shared application service used by CLI and API layers.

Provides a reusable in-memory engine that:
  1) loads CIDR database once,
  2) loads topology graph once,
  3) precomputes shortest paths once,
  4) resolves one or many rows through resolver.resolve_row.
"""

from typing import Any, Dict, List

import config
from cidr_matcher import CIDRMatcher
from graph import TopologyGraph
from loader import load_cidr_db
from resolver import resolve_row

import jwt
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from schemas import LoginRequest, UserCreate
import db_repository as repo
import re
import itertools
from ip_parser import parse_ip
import bcrypt

SECRET_KEY = config.SECRET_KEY
ALGORITHM = config.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = config.ACCESS_TOKEN_EXPIRE_MINUTES
# pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class PathFinderService:
    def __init__(self) -> None:
        records = load_cidr_db(config.CIDR_DB_PATH)
        self._matcher = CIDRMatcher(records)

        self._graph = TopologyGraph()
        self._graph.load(config.TOPOLOGY_PATH)
        self._graph.precompute_paths()

    # def resolve_row(self, row: Dict[str, Any]) -> List[Dict[str, Any]]:
    #     """Resolve a single input row into one-or-more hop rows."""
    #     return resolve_row(row, self._matcher, self._graph)

    # def resolve_rows(self, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    #     """Resolve a list of input rows and flatten all hop rows."""
    #     if not rows:
    #         return []

    #     out_rows: List[Dict[str, Any]] = []
    #     for row in rows:
    #         out_rows.extend(self.resolve_row(row))
    #     return out_rows

    def _split_ips(self, ip_str: str) -> List[str]:
        if not ip_str:
            return []
        return [ip.strip() for ip in re.split(r'[,\s\n]+', str(ip_str)) if ip.strip()]

    def _group_by_vsys(self, ips: List[str]) -> List[str]:
        if not ips:
            return [""]
        
        groups: Dict[str, List[str]] = {}
        for ip in ips:
            parsed = parse_ip(ip)
            match = self._matcher.match(parsed)
            
            vsys = match.vsys if (match.matched and match.vsys) else "UNKNOWN"
            groups.setdefault(vsys, []).append(ip)
            
        return [", ".join(group) for group in groups.values()]

    def _expand_row(self, row: Dict[str, Any]) -> List[Dict[str, Any]]:
        src_raw = row.get(config.COL_SOURCE_IP, "")
        dst_raw = row.get(config.COL_DEST_IP, "")

        src_groups = self._group_by_vsys(self._split_ips(src_raw))
        dst_groups = self._group_by_vsys(self._split_ips(dst_raw))

        expanded_rows = []
        for src_group, dst_group in itertools.product(src_groups, dst_groups):
            new_row = row.copy()
            new_row[config.COL_SOURCE_IP] = src_group
            new_row[config.COL_DEST_IP] = dst_group
            expanded_rows.append(new_row)

        return expanded_rows
    # ----------------------------

    def resolve_row(self, row: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Resolve a single input row into one-or-more hop rows."""
        expanded_rows = self._expand_row(row)
        
        out_rows = []
        for exp_row in expanded_rows:
            # Memanggil fungsi resolve_row yang ada di luar class
            out_rows.extend(resolve_row(exp_row, self._matcher, self._graph))
        return out_rows

    def resolve_rows(self, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Resolve a list of input rows and flatten all hop rows."""
        if not rows:
            return []

        out_rows: List[Dict[str, Any]] = []
        for row in rows:
            out_rows.extend(self.resolve_row(row))
        return out_rows



class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def register(self, user_data: UserCreate):
        existing_user = await repo.get_user_by_email(self.session, user_data.email)
        if existing_user:
            raise ValueError("Email has been registered. Choose another email") 
        
        # hashed_pwd = pwd_context.hash(user_data.password)
        hashed_pwd = bcrypt.hashpw(user_data.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        return await repo.create_user_db(self.session, user_data, hashed_pwd)

    async def login(self, credentials: LoginRequest) -> dict[str, str]:
        user = await repo.get_user_by_email(self.session, credentials.email)
        # if not user or not pwd_context.verify(credentials.password, user.hashed_password):
        if not user or not bcrypt.checkpw(credentials.password.encode('utf-8'), user.hashed_password.encode('utf-8')):
            raise ValueError("The email or password is incorrect")
        
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode = {"sub": str(user.id), "role": user.role.value, "exp": expire}
        access_token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        
        return {"access_token": access_token}

    async def admin_reset_password(self, target_user_id: int, new_password: str) -> bool:
        user = await repo.get_user_by_id(self.session, target_user_id)
        if not user:
            raise ValueError("User not found")

        # hashed_new_password = pwd_context.hash(new_password)
        hashed_new_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        await repo.update_user_password(self.session, user.id, hashed_new_password)
        return True