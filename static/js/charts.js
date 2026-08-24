// Civic Analytics Chart Visualizer (Chart.js wrapper)

let deptChart = null;
let categoryChart = null;
let severityChart = null;
let trendChart = null;

async function renderAdminCharts() {
  try {
    const token = localStorage.getItem("civic_token");
    const res = await fetch("/api/analytics/admin/charts", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) return;
    const data = await res.json();

    // 1. Department Distribution Chart
    const deptCtx = document.getElementById("chart-by-dept");
    if (deptCtx) {
      if (deptChart) deptChart.destroy();
      const labels = data.by_department.map(d => d.label.replace(" Department", ""));
      const values = data.by_department.map(d => d.value);

      deptChart = new Chart(deptCtx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Complaints Assigned',
            data: values,
            backgroundColor: 'rgba(59, 130, 246, 0.75)',
            borderColor: '#3b82f6',
            borderWidth: 1,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#94a3b8' } },
            x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } }
          }
        }
      });
    }

    // 2. Defect Category Doughnut
    const catCtx = document.getElementById("chart-by-category");
    if (catCtx) {
      if (categoryChart) categoryChart.destroy();
      const labels = data.by_category.map(c => c.label);
      const values = data.by_category.map(c => c.value);

      categoryChart = new Chart(catCtx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: values,
            backgroundColor: [
              '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
              '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'
            ],
            borderColor: '#0f172a',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right', labels: { color: '#cbd5e1', boxWidth: 12, font: { size: 11 } } }
          }
        }
      });
    }

    // 3. Severity Breakdown Chart
    const sevCtx = document.getElementById("chart-by-severity");
    if (sevCtx) {
      if (severityChart) severityChart.destroy();
      const labels = data.by_severity.map(s => s.label);
      const values = data.by_severity.map(s => s.value);
      const colors = labels.map(l => {
        if (l === 'CRITICAL') return '#ef4444';
        if (l === 'HIGH') return '#f97316';
        if (l === 'MEDIUM') return '#f59e0b';
        return '#3b82f6';
      });

      severityChart = new Chart(sevCtx, {
        type: 'polarArea',
        data: {
          labels: labels,
          datasets: [{
            data: values,
            backgroundColor: colors.map(c => c + 'aa'),
            borderColor: colors,
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { color: '#cbd5e1', font: { size: 11 } } } },
          scales: { r: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { display: false } } }
        }
      });
    }

    // 4. Weekly Volume Trend Line Chart
    const trendCtx = document.getElementById("chart-trend");
    if (trendCtx) {
      if (trendChart) trendChart.destroy();
      const labels = data.weekly_trend.map(t => t.label);
      const values = data.weekly_trend.map(t => t.value);

      trendChart = new Chart(trendCtx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'New Reports',
            data: values,
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.15)',
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#38bdf8',
            pointRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#94a3b8' } },
            x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
          }
        }
      });
    }

  } catch (err) {
    console.error("Failed to render admin charts:", err);
  }
}
