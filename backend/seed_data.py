import os
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from .config import UPLOADS_DIR, STATIC_DIR
from .database import get_db, init_db
from .auth import get_password_hash
from .ai_service import ai_engine
from .priority_service import calculate_priority_and_sla

def generate_sample_images():
    """Create realistic infrastructure defect & repair sample images using Pillow"""
    sample_dir = STATIC_DIR / "sample_images"
    sample_dir.mkdir(parents=True, exist_ok=True)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    
    images_to_generate = [
        ("pothole_before.jpg", "POTHOLE DEFECT", (45, 45, 50), (20, 20, 20), "CRATER"),
        ("pothole_after.jpg", "REPAIRED ROAD PATCH", (45, 45, 50), (25, 25, 30), "REPAIR_PATCH"),
        ("clean_road.jpg", "NORMAL CLEAN ROADWAY", (50, 50, 55), (55, 55, 60), "CLEAN_ROAD"),
        ("manhole_before.jpg", "OPEN HAZARDOUS MANHOLE", (60, 60, 65), (10, 10, 15), "OPEN_HOLE"),
        ("manhole_after.jpg", "SEALED CAST IRON MANHOLE", (60, 60, 65), (70, 75, 80), "SEALED_LID"),
        ("garbage_before.jpg", "UNMANAGED SOLID WASTE", (75, 70, 65), (180, 120, 50), "TRASH_HEAP"),
        ("garbage_after.jpg", "CLEANED SANITIZED CORRIDOR", (75, 85, 75), (50, 130, 70), "CLEAN_ROAD"),
        ("streetlight_before.jpg", "DAMAGED LUMINAIRE FIXTURE", (30, 35, 45), (15, 20, 25), "BROKEN_LAMP"),
        ("streetlight_after.jpg", "OPERATIONAL LED STREETLIGHT", (30, 40, 55), (255, 240, 160), "GLOWING_LAMP"),
        ("water_leak_before.jpg", "WATER PIPELINE RUPTURE", (50, 60, 70), (40, 120, 210), "WATER_POOL"),
        ("water_leak_after.jpg", "REPAIRED PRESSURE CONDUIT", (60, 65, 70), (40, 45, 50), "REPAIRED_PIPE"),
        ("footpath_before.jpg", "BROKEN PEDESTRIAN PAVEMENT", (90, 85, 80), (120, 90, 70), "BROKEN_TILES"),
    ]
    
    for filename, title, bg_color, detail_color, defect_pattern in images_to_generate:
        target_path = sample_dir / filename
        upload_path = UPLOADS_DIR / filename
        
        # Create 640x480 high-contrast realistic preview image
        img = Image.new("RGB", (640, 480), bg_color)
        draw = ImageDraw.Draw(img)
        
        # Draw road / asphalt texture background
        for y in range(0, 480, 4):
            shade = bg_color[0] + ((y % 16) - 8)
            draw.line([(0, y), (640, y)], fill=(shade, shade, shade + 2))
            
        # Draw roadway markings
        draw.line([(0, 240), (640, 240)], fill=(200, 180, 50), width=4)
        draw.line([(0, 440), (640, 440)], fill=(240, 240, 240), width=6)
        
        # Draw defect or repair representation
        if defect_pattern == "CRATER":
            draw.ellipse([(180, 160), (460, 360)], fill=detail_color, outline=(10, 10, 10), width=5)
            draw.polygon([(200, 200), (260, 170), (320, 210), (280, 290)], fill=(5, 5, 5))
            draw.polygon([(340, 220), (420, 200), (440, 310), (360, 330)], fill=(12, 12, 12))
            draw.line([(160, 240), (120, 280)], fill=(10, 10, 10), width=3)
            draw.line([(480, 250), (530, 290)], fill=(10, 10, 10), width=3)
        elif defect_pattern == "REPAIR_PATCH":
            draw.rectangle([(170, 150), (470, 370)], fill=(25, 25, 28), outline=(60, 60, 65), width=4)
            draw.rectangle([(165, 145), (475, 375)], outline=(15, 15, 18), width=3)
        elif defect_pattern == "OPEN_HOLE":
            draw.ellipse([(200, 140), (440, 380)], fill=(5, 5, 8), outline=(80, 30, 30), width=6)
            draw.ellipse([(220, 160), (420, 360)], fill=(0, 0, 0))
        elif defect_pattern == "SEALED_LID":
            draw.ellipse([(200, 140), (440, 380)], fill=(85, 90, 95), outline=(30, 30, 35), width=6)
            draw.ellipse([(240, 180), (400, 340)], outline=(110, 115, 120), width=4)
            draw.ellipse([(290, 230), (350, 290)], fill=(40, 45, 50))
        elif defect_pattern == "TRASH_HEAP":
            for _ in range(12):
                bx = 180 + (_ * 22) % 240
                by = 180 + (_ * 17) % 150
                draw.rectangle([(bx, by), (bx+50, by+40)], fill=((_+40)*4 % 255, (_+80)*3 % 255, (_+120)*2 % 255))
        elif defect_pattern == "CLEAN_ROAD":
            # Smooth uniform asphalt road with lane markings and no holes
            draw.rectangle([(120, 120), (520, 380)], fill=(48, 48, 52), outline=(55, 55, 60), width=2)
        elif defect_pattern == "BROKEN_LAMP":
            draw.line([(320, 440), (320, 120)], fill=(120, 120, 130), width=12)
            draw.line([(320, 120), (420, 120)], fill=(120, 120, 130), width=8)
            draw.polygon([(400, 120), (440, 120), (420, 160)], fill=(40, 40, 50))
        elif defect_pattern == "GLOWING_LAMP":
            draw.line([(320, 440), (320, 120)], fill=(120, 120, 130), width=12)
            draw.line([(320, 120), (420, 120)], fill=(120, 120, 130), width=8)
            draw.ellipse([(380, 90), (460, 220)], fill=(255, 240, 120, 180), outline=(255, 255, 200), width=3)
        elif defect_pattern == "WATER_POOL":
            draw.ellipse([(160, 180), (480, 360)], fill=(30, 100, 190), outline=(70, 160, 240), width=4)
            draw.ellipse([(240, 220), (400, 320)], fill=(60, 140, 230))
        elif defect_pattern == "REPAIRED_PIPE":
            draw.rectangle([(160, 230), (480, 290)], fill=(35, 40, 45), outline=(70, 75, 80), width=3)
            draw.line([(280, 210), (280, 310)], fill=(180, 150, 40), width=6)
        elif defect_pattern == "BROKEN_TILES":
            for r in range(4):
                for c in range(5):
                    rx = 180 + c * 55
                    ry = 180 + r * 45
                    draw.rectangle([(rx, ry), (rx+48, ry+38)], fill=(130 + (r*c*5)%40, 100, 90), outline=(20, 20, 20), width=2)
                    
        # Add Title Banner
        draw.rectangle([(0, 0), (640, 42)], fill=(15, 23, 42))
        draw.text((20, 12), f"CIVIC-AI INFRASTRUCTURE MONITORING: {title}", fill=(240, 240, 240))
        draw.text((20, 455), "GPS: 16.3075 N, 80.4420 E | Guntur Smart City Zone", fill=(200, 200, 200))
        
        img.save(target_path, "JPEG", quality=90)
        img.save(upload_path, "JPEG", quality=90)

