import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from .database import get_db

def add_timeline_event(
    complaint_id: str,
    stage: str,
    title: str,
    description: Optional[str] = None,
    actor_role: str = "SYSTEM",
    actor_name: str = "Civic AI Engine",
    metadata: Optional[Dict[str, Any]] = None
):
    """
    Append an entry to the vertical complaint timeline
    """
    meta_str = json.dumps(metadata) if metadata else None
    with get_db() as conn:
        conn.execute("""
            INSERT INTO complaint_timeline (complaint_id, stage, title, description, actor_role, actor_name, metadata_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (complaint_id, stage, title, description, actor_role, actor_name, meta_str))

def create_notification(
    user_id: int,
    role: str,
    complaint_id: Optional[str],
    title: str,
    message: str,
    notif_type: str = "INFO"
):
    """
    Create an in-app notification for a specific user
    """
    with get_db() as conn:
        conn.execute("""
            INSERT INTO notifications (user_id, role, complaint_id, title, message, type)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (user_id, role, complaint_id, title, message, notif_type))

def notify_all_admins(
    complaint_id: str,
    title: str,
    message: str,
    notif_type: str = "INFO"
):
    """
    Broadcast notification to all active system administrators
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE role = 'admin'")
        admins = cursor.fetchall()
        for a in admins:
            cursor.execute("""
                INSERT INTO notifications (user_id, role, complaint_id, title, message, type)
                VALUES (?, 'admin', ?, ?, ?, ?)
            """, (a["id"], complaint_id, title, message, notif_type))

def notify_department_officers(
    department_id: int,
    complaint_id: str,
    title: str,
    message: str,
    notif_type: str = "INFO"
):
    """
    Notify officers of a specific municipal department
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT u.id FROM users u
            JOIN departments d ON d.user_id = u.id
            WHERE d.id = ?
        """, (department_id,))
        officers = cursor.fetchall()
        for o in officers:
            cursor.execute("""
                INSERT INTO notifications (user_id, role, complaint_id, title, message, type)
                VALUES (?, 'department', ?, ?, ?, ?)
            """, (o["id"], complaint_id, title, message, notif_type))

def notify_worker(
    worker_id: int,
    complaint_id: str,
    title: str,
    message: str,
    notif_type: str = "INFO"
):
    """
    Notify a field worker about job assignment or status changes
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT u.id FROM users u
            JOIN workers w ON w.user_id = u.id
            WHERE w.id = ?
        """, (worker_id,))
        worker = cursor.fetchone()
        if worker:
            cursor.execute("""
                INSERT INTO notifications (user_id, role, complaint_id, title, message, type)
                VALUES (?, 'worker', ?, ?, ?, ?)
            """, (worker["id"], complaint_id, title, message, notif_type))
