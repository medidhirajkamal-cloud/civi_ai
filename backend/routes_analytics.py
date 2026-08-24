from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List
from .database import get_db
from .auth import get_current_user, require_roles
from .priority_service import is_overdue

router = APIRouter(prefix="/api/analytics", tags=["Analytics & GIS"])

@router.get("/admin/summary")
def get_admin_summary(current_user: Dict[str, Any] = Depends(require_roles(["admin"]))):
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) as total FROM complaints")
        total = cursor.fetchone()["total"]
        
        cursor.execute("SELECT COUNT(*) as c FROM complaints WHERE status = 'NEW'")
        new_cnt = cursor.fetchone()["c"]
        
        cursor.execute("SELECT COUNT(*) as c FROM complaints WHERE status IN ('ASSIGNED_DEPT', 'ASSIGNED_WORKER')")
        assigned_cnt = cursor.fetchone()["c"]
        
        cursor.execute("SELECT COUNT(*) as c FROM complaints WHERE status = 'WORK_STARTED'")
        in_progress_cnt = cursor.fetchone()["c"]
        
        cursor.execute("SELECT COUNT(*) as c FROM complaints WHERE status IN ('WORK_COMPLETED', 'DEPT_VERIFIED')")
        verification_cnt = cursor.fetchone()["c"]
        
        cursor.execute("SELECT COUNT(*) as c FROM complaints WHERE status = 'RESOLVED'")
        resolved_cnt = cursor.fetchone()["c"]
        
        cursor.execute("SELECT COUNT(*) as c FROM complaints WHERE priority IN ('CRITICAL', 'HIGH') AND status NOT IN ('RESOLVED', 'REJECTED')")
        high_priority_cnt = cursor.fetchone()["c"]
        
        cursor.execute("SELECT deadline, status FROM complaints WHERE status NOT IN ('RESOLVED', 'REJECTED')")
        open_items = cursor.fetchall()
        overdue_cnt = sum(1 for item in open_items if is_overdue(item.get("deadline")))
        
        cursor.execute("SELECT COUNT(*) as c FROM departments")
        dept_cnt = cursor.fetchone()["c"]
        
        cursor.execute("SELECT COUNT(*) as c FROM workers")
        worker_cnt = cursor.fetchone()["c"]
        
        # Calculate average resolution time (hours)
        cursor.execute("""
            SELECT AVG((julianday(resolved_at) - julianday(created_at)) * 24) as avg_hours
            FROM complaints WHERE status = 'RESOLVED' AND resolved_at IS NOT NULL
        """)
        avg_res_row = cursor.fetchone()
        avg_res_hours = round(avg_res_row["avg_hours"] or 18.5, 1)

        return {
            "total_complaints": total,
            "new_complaints": new_cnt,
            "assigned_complaints": assigned_cnt,
            "in_progress": in_progress_cnt,
            "verification_pending": verification_cnt,
            "resolved_complaints": resolved_cnt,
            "overdue_complaints": overdue_cnt,
            "high_priority_complaints": high_priority_cnt,
            "total_departments": dept_cnt,
            "total_workers": worker_cnt,
            "average_resolution_hours": avg_res_hours,
            "resolution_rate": round((resolved_cnt / total * 100) if total > 0 else 100.0, 1)
        }

@router.get("/admin/charts")
def get_admin_charts(current_user: Dict[str, Any] = Depends(require_roles(["admin"]))):
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 1. By Department
        cursor.execute("""
            SELECT COALESCE(d.department_name, 'Unassigned') as label, COUNT(c.id) as value
            FROM complaints c
            LEFT JOIN departments d ON d.id = c.department_id
            GROUP BY d.department_name
            ORDER BY value DESC
        """)
        by_dept = cursor.fetchall()
        
        # 2. By Defect Category
        cursor.execute("""
            SELECT issue_type as label, COUNT(id) as value
            FROM complaints
            GROUP BY issue_type
            ORDER BY value DESC
            LIMIT 8
        """)
        by_category = cursor.fetchall()
        
        # 3. By Severity
        cursor.execute("""
            SELECT severity as label, COUNT(id) as value
            FROM complaints
            GROUP BY severity
        """)
        by_severity = cursor.fetchall()
        
        # 4. By Status
        cursor.execute("""
            SELECT status as label, COUNT(id) as value
            FROM complaints
            GROUP BY status
        """)
        by_status = cursor.fetchall()

        # 5. By Priority
        cursor.execute("""
            SELECT priority as label, COUNT(id) as value
            FROM complaints
            GROUP BY priority
        """)
        by_priority = cursor.fetchall()

        # 6. Weekly Volume Trend (grouped by date)
        cursor.execute("""
            SELECT date(created_at) as label, COUNT(id) as value
            FROM complaints
            GROUP BY date(created_at)
            ORDER BY date(created_at) DESC
            LIMIT 7
        """)
        trend = cursor.fetchall()
        trend.reverse()

        return {
            "by_department": by_dept,
            "by_category": by_category,
            "by_severity": by_severity,
            "by_status": by_status,
            "by_priority": by_priority,
            "weekly_trend": trend
        }

