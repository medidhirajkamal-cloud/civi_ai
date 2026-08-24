// Vertical Complaint Timeline Visualizer

const STAGE_ICONS = {
  REPORTED: "fa-camera-retro",
  AI_DETECTED: "fa-brain",
  ASSIGNED_DEPT: "fa-building-shield",
  ASSIGNED_WORKER: "fa-helmet-safety",
  WORK_ACCEPTED: "fa-check-circle",
  ON_THE_WAY: "fa-truck-fast",
  WORK_STARTED: "fa-screwdriver-wrench",
  WORK_COMPLETED: "fa-camera",
  AI_VERIFICATION: "fa-microchip",
  DEPT_VERIFIED: "fa-circle-check",
  DEPT_REJECTED: "fa-rotate-left",
  ADMIN_APPROVED: "fa-stamp",
  RESOLVED: "fa-circle-check",
  REOPENED: "fa-arrows-rotate"
};

const STAGE_COLORS = {
  REPORTED: "border-blue-500 text-blue-400 bg-blue-500/10",
  AI_DETECTED: "border-sky-400 text-sky-300 bg-sky-500/10",
  ASSIGNED_DEPT: "border-amber-500 text-amber-400 bg-amber-500/10",
  ASSIGNED_WORKER: "border-orange-500 text-orange-400 bg-orange-500/10",
  WORK_STARTED: "border-indigo-500 text-indigo-400 bg-indigo-500/10",
  WORK_COMPLETED: "border-purple-500 text-purple-400 bg-purple-500/10",
  AI_VERIFICATION: "border-teal-400 text-teal-300 bg-teal-500/10",
  DEPT_VERIFIED: "border-teal-500 text-teal-400 bg-teal-500/10",
  ADMIN_APPROVED: "border-emerald-500 text-emerald-400 bg-emerald-500/10",
  RESOLVED: "border-green-500 text-green-400 bg-green-500/10",
  DEPT_REJECTED: "border-rose-500 text-rose-400 bg-rose-500/10",
  REOPENED: "border-red-500 text-red-400 bg-red-500/10"
};

function renderVerticalTimeline(timelineEvents, containerId = "complaint-timeline-container") {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!timelineEvents || timelineEvents.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-400 py-4 text-center">No timeline events recorded yet.</div>`;
    return;
  }

  let html = `
    <div class="relative pl-8 space-y-6 before:content-[''] before:absolute before:top-2 before:bottom-2 before:left-3.5 before:w-0.5 before:bg-slate-700">
  `;

  timelineEvents.forEach((evt, idx) => {
    const icon = STAGE_ICONS[evt.stage] || "fa-circle-dot";
    const colorClass = STAGE_COLORS[evt.stage] || "border-slate-500 text-slate-300 bg-slate-800";
    const formattedTime = new Date(evt.timestamp).toLocaleString("en-IN", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
    });

    html += `
      <div class="relative group">
        <!-- Dot / Icon -->
        <div class="absolute -left-8 top-0.5 w-7 h-7 rounded-full border-2 ${colorClass} flex items-center justify-center text-xs shadow-md z-10">
          <i class="fa-solid ${icon}"></i>
        </div>
        
        <!-- Content Card -->
        <div class="glass-card p-3 rounded-lg border border-slate-700/60 hover:border-slate-600 transition-all">
          <div class="flex items-center justify-between gap-2 mb-1">
            <h4 class="text-xs font-bold text-slate-100">${evt.title}</h4>
            <span class="text-[11px] font-mono text-slate-400 whitespace-nowrap">${formattedTime}</span>
          </div>
          
          ${evt.description ? `<p class="text-xs text-slate-300 mb-2 leading-relaxed">${evt.description}</p>` : ''}
          
          <div class="flex items-center space-x-2 text-[10px]">
            <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-semibold uppercase">
              ${evt.actor_role}
            </span>
            <span class="text-slate-400 font-medium">${evt.actor_name}</span>
          </div>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}
