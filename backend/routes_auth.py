from fastapi import APIRouter, HTTPException, status, Depends, Request
from typing import Dict, Any, List
from .database import get_db
from .models import (
    UserRegisterRequest, AdminRegisterRequest, DepartmentRegisterRequest,
    WorkerRegisterRequest, LoginRequest, TokenResponse
)
from .auth import (
    verify_password, get_password_hash, create_access_token,
    get_current_user, record_audit_log
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.get("/departments-list")
def list_departments():
    """Get active department list for selection dropdowns"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, department_name, dept_code, service_area, officer_name FROM departments ORDER BY department_name")
        return cursor.fetchall()

@router.post("/register/user", response_model=TokenResponse)
def register_user(req: UserRegisterRequest, request: Request):
    if req.password != req.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = ?", (req.email.lower(),))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Email already registered")
            
        pwd_hash = get_password_hash(req.password)
        cursor.execute("""
            INSERT INTO users (email, password_hash, role, full_name, phone, address, city, state, profile_photo)
            VALUES (?, ?, 'user', ?, ?, ?, ?, ?, ?)
        """, (req.email.lower(), pwd_hash, req.full_name or "Citizen User", req.phone, req.address, req.city, req.state, req.profile_photo))
        user_id = cursor.lastrowid
        
        token = create_access_token({"sub": user_id, "role": "user", "email": req.email.lower()})
        record_audit_log(user_id, "USER_REGISTER", "users", str(user_id), f"Citizen registered: {req.full_name}", request.client.host if request.client else None)
        
        return TokenResponse(
            access_token=token,
            user={
                "id": user_id,
                "email": req.email.lower(),
                "role": "user",
                "full_name": req.full_name or "Citizen User",
                "city": req.city,
                "state": req.state
            }
        )

@router.post("/register/admin", response_model=TokenResponse)
def register_admin(req: AdminRegisterRequest, request: Request):
    if req.password != req.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
        
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = ?", (req.email.lower(),))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Official email already registered")
            
        cursor.execute("SELECT id FROM admins WHERE employee_id = ?", (req.employee_id.upper(),))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Employee ID already exists")
            
        pwd_hash = get_password_hash(req.password)
        cursor.execute("""
            INSERT INTO users (email, password_hash, role, full_name)
            VALUES (?, ?, 'admin', ?)
        """, (req.email.lower(), pwd_hash, req.full_name or "Admin Officer"))
        user_id = cursor.lastrowid
        
        cursor.execute("""
            INSERT INTO admins (user_id, employee_id, organization)
            VALUES (?, ?, ?)
        """, (user_id, req.employee_id.upper(), req.organization or "Municipal Administration"))
        
        token = create_access_token({"sub": user_id, "role": "admin", "email": req.email.lower()})
        record_audit_log(user_id, "ADMIN_REGISTER", "admins", req.employee_id.upper(), f"Admin registered: {req.full_name}", request.client.host if request.client else None)
        
        return TokenResponse(
            access_token=token,
            user={
                "id": user_id,
                "email": req.email.lower(),
                "role": "admin",
                "full_name": req.full_name or "Admin Officer",
                "employee_id": req.employee_id.upper(),
                "organization": req.organization or "Municipal Administration"
            }
        )

@router.post("/register/department", response_model=TokenResponse)
def register_department(req: DepartmentRegisterRequest, request: Request):
    if req.password != req.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
        
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = ?", (req.email.lower(),))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Department email already registered")
            
        cursor.execute("SELECT id FROM departments WHERE dept_code = ?", (req.dept_code.upper(),))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Department code already exists")
            
        pwd_hash = get_password_hash(req.password)
        cursor.execute("""
            INSERT INTO users (email, password_hash, role, full_name, phone)
            VALUES (?, ?, 'department', ?, ?)
        """, (req.email.lower(), pwd_hash, req.officer_name or "Department Officer", req.phone))
        user_id = cursor.lastrowid
        
        cursor.execute("""
            INSERT INTO departments (user_id, department_name, officer_name, official_email, dept_code, phone, service_area)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (user_id, req.department_name, req.officer_name, req.email.lower(), req.dept_code.upper(), req.phone, req.service_area or "Municipal Zone"))
        dept_id = cursor.lastrowid
        
        token = create_access_token({"sub": user_id, "role": "department", "email": req.email.lower()})
        record_audit_log(user_id, "DEPT_REGISTER", "departments", str(dept_id), f"Dept registered: {req.department_name}", request.client.host if request.client else None)
        
        return TokenResponse(
            access_token=token,
            user={
                "id": user_id,
                "email": req.email.lower(),
                "role": "department",
                "full_name": req.officer_name or "Department Officer",
                "department_id": dept_id,
                "department_name": req.department_name,
                "dept_code": req.dept_code.upper(),
                "service_area": req.service_area or "Municipal Zone"
            }
        )

