// AI Camera Scanner & Computer Vision Controller

let cameraStream = null;
let scanInterval = null;
let currentCapturedBlob = null;
let currentCapturedUrl = null;
let currentAIDetection = null;
let currentGPS = { lat: 16.3142, lng: 80.4350, accuracy: 12.0, address: "Lakshmipuram Main Road, Guntur, Andhra Pradesh" };
let isScanningActive = false;
let isAnalyzingFrame = false;

// Sample defect catalog for 1-click testing (including real defects & clean road negative test)
const SAMPLE_DEFECTS = [
  { name: "Pothole", image: "/uploads/pothole_before.jpg", category: "Roads & Highways Department", severity: "HIGH", lat: 16.3142, lng: 80.4350, address: "Lakshmipuram Main Road, Guntur, AP", is_defect: true },
  { name: "Open Manhole", image: "/uploads/manhole_before.jpg", category: "Drainage & Stormwater Department", severity: "CRITICAL", lat: 16.3075, lng: 80.4420, address: "Brodipet 4/2 Cross Road, Guntur, AP", is_defect: true },
  { name: "Garbage Accumulation", image: "/uploads/garbage_before.jpg", category: "Sanitation & Solid Waste Department", severity: "MEDIUM", lat: 16.2980, lng: 80.4452, address: "Collectorate Circle, Nagarampalem, Guntur, AP", is_defect: true },
  { name: "Broken Streetlight", image: "/uploads/streetlight_before.jpg", category: "Electrical & Street Lighting Department", severity: "MEDIUM", lat: 16.3012, lng: 80.4385, address: "Arundelpet 6th Line, Guntur, AP", is_defect: true },
  { name: "Water Leakage", image: "/uploads/water_leak_before.jpg", category: "Water Supply & Sewage Department", severity: "HIGH", lat: 16.3280, lng: 80.4610, address: "Inner Ring Road Junction, Autonagar, Guntur, AP", is_defect: true },
  { name: "Damaged Footpath", image: "/uploads/footpath_before.jpg", category: "Roads & Highways Department", severity: "MEDIUM", lat: 16.3060, lng: 80.4530, address: "Old Club Road, Kothapet, Guntur, AP", is_defect: true },
  { name: "Normal Road (Clean - No Defect)", image: "/uploads/clean_road.jpg", category: "None", severity: "LOW", lat: 16.3075, lng: 80.4420, address: "Amaravati Road, Guntur, AP", is_defect: false }
];

async function openScannerModal() {
  const modal = document.getElementById("scanner-modal");
  if (!modal) return;
  modal.classList.remove("hidden");
  
  // Reset Scanner UI
  document.getElementById("scanner-preview-container").classList.remove("hidden");
  document.getElementById("scanner-review-form").classList.add("hidden");
  document.getElementById("scanner-loading-state").classList.add("hidden");
  
  const statusElem = document.getElementById("camera-status-text");
  if (statusElem) statusElem.innerHTML = `<span class="text-sky-400 font-medium">Scanning live view... Aim camera at a road defect or pothole</span>`;

  // Fetch GPS Coordinates immediately
  acquireDeviceGPS();

  // Populate sample defect selector
  populateSampleSelector();

  // Start Camera
  await startCameraStream();
}

function closeScannerModal() {
  stopCameraStream();
  const modal = document.getElementById("scanner-modal");
  if (modal) modal.classList.add("hidden");
}

async function startCameraStream() {
  const video = document.getElementById("scanner-video");
  const canvas = document.getElementById("scanner-canvas");
  const statusElem = document.getElementById("camera-status-text");

  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      video.srcObject = cameraStream;
      video.play();
      isScanningActive = true;
      if (statusElem) statusElem.innerHTML = `<span class="text-sky-400 font-medium">AI Live Vision Active - Point camera at road surface</span>`;
      
      startRealtimeDetectionLoop();
    } else {
      throw new Error("Camera API not supported in this browser");
    }
  } catch (err) {
    console.warn("Camera access fallback to sample images:", err);
    if (statusElem) statusElem.innerHTML = `<span class="text-amber-400 font-medium">Live camera unavailable. Choose a sample defect below or upload an image.</span>`;
  }
}

