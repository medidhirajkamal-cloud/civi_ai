// Main Frontend Application Controller

let currentUser = null;
let currentToken = null;
let activeRole = "user";
let activeComplaintDetail = null;

document.addEventListener("DOMContentLoaded", async () => {
  initToasts();
  await checkAuthSession();
  setupEventListeners();
});

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const bgColors = {
    success: "bg-emerald-600 border-emerald-400 text-white",
    error: "bg-rose-600 border-rose-400 text-white",
    info: "bg-blue-600 border-blue-400 text-white",
    warning: "bg-amber-600 border-amber-400 text-white"
  };

  const icons = {
    success: "fa-circle-check",
    error: "fa-circle-exclamation",
    info: "fa-circle-info",
    warning: "fa-triangle-exclamation"
  };

  const toast = document.createElement("div");
  toast.className = `flex items-center space-x-3 px-4 py-3 rounded-lg border shadow-xl transition-all transform duration-300 translate-y-2 opacity-0 text-sm font-medium ${bgColors[type] || bgColors.info}`;
  toast.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info} text-lg"></i>
    <span class="flex-1">${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove("translate-y-2", "opacity-0");
  }, 10);

  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-x-full");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function initToasts() {
  if (!document.getElementById("toast-container")) {
    const cont = document.createElement("div");
    cont.id = "toast-container";
    cont.className = "fixed bottom-5 right-5 z-50 flex flex-col space-y-2.5 max-w-sm";
    document.body.appendChild(cont);
  }
}

async function checkAuthSession() {
  currentToken = localStorage.getItem("civic_token");
  const storedUser = localStorage.getItem("civic_user");

  if (currentToken && storedUser) {
    try {
      currentUser = JSON.parse(storedUser);
      activeRole = currentUser.role;
      updateHeaderUI();
      switchView(currentUser.role);
      fetchNotifications();
      return;
    } catch (e) {
      console.warn("Corrupt session data", e);
    }
  }

  currentUser = null;
  currentToken = null;
  updateHeaderUI();
  switchView("landing");
}

function updateHeaderUI() {
  const userSection = document.getElementById("header-user-section");
  const guestSection = document.getElementById("header-guest-section");
  const userNameElem = document.getElementById("header-user-name");
  const userRoleElem = document.getElementById("header-user-role");
  const roleBadge = document.getElementById("header-role-badge");

  if (currentUser) {
    if (userSection) userSection.classList.remove("hidden");
    if (guestSection) guestSection.classList.add("hidden");
    if (userNameElem) userNameElem.innerText = currentUser.full_name;
    if (userRoleElem) userRoleElem.innerText = currentUser.role.toUpperCase();
    if (roleBadge) {
      roleBadge.innerText = currentUser.role.toUpperCase();
      roleBadge.className = `px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${getRoleBadgeClass(currentUser.role)}`;
    }
  } else {
    if (userSection) userSection.classList.add("hidden");
    if (guestSection) guestSection.classList.remove("hidden");
  }
}

function getRoleBadgeClass(role) {
  switch (role) {
    case "admin": return "bg-red-500/20 text-red-400 border border-red-500/40";
    case "department": return "bg-amber-500/20 text-amber-400 border border-amber-500/40";
    case "worker": return "bg-purple-500/20 text-purple-400 border border-purple-500/40";
    default: return "bg-blue-500/20 text-blue-400 border border-blue-500/40";
  }
}

