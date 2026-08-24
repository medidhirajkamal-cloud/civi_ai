from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
from .database import get_db
from .auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

@router.get("")
def get_user_notifications(current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM notifications
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 40
        """, (current_user["id"],))
        notifs = cursor.fetchall()
        
        unread_count = sum(1 for n in notifs if not n["is_read"])
        return {
            "unread_count": unread_count,
            "notifications": notifs
        }

@router.post("/{notification_id}/mark-read")
def mark_notification_read(notification_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_db() as conn:
        conn.execute("""
            UPDATE notifications SET is_read = 1
            WHERE id = ? AND user_id = ?
        """, (notification_id, current_user["id"]))
        return {"success": True}

@router.post("/mark-all-read")
def mark_all_notifications_read(current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_db() as conn:
        conn.execute("""
            UPDATE notifications SET is_read = 1
            WHERE user_id = ?
        """, (current_user["id"],))
        return {"success": True}
