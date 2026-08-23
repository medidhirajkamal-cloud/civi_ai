const API = "http://localhost:5000/api";
const tokenKey = "civic_token";
let token = localStorage.getItem(tokenKey);
let currentUser = null;

const $ = id => document.getElementById(id);

function setMsg(id, text, ok = false) {
  const el = $(id);
  el.textContent = text || "";
  el.style.color = ok ? "#067647" : "#b42318";
}

function headers() {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function show(view) {
  ["authView", "citizenView", "adminView"].forEach(id => $(id).classList.add("hidden"));
  $(view).classList.remove("hidden");
}

function saveSession(data) {
  token = data.token;
  currentUser = data.user;
  localStorage.setItem(tokenKey, token);
  $("userBox").textContent = `${currentUser.name} • ${currentUser.role}`;
}

async function api(path, options = {}) {
  const opts = { ...options, headers: { ...headers(), ...(options.headers || {}) } };
  const response = await fetch(API + path, opts);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}

$("loginTab").onclick = () => {
  $("loginTab").classList.add("active");
  $("registerTab").classList.remove("active");
  $("loginForm").classList.remove("hidden");
  $("registerForm").classList.add("hidden");
};

$("registerTab").onclick = () => {
  $("registerTab").classList.add("active");
  $("loginTab").classList.remove("active");
  $("registerForm").classList.remove("hidden");
  $("loginForm").classList.add("hidden");
};

$("registerForm").onsubmit = async e => {
  e.preventDefault();
  try {
    const data = await api("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: $("regName").value,
        email: $("regEmail").value,
        phone: $("regPhone").value,
        password: $("regPassword").value
      })
    });
    saveSession(data);
    openDashboard();
  } catch (err) {
    setMsg("registerMsg", err.message);
  }
};

$("loginForm").onsubmit = async e => {
  e.preventDefault();
  try {
    const data = await api("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: $("loginEmail").value,
        password: $("loginPassword").value
      })
    });
    saveSession(data);
    openDashboard();
  } catch (err) {
    setMsg("loginMsg", err.message);
  }
};

async function openDashboard() {
  if (!currentUser) {
    try {
      const data = await api("/auth/me");
      currentUser = data.user;
    } catch {
      localStorage.removeItem(tokenKey);
      token = null;
      show("authView");
      return;
    }
  }

  $("userBox").textContent = `${currentUser.name} • ${currentUser.role}`;

  if (currentUser.role === "admin") {
    show("adminView");
    loadAdmin();
  } else {
    show("citizenView");
    loadMyComplaints();
  }
}

$("logoutBtn").onclick = logout;
$("adminLogoutBtn").onclick = logout;

function logout() {
  localStorage.removeItem(tokenKey);
  token = null;
  currentUser = null;
  $("userBox").textContent = "";
  show("authView");
}

$("locationBtn").onclick = () => {
  if (!navigator.geolocation) return setMsg("complaintMsg", "Geolocation is not supported.");
  navigator.geolocation.getCurrentPosition(
    pos => {
      $("latitude").value = pos.coords.latitude;
      $("longitude").value = pos.coords.longitude;
      setMsg("complaintMsg", "Location captured.", true);
    },
    () => setMsg("complaintMsg", "Could not access your location.")
  );
};

$("complaintForm").onsubmit = async e => {
  e.preventDefault();
  setMsg("complaintMsg", "AI is analyzing and routing your complaint...", true);

  const form = new FormData();
  form.append("title", $("title").value);
  form.append("description", $("description").value);
  form.append("address", $("address").value);
  form.append("latitude", $("latitude").value);
  form.append("longitude", $("longitude").value);
  if ($("proof").files[0]) form.append("proof", $("proof").files[0]);

  try {
    const data = await api("/complaints", { method: "POST", body: form });
    setMsg("complaintMsg", `${data.message} Complaint #${data.complaint.id}`, true);
    $("complaintForm").reset();
    loadMyComplaints();
  } catch (err) {
    setMsg("complaintMsg", err.message);
  }
};

async function loadMyComplaints() {
  try {
    const data = await api("/complaints/my");
    const list = $("complaintsList");

    if (!data.complaints.length) {
      list.innerHTML = `<p class="muted">No complaints yet. Submit your first complaint.</p>`;
      return;
    }

    list.innerHTML = data.complaints.map(c => `
      <div class="complaint" onclick="viewComplaint(${c.id})">
        <div class="complaint-top">
          <strong>#${c.id} ${escapeHtml(c.title)}</strong>
          <span class="badge ${c.priority.toLowerCase()}">${c.priority}</span>
        </div>
        <p class="muted">${escapeHtml(c.department || "Pending department")}</p>
        <p>${escapeHtml(c.summary || c.description)}</p>
        <span class="badge ${c.status === "Resolved" ? "resolved" : ""}">${c.status}</span>
      </div>
    `).join("");
  } catch (err) {
    console.error(err);
  }
}

