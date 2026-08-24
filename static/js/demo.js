// Interactive Guided Demo Walkthrough & 1-Click Role Switcher

let isDemoRunning = false;

async function quickSwitchRole(role) {
  try {
    const res = await fetch(`/api/auth/demo-login/${role}`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Demo login failed");
    }
    const data = await res.json();
    localStorage.setItem("civic_token", data.access_token);
    localStorage.setItem("civic_user", JSON.stringify(data.user));
    
    showToast(`Switched active session to: ${data.user.full_name} (${data.user.role.toUpperCase()})`, "info");
    
    // Update global app state
    if (typeof checkAuthSession === "function") {
      await checkAuthSession();
    }
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function runEndToEndDemoTour() {
  if (isDemoRunning) return;
  isDemoRunning = true;

  const demoBanner = document.getElementById("demo-tour-banner");
  if (demoBanner) demoBanner.classList.remove("hidden");

  function updateTourStep(stepNum, title, desc) {
    const titleElem = document.getElementById("demo-tour-title");
    const descElem = document.getElementById("demo-tour-desc");
    const stepPill = document.getElementById("demo-tour-step-pill");
    if (titleElem) titleElem.innerText = title;
    if (descElem) descElem.innerText = desc;
    if (stepPill) stepPill.innerText = `Step ${stepNum}/7`;
  }

  try {
    // STEP 1: Citizen Reports Pothole
    updateTourStep(1, "1. Citizen Scans & Reports Defect", "Logging in as Citizen Priya Sharma and creating a new pothole report...");
    await quickSwitchRole("user");
    await sleep(1500);

    // Create a new complaint via API to simulate scan
    const token = localStorage.getItem("civic_token");
    const createRes = await fetch("/api/complaints/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({
        issue_type: "Pothole",
        category: "Roads & Highways Department",
        description: "Severe road pothole cavity detected on high-traffic corridor near Lakshmipuram.",
        severity: "HIGH",
        latitude: 16.3142,
        longitude: 80.4350,
        address: "Lakshmipuram Main Road, Guntur, Andhra Pradesh",
        image_url: "/uploads/pothole_before.jpg",
        ai_detection: {
          issue_type: "Pothole",
          confidence: 0.95,
          severity: "HIGH",
          bounding_boxes: [{ ymin: 0.28, xmin: 0.22, ymax: 0.74, xmax: 0.78, label: "Pothole", confidence: 0.95 }],
          description: "Severe asphalt cavity (~0.85m diameter) with high structural hazard.",
          recommended_department: "Roads & Highways Department",
          dept_code: "ROADS",
          base_priority: "HIGH"
        }
      })
    });
    const createdData = await createRes.json();
    const complaintId = createdData.complaint_id;
    showToast(`Citizen created complaint ${complaintId}`, "success");
    await sleep(2500);

    // STEP 2: Admin Receives & Assigns Department
    updateTourStep(2, "2. Municipal Admin Assigns Department", `Admin reviews AI detection for ${complaintId} and assigns Roads & Highways Dept...`);
    await quickSwitchRole("admin");
    await sleep(1500);

    const adminToken = localStorage.getItem("civic_token");
    await fetch(`/api/complaints/${complaintId}/admin-assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${adminToken}` },
      body: JSON.stringify({
        department_id: 1, // Roads Dept
        priority: "HIGH",
        deadline_hours: 24,
        admin_instructions: "Immediate pothole patching required on main arterial road. Deploy compaction roller."
      })
    });
    showToast(`Admin assigned ${complaintId} to Roads Dept`, "info");
    await sleep(2500);

    // STEP 3: Department Officer Dispatches Worker
    updateTourStep(3, "3. Roads Department Dispatches Worker", `Roads Officer Er. Venkat Rao assigns field crew lead Ravi Teja...`);
    await quickSwitchRole("department");
    await sleep(1500);

    const deptToken = localStorage.getItem("civic_token");
    await fetch(`/api/complaints/${complaintId}/dept-assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${deptToken}` },
      body: JSON.stringify({
        worker_id: 1, // Worker Ravi
        dept_instructions: "Execute cold asphalt mix patching and ensure smooth grade transition."
      })
    });
    showToast(`Department dispatched task to Worker Ravi`, "info");
    await sleep(2500);

    // STEP 4: Worker Executes Repair & Submits Before/After
    updateTourStep(4, "4. Worker Executes Repair & Uploads Proof", `Worker Ravi arrives on-site, completes repair, and submits before/after photos with GPS...`);
    await quickSwitchRole("worker");
    await sleep(1500);

    const workerToken = localStorage.getItem("civic_token");
    // Start work
    await fetch(`/api/complaints/${complaintId}/worker-update-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${workerToken}` },
      body: JSON.stringify({ status: "WORK_STARTED", worker_lat: 16.3142, worker_lng: 80.4350 })
    });
    await sleep(1500);

    // Submit resolution
    const resolveRes = await fetch(`/api/complaints/${complaintId}/worker-resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${workerToken}` },
      body: JSON.stringify({
        work_description: "Excavated cavity, applied bitumen tack coat, laid 50mm dense asphalt mix and compacted to level grade.",
        materials_used: "Bitumen Emulsion 40kg, Dense Bituminous Macadam 300kg, Roller Compactor",
        before_image_url: "/uploads/pothole_before.jpg",
        after_image_url: "/uploads/pothole_after.jpg",
        worker_lat: 16.3142,
        worker_lng: 80.4350
      })
    });
    const resolveData = await resolveRes.json();
    showToast(`Worker submitted repair! AI Match: ${Math.round((resolveData.ai_verification?.resolution_confidence || 0.95) * 100)}%`, "success");
    await sleep(3000);

    // STEP 5: Department Officer Quality Check
    updateTourStep(5, "5. Department Officer Quality Verification", `Officer verifies Before vs After repair photos and approves work...`);
    await quickSwitchRole("department");
    await sleep(1500);

    await fetch(`/api/complaints/${complaintId}/dept-verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${deptToken}` },
      body: JSON.stringify({ approved: true, comments: "Photographic proof and GPS verified. Repair meets GMC engineering specs." })
    });
    showToast(`Department Officer approved repair for ${complaintId}`, "info");
    await sleep(2500);

    // STEP 6: Admin Final Sign-Off
    updateTourStep(6, "6. Municipal Admin Final Approval", `Admin grants final closure sign-off for ${complaintId}...`);
    await quickSwitchRole("admin");
    await sleep(1500);

    await fetch(`/api/complaints/${complaintId}/admin-verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${adminToken}` },
      body: JSON.stringify({ approved: true, comments: "Administrative inspection complete. Complaint closed successfully." })
    });
    showToast(`Admin signed off. Status: RESOLVED`, "success");
    await sleep(2500);

    // STEP 7: Citizen Receives Resolution
    updateTourStep(7, "7. Citizen Resolution Certificate", `Switching back to Citizen Priya Sharma to view the resolution details and vertical timeline!`);
    await quickSwitchRole("user");
    await sleep(1500);

    if (typeof viewComplaintDetail === "function") {
      viewComplaintDetail(complaintId);
    }
    showToast(`🎉 Complete 10-Step Civic Lifecycle Tour Finished!`, "success");

  } catch (err) {
    console.error("Demo tour error:", err);
    showToast(`Demo step encountered issue: ${err.message}`, "error");
  } finally {
    isDemoRunning = false;
    setTimeout(() => {
      if (demoBanner) demoBanner.classList.add("hidden");
    }, 8000);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