@router.post("/register/worker", response_model=TokenResponse)
def register_worker(req: WorkerRegisterRequest, request: Request):
    if req.password != req.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
        
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = ?", (req.email.lower(),))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Worker email already registered")
            
        cursor.execute("SELECT id FROM workers WHERE worker_id_code = ?", (req.worker_id_code.upper(),))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Worker ID already exists")
            
        cursor.execute("SELECT id, department_name FROM departments WHERE id = ?", (req.department_id,))
        dept = cursor.fetchone()
        if not dept:
            raise HTTPException(status_code=400, detail="Selected department does not exist")
            
        pwd_hash = get_password_hash(req.password)
        cursor.execute("""
            INSERT INTO users (email, password_hash, role, full_name, phone)
            VALUES (?, ?, 'worker', ?, ?)
        """, (req.email.lower(), pwd_hash, req.full_name or "Field Worker", req.phone))
        user_id = cursor.lastrowid
        
        cursor.execute("""
            INSERT INTO workers (user_id, worker_id_code, department_id, skill_type, service_area, phone)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (user_id, req.worker_id_code.upper(), req.department_id, req.skill_type or "Repair Crew", req.service_area or "City Grid", req.phone))
        worker_id = cursor.lastrowid
        
        token = create_access_token({"sub": user_id, "role": "worker", "email": req.email.lower()})
        record_audit_log(user_id, "WORKER_REGISTER", "workers", str(worker_id), f"Worker registered: {req.full_name}", request.client.host if request.client else None)
        
        return TokenResponse(
            access_token=token,
            user={
                "id": user_id,
                "email": req.email.lower(),
                "role": "worker",
                "full_name": req.full_name or "Field Worker",
                "worker_id": worker_id,
                "worker_id_code": req.worker_id_code.upper(),
                "department_id": req.department_id,
                "department_name": dept["department_name"],
                "skill_type": req.skill_type or "Repair Crew"
            }
        )

@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, request: Request):
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Support login by email OR worker_id_code OR employee_id
        cursor.execute("""
            SELECT u.id, u.email, u.password_hash, u.role, u.full_name, u.phone, u.city, u.state, u.profile_photo
            FROM users u
            LEFT JOIN admins a ON a.user_id = u.id
            LEFT JOIN workers w ON w.user_id = u.id
            LEFT JOIN departments d ON d.user_id = u.id
            WHERE LOWER(u.email) = ? OR LOWER(a.employee_id) = ? OR LOWER(w.worker_id_code) = ? OR LOWER(d.dept_code) = ?
        """, (req.email.lower().strip(), req.email.lower().strip(), req.email.lower().strip(), req.email.lower().strip()))
        
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=401, detail="Invalid email / user ID or user does not exist")
            
        if not verify_password(req.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid password. Please check your credentials.")
            
        # If a specific role was requested and is not "auto", verify or auto-switch
        if req.role and req.role.lower() not in ["auto", "", "all"]:
            if req.role.lower() != user["role"].lower():
                # Allow login and notify role
                pass
            
        # Role-specific attachments
        user_info = {
            "id": user["id"],
            "email": user["email"],
            "role": user["role"],
            "full_name": user["full_name"],
            "city": user.get("city"),
            "state": user.get("state"),
            "phone": user.get("phone"),
            "profile_photo": user.get("profile_photo")
        }
        
        if user["role"] == "admin":
            cursor.execute("SELECT employee_id, organization FROM admins WHERE user_id = ?", (user["id"],))
            admin_data = cursor.fetchone()
            if admin_data:
                user_info.update(admin_data)
        elif user["role"] == "department":
            cursor.execute("SELECT id as department_id, department_name, officer_name, dept_code, service_area FROM departments WHERE user_id = ?", (user["id"],))
            dept_data = cursor.fetchone()
            if dept_data:
                user_info.update(dept_data)
        elif user["role"] == "worker":
            cursor.execute("""
                SELECT w.id as worker_id, w.worker_id_code, w.department_id, w.skill_type, w.service_area, d.department_name
                FROM workers w
                JOIN departments d ON d.id = w.department_id
                WHERE w.user_id = ?
            """, (user["id"],))
            worker_data = cursor.fetchone()
            if worker_data:
                user_info.update(worker_data)
                
        token = create_access_token({"sub": user["id"], "role": user["role"], "email": user["email"]})
        record_audit_log(user["id"], "LOGIN", "users", str(user["id"]), f"{user['role'].upper()} login successful", request.client.host if request.client else None)
        
        return TokenResponse(access_token=token, user=user_info)

@router.post("/demo-login/{role}", response_model=TokenResponse)
def demo_login(role: str, request: Request):
    target_role = role.lower()
    if target_role not in ["user", "admin", "department", "worker"]:
        raise HTTPException(status_code=400, detail="Invalid demo role")
        
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, email, role, full_name, city, state, phone, profile_photo FROM users WHERE role = ? ORDER BY id ASC LIMIT 1", (target_role,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail=f"No demo account found for role '{role}'. Please run database seeding.")
            
        user_info = {
            "id": user["id"],
            "email": user["email"],
            "role": user["role"],
            "full_name": user["full_name"],
            "city": user.get("city"),
            "state": user.get("state"),
            "phone": user.get("phone"),
            "profile_photo": user.get("profile_photo")
        }
        
        if user["role"] == "admin":
            cursor.execute("SELECT employee_id, organization FROM admins WHERE user_id = ?", (user["id"],))
            admin_data = cursor.fetchone()
            if admin_data:
                user_info.update(admin_data)
        elif user["role"] == "department":
            cursor.execute("SELECT id as department_id, department_name, officer_name, dept_code, service_area FROM departments WHERE user_id = ?", (user["id"],))
            dept_data = cursor.fetchone()
            if dept_data:
                user_info.update(dept_data)
        elif user["role"] == "worker":
            cursor.execute("""
                SELECT w.id as worker_id, w.worker_id_code, w.department_id, w.skill_type, w.service_area, d.department_name
                FROM workers w
                JOIN departments d ON d.id = w.department_id
                WHERE w.user_id = ?
            """, (user["id"],))
            worker_data = cursor.fetchone()
            if worker_data:
                user_info.update(worker_data)
                
        token = create_access_token({"sub": user["id"], "role": user["role"], "email": user["email"]})
        record_audit_log(user["id"], "DEMO_LOGIN", "users", str(user["id"]), f"Demo login as {target_role.upper()}", request.client.host if request.client else None)
        
        return TokenResponse(access_token=token, user=user_info)

@router.get("/me")
def get_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    return {"user": current_user}