window.viewComplaint = async id => {
  try {
    const data = await api(`/complaints/${id}`);
    const c = data.complaint;
    $("modalContent").innerHTML = `
      <h2>#${c.id} ${escapeHtml(c.title)}</h2>
      <p><b>Status:</b> ${escapeHtml(c.status)}</p>
      <p><b>Category:</b> ${escapeHtml(c.category || "-")}</p>
      <p><b>Department:</b> ${escapeHtml(c.department || "-")}</p>
      <p><b>Priority:</b> ${escapeHtml(c.priority || "-")}</p>
      <p><b>AI summary:</b> ${escapeHtml(c.summary || "-")}</p>
      <p><b>Address:</b> ${escapeHtml(c.address)}</p>
      <p><b>Description:</b> ${escapeHtml(c.description)}</p>
      ${c.duplicate_of ? `<p><b>Possible duplicate:</b> Complaint #${c.duplicate_of}</p>` : ""}
      ${c.proof_path ? `<img class="proof" src="http://localhost:5000${c.proof_path}" alt="Complaint proof" />` : ""}
    `;
    $("modal").classList.remove("hidden");
  } catch (err) {
    alert(err.message);
  }
};

$("closeModal").onclick = () => $("modal").classList.add("hidden");
$("modal").onclick = e => {
  if (e.target.id === "modal") $("modal").classList.add("hidden");
};

async function loadAdmin() {
  const [complaints, analytics] = await Promise.all([
    api("/admin/complaints"),
    api("/admin/analytics")
  ]);

  $("analytics").innerHTML = [
    ["Total complaints", complaints.complaints.length],
    ["Categories", analytics.byCategory.length],
    ["Departments", analytics.byDepartment.length]
  ].map(([label, value]) => `
    <div class="stat"><span class="muted">${label}</span><strong>${value}</strong></div>
  `).join("");

  $("adminTable").innerHTML = complaints.complaints.map(c => `
    <tr>
      <td>#${c.id}</td>
      <td><b>${escapeHtml(c.title)}</b><br><span class="muted">${escapeHtml(c.citizen_name)}</span></td>
      <td>${escapeHtml(c.category || "-")}</td>
      <td>${escapeHtml(c.department || "-")}</td>
      <td><span class="badge ${c.priority.toLowerCase()}">${c.priority}</span></td>
      <td>
        <select onchange="updateStatus(${c.id}, this.value)">
          ${["Submitted","Assigned","In Progress","Resolved","Rejected"].map(s =>
            `<option ${s === c.status ? "selected" : ""}>${s}</option>`
          ).join("")}
        </select>
      </td>
      <td><button class="outline" onclick="viewComplaint(${c.id})">View</button></td>
    </tr>
  `).join("");
}

window.updateStatus = async (id, status) => {
  try {
    await api(`/admin/complaints/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    loadAdmin();
  } catch (err) {
    alert(err.message);
  }
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[ch]));
}

if (token) openDashboard();
else show("authView");
// =========================
// AI CHATBOT
// =========================

document.addEventListener("DOMContentLoaded", () => {
const chatbotToggle = $("chatbot-toggle");
const chatbotWindow = $("chatbot-window");
const chatbotClose = $("chatbot-close");
const chatbotInput = $("chatbot-input");
const chatbotSend = $("chatbot-send");
const chatbotMessages = $("chatbot-messages");

chatbotToggle.addEventListener("click", () => {
  chatbotWindow.style.display = "flex";
  chatbotInput.focus();
});

chatbotClose.addEventListener("click", () => {
  chatbotWindow.style.display = "none";
});

function addChatMessage(text, type) {
  const message = document.createElement("div");
  message.className = type === "user" ? "user-message" : "bot-message";
  message.textContent = text;

  chatbotMessages.appendChild(message);
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}

async function sendChatMessage() {
  const message = chatbotInput.value.trim();

  if (!message) return;

  addChatMessage(message, "user");
  chatbotInput.value = "";

  addChatMessage("Thinking... 🤔", "bot");

  const thinkingMessage =
    chatbotMessages.lastElementChild;

  try {
    const response = await fetch(`${API}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: message
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Chat request failed");
    }

    thinkingMessage.textContent =
      data.reply || "Sorry, I couldn't generate a response.";

  } catch (error) {
    console.error("Chatbot error:", error);

    thinkingMessage.textContent =
      "Sorry, I couldn't connect to the AI assistant.";
  }
}

chatbotSend.addEventListener("click", sendChatMessage);

chatbotInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendChatMessage();
  }
});
});