function switchView(viewName) {
  const screens = ["landing", "user", "admin", "department", "worker", "auth"];
  screens.forEach(s => {
    const el = document.getElementById(`screen-${s}`);
    if (el) el.classList.add("hidden");
  });

  const target = document.getElementById(`screen-${viewName}`);
  if (target) target.classList.remove("hidden");

  if (viewName === "user") loadCitizenDashboard();
  else if (viewName === "admin") loadAdminDashboard();
  else if (viewName === "department") loadDepartmentDashboard();
  else if (viewName === "worker") loadWorkerDashboard();
  else if (viewName === "landing") loadLandingStats();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showAuthModal(tab = 'login') {
  switchView('auth');
  const loginTab = document.getElementById('auth-tab-login');
  const regTab = document.getElementById('auth-tab-register');
  const loginForm = document.getElementById('form-login');
  const regForm = document.getElementById('form-register');

  if (tab === 'login') {
    if (loginTab) loginTab.className = "flex-1 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 transition-all";
    if (regTab) regTab.className = "flex-1 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition-all";
    if (loginForm) loginForm.classList.remove('hidden');
    if (regForm) regForm.classList.add('hidden');
  } else {
    if (regTab) regTab.className = "flex-1 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 transition-all";
    if (loginTab) loginTab.className = "flex-1 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition-all";
    if (regForm) regForm.classList.remove('hidden');
    if (loginForm) loginForm.classList.add('hidden');
    updateRegFields();
  }
}

function updateRegFields() {
  const role = document.getElementById('reg-role')?.value || 'user';
  ['user', 'admin', 'dept', 'worker'].forEach(r => {
    const el = document.getElementById(`reg-fields-${r}`);
    if (el) el.classList.add('hidden');
  });
  const target = document.getElementById(`reg-fields-${role === 'department' ? 'dept' : role}`);
  if (target) target.classList.remove('hidden');
}

function quickFillLogin(email, password, role) {
  document.getElementById("login-email").value = email;
  document.getElementById("login-password").value = password;
  document.getElementById("login-role").value = role || "auto";
  showToast(`Filled ${role.toUpperCase()} credentials: ${email}`, "info");
}

function logout() {
  localStorage.removeItem("civic_token");
  localStorage.removeItem("civic_user");
  currentUser = null;
  currentToken = null;
  updateHeaderUI();
  switchView("landing");
  showToast("Logged out successfully", "info");
}

function setupEventListeners() {
  // Login form handler
  const loginForm = document.getElementById("form-login");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password").value;
      const role = document.getElementById("login-role").value;

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, role })
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || "Authentication failed");
        }

        const data = await res.json();
        localStorage.setItem("civic_token", data.access_token);
        localStorage.setItem("civic_user", JSON.stringify(data.user));
        currentUser = data.user;
        currentToken = data.access_token;
        activeRole = data.user.role;

        updateHeaderUI();
        switchView(data.user.role);
        showToast(`Welcome back, ${data.user.full_name}!`, "success");
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }

  // Registration Form handler
  const regForm = document.getElementById("form-register");
  if (regForm) {
    regForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const role = document.getElementById("reg-role").value;
      let endpoint = `/api/auth/register/${role}`;
      let payload = {};

      const pwd = document.getElementById("reg-password").value;
      const confirmPwd = document.getElementById("reg-confirm-password").value;

      if (pwd !== confirmPwd) {
        showToast("Passwords do not match!", "error");
        return;
      }

      if (role === "user") {
        payload = {
          full_name: document.getElementById("reg-user-name").value || "Citizen User",
          email: document.getElementById("reg-user-email").value,
          phone: document.getElementById("reg-user-phone").value || "+91 98480 00000",
          address: document.getElementById("reg-user-address").value || "Guntur Main Road",
          city: "Guntur",
          state: "Andhra Pradesh",
          password: pwd,
          confirm_password: confirmPwd
        };
      } else if (role === "admin") {
        payload = {
          full_name: document.getElementById("reg-admin-name").value || "Admin Officer",
          email: document.getElementById("reg-admin-email").value,
          employee_id: document.getElementById("reg-admin-empid").value || `ADM-${Date.now().toString().slice(-4)}`,
          organization: document.getElementById("reg-admin-org").value || "Guntur Municipal Corporation",
          password: pwd,
          confirm_password: confirmPwd
        };
      } else if (role === "department") {
        payload = {
          department_name: document.getElementById("reg-dept-name").value || "Municipal Engineering Department",
          officer_name: document.getElementById("reg-dept-officer").value || "Department Officer",
          email: document.getElementById("reg-dept-email").value,
          dept_code: document.getElementById("reg-dept-code").value || `DEPT-${Date.now().toString().slice(-4)}`,
          phone: document.getElementById("reg-dept-phone").value || "+91 863 2224000",
          service_area: document.getElementById("reg-dept-area").value || "Guntur Urban",
          password: pwd,
          confirm_password: confirmPwd
        };
      } else if (role === "worker") {
        payload = {
          full_name: document.getElementById("reg-worker-name").value || "Field Worker",
          email: document.getElementById("reg-worker-email").value,
          worker_id_code: document.getElementById("reg-worker-id").value || `WRK-${Date.now().toString().slice(-4)}`,
          phone: document.getElementById("reg-worker-phone").value || "+91 94400 00000",
          department_id: parseInt(document.getElementById("reg-worker-dept").value || "1"),
          skill_type: document.getElementById("reg-worker-skill").value || "Asphalt Patching & Paving",
          service_area: document.getElementById("reg-worker-area").value || "Guntur City",
          password: pwd,
          confirm_password: confirmPwd
        };
      }

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || "Registration failed");
        }

        const data = await res.json();
        localStorage.setItem("civic_token", data.access_token);
        localStorage.setItem("civic_user", JSON.stringify(data.user));
        currentUser = data.user;
        currentToken = data.access_token;

        updateHeaderUI();
        switchView(data.user.role);
        showToast("🎉 Registration Successful! Welcome to Civic AI Platform.", "success");
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }
}

// ----------------- CITIZEN CONTROLLER -----------------

