from functools import wraps
from app.context import current_user_id, current_ip_address
from models import AuditLog
import database
import inspect

def audit_file_mutation(target_table: str, action: str):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            
            result = await func(*args, **kwargs)

            sig = inspect.signature(func)
            bound_args = sig.bind(*args, **kwargs)
            bound_args.apply_defaults()
            params = bound_args.arguments
            
            user_id = current_user_id.get()
            ip_addr = current_ip_address.get()
            # data = args[0] if args else kwargs.get("data", {})

            session_factory = database._session_factory
            if session_factory:
                async with session_factory() as db:
                    target_id = "N/A"
                    
                    if "data" in params and isinstance(params["data"], dict) and params["data"]:
                        target_id = params["data"].get("segment") or params["data"].get("name") or params["data"].get("from_ep") or "N/A"
                    
                    elif "segment" in params:
                        target_id = params["segment"]
                    elif "name" in params:
                        target_id = params["name"]
                    
                    if target_id == "N/A" and isinstance(result, dict):
                        target_id = result.get("segment") or result.get("name") or result.get("from_ep") or "N/A"
                        
                    target_id = str(target_id)
                    

                    changes_payload = {}
                    if action == "CREATE":
                        changes_payload = {"new": result if isinstance(result, dict) else params.get("data", {})}
                    elif action == "UPDATE":
                        changes_payload = {
                            "old": params.get("old_data", {}),
                            "new": result if isinstance(result, dict) else params.get("data", {})
                        }
                    elif action == "DELETE":
                        changes_payload = {"old": params.get("old_data", {})}

                    audit_entry = AuditLog(
                        user_id=user_id,
                        action=action,
                        target_table=target_table,
                        target_id=target_id,
                        changes=changes_payload,
                        ip_address=ip_addr
                    )
                    db.add(audit_entry)
                    await db.commit()

            return result
        return wrapper
    return decorator