def seed_database(force_reseed: bool = False):
    """Seed initial smart city accounts, departments, workers, and sample lifecycle complaints"""
    init_db()
    generate_sample_images()
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) as c FROM users")
        if cursor.fetchone()["c"] > 0 and not force_reseed:
            return

        default_pwd = get_password_hash("password123")
        
        cursor.execute("""
            INSERT INTO users (email, password_hash, role, full_name, phone, address, city, state, profile_photo)
            VALUES (?, ?, 'user', 'Priya Sharma', '+91 98480 12345', 'Plot 42, Lakshmipuram Main Road', 'Guntur', 'Andhra Pradesh', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150')
        """, ("citizen@civic.gov.in", default_pwd))
        citizen_id = cursor.lastrowid
        
        cursor.execute("""
            INSERT INTO users (email, password_hash, role, full_name, phone, city, state)
            VALUES (?, ?, 'admin', 'K. Ramesh Kumar, IAS', '+91 863 2224001', 'Guntur', 'Andhra Pradesh')
        """, ("admin@civic.gov.in", default_pwd))
        admin_user_id = cursor.lastrowid
        cursor.execute("""
            INSERT INTO admins (user_id, employee_id, organization)
            VALUES (?, 'GMC-ADM-001', 'Guntur Municipal Corporation (GMC)')
        """, (admin_user_id,))
        
        dept_configs = [
            ("Roads & Highways Department", "Er. Venkat Rao, EE", "roads@civic.gov.in", "ROADS-GMC", "+91 863 2224010", "Guntur Urban Central & West"),
            ("Sanitation & Solid Waste Department", "Dr. S. Anitha, Health Officer", "sanitation@civic.gov.in", "SAN-GMC", "+91 863 2224020", "Guntur Municipal Zone"),
            ("Drainage & Stormwater Department", "Er. M. Suresh, DEE", "drainage@civic.gov.in", "DRN-GMC", "+91 863 2224030", "Guntur & Amaravati Corridor"),
            ("Electrical & Street Lighting Department", "Er. P. Naresh, AEE", "electrical@civic.gov.in", "ELEC-GMC", "+91 863 2224040", "Guntur City Grid"),
            ("Water Supply & Sewage Department", "Er. K. Varma, EE", "water@civic.gov.in", "WTR-GMC", "+91 863 2224050", "Guntur Urban District"),
            ("Municipal Engineering Department", "Er. B. Krishna, SE", "engineering@civic.gov.in", "ENG-GMC", "+91 863 2224060", "Guntur Metro")
        ]
        
        dept_ids = {}
        for dname, oname, email, code, phone, area in dept_configs:
            cursor.execute("""
                INSERT INTO users (email, password_hash, role, full_name, phone, city, state)
                VALUES (?, ?, 'department', ?, ?, 'Guntur', 'Andhra Pradesh')
            """, (email, default_pwd, oname, phone))
            duid = cursor.lastrowid
            cursor.execute("""
                INSERT INTO departments (user_id, department_name, officer_name, official_email, dept_code, phone, service_area)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (duid, dname, oname, email, code, phone, area))
            dept_ids[code] = cursor.lastrowid

        workers_configs = [
            ("Ravi Teja (Paving Crew Lead)", "worker.ravi@civic.gov.in", "+91 94401 11222", "WRK-RDS-101", dept_ids["ROADS-GMC"], "Asphalt Paving & Road Repair", "Guntur Central"),
            ("Kiran Kumar (Sanitation Field Lead)", "worker.kiran@civic.gov.in", "+91 94402 33444", "WRK-SAN-202", dept_ids["SAN-GMC"], "Solid Waste Clearance", "Guntur Municipal"),
            ("Siva Shankar (Drainage Specialist)", "worker.siva@civic.gov.in", "+91 94403 55666", "WRK-DRN-303", dept_ids["DRN-GMC"], "Manhole Sealing & Desilting", "Amaravati Corridor"),
            ("M. Rajesh (Electrical Lineman)", "worker.rajesh@civic.gov.in", "+91 94404 77888", "WRK-ELE-404", dept_ids["ELEC-GMC"], "Streetlight Maintenance & Pole Repair", "Guntur City")
        ]
        
        worker_ids = {}
        for wname, wemail, wphone, wcode, dept_id, skill, area in workers_configs:
            cursor.execute("""
                INSERT INTO users (email, password_hash, role, full_name, phone, city, state)
                VALUES (?, ?, 'worker', ?, ?, 'Guntur', 'Andhra Pradesh')
            """, (wemail, default_pwd, wname, wphone))
            wuid = cursor.lastrowid
            cursor.execute("""
                INSERT INTO workers (user_id, worker_id_code, department_id, skill_type, service_area, phone)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (wuid, wcode, dept_id, skill, area, wphone))
            worker_ids[wcode] = cursor.lastrowid

        now = datetime.now(timezone.utc)
        sample_complaints = [
            {
                "id": "CIV-2026-000101",
                "issue": "Pothole",
                "category": "Roads & Highways Department",
                "desc": "Severe pothole (0.9m width, 12cm depth) causing traffic congestion and hazard to two-wheelers.",
                "severity": "HIGH",
                "priority": "HIGH",
                "score": 68.0,
                "image": "/uploads/pothole_before.jpg",
                "after_image": "/uploads/pothole_after.jpg",
                "lat": 16.3142,
                "lng": 80.4350,
                "address": "Lakshmipuram Main Road, Near SBI Circle, Guntur - 522007",
                "dept_id": dept_ids["ROADS-GMC"],
                "worker_id": worker_ids["WRK-RDS-101"],
                "status": "RESOLVED",
                "created_at": (now - timedelta(days=2, hours=5)).strftime("%Y-%m-%d %H:%M:%S"),
                "resolved_at": (now - timedelta(hours=6)).strftime("%Y-%m-%d %H:%M:%S"),
                "deadline": (now + timedelta(hours=18)).strftime("%Y-%m-%d %H:%M:%S"),
                "materials": "Bitumen Emulsion (45kg), Dense Bituminous Macadam (320kg), Road Compactor Roller",
                "work_desc": "Excavated loose road debris, applied tack coat, laid 50mm hot asphalt mix and compacted to grade level.",
                "ai_res_conf": 0.95
            },
            {
                "id": "CIV-2026-000102",
                "issue": "Open Manhole",
                "category": "Drainage & Stormwater Department",
                "desc": "Open stormwater manhole without safety lid near busy pedestrian street.",
                "severity": "CRITICAL",
                "priority": "CRITICAL",
                "score": 92.0,
                "image": "/uploads/manhole_before.jpg",
                "after_image": "/uploads/manhole_after.jpg",
                "lat": 16.3075,
                "lng": 80.4420,
                "address": "Brodipet 4/2 Cross Road, Guntur - 522002",
                "dept_id": dept_ids["DRN-GMC"],
                "worker_id": worker_ids["WRK-DRN-303"],
                "status": "DEPT_VERIFIED",
                "created_at": (now - timedelta(hours=18)).strftime("%Y-%m-%d %H:%M:%S"),
                "resolved_at": None,
                "deadline": (now + timedelta(hours=6)).strftime("%Y-%m-%d %H:%M:%S"),
                "materials": "Heavy Duty Ductile Iron Manhole Cover (Grade D400), M25 Grade Concrete Ring",
                "work_desc": "Installed new reinforced concrete collar frame and secured heavy-duty cast iron lockable cover.",
                "ai_res_conf": 0.94
            }
        ]

        for sc in sample_complaints:
            cursor.execute("""
                INSERT INTO complaints (
                    complaint_id, user_id, issue_type, category, description, severity,
                    priority, priority_score, image_url, latitude, longitude, address,
                    department_id, worker_id, status, deadline, created_at, resolved_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                sc["id"], citizen_id, sc["issue"], sc["category"], sc["desc"],
                sc["severity"], sc["priority"], sc["score"], sc["image"],
                sc["lat"], sc["lng"], sc["address"], sc["dept_id"], sc["worker_id"],
                sc["status"], sc["deadline"], sc["created_at"], sc["resolved_at"]
            ))
            
            boxes = [
                {"ymin": 0.28, "xmin": 0.22, "ymax": 0.74, "xmax": 0.78, "label": sc["issue"], "confidence": 0.94}
            ]
            cursor.execute("""
                INSERT INTO ai_detections (
                    complaint_id, issue_type, confidence, severity, bounding_boxes_json, description
                ) VALUES (?, ?, 0.94, ?, ?, ?)
            """, (sc["id"], sc["issue"], sc["severity"], json.dumps(boxes), f"AI Computer Vision detected {sc['issue']} with 94% confidence."))

            cursor.execute("""
                INSERT INTO complaint_timeline (complaint_id, stage, title, description, actor_role, actor_name, timestamp)
                VALUES (?, 'REPORTED', 'Complaint Submitted by Citizen', ?, 'CITIZEN', 'Priya Sharma', ?)
            """, (sc["id"], f"Reported at {sc['address']}", sc["created_at"]))
            
            cursor.execute("""
                INSERT INTO complaint_timeline (complaint_id, stage, title, description, actor_role, actor_name, timestamp)
                VALUES (?, 'AI_DETECTED', 'AI Vision Defect Identification (94% Conf)', ?, 'AI_ENGINE', 'Civic AI Engine', ?)
            """, (sc["id"], f"Classified {sc['issue']} ({sc['severity']} Severity)", sc["created_at"]))

            if sc["dept_id"]:
                cursor.execute("""
                    INSERT INTO complaint_timeline (complaint_id, stage, title, description, actor_role, actor_name, timestamp)
                    VALUES (?, 'ASSIGNED_DEPT', 'Assigned to Municipal Department', ?, 'ADMIN', 'K. Ramesh Kumar, IAS', ?)
                """, (sc["id"], f"Department: {sc['category']}", sc["created_at"]))

            if sc["worker_id"]:
                cursor.execute("""
                    INSERT INTO complaint_timeline (complaint_id, stage, title, description, actor_role, actor_name, timestamp)
                    VALUES (?, 'ASSIGNED_WORKER', 'Dispatched to Field Crew', 'Worker assigned with priority repair instructions', 'DEPARTMENT', 'Department Officer', ?)
                """, (sc["id"], sc["created_at"]))

            if sc["status"] == "RESOLVED":
                cursor.execute("""
                    INSERT INTO work_updates (
                        complaint_id, worker_id, status, work_description, materials_used,
                        before_image_url, after_image_url, worker_lat, worker_lng,
                        ai_resolution_confidence, ai_resolution_verdict, ai_comparison_notes
                    ) VALUES (?, ?, 'COMPLETED', ?, ?, ?, ?, ?, ?, ?, 'LIKELY_RESOLVED', 'AI Vision confirmed successful remediation of the reported defect.')
                """, (
                    sc["id"], sc["worker_id"], sc["work_desc"], sc["materials"],
                    sc["image"], sc["after_image"], sc["lat"], sc["lng"], sc["ai_res_conf"]
                ))
                
                cursor.execute("""
                    INSERT INTO complaint_timeline (complaint_id, stage, title, description, actor_role, actor_name, timestamp)
                    VALUES (?, 'WORK_COMPLETED', 'Repair Completed by Field Crew', ?, 'WORKER', 'Field Worker', ?)
                """, (sc["id"], f"Materials: {sc['materials']}", sc["created_at"]))
                
                cursor.execute("""
                    INSERT INTO complaint_timeline (complaint_id, stage, title, description, actor_role, actor_name, timestamp)
                    VALUES (?, 'RESOLVED', 'Final Resolution Approved by Municipal Admin', 'Complaint closed. Citizen notified with resolution certificate.', 'ADMIN', 'K. Ramesh Kumar, IAS', ?)
                """, (sc["id"], sc["resolved_at"]))
