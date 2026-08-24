import os
from pathlib import Path

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
UPLOADS_DIR = BASE_DIR / "uploads"
DATABASE_PATH = BASE_DIR / "civic_platform.db"

# Ensure necessary directories exist
STATIC_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
(STATIC_DIR / "sample_images").mkdir(parents=True, exist_ok=True)
(STATIC_DIR / "css").mkdir(parents=True, exist_ok=True)
(STATIC_DIR / "js").mkdir(parents=True, exist_ok=True)

# Security settings
SECRET_KEY = os.getenv("CIVIC_SECRET_KEY", "civic_platform_super_secret_jwt_key_2026_secure")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# AI & Vision API Key (Optional Gemini / Cloud Vision API key)
CIVIC_AI_API_KEY = os.getenv("CIVIC_AI_API_KEY", os.getenv("GEMINI_API_KEY", ""))

# SLA Thresholds (in hours)
SLA_HOURS = {
    "CRITICAL": 12,
    "HIGH": 24,
    "MEDIUM": 72,
    "LOW": 168  # 7 days
}

# Supported Civic Defect Categories & Mappings
DEFECT_CATEGORIES = {
    "Pothole": {"dept": "Roads & Highways Department", "dept_code": "ROADS", "severity": "HIGH", "base_priority": "HIGH"},
    "Cracks in Road": {"dept": "Roads & Highways Department", "dept_code": "ROADS", "severity": "MEDIUM", "base_priority": "MEDIUM"},
    "Broken Road": {"dept": "Roads & Highways Department", "dept_code": "ROADS", "severity": "HIGH", "base_priority": "HIGH"},
    "Damaged Footpath": {"dept": "Roads & Highways Department", "dept_code": "ROADS", "severity": "MEDIUM", "base_priority": "MEDIUM"},
    "Open Manhole": {"dept": "Drainage & Stormwater Department", "dept_code": "DRAINAGE", "severity": "CRITICAL", "base_priority": "CRITICAL"},
    "Water Leakage": {"dept": "Water Supply & Sewage Department", "dept_code": "WATER", "severity": "HIGH", "base_priority": "HIGH"},
    "Drainage Blockage": {"dept": "Drainage & Stormwater Department", "dept_code": "DRAINAGE", "severity": "HIGH", "base_priority": "HIGH"},
    "Garbage Accumulation": {"dept": "Sanitation & Solid Waste Department", "dept_code": "SANITATION", "severity": "MEDIUM", "base_priority": "MEDIUM"},
    "Broken Streetlight": {"dept": "Electrical & Street Lighting Department", "dept_code": "ELECTRICAL", "severity": "MEDIUM", "base_priority": "MEDIUM"},
    "Damaged Traffic Sign": {"dept": "Traffic & Road Safety Department", "dept_code": "TRAFFIC", "severity": "MEDIUM", "base_priority": "MEDIUM"},
    "Fallen Electric Pole": {"dept": "Electrical & Street Lighting Department", "dept_code": "ELECTRICAL", "severity": "CRITICAL", "base_priority": "CRITICAL"},
    "Construction Debris": {"dept": "Sanitation & Solid Waste Department", "dept_code": "SANITATION", "severity": "MEDIUM", "base_priority": "MEDIUM"},
    "Damaged Public Building": {"dept": "Municipal Engineering Department", "dept_code": "ENGINEERING", "severity": "HIGH", "base_priority": "HIGH"},
    "Road Surface Deterioration": {"dept": "Roads & Highways Department", "dept_code": "ROADS", "severity": "MEDIUM", "base_priority": "MEDIUM"},
    "Unsafe Construction Area": {"dept": "Municipal Engineering Department", "dept_code": "ENGINEERING", "severity": "HIGH", "base_priority": "HIGH"},
    "Damaged Bridge": {"dept": "Roads & Highways Department", "dept_code": "ROADS", "severity": "CRITICAL", "base_priority": "CRITICAL"},
    "Flooded Road": {"dept": "Drainage & Stormwater Department", "dept_code": "DRAINAGE", "severity": "HIGH", "base_priority": "HIGH"},
    "Other Infrastructure Defect": {"dept": "Municipal Engineering Department", "dept_code": "ENGINEERING", "severity": "MEDIUM", "base_priority": "MEDIUM"}
}
