// Civic GIS Interactive Map Engine (Leaflet integration)

let globalAdminMap = null;
let globalCitizenMap = null;
let mapMarkersLayer = null;

const STATUS_COLORS = {
  NEW: "#ef4444",
  ASSIGNED_DEPT: "#f59e0b",
  ASSIGNED_WORKER: "#f59e0b",
  WORK_STARTED: "#3b82f6",
  WORK_COMPLETED: "#a855f7",
  DEPT_VERIFIED: "#14b8a6",
  RESOLVED: "#22c55e",
  REJECTED: "#6b7280",
  REOPENED: "#dc2626"
};

function createCustomMarkerIcon(status, severity) {
  const color = STATUS_COLORS[status] || "#3b82f6";
  const isCritical = severity === "CRITICAL" || status === "NEW";
  
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 18px;
        height: 18px;
        border-radius: 50%;
        border: 2px solid #ffffff;
        box-shadow: 0 0 10px ${color};
        ${isCritical ? 'animation: pulseCrit 1.8s infinite;' : ''}
      "></div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10]
  });
}

function initLeafletMap(containerId, center = [16.3075, 80.4420], zoom = 13) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  // Clear if already initialized
  if (container._leaflet_id) {
    container._leaflet_id = null;
    container.innerHTML = "";
  }

  const map = L.map(containerId, {
    zoomControl: true,
    attributionControl: false
  }).setView(center, zoom);

  // High-performance CartoDB Dark Matter tiles
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd',
  }).addTo(map);

  return map;
}

async function renderAdminMap(statusFilter = "", deptFilter = "") {
  const container = document.getElementById("admin-map-container");
  if (!container) return;

  if (!globalAdminMap) {
    globalAdminMap = initLeafletMap("admin-map-container", [16.3075, 80.4420], 13);
  }

  // Fetch markers from API
  try {
    const token = localStorage.getItem("civic_token");
    const res = await fetch("/api/analytics/map-markers", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) return;
    const markersData = await res.json();

    if (mapMarkersLayer && globalAdminMap) {
      globalAdminMap.removeLayer(mapMarkersLayer);
    }

    mapMarkersLayer = L.layerGroup().addTo(globalAdminMap);
    const bounds = [];

    markersData.forEach(item => {
      if (statusFilter && item.status !== statusFilter) return;
      if (deptFilter && item.department_name !== deptFilter) return;

      const icon = createCustomMarkerIcon(item.status, item.severity);
      const marker = L.marker([item.latitude, item.longitude], { icon });

      const popupHtml = `
        <div class="p-1 max-w-xs">
          <div class="relative h-28 w-full mb-2 rounded overflow-hidden bg-slate-900">
            <img src="${item.image_url}" class="w-full h-full object-cover" onerror="this.src='/uploads/pothole_before.jpg'">
            <span class="absolute top-1 right-1 text-xs px-2 py-0.5 rounded font-bold uppercase bg-slate-900/80 text-white">
              ${item.severity}
            </span>
          </div>
          <div class="font-bold text-sm text-slate-100">${item.issue_type}</div>
          <div class="text-xs text-blue-400 font-mono mb-1">${item.complaint_id}</div>
          <div class="text-xs text-slate-300 mb-2 truncate">${item.address}</div>
          <div class="flex items-center justify-between pt-1 border-t border-slate-700">
            <span class="text-xs font-semibold px-2 py-0.5 rounded badge-${item.status.toLowerCase().replace('_','-')}">
              ${item.status.replace('_', ' ')}
            </span>
            <button onclick="viewComplaintDetail('${item.complaint_id}')" class="text-xs text-blue-400 hover:text-blue-300 font-bold">
              View Details →
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      mapMarkersLayer.addLayer(marker);
      bounds.push([item.latitude, item.longitude]);
    });

    if (bounds.length > 0) {
      globalAdminMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    }
  } catch (err) {
    console.error("Failed to render map markers:", err);
  }
}

async function renderCitizenMap() {
  const container = document.getElementById("citizen-map-container");
  if (!container) return;

  if (!globalCitizenMap) {
    globalCitizenMap = initLeafletMap("citizen-map-container", [16.3075, 80.4420], 13);
  }

  try {
    const token = localStorage.getItem("civic_token");
    const res = await fetch("/api/analytics/map-markers", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) return;
    const markersData = await res.json();

    const layer = L.layerGroup().addTo(globalCitizenMap);
    const bounds = [];

    markersData.forEach(item => {
      const icon = createCustomMarkerIcon(item.status, item.severity);
      const marker = L.marker([item.latitude, item.longitude], { icon });

      const popupHtml = `
        <div class="p-1 max-w-xs">
          <div class="font-bold text-sm text-slate-100">${item.issue_type}</div>
          <div class="text-xs text-blue-400 font-mono mb-1">${item.complaint_id}</div>
          <div class="text-xs text-slate-300 mb-2">${item.address}</div>
          <button onclick="viewComplaintDetail('${item.complaint_id}')" class="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded w-full">
            Track Progress
          </button>
        </div>
      `;
      marker.bindPopup(popupHtml);
      layer.addLayer(marker);
      bounds.push([item.latitude, item.longitude]);
    });

    if (bounds.length > 0) {
      globalCitizenMap.fitBounds(bounds, { padding: [20, 20], maxZoom: 14 });
    }
  } catch (e) {
    console.error("Citizen map error:", e);
  }
}