async function loadCitizenDashboard() {
  try {
    const res = await fetch("/api/complaints", {
      headers: { "Authorization": `Bearer ${currentToken}` }
    });
    if (!res.ok) return;
    const complaints = await res.json();

    const total = complaints.length;
    const resolved = complaints.filter(c => c.status === "RESOLVED").length;
    const inProgress = complaints.filter(c => c.status !== "RESOLVED" && c.status !== "NEW").length;

    document.getElementById("citizen-stat-total").innerText = total;
    document.getElementById("citizen-stat-resolved").innerText = resolved;
    document.getElementById("citizen-stat-active").innerText = inProgress;

    const listContainer = document.getElementById("citizen-complaints-list");
    if (!listContainer) return;

    if (complaints.length === 0) {
      listContainer.innerHTML = `
        <div class="col-span-full p-8 text-center glass-panel rounded-xl">
          <i class="fa-solid fa-camera-retro text-4xl text-blue-400 mb-3"></i>
          <h3 class="text-base font-bold text-slate-200">No Complaints Reported Yet</h3>
          <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Point your camera at a road defect, pothole, or broken streetlight to scan and submit a report.</p>
          <button onclick="openScannerModal()" class="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold">
            Scan & Report Defect
          </button>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = complaints.map(c => `
      <div class="glass-card rounded-xl overflow-hidden flex flex-col border border-slate-700/60">
        <div class="relative h-44 w-full bg-slate-900 overflow-hidden">
          <img src="${c.image_url}" class="w-full h-full object-cover" onerror="this.src='/uploads/pothole_before.jpg'">
          <div class="absolute top-2 left-2 flex items-center space-x-1.5">
            <span class="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900/80 text-blue-400 border border-blue-500/30">
              ${c.complaint_id}
            </span>
          </div>
          <div class="absolute top-2 right-2">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider badge-${c.status.toLowerCase().replace('_','-')}">
              ${c.status.replace('_', ' ')}
            </span>
          </div>
        </div>
        
        <div class="p-4 flex-1 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-1">
              <h3 class="font-bold text-sm text-slate-100">${c.issue_type}</h3>
              <span class="text-xs font-bold ${c.priority === 'CRITICAL' ? 'text-red-400' : 'text-amber-400'}">
                ${c.priority} Priority
              </span>
            </div>
            <p class="text-xs text-slate-300 line-clamp-2 mb-3 leading-relaxed">${c.description}</p>
            <div class="text-[11px] text-slate-400 flex items-center space-x-1.5 mb-3">
              <i class="fa-solid fa-location-dot text-rose-400"></i>
              <span class="truncate">${c.address}</span>
            </div>
          </div>
          
          <div class="pt-3 border-t border-slate-700/60 flex items-center justify-between">
            <span class="text-[10px] text-slate-400 font-mono">${new Date(c.created_at).toLocaleDateString()}</span>
            <button onclick="viewComplaintDetail('${c.complaint_id}')" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all">
              <span>Track Status</span>
              <i class="fa-solid fa-arrow-right text-[10px]"></i>
            </button>
          </div>
        </div>
      </div>
    `).join("");

    renderCitizenMap();
  } catch (err) {
    console.error("Failed to load citizen complaints:", err);
  }
}

// ----------------- ADMIN CONTROLLER -----------------

async function loadAdminDashboard() {
  try {
    const statsRes = await fetch("/api/analytics/admin/summary", {
      headers: { "Authorization": `Bearer ${currentToken}` }
    });
    if (statsRes.ok) {
      const stats = await statsRes.json();
      document.getElementById("admin-stat-total").innerText = stats.total_complaints;
      document.getElementById("admin-stat-new").innerText = stats.new_complaints;
      document.getElementById("admin-stat-assigned").innerText = stats.assigned_complaints;
      document.getElementById("admin-stat-progress").innerText = stats.in_progress;
      document.getElementById("admin-stat-verification").innerText = stats.verification_pending;
      document.getElementById("admin-stat-resolved").innerText = stats.resolved_complaints;
      document.getElementById("admin-stat-overdue").innerText = stats.overdue_complaints;
      document.getElementById("admin-stat-avghours").innerText = `${stats.average_resolution_hours}h`;
    }

    renderAdminCharts();
    renderAdminMap();

    const deptListRes = await fetch("/api/auth/departments-list");
    if (deptListRes.ok) {
      const depts = await deptListRes.json();
      const filterSelect = document.getElementById("admin-filter-dept");
      const assignSelect = document.getElementById("admin-assign-dept-select");
      if (filterSelect) {
        filterSelect.innerHTML = `<option value="">All Departments</option>` + depts.map(d => `<option value="${d.department_name}">${d.department_name}</option>`).join("");
      }
      if (assignSelect) {
        assignSelect.innerHTML = depts.map(d => `<option value="${d.id}">${d.department_name} (${d.dept_code})</option>`).join("");
      }
    }

    await filterAdminComplaints();
  } catch (err) {
    console.error("Admin dashboard load error:", err);
  }
}

async function filterAdminComplaints() {
  const status = document.getElementById("admin-filter-status")?.value || "";
  const priority = document.getElementById("admin-filter-priority")?.value || "";
  const search = document.getElementById("admin-filter-search")?.value || "";

  try {
    let url = `/api/complaints?`;
    if (status) url += `status_filter=${status}&`;
    if (priority) url += `priority_filter=${priority}&`;
    if (search) url += `search=${encodeURIComponent(search)}&`;

    const res = await fetch(url, {
      headers: { "Authorization": `Bearer ${currentToken}` }
    });
    if (!res.ok) return;
    const complaints = await res.json();

    const tbody = document.getElementById("admin-complaints-tbody");
    if (!tbody) return;

    if (complaints.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400 text-xs">No matching complaints found</td></tr>`;
      return;
    }

    tbody.innerHTML = complaints.map(c => `
      <tr class="hover:bg-slate-800/50 transition-colors border-b border-slate-800">
        <td class="px-4 py-3 font-mono text-xs font-bold text-blue-400">${c.complaint_id}</td>
        <td class="px-4 py-3">
          <div class="flex items-center space-x-2">
            <img src="${c.image_url}" class="w-8 h-8 rounded object-cover bg-slate-900 flex-shrink-0" onerror="this.src='/uploads/pothole_before.jpg'">
            <div>
              <div class="font-bold text-xs text-slate-100">${c.issue_type}</div>
              <div class="text-[10px] text-slate-400 truncate max-w-xs">${c.address}</div>
            </div>
          </div>
        </td>
        <td class="px-4 py-3 text-xs text-slate-300">${c.department_name || '<span class="text-rose-400 italic">Unassigned</span>'}</td>
        <td class="px-4 py-3">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded ${c.priority === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border border-red-500/30 pulse-critical' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}">
            ${c.priority}
          </span>
        </td>
        <td class="px-4 py-3">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded badge-${c.status.toLowerCase().replace('_','-')}">
            ${c.status.replace('_', ' ')}
          </span>
          ${c.is_overdue ? '<span class="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-rose-900/60 text-rose-300 border border-rose-700 font-bold">OVERDUE</span>' : ''}
        </td>
        <td class="px-4 py-3 text-[11px] text-slate-400 font-mono">${new Date(c.created_at).toLocaleDateString()}</td>
        <td class="px-4 py-3 text-right">
          <button onclick="viewComplaintDetail('${c.complaint_id}')" class="px-2.5 py-1 bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white rounded text-xs font-semibold transition-all">
            Inspect & Assign
          </button>
        </td>
      </tr>
    `).join("");
  } catch (err) {
    console.error("Admin filter complaints error:", err);
  }
}

// ----------------- DEPARTMENT CONTROLLER -----------------

async function loadDepartmentDashboard() {
  try {
    const res = await fetch("/api/analytics/department/summary", {
      headers: { "Authorization": `Bearer ${currentToken}` }
    });
    if (!res.ok) return;
    const data = await res.json();

    document.getElementById("dept-name-display").innerText = currentUser.department_name;
    document.getElementById("dept-stat-total").innerText = data.total_assigned;
    document.getElementById("dept-stat-dispatch").innerText = data.pending_dispatch;
    document.getElementById("dept-stat-active").innerText = data.active_work;
    document.getElementById("dept-stat-verify").innerText = data.pending_verification;
    document.getElementById("dept-stat-resolved").innerText = data.resolved;

    const workerSelect = document.getElementById("dept-assign-worker-select");
    if (workerSelect) {
      workerSelect.innerHTML = data.workers.map(w => `
        <option value="${w.id}">${w.full_name} (${w.worker_id_code}) - ${w.skill_type} [${w.active_jobs} Active Jobs]</option>
      `).join("");
    }

    const compRes = await fetch("/api/complaints", {
      headers: { "Authorization": `Bearer ${currentToken}` }
    });
    if (!compRes.ok) return;
    const complaints = await compRes.json();

    const tbody = document.getElementById("dept-complaints-tbody");
    if (!tbody) return;

    if (complaints.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-400 text-xs">No assigned complaints for this department</td></tr>`;
      return;
    }

    tbody.innerHTML = complaints.map(c => `
      <tr class="hover:bg-slate-800/50 transition-colors border-b border-slate-800">
        <td class="px-4 py-3 font-mono text-xs font-bold text-amber-400">${c.complaint_id}</td>
        <td class="px-4 py-3">
          <div class="font-bold text-xs text-slate-100">${c.issue_type}</div>
          <div class="text-[10px] text-slate-400 truncate max-w-xs">${c.address}</div>
        </td>
        <td class="px-4 py-3 text-xs text-slate-300">${c.worker_name ? `${c.worker_name} (${c.worker_id_code})` : '<span class="text-amber-400 font-semibold">Needs Dispatch</span>'}</td>
        <td class="px-4 py-3">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded ${c.priority === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}">
            ${c.priority}
          </span>
        </td>
        <td class="px-4 py-3">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded badge-${c.status.toLowerCase().replace('_','-')}">
            ${c.status.replace('_', ' ')}
          </span>
        </td>
        <td class="px-4 py-3 text-right space-x-2">
          ${c.status === 'ASSIGNED_DEPT' ? `
            <button onclick="openDeptAssignModal('${c.complaint_id}')" class="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold">
              Dispatch Worker
            </button>
          ` : ''}
          ${c.status === 'WORK_COMPLETED' ? `
            <button onclick="viewComplaintDetail('${c.complaint_id}')" class="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded text-xs font-bold">
              Review & Verify
            </button>
          ` : ''}
          <button onclick="viewComplaintDetail('${c.complaint_id}')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-semibold">
            Details
          </button>
        </td>
      </tr>
    `).join("");

  } catch (err) {
    console.error("Dept dashboard load error:", err);
  }
}

