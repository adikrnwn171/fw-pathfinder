from contextvars import ContextVar
from typing import Optional

current_user_id: ContextVar[Optional[int]] = ContextVar("current_user_id", default=None)
current_ip_address: ContextVar[Optional[str]] = ContextVar("current_ip_address", default=None)
is_mutating_request: ContextVar[bool] = ContextVar("is_mutating_request", default=False)