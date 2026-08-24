import sqlite3
import json
from datetime import datetime
from pathlib import Path
from contextlib import contextmanager
from .config import DATABASE_PATH

def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

@contextmanager
def get_db():
    conn = sqlite3.connect(DATABASE_PATH, timeout=30.0)
    conn.row_factory = dict_factory
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 30000")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 1. Users table (stores credentials & common profile)
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('user', 'admin', 'department', 'worker')),
            full_name TEXT NOT NULL,
            phone TEXT,
            address TEXT,
            city TEXT,
            state TEXT,
            profile_photo TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        # 2. Admins table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            employee_id TEXT UNIQUE NOT NULL,
            organization TEXT NOT NULL
        )
        ''')
        
        # 3. Departments table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS departments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            department_name TEXT NOT NULL,
            officer_name TEXT NOT NULL,
            official_email TEXT UNIQUE NOT NULL,
            dept_code TEXT UNIQUE NOT NULL,
            phone TEXT,
            service_area TEXT NOT NULL
        )
        ''')
        
        # 4. Workers table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS workers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            worker_id_code TEXT UNIQUE NOT NULL,
            department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
            skill_type TEXT NOT NULL,
            service_area TEXT NOT NULL,
            phone TEXT
        )
        ''')
        
        # 5. Complaints table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS complaints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            complaint_id TEXT UNIQUE NOT NULL,
            user_id INTEGER NOT NULL REFERENCES users(id),
            issue_type TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT NOT NULL,
            severity TEXT NOT NULL CHECK(severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
            priority TEXT NOT NULL CHECK(priority IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
            priority_score REAL DEFAULT 0.0,
            image_url TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            address TEXT NOT NULL,
            street TEXT,
            city TEXT,
            state TEXT,
            postal_code TEXT,
            department_id INTEGER REFERENCES departments(id),
            worker_id INTEGER REFERENCES workers(id),
            status TEXT NOT NULL CHECK(status IN (
                'NEW', 
                'ASSIGNED_DEPT', 
                'ASSIGNED_WORKER', 
                'WORK_STARTED', 
                'WORK_COMPLETED', 
                'DEPT_VERIFIED', 
                'RESOLVED', 
                'REJECTED', 
                'REOPENED'
            )),
            deadline TIMESTAMP,
            admin_instructions TEXT,
            dept_instructions TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            assigned_at TIMESTAMP,
            started_at TIMESTAMP,
            completed_at TIMESTAMP,
            verified_at TIMESTAMP,
            resolved_at TIMESTAMP
        )
        ''')
        
        # 6. AI Detections table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS ai_detections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            complaint_id TEXT NOT NULL REFERENCES complaints(complaint_id) ON DELETE CASCADE,
            issue_type TEXT NOT NULL,
            confidence REAL NOT NULL,
            severity TEXT NOT NULL,
            bounding_boxes_json TEXT NOT NULL,
            description TEXT,
            raw_response TEXT,
            detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        # 7. Work Updates table (Worker submission & verification)
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS work_updates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            complaint_id TEXT NOT NULL REFERENCES complaints(complaint_id) ON DELETE CASCADE,
            worker_id INTEGER NOT NULL REFERENCES workers(id),
            status TEXT NOT NULL,
            work_description TEXT NOT NULL,
            materials_used TEXT,
            before_image_url TEXT NOT NULL,
            after_image_url TEXT NOT NULL,
            worker_lat REAL,
            worker_lng REAL,
            ai_resolution_confidence REAL,
            ai_resolution_verdict TEXT,
            ai_comparison_notes TEXT,
            submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            dept_approved_at TIMESTAMP,
            dept_rejection_reason TEXT,
            admin_approved_at TIMESTAMP
        )
        ''')
        
        # 8. Notifications table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role TEXT NOT NULL,
            complaint_id TEXT,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            type TEXT DEFAULT 'INFO',
            is_read INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        # 9. Complaint Timeline table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS complaint_timeline (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            complaint_id TEXT NOT NULL REFERENCES complaints(complaint_id) ON DELETE CASCADE,
            stage TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            actor_role TEXT NOT NULL,
            actor_name TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            metadata_json TEXT
        )
        ''')
        
        # 10. Audit Logs table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER REFERENCES users(id),
            action TEXT NOT NULL,
            target_type TEXT NOT NULL,
            target_id TEXT,
            details TEXT,
            ip_address TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')

        # Indices for high query performance
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_complaints_user ON complaints(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_complaints_dept ON complaints(department_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_complaints_worker ON complaints(worker_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_timeline_complaint ON complaint_timeline(complaint_id)')
