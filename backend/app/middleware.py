from fastapi import Request
from app.context import  is_mutating_request, current_ip_address

MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


async def audit_context_middleware(request: Request, call_next):
    if request.method in MUTATING_METHODS:
        is_mutating_request.set(True)

        x_forwarded_for = request.headers.get("X-Forwarded-For")
        if x_forwarded_for:
            client_ip = x_forwarded_for.split(",")[0].strip()
        else:
            client_ip = request.headers.get("X-Real-IP") or (request.client.host if request.client else None)
            
        current_ip_address.set(client_ip)
    else:
        is_mutating_request.set(False)

    return await call_next(request)