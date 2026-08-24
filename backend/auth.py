import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from .database import get_db

security = HTTPBearer(auto_error=False)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])
        
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except Exception as e:
        print(f"Token decode error: {e}")
        return None

def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict[str, Any]:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id_raw = payload.get("sub")
    if not user_id_raw:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload: missing sub")
        
    try:
        user_id = int(user_id_raw)
    except ValueError:
        user_id = user_id_raw

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, email, role, full_name, phone, address, city, state, profile_photo FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer exists")
        
        # Attach role-specific metadata
        if user["role"] == "admin":
            cursor.execute("SELECT employee_id, organization FROM admins WHERE user_id = ?", (user["id"],))
            admin_data = cursor.fetchone()
            if admin_data:
                user.update(admin_data)
        elif user["role"] == "department":
            cursor.execute("SELECT id as dept_table_id, department_name, officer_name, official_email, dept_code, service_area FROM departments WHERE user_id = ?", (user["id"],))
            dept_data = cursor.fetchone()
            if dept_data:
                user.update(dept_data)
                user["department_id"] = dept_data["dept_table_id"]
        elif user["role"] == "worker":
            cursor.execute("SELECT id as worker_table_id, worker_id_code, department_id, skill_type, service_area FROM workers WHERE user_id = ?", (user["id"],))
            worker_data = cursor.fetchone()
            if worker_data:
                user.update(worker_data)
                user["worker_id"] = worker_data["worker_table_id"]
                
        return user

def require_roles(allowed_roles: List[str]):
    def role_checker(current_user: Dict[str, Any] = Depends(get_current_user)):
        if current_user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: requires one of roles {allowed_roles}, current role is '{current_user['role']}'"
            )
        return current_user
    return role_checker

def record_audit_log(user_id: Optional[int], action: str, target_type: str, target_id: Optional[str] = None, details: Optional[str] = None, ip_address: Optional[str] = None):
    try:
        with get_db() as conn:
            conn.execute(
                "INSERT INTO audit_logs (user_id, action, target_type, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)",
                (user_id, action, target_type, target_id, details, ip_address)
            )
    except Exception as e:
        print(f"Audit log recording error: {e}")