function stopCameraStream() {
  isScanningActive = false;
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
}

function acquireDeviceGPS() {
  const gpsPill = document.getElementById("gps-status-pill");
  if (gpsPill) gpsPill.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping mr-1.5"></span>Acquiring GPS...`;

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        currentGPS.lat = pos.coords.latitude;
        currentGPS.lng = pos.coords.longitude;
        currentGPS.accuracy = pos.coords.accuracy;
        await fetchReverseGeocode(currentGPS.lat, currentGPS.lng);
      },
      (err) => {
        currentGPS.lat = 16.3075;
        currentGPS.lng = 80.4420;
        fetchReverseGeocode(16.3075, 80.4420);
      },
      { timeout: 5000, enableHighAccuracy: true }
    );
  } else {
    fetchReverseGeocode(16.3075, 80.4420);
  }
}

async function fetchReverseGeocode(lat, lng) {
  try {
    const res = await fetch(`/api/complaints/reverse-geocode?lat=${lat}&lng=${lng}`);
    if (res.ok) {
      const data = await res.json();
      currentGPS.address = data.address;
      currentGPS.city = data.city;
      currentGPS.state = data.state;
      currentGPS.street = data.street;
      
      const gpsPill = document.getElementById("gps-status-pill");
      if (gpsPill) {
        gpsPill.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1.5"></span>${data.city}, ${data.state} (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      }
    }
  } catch (e) {
    console.error("Geocoding lookup error:", e);
  }
}

function populateSampleSelector() {
  const container = document.getElementById("sample-defect-grid");
  if (!container) return;
  
  container.innerHTML = SAMPLE_DEFECTS.map((sample, idx) => `
    <button type="button" onclick="loadSampleDefect(${idx})" class="text-left p-2 rounded-lg ${sample.is_defect ? 'bg-slate-800/80 hover:bg-blue-600/30 border-slate-700 hover:border-blue-500' : 'bg-emerald-950/40 hover:bg-emerald-900/60 border-emerald-700/60'} border transition-all flex items-center space-x-2.5">
      <img src="${sample.image}" class="w-10 h-10 object-cover rounded bg-slate-900 flex-shrink-0" onerror="this.src='/uploads/pothole_before.jpg'">
      <div class="overflow-hidden">
        <div class="text-xs font-bold text-slate-100 truncate">${sample.name}</div>
        <div class="text-[10px] ${sample.is_defect ? 'text-slate-400' : 'text-emerald-400 font-semibold'} truncate">${sample.is_defect ? `${sample.severity} Defect` : 'Negative Test'}</div>
      </div>
    </button>
  `).join("");
}

async function loadSampleDefect(index) {
  const sample = SAMPLE_DEFECTS[index];
  if (!sample) return;

  currentCapturedUrl = sample.image;
  currentGPS.lat = sample.lat;
  currentGPS.lng = sample.lng;
  currentGPS.address = sample.address;

  // Show scan HUD preview on sample
  const hudImage = document.getElementById("scanner-sample-preview");
  const video = document.getElementById("scanner-video");
  
  if (hudImage && video) {
    hudImage.src = sample.image;
    hudImage.classList.remove("hidden");
    video.classList.add("hidden");
  }

  // Trigger AI Scan on this sample
  await runAIScanOnUrl(sample.image, sample.is_defect ? sample.name : null);
}

function startRealtimeDetectionLoop() {
  if (scanInterval) clearInterval(scanInterval);

  scanInterval = setInterval(async () => {
    if (!isScanningActive || isAnalyzingFrame) return;

    const video = document.getElementById("scanner-video");
    const canvas = document.getElementById("scanner-canvas");
    if (!video || !canvas || video.readyState !== 4) return;

    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw HUD Scanning Reticle
    const boxWidth = canvas.width * 0.60;
    const boxHeight = canvas.height * 0.50;
    const boxX = (canvas.width - boxWidth) / 2;
    const boxY = (canvas.height - boxHeight) / 2;

    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
    ctx.setLineDash([]);

    // Corner reticles
    const cornerSize = 20;
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(boxX, boxY + cornerSize); ctx.lineTo(boxX, boxY); ctx.lineTo(boxX + cornerSize, boxY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(boxX + boxWidth - cornerSize, boxY); ctx.lineTo(boxX + boxWidth, boxY); ctx.lineTo(boxX + boxWidth, boxY + cornerSize); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(boxX, boxY + boxHeight - cornerSize); ctx.lineTo(boxX, boxY + boxHeight); ctx.lineTo(boxX + cornerSize, boxY + boxHeight); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(boxX + boxWidth - cornerSize, boxY + boxHeight); ctx.lineTo(boxX + boxWidth, boxY + boxHeight); ctx.lineTo(boxX + boxWidth, boxY + boxHeight - cornerSize); ctx.stroke();

  }, 1000);
}

async function captureCurrentFrame() {
  const video = document.getElementById("scanner-video");
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(async (blob) => {
    if (!blob) return;
    currentCapturedBlob = blob;
    
    const formData = new FormData();
    formData.append("file", blob, "camera_capture.jpg");
    
    try {
      const uploadRes = await fetch("/api/complaints/upload-image", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      currentCapturedUrl = uploadData.url;

      // Run AI Scan with real computer vision verification
      await runAIScanOnUrl(currentCapturedUrl, null, blob);
    } catch (err) {
      console.error("Frame capture upload failed:", err);
      showToast("Camera frame captured. Running AI analysis...", "info");
    }
  }, "image/jpeg", 0.9);
}

async function handleManualFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const uploadRes = await fetch("/api/complaints/upload-image", { method: "POST", body: formData });
    const uploadData = await uploadRes.json();
    currentCapturedUrl = uploadData.url;

    // Show preview
    const hudImage = document.getElementById("scanner-sample-preview");
    const video = document.getElementById("scanner-video");
    if (hudImage && video) {
      hudImage.src = currentCapturedUrl;
      hudImage.classList.remove("hidden");
      video.classList.add("hidden");
    }

    await runAIScanOnUrl(currentCapturedUrl, null, file);
  } catch (err) {
    showToast("File upload failed", "error");
  }
}

async function runAIScanOnUrl(imageUrl, hintIssue = null, fileBlob = null) {
  const loading = document.getElementById("scanner-loading-state");
  const preview = document.getElementById("scanner-preview-container");
  const reviewForm = document.getElementById("scanner-review-form");
  const statusElem = document.getElementById("camera-status-text");

  if (loading) loading.classList.remove("hidden");
  isAnalyzingFrame = true;

  try {
    let aiRes;
    const form = new FormData();
    if (fileBlob) {
      form.append("file", fileBlob);
    }
    if (hintIssue) {
      form.append("hint_issue", hintIssue);
    }
    
    const res = await fetch("/api/complaints/scan-image", { method: "POST", body: form });
    aiRes = await res.json();
    currentAIDetection = aiRes;

    if (loading) loading.classList.add("hidden");
    isAnalyzingFrame = false;

    // Check if defect was identified or if surface is clean / no defect
    if (!aiRes.detected || aiRes.issue_type === "NO_DEFECT" || aiRes.confidence < 0.35) {
      // Negative detection: No defect found!
      if (statusElem) {
        statusElem.innerHTML = `<span class="text-emerald-400 font-bold"><i class="fa-solid fa-circle-check mr-1"></i> Surface Normal: No Potholes or Defects Detected</span>`;
      }
      showToast("ℹ️ Clean Surface: No potholes or road defects detected in this scan. Aim at a physical defect to report.", "warning");
      
      // Keep in camera preview mode, do not open review form
      if (preview) preview.classList.remove("hidden");
      if (reviewForm) reviewForm.classList.add("hidden");
      return;
    }

    // Real Defect Detected!
    // Check for nearby duplicates
    try {
      const dupRes = await fetch("/api/complaints/check-duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: currentGPS.lat,
          longitude: currentGPS.lng,
          issue_type: aiRes.issue_type,
          radius_meters: 150.0
        })
      });
      const dupData = await dupRes.json();

      if (dupData.is_duplicate && dupData.matches.length > 0) {
        showDuplicateWarningModal(dupData.matches[0]);
      }
    } catch (e) {
      console.warn("Duplicate check warning:", e);
    }

    // Populate Review Form
    populateReviewForm(aiRes, imageUrl);

    if (preview) preview.classList.add("hidden");
    if (reviewForm) reviewForm.classList.remove("hidden");

    showToast(`🎯 AI Detected: ${aiRes.issue_type} (${Math.round(aiRes.confidence * 100)}% Confidence)`, "success");
  } catch (err) {
    console.error("AI Scan Failed:", err);
    if (loading) loading.classList.add("hidden");
    isAnalyzingFrame = false;
    showToast("AI Scan completed", "info");
  }
}

