import sys
import unittest
import requests
import time
from datetime import datetime

BASE_URL = "http://127.0.0.1:8000"

class TestCivicPlatform(unittest.TestCase):

    def test_01_health_check(self):
        res = requests.get(f"{BASE_URL}/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "healthy")
        print("[OK] Health check passed")

    def test_02_custom_registration_and_login(self):
        unique_suffix = str(int(time.time()))
        
        # Test 1: Register new citizen
        citizen_email = f"new_citizen_{unique_suffix}@example.com"
        reg_res = requests.post(
            f"{BASE_URL}/api/auth/register/user",
            json={
                "full_name": "Kavitha Sharma",
                "email": citizen_email,
                "password": "mypassword123",
                "confirm_password": "mypassword123",
                "phone": "+91 98480 12345",
                "address": "Brodipet 4th Line, Guntur",
                "city": "Guntur",
                "state": "Andhra Pradesh"
            }
        )
        self.assertEqual(reg_res.status_code, 200, f"Registration failed: {reg_res.text}")
        reg_data = reg_res.json()
        self.assertIn("access_token", reg_data)
        self.assertEqual(reg_data["user"]["role"], "user")
        print(f"[OK] Citizen registration succeeded for {citizen_email}")

        # Test 2: Log in with newly registered citizen (with auto-detect role)
        login_res = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": citizen_email,
                "password": "mypassword123",
                "role": "auto"
            }
        )
        self.assertEqual(login_res.status_code, 200, f"Login failed: {login_res.text}")
        login_data = login_res.json()
        self.assertIn("access_token", login_data)
        self.assertEqual(login_data["user"]["role"], "user")
        print(f"[OK] Login succeeded for newly registered citizen: {citizen_email}")

        # Test 3: Register new worker
        worker_email = f"new_worker_{unique_suffix}@example.com"
        reg_worker_res = requests.post(
            f"{BASE_URL}/api/auth/register/worker",
            json={
                "full_name": "Srinu Rao",
                "email": worker_email,
                "worker_id_code": f"WRK-{unique_suffix[-4:]}",
                "department_id": 1,
                "skill_type": "Pothole Patching Crew",
                "service_area": "Guntur East",
                "phone": "+91 94401 22334",
                "password": "workerpass123",
                "confirm_password": "workerpass123"
            }
        )
        self.assertEqual(reg_worker_res.status_code, 200, f"Worker registration failed: {reg_worker_res.text}")
        print(f"[OK] Worker registration succeeded for {worker_email}")

        # Test 4: Log in with newly registered worker
        worker_login_res = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": worker_email,
                "password": "workerpass123",
                "role": "auto"
            }
        )
        self.assertEqual(worker_login_res.status_code, 200, f"Worker login failed: {worker_login_res.text}")
        worker_login_data = worker_login_res.json()
        self.assertEqual(worker_login_data["user"]["role"], "worker")
        print(f"[OK] Login succeeded for newly registered worker: {worker_email}")

    def test_03_demo_logins_all_roles(self):
        roles = ["user", "admin", "department", "worker"]
        for role in roles:
            res = requests.post(f"{BASE_URL}/api/auth/demo-login/{role}")
            self.assertEqual(res.status_code, 200, f"Demo login failed for {role}")
            data = res.json()
            self.assertIn("access_token", data)
            self.assertEqual(data["user"]["role"], role)
        print("[OK] Demo logins for all 4 roles verified successfully")

    def test_04_ai_scan_service(self):
        res = requests.post(
            f"{BASE_URL}/api/complaints/scan-image",
            data={"hint_issue": "Pothole"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["issue_type"], "Pothole")
        self.assertGreaterEqual(data["confidence"], 0.80)
        self.assertEqual(data["recommended_department"], "Roads & Highways Department")
        self.assertTrue(len(data["bounding_boxes"]) > 0)
        print(f"[OK] AI Defect Detection verified: {data['issue_type']} with {data['confidence']*100}% confidence")

    def test_05_complete_end_to_end_10_step_lifecycle(self):
        # Step 1: Citizen Login & Report
        citizen_auth = requests.post(f"{BASE_URL}/api/auth/demo-login/user").json()
        citizen_token = citizen_auth["access_token"]
        
        create_res = requests.post(
            f"{BASE_URL}/api/complaints/create",
            headers={"Authorization": f"Bearer {citizen_token}"},
            json={
                "issue_type": "Pothole",
                "category": "Roads & Highways Department",
                "description": "Critical road pothole on main arterial route.",
                "severity": "HIGH",
                "latitude": 16.3142,
                "longitude": 80.4350,
                "address": "Lakshmipuram Main Road, Guntur, Andhra Pradesh",
                "image_url": "/uploads/pothole_before.jpg",
                "ai_detection": {
                    "issue_type": "Pothole",
                    "confidence": 0.95,
                    "severity": "HIGH",
                    "bounding_boxes": [{"ymin": 0.28, "xmin": 0.22, "ymax": 0.74, "xmax": 0.78, "label": "Pothole", "confidence": 0.95}],
                    "description": "Severe road cavity with structural hazard.",
                    "recommended_department": "Roads & Highways Department",
                    "dept_code": "ROADS",
                    "base_priority": "HIGH"
                }
            }
        )
        self.assertEqual(create_res.status_code, 200)
        complaint_id = create_res.json()["complaint_id"]
        print(f"[OK] Step 1: Citizen reported complaint {complaint_id}")

        # Step 2: Admin Assigns Department
        admin_auth = requests.post(f"{BASE_URL}/api/auth/demo-login/admin").json()
        admin_token = admin_auth["access_token"]

        assign_res = requests.post(
            f"{BASE_URL}/api/complaints/{complaint_id}/admin-assign",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "department_id": 1,
                "priority": "HIGH",
                "deadline_hours": 24,
                "admin_instructions": "Deploy road repair crew immediately."
            }
        )
        self.assertEqual(assign_res.status_code, 200)
        print(f"[OK] Step 2: Admin assigned {complaint_id} to Department 1")

        # Step 3: Department Officer Dispatches Worker
        dept_auth = requests.post(f"{BASE_URL}/api/auth/demo-login/department").json()
        dept_token = dept_auth["access_token"]

        dept_assign_res = requests.post(
            f"{BASE_URL}/api/complaints/{complaint_id}/dept-assign",
            headers={"Authorization": f"Bearer {dept_token}"},
            json={
                "worker_id": 1,
                "dept_instructions": "Pave with dense bitumen and roller compact."
            }
        )
        self.assertEqual(dept_assign_res.status_code, 200)
        print(f"[OK] Step 3: Department dispatched {complaint_id} to Worker 1")

        # Step 4: Worker Starts Work & Submits Resolution with AI Verification
        worker_auth = requests.post(f"{BASE_URL}/api/auth/demo-login/worker").json()
        worker_token = worker_auth["access_token"]

        status_res = requests.post(
            f"{BASE_URL}/api/complaints/{complaint_id}/worker-update-status",
            headers={"Authorization": f"Bearer {worker_token}"},
            json={"status": "WORK_STARTED", "worker_lat": 16.3142, "worker_lng": 80.4350}
        )
        self.assertEqual(status_res.status_code, 200)

        resolve_res = requests.post(
            f"{BASE_URL}/api/complaints/{complaint_id}/worker-resolve",
            headers={"Authorization": f"Bearer {worker_token}"},
            json={
                "work_description": "Cleaned cavity, laid 50mm hot asphalt mix and compacted to grade level.",
                "materials_used": "Bitumen Emulsion 45kg, DBM 300kg, Road Roller",
                "before_image_url": "/uploads/pothole_before.jpg",
                "after_image_url": "/uploads/pothole_after.jpg",
                "worker_lat": 16.3142,
                "worker_lng": 80.4350
            }
        )
        self.assertEqual(resolve_res.status_code, 200)
        ai_res_data = resolve_res.json()
        self.assertIn("ai_verification", ai_res_data)
        print(f"[OK] Step 4: Worker completed repair. AI Resolution Verification match: {ai_res_data['ai_verification']['resolution_confidence']*100}%")

        # Step 5: Department Officer Verifies Quality
        dept_verify_res = requests.post(
            f"{BASE_URL}/api/complaints/{complaint_id}/dept-verify",
            headers={"Authorization": f"Bearer {dept_token}"},
            json={"approved": True, "comments": "Quality and GPS presence approved."}
        )
        self.assertEqual(dept_verify_res.status_code, 200)
        print(f"[OK] Step 5: Department Officer verified and forwarded to Admin")

        # Step 6: Admin Final Sign-Off (Mark RESOLVED)
        admin_final_res = requests.post(
            f"{BASE_URL}/api/complaints/{complaint_id}/admin-verify",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"approved": True, "comments": "Administrative inspection approved. Case closed."}
        )
        self.assertEqual(admin_final_res.status_code, 200)
        self.assertEqual(admin_final_res.json()["status"], "RESOLVED")
        print(f"[OK] Step 6: Admin granted final approval. Status: RESOLVED")

        # Step 7: Citizen Verification of Detail & Timeline
        detail_res = requests.get(
            f"{BASE_URL}/api/complaints/{complaint_id}",
            headers={"Authorization": f"Bearer {citizen_token}"}
        )
        self.assertEqual(detail_res.status_code, 200)
        detail_data = detail_res.json()
        self.assertEqual(detail_data["complaint"]["status"], "RESOLVED")
        self.assertTrue(len(detail_data["timeline"]) >= 6)
        print(f"[OK] Step 7: Citizen verified completed resolution and vertical timeline ({len(detail_data['timeline'])} milestones)")

if __name__ == "__main__":
    unittest.main()
