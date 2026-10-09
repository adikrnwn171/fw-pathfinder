from sqlalchemy import event, inspect
from sqlalchemy.orm import Session
from app.context import current_user_id, is_mutating_request, current_ip_address
from models import AuditLog

EXCLUDED_TABLES = {
    "audit_logs",
    "fw_hop_rows"
}


@event.listens_for(Session, "before_flush")
def audit_before_flush(session, flush_context, instances):
    if not is_mutating_request.get():
        return

    user_id = current_user_id.get()
    ip_addr = current_ip_address.get()
    logs = []

    for instance in session.new:
        if instance.__tablename__ in EXCLUDED_TABLES:
            continue

        insp = inspect(instance)
        new_data = {attr.key: str(getattr(instance, attr.key)) for attr in insp.mapper.column_attrs if getattr(instance, attr.key) is not None}
        logs.append(AuditLog(user_id=user_id, action="CREATE", target_table=instance.__tablename__, target_id=str(getattr(instance, "id", None)), changes={"new": new_data}, ip_address=ip_addr))

    for instance in session.dirty:
        if instance.__tablename__ in EXCLUDED_TABLES:
            continue
        
        if session.is_modified(instance):
            insp = inspect(instance)
            changes = {"old": {}, "new": {}}
            for attr in insp.attrs:
                if attr.key in insp.mapper.column_attrs.keys():
                    hist = attr.history
                    if hist.has_changes():
                        changes["old"][attr.key] = str(hist.deleted[0]) if hist.deleted else None
                        changes["new"][attr.key] = str(hist.added[0]) if hist.added else None
            if changes["old"] or changes["new"]:
                logs.append(AuditLog(user_id=user_id, action="UPDATE", target_table=instance.__tablename__, target_id=str(getattr(instance, "id", None)), changes=changes, ip_address=ip_addr))

    # for instance in session.deleted:
    #     if instance.__tablename__ in EXCLUDED_TABLES:
    #         continue

    #     insp = inspect(instance)
    #     old_data = {attr.key: str(getattr(instance, attr.key)) for attr in insp.mapper.column_attrs if getattr(instance, attr.key) is not None}
    #     logs.append(AuditLog(user_id=user_id, action="DELETE", target_table=instance.__tablename__, target_id=str(getattr(instance, "id", None)), changes={"old": old_data}, ip_address=ip_addr))

    session.add_all(logs)