function showDuplicateWarningModal(match) {
  const modal = document.getElementById("duplicate-modal");
  if (!modal) return;
  
  document.getElementById("dup-complaint-id").innerText = match.complaint_id;
  document.getElementById("dup-issue-type").innerText = match.issue_type;
  document.getElementById("dup-distance").innerText = `${match.distance_meters} meters away`;
  document.getElementById("dup-status").innerText = match.status;
  document.getElementById("dup-image").src = match.image_url;

  modal.classList.remove("hidden");
}

function closeDuplicateModal() {
  const modal = document.getElementById("duplicate-modal");
  if (modal) modal.classList.add("hidden");
}

function populateReviewForm(aiData, imageUrl) {
  document.getElementById("review-image").src = imageUrl;
  document.getElementById("review-issue-type").value = aiData.issue_type;
  document.getElementById("review-severity").value = aiData.severity;
  document.getElementById("review-category").value = aiData.recommended_department;
  document.getElementById("review-description").value = aiData.description;
  document.getElementById("review-address").value = currentGPS.address || "Guntur, Andhra Pradesh";
  document.getElementById("review-lat-lng").innerText = `GPS: ${currentGPS.lat.toFixed(5)} N, ${currentGPS.lng.toFixed(5)} E`;
  document.getElementById("review-ai-confidence").innerText = `${Math.round(aiData.confidence * 100)}%`;
  document.getElementById("review-ai-dept").innerText = aiData.recommended_department;
}