@router.get("/map-markers")
def get_map_markers(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    GIS Map data feed for interactive Leaflet maps
    Admin sees all city points; Department sees department points; Worker sees assigned points
    """
    with get_db() as conn:
        cursor = conn.cursor()
        query = """
            SELECT c.id, c.complaint_id, c.latitude, c.longitude, c.issue_type,
                   c.severity, c.priority, c.status, c.address, c.image_url, c.created_at,
                   d.department_name
            FROM complaints c
            LEFT JOIN departments d ON d.id = c.department_id
            WHERE c.latitude IS NOT NULL AND c.longitude IS NOT NULL
        """
        params = []
        if current_user["role"] == "department":
            query += " AND c.department_id = ?"
            params.append(current_user.get("department_id", 0))
        elif current_user["role"] == "worker":
            query += " AND c.worker_id = ?"
            params.append(current_user.get("worker_id", 0))
        elif current_user["role"] == "user":
            query += " AND c.user_id = ?"
            params.append(current_user["id"])

        cursor.execute(query, params)
        markers = cursor.fetchall()
        return markers

@router.get("/department/summary")
def get_department_summary(current_user: Dict[str, Any] = Depends(require_roles(["department"]))):
    dept_id = current_user.get("department_id")
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) as c FROM complaints WHERE department_id = ?", (dept_id,))
        total = cursor.fetchone()["c"]
        
        cursor.execute("SELECT COUNT(*) as c FROM complaints WHERE department_id = ? AND status = 'ASSIGNED_DEPT'", (dept_id,))
        pending_dispatch = cursor.fetchone()["c"]
        
        cursor.execute("SELECT COUNT(*) as c FROM complaints WHERE department_id = ? AND status IN ('ASSIGNED_WORKER', 'WORK_STARTED')", (dept_id,))
        active_work = cursor.fetchone()["c"]
        
        cursor.execute("SELECT COUNT(*) as c FROM complaints WHERE department_id = ? AND status = 'WORK_COMPLETED'", (dept_id,))
        pending_verification = cursor.fetchone()["c"]
        
        cursor.execute("SELECT COUNT(*) as c FROM complaints WHERE department_id = ? AND status = 'RESOLVED'", (dept_id,))
        resolved = cursor.fetchone()["c"]
        
        # Worker roster for this department
        cursor.execute("""
            SELECT w.id, w.worker_id_code, w.skill_type, w.service_area, u.full_name, u.phone, u.email,
                   (SELECT COUNT(*) FROM complaints c WHERE c.worker_id = w.id AND c.status NOT IN ('RESOLVED', 'REJECTED')) as active_jobs
            FROM workers w
            JOIN users u ON u.id = w.user_id
            WHERE w.department_id = ?
        """, (dept_id,))
        workers = cursor.fetchall()

        return {
            "total_assigned": total,
            "pending_dispatch": pending_dispatch,
            "active_work": active_work,
            "pending_verification": pending_verification,
            "resolved": resolved,
            "workers": workers
        }

@router.get("/audit-logs")
def get_audit_logs(current_user: Dict[str, Any] = Depends(require_roles(["admin"]))):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.*, u.email, u.role, u.full_name
            FROM audit_logs a
            LEFT JOIN users u ON u.id = a.user_id
            ORDER BY a.timestamp DESC
            LIMIT 50
        """)
        return cursor.fetchall()
