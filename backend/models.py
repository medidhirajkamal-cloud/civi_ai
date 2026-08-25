from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

# --- Authentication Models ---

class UserRegisterRequest(BaseModel):
    full_name: str
    email: str
    password: str
    confirm_password: str
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = "Guntur"
    state: Optional[str] = "Andhra Pradesh"
    profile_photo: Optional[str] = None

class AdminRegisterRequest(BaseModel):
    full_name: str
    email: str
    password: str
    confirm_password: str
    employee_id: str
    organization: str

class DepartmentRegisterRequest(BaseModel):
    department_name: str
    officer_name: str
    email: str
    dept_code: str
    phone: Optional[str] = None
    service_area: str
    password: str
    confirm_password: str

class WorkerRegisterRequest(BaseModel):
    full_name: str
    worker_id_code: str
    phone: str
    email: str
    department_id: int
    skill_type: str
    service_area: str
    password: str
    confirm_password: str

class LoginRequest(BaseModel):
    email: str
    password: str
    role: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

# --- AI & Vision Models ---

class BoundingBox(BaseModel):
    ymin: float
    xmin: float
    ymax: float
    xmax: float
    label: str
    confidence: float

class AIDetectionResponse(BaseModel):
    detected: bool = True
    issue_type: str
    confidence: float
    severity: str
    bounding_boxes: List[BoundingBox] = []
    description: str
    recommended_department: str
    dept_code: str
    base_priority: str
    raw_response: Optional[Dict[str, Any]] = None

class AIResolutionComparisonResponse(BaseModel):
    resolution_confidence: float
    verdict: str  # "LIKELY_RESOLVED", "PARTIALLY_RESOLVED", "UNRESOLVED"
    similarity_score: float
    comparison_notes: str
    key_observations: List[str]

# --- Geospatial & Duplicate Models ---

class DuplicateCheckRequest(BaseModel):
    latitude: float
    longitude: float
    issue_type: str
    radius_meters: Optional[float] = 100.0

class DuplicateMatch(BaseModel):
    complaint_id: str
    issue_type: str
    distance_meters: float
    status: str
    image_url: str
    created_at: str

class DuplicateCheckResponse(BaseModel):
    is_duplicate: bool
    message: str
    matches: List[DuplicateMatch]

class ReverseGeocodeResponse(BaseModel):
    address: str
    street: Optional[str] = None
    area: Optional[str] = None
    city: str
    district: Optional[str] = None
    state: str
    postal_code: Optional[str] = None
    country: str = "India"

# --- Complaint Models ---

class CreateComplaintRequest(BaseModel):
    issue_type: str
    category: Optional[str] = None
    description: str
    severity: str  # CRITICAL, HIGH, MEDIUM, LOW
    latitude: float
    longitude: float
    address: str
    street: Optional[str] = None
    city: Optional[str] = "Guntur"
    state: Optional[str] = "Andhra Pradesh"
    postal_code: Optional[str] = None
    image_url: str
    ai_detection: Optional[AIDetectionResponse] = None

class AdminAssignRequest(BaseModel):
    department_id: int
    category: Optional[str] = None
    priority: str  # CRITICAL, HIGH, MEDIUM, LOW
    deadline_hours: Optional[int] = None
    admin_instructions: Optional[str] = None

class DeptAssignRequest(BaseModel):
    worker_id: int
    priority: Optional[str] = None
    deadline_hours: Optional[int] = None
    dept_instructions: Optional[str] = None

class WorkerStatusUpdateRequest(BaseModel):
    status: str  # ACCEPTED, ON_THE_WAY, WORK_STARTED, UNABLE_TO_RESOLVE
    notes: Optional[str] = None
    worker_lat: Optional[float] = None
    worker_lng: Optional[float] = None

class WorkerResolutionRequest(BaseModel):
    work_description: str
    materials_used: str
    before_image_url: str
    after_image_url: str
    worker_lat: float
    worker_lng: float

class VerificationRequest(BaseModel):
    approved: bool
    rejection_reason: Optional[str] = None
    comments: Optional[str] = None