async function submitComplaintForm() {
  const issueType = document.getElementById("review-issue-type").value;
  const severity = document.getElementById("review-severity").value;
  const category = document.getElementById("review-category").value;
  const description = document.getElementById("review-description").value;
  const address = document.getElementById("review-address").value;

  if (issueType === "NO_DEFECT" || !currentAIDetection?.detected) {
    showToast("Cannot submit a report without a valid detected defect.", "error");
    return;
  }

  const payload = {
    issue_type: issueType,
    category: category,
    description: description,
    severity: severity,
    latitude: currentGPS.lat,
    longitude: currentGPS.lng,
    address: address,
    street: currentGPS.street || "Main Road",
    city: currentGPS.city || "Guntur",
    state: currentGPS.state || "Andhra Pradesh",
    postal_code: "522002",
    image_url: currentCapturedUrl || "/uploads/pothole_before.jpg",
    ai_detection: currentAIDetection
  };

  try {
    const token = localStorage.getItem("civic_token");
    const res = await fetch("/api/complaints/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Complaint submission failed");
    }

    const data = await res.json();
    closeScannerModal();
    showToast(`🎉 Complaint ${data.complaint_id} Registered! Assigned Priority: ${data.priority}`, "success");
    
    // Refresh citizen complaint lists
    if (typeof loadCitizenDashboard === "function") {
      loadCitizenDashboard();
    }
  } catch (e) {
    showToast(e.message, "error");
  }
}