// ----------------- WORKER CONTROLLER -----------------

async function loadWorkerDashboard() {
  try {
    const res = await fetch("/api/complaints", {
      headers: { "Authorization": `Bearer ${currentToken}` }
    });
    if (!res.ok) return;
    const tasks = await res.json();

    document.getElementById("worker-name-display").innerText = currentUser.full_name;
    document.getElementById("worker-skill-display").innerText = currentUser.skill_type || "Field Repair Crew";

    const taskGrid = document.getElementById("worker-tasks-grid");
    if (!taskGrid) return;

    if (tasks.length === 0) {
      taskGrid.innerHTML = `
        <div class="col-span-full p-8 text-center glass-panel rounded-xl">
          <i class="fa-solid fa-clipboard-check text-4xl text-emerald-400 mb-3"></i>
          <h3 class="text-base font-bold text-slate-200">No Pending Tasks</h3>
          <p class="text-xs text-slate-400 mt-1">All assigned repairs have been completed or no jobs currently dispatched.</p>
        </div>
      `;
      return;
    }

    taskGrid.innerHTML = tasks.map(t => `
      <div class="glass-card rounded-xl overflow-hidden border border-slate-700/60 flex flex-col">
        <div class="relative h-48 w-full bg-slate-900">
          <img src="${t.image_url}" class="w-full h-full object-cover" onerror="this.src='/uploads/pothole_before.jpg'">
          <div class="absolute top-2 left-2">
            <span class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-900/80 text-purple-400 border border-purple-500/30">
              ${t.complaint_id}
            </span>
          </div>
          <div class="absolute top-2 right-2">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded badge-${t.status.toLowerCase().replace('_','-')}">
              ${t.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        <div class="p-4 flex-1 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <h3 class="font-bold text-base text-slate-100">${t.issue_type}</h3>
              <span class="text-xs font-bold text-amber-400">${t.priority}</span>
            </div>
            
            <div class="text-xs text-slate-300 mb-3 leading-relaxed">
              <span class="text-slate-400 font-semibold">Instructions:</span> ${t.dept_instructions || t.admin_instructions || 'Execute on-site repair and upload before/after photos.'}
            </div>

            <div class="p-2 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-300 space-y-1 mb-3">
              <div class="flex items-center space-x-1.5 text-rose-400">
                <i class="fa-solid fa-location-dot"></i>
                <span class="font-bold truncate">${t.address}</span>
              </div>
              <div class="text-[10px] text-slate-400 font-mono">GPS: ${t.latitude.toFixed(4)}, ${t.longitude.toFixed(4)}</div>
            </div>
          </div>

          <div class="pt-3 border-t border-slate-700/60 space-y-2">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${t.latitude},${t.longitude}" target="_blank" class="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 text-blue-400 transition-all">
              <i class="fa-solid fa-diamond-turn-right"></i>
              <span>Open in Google Maps / Navigation</span>
            </a>

            <div class="grid grid-cols-2 gap-2">
              ${t.status === 'ASSIGNED_WORKER' ? `
                <button onclick="updateWorkerJobStatus('${t.complaint_id}', 'ACCEPTED')" class="py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold">
                  Accept Job
                </button>
                <button onclick="updateWorkerJobStatus('${t.complaint_id}', 'ON_THE_WAY')" class="py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold">
                  On The Way
                </button>
              ` : ''}
              ${t.status === 'WORK_ACCEPTED' || t.status === 'ON_THE_WAY' ? `
                <button onclick="updateWorkerJobStatus('${t.complaint_id}', 'WORK_STARTED')" class="col-span-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-2">
                  <i class="fa-solid fa-screwdriver-wrench"></i>
                  <span>Mark Work Started</span>
                </button>
              ` : ''}
              ${t.status === 'WORK_STARTED' ? `
                <button onclick="openWorkerResolutionModal('${t.complaint_id}', '${t.image_url}', '${t.issue_type}')" class="col-span-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-2 shadow-lg shadow-emerald-900/40">
                  <i class="fa-solid fa-camera"></i>
                  <span>Submit Resolution (After Photo)</span>
                </button>
              ` : ''}
              ${t.status === 'WORK_COMPLETED' || t.status === 'DEPT_VERIFIED' || t.status === 'RESOLVED' ? `
                <button onclick="viewComplaintDetail('${t.complaint_id}')" class="col-span-2 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-bold">
                  View Submitted Resolution
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `).join("");

  } catch (err) {
    console.error("Worker dashboard load error:", err);
  }
}

async function updateWorkerJobStatus(complaintId, status) {
  try {
    const res = await fetch(`/api/complaints/${complaintId}/worker-update-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${currentToken}` },
      body: JSON.stringify({ status, notes: `Worker status updated to ${status}` })
    });
    if (!res.ok) throw new Error("Status update failed");
    showToast(`Status updated to ${status}`, "success");
    loadWorkerDashboard();
  } catch (e) {
    showToast(e.message, "error");
  }
}

function openWorkerResolutionModal(complaintId, beforeUrl, issueType) {
  const modal = document.getElementById("worker-resolve-modal");
  if (!modal) return;

  document.getElementById("resolve-complaint-id").innerText = complaintId;
  document.getElementById("resolve-complaint-id-input").value = complaintId;
  document.getElementById("resolve-before-preview").src = beforeUrl;
  document.getElementById("resolve-before-url-input").value = beforeUrl;
  document.getElementById("resolve-issue-type-input").value = issueType;

  document.getElementById("resolve-after-preview").src = "/uploads/pothole_after.jpg";
  document.getElementById("resolve-after-url-input").value = "/uploads/pothole_after.jpg";

  modal.classList.remove("hidden");
}

function closeWorkerResolveModal() {
  const modal = document.getElementById("worker-resolve-modal");
  if (modal) modal.classList.add("hidden");
}

async function handleWorkerAfterPhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const uploadRes = await fetch("/api/complaints/upload-image", { method: "POST", body: formData });
    const uploadData = await uploadRes.json();
    document.getElementById("resolve-after-preview").src = uploadData.url;
    document.getElementById("resolve-after-url-input").value = uploadData.url;
    showToast("After-repair photo uploaded", "success");
  } catch (err) {
    showToast("Image upload failed", "error");
  }
}

async function submitWorkerResolution() {
  const complaintId = document.getElementById("resolve-complaint-id-input").value;
  const beforeUrl = document.getElementById("resolve-before-url-input").value;
  const afterUrl = document.getElementById("resolve-after-url-input").value;
  const workDesc = document.getElementById("resolve-work-desc").value;
  const materials = document.getElementById("resolve-materials").value;

  if (!workDesc || !materials) {
    showToast("Please provide work description and materials used", "warning");
    return;
  }

  try {
    const res = await fetch(`/api/complaints/${complaintId}/worker-resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${currentToken}` },
      body: JSON.stringify({
        work_description: workDesc,
        materials_used: materials,
        before_image_url: beforeUrl,
        after_image_url: afterUrl,
        worker_lat: 16.3142,
        worker_lng: 80.4350
      })
    });

    if (!res.ok) throw new Error("Resolution submission failed");
    const data = await res.json();

    closeWorkerResolveModal();
    showToast(`🎉 Repair Submitted! AI Verification Confidence: ${Math.round((data.ai_verification?.resolution_confidence || 0.94)*100)}%`, "success");
    loadWorkerDashboard();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ----------------- COMPLAINT DETAIL & TIMELINE MODAL -----------------

async function viewComplaintDetail(complaintId) {
  try {
    const res = await fetch(`/api/complaints/${complaintId}`, {
      headers: { "Authorization": `Bearer ${currentToken}` }
    });
    if (!res.ok) {
      showToast("Unable to load complaint details", "error");
      return;
    }

    const data = await res.json();
    activeComplaintDetail = data;
    const c = data.complaint;
    const ai = data.ai_detection;
    const work = data.work_update;
    const timeline = data.timeline;

    const modal = document.getElementById("complaint-detail-modal");
    if (!modal) return;

    document.getElementById("detail-modal-id").innerText = c.complaint_id;
    document.getElementById("detail-modal-issue").innerText = c.issue_type;
    document.getElementById("detail-modal-status").innerText = c.status.replace('_', ' ');
    document.getElementById("detail-modal-status").className = `px-2.5 py-0.5 rounded text-xs font-bold uppercase badge-${c.status.toLowerCase().replace('_','-')}`;
    
    document.getElementById("detail-modal-address").innerText = c.address;
    document.getElementById("detail-modal-coords").innerText = `GPS: ${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}`;
    document.getElementById("detail-modal-priority").innerText = c.priority;
    document.getElementById("detail-modal-severity").innerText = c.severity;
    document.getElementById("detail-modal-dept").innerText = c.department_name || "Pending Assignment";
    document.getElementById("detail-modal-worker").innerText = c.worker_name ? `${c.worker_name} (${c.worker_id_code})` : "Unassigned";
    document.getElementById("detail-modal-description").innerText = c.description;

    const beforeImg = document.getElementById("detail-modal-image");
    beforeImg.src = c.image_url;

    const resSection = document.getElementById("detail-resolution-section");
    if (work && work.after_image_url) {
      resSection.classList.remove("hidden");
      document.getElementById("detail-before-img").src = work.before_image_url;
      document.getElementById("detail-after-img").src = work.after_image_url;
      document.getElementById("detail-work-desc").innerText = work.work_description;
      document.getElementById("detail-materials").innerText = work.materials_used;
      document.getElementById("detail-ai-conf").innerText = `${Math.round((work.ai_resolution_confidence || 0.94) * 100)}% Match`;
      document.getElementById("detail-ai-notes").innerText = work.ai_comparison_notes || "Defect successfully remediated.";
    } else {
      resSection.classList.add("hidden");
    }

    renderVerticalTimeline(timeline, "detail-modal-timeline-container");
    renderDetailActionButtons(c, work);

    modal.classList.remove("hidden");
  } catch (err) {
    console.error("View detail error:", err);
  }
}

function closeDetailModal() {
  const modal = document.getElementById("complaint-detail-modal");
  if (modal) modal.classList.add("hidden");
}

function renderDetailActionButtons(c, work) {
  const container = document.getElementById("detail-actions-container");
  if (!container) return;
  container.innerHTML = "";

  if (currentUser?.role === "admin") {
    if (c.status === "NEW" || c.status === "REOPENED") {
      container.innerHTML += `
        <button onclick="openAdminAssignModal('${c.complaint_id}')" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold">
          Assign to Department
        </button>
      `;
    }
    if (c.status === "DEPT_VERIFIED" || c.status === "WORK_COMPLETED") {
      container.innerHTML += `
        <button onclick="adminVerifyComplaint('${c.complaint_id}', true)" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold">
          Approve Final Resolution (Mark Resolved)
        </button>
        <button onclick="adminVerifyComplaint('${c.complaint_id}', false)" class="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold">
          Reopen Complaint
        </button>
      `;
    }
  } else if (currentUser?.role === "department") {
    if (c.status === "ASSIGNED_DEPT") {
      container.innerHTML += `
        <button onclick="openDeptAssignModal('${c.complaint_id}')" class="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold">
          Assign to Worker
        </button>
      `;
    }
    if (c.status === "WORK_COMPLETED") {
      container.innerHTML += `
        <button onclick="deptVerifyComplaint('${c.complaint_id}', true)" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold">
          Approve & Forward to Admin
        </button>
        <button onclick="deptVerifyComplaint('${c.complaint_id}', false)" class="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold">
          Reject (Send Back to Worker)
        </button>
      `;
    }
  }
}

// ----------------- ADMIN ASSIGNMENT MODAL -----------------

function openAdminAssignModal(complaintId) {
  const modal = document.getElementById("admin-assign-modal");
  if (!modal) return;
  document.getElementById("admin-assign-complaint-id").value = complaintId;
  modal.classList.remove("hidden");
}

function closeAdminAssignModal() {
  const modal = document.getElementById("admin-assign-modal");
  if (modal) modal.classList.add("hidden");
}

async function submitAdminAssignment() {
  const complaintId = document.getElementById("admin-assign-complaint-id").value;
  const deptId = parseInt(document.getElementById("admin-assign-dept-select").value);
  const priority = document.getElementById("admin-assign-priority-select").value;
  const deadlineHours = parseInt(document.getElementById("admin-assign-deadline-input").value);
  const instructions = document.getElementById("admin-assign-instructions").value;

  try {
    const res = await fetch(`/api/complaints/${complaintId}/admin-assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${currentToken}` },
      body: JSON.stringify({
        department_id: deptId,
        priority: priority,
        deadline_hours: deadlineHours,
        admin_instructions: instructions
      })
    });

    if (!res.ok) throw new Error("Assignment failed");
    closeAdminAssignModal();
    closeDetailModal();
    showToast("Complaint assigned to Department successfully", "success");
    loadAdminDashboard();
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ----------------- DEPARTMENT ASSIGN MODAL -----------------

function openDeptAssignModal(complaintId) {
  const modal = document.getElementById("dept-assign-modal");
  if (!modal) return;
  document.getElementById("dept-assign-complaint-id").value = complaintId;
  modal.classList.remove("hidden");
}

function closeDeptAssignModal() {
  const modal = document.getElementById("dept-assign-modal");
  if (modal) modal.classList.add("hidden");
}

async function submitDeptAssignment() {
  const complaintId = document.getElementById("dept-assign-complaint-id").value;
  const workerId = parseInt(document.getElementById("dept-assign-worker-select").value);
  const instructions = document.getElementById("dept-assign-instructions").value;

  try {
    const res = await fetch(`/api/complaints/${complaintId}/dept-assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${currentToken}` },
      body: JSON.stringify({
        worker_id: workerId,
        dept_instructions: instructions
      })
    });

    if (!res.ok) throw new Error("Worker assignment failed");
    closeDeptAssignModal();
    closeDetailModal();
    showToast("Task successfully dispatched to worker", "success");
    loadDepartmentDashboard();
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ----------------- VERIFICATION ACTIONS -----------------

async function deptVerifyComplaint(complaintId, approved) {
  let rejectionReason = null;
  if (!approved) {
    rejectionReason = prompt("Please enter the reason for rejection / rework instructions:");
    if (!rejectionReason) return;
  }

  try {
    const res = await fetch(`/api/complaints/${complaintId}/dept-verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${currentToken}` },
      body: JSON.stringify({
        approved: approved,
        rejection_reason: rejectionReason,
        comments: approved ? "Department verified quality standards." : null
      })
    });

    if (!res.ok) throw new Error("Department verification failed");
    closeDetailModal();
    showToast(approved ? "Department approved and forwarded to Admin" : "Sent back to worker for rework", approved ? "success" : "warning");
    loadDepartmentDashboard();
  } catch (e) {
    showToast(e.message, "error");
  }
}

async function adminVerifyComplaint(complaintId, approved) {
  let rejectionReason = null;
  if (!approved) {
    rejectionReason = prompt("Please enter the reason for reopening the complaint:");
    if (!rejectionReason) return;
  }

  try {
    const res = await fetch(`/api/complaints/${complaintId}/admin-verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${currentToken}` },
      body: JSON.stringify({
        approved: approved,
        rejection_reason: rejectionReason,
        comments: approved ? "Final administrative approval granted. Issue closed." : null
      })
    });

    if (!res.ok) throw new Error("Admin approval failed");
    closeDetailModal();
    showToast(approved ? "🎉 Complaint Marked RESOLVED! Citizen Notified." : "Complaint Reopened", "success");
    loadAdminDashboard();
  } catch (e) {
    showToast(e.message, "error");
  }
}

// ----------------- NOTIFICATIONS -----------------

async function fetchNotifications() {
  if (!currentToken) return;
  try {
    const res = await fetch("/api/notifications", {
      headers: { "Authorization": `Bearer ${currentToken}` }
    });
    if (!res.ok) return;
    const data = await res.json();

    const countBadge = document.getElementById("notif-unread-count");
    if (countBadge) {
      if (data.unread_count > 0) {
        countBadge.innerText = data.unread_count;
        countBadge.classList.remove("hidden");
      } else {
        countBadge.classList.add("hidden");
      }
    }

    const listContainer = document.getElementById("notifications-dropdown-list");
    if (listContainer) {
      if (data.notifications.length === 0) {
        listContainer.innerHTML = `<div class="p-4 text-center text-xs text-slate-400">No notifications</div>`;
      } else {
        listContainer.innerHTML = data.notifications.map(n => `
          <div class="p-3 border-b border-slate-700/60 hover:bg-slate-800/80 transition-colors ${n.is_read ? 'opacity-60' : 'bg-blue-900/10'}">
            <div class="font-bold text-xs text-slate-200 mb-0.5">${n.title}</div>
            <div class="text-[11px] text-slate-300 mb-1 leading-snug">${n.message}</div>
            <div class="text-[10px] text-slate-400 font-mono">${new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        `).join("");
      }
    }
  } catch (err) {
    console.error("Notifications fetch error:", err);
  }
}

function toggleNotificationDropdown() {
  const dd = document.getElementById("notifications-dropdown");
  if (dd) dd.classList.toggle("hidden");
}

async function markAllNotificationsRead() {
  if (!currentToken) return;
  await fetch("/api/notifications/mark-all-read", {
    method: "POST",
    headers: { "Authorization": `Bearer ${currentToken}` }
  });
  fetchNotifications();
}

async function loadLandingStats() {}
