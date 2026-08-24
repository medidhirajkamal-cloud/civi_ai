from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Tuple
from .config import SLA_HOURS, DEFECT_CATEGORIES

HIGH_RISK_DEFECTS = ["Open Manhole", "Fallen Electric Pole", "Damaged Bridge", "Flooded Road", "Water Leakage"]

def calculate_priority_and_sla(
    issue_type: str,
    severity: str,
    duplicates_count: int = 0,
    is_school_hospital_zone: bool = False,
    is_main_arterial_road: bool = True
) -> Tuple[str, float, datetime]:
    """
    Calculate Priority level (CRITICAL, HIGH, MEDIUM, LOW), Score (0-100), and SLA Deadline
    """
    score = 0.0
    
    # 1. Base Severity Contribution
    severity_map = {
        "CRITICAL": 45.0,
        "HIGH": 30.0,
        "MEDIUM": 18.0,
        "LOW": 8.0
    }
    score += severity_map.get(severity.upper(), 20.0)
    
    # 2. High-Risk Defect Category Factor
    if issue_type in HIGH_RISK_DEFECTS:
        score += 20.0
    elif issue_type in ["Pothole", "Broken Road", "Drainage Blockage"]:
        score += 12.0
    else:
        score += 5.0
        
    # 3. Location Infrastructure Importance
    if is_school_hospital_zone:
        score += 15.0
    if is_main_arterial_road:
        score += 10.0
        
    # 4. Community Duplicate Impact
    score += min(duplicates_count * 5.0, 15.0)
    
    # Bound score between 0 and 100
    score = min(max(score, 5.0), 100.0)
    
    # 5. Determine Priority Tier
    if score >= 75.0 or severity.upper() == "CRITICAL" or issue_type in ["Open Manhole", "Fallen Electric Pole"]:
        priority = "CRITICAL"
    elif score >= 50.0 or severity.upper() == "HIGH":
        priority = "HIGH"
    elif score >= 28.0:
        priority = "MEDIUM"
    else:
        priority = "LOW"
        
    # 6. Compute SLA Deadline
    hours = SLA_HOURS.get(priority, 72)
    deadline = datetime.now(timezone.utc) + timedelta(hours=hours)
    
    return priority, round(score, 1), deadline

def is_overdue(deadline_str: Any) -> bool:
    """Check if the complaint has breached SLA deadline"""
    if not deadline_str:
        return False
    try:
        if isinstance(deadline_str, str):
            # Parse ISO or SQLite timestamp
            deadline_clean = deadline_str.replace("Z", "+00:00")
            if "T" in deadline_clean:
                dt = datetime.fromisoformat(deadline_clean)
            else:
                dt = datetime.strptime(deadline_clean[:19], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        elif isinstance(deadline_str, datetime):
            dt = deadline_str if deadline_str.tzinfo else deadline_str.replace(tzinfo=timezone.utc)
        else:
            return False
            
        return datetime.now(timezone.utc) > dt
    except Exception:
        return False
