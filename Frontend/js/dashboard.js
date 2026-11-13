/**
 * Dashboard JavaScript - Cold Chain Telemetry System
 */

let mainTelemetryChart = null;
let lastChartPoints = [];
let currentChartFilter = "all";

const SAFE_BAND_PLUGIN = {
    id: "safeBand",
    beforeDatasetsDraw(chart) {
        const yScale = chart.scales.y;
        const { ctx, chartArea } = chart;
        if (!chartArea || !yScale) return;
        const y8 = yScale.getPixelForValue(8);
        const y2 = yScale.getPixelForValue(2);
        ctx.save();
        ctx.fillStyle = "rgba(37, 99, 235, 0.08)";
        ctx.fillRect(chartArea.left, y8, chartArea.right - chartArea.left, y2 - y8);
        ctx.restore();
    }
};

document.addEventListener("DOMContentLoaded", async () => {
    await loadDashboardSummary();
    await loadRecentAlerts();
    initChartFilters();

    const refreshBtn = document.getElementById("refresh-dashboard-btn");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", async () => {
            refreshBtn.disabled = true;
            await loadDashboardSummary();
            await loadRecentAlerts();
            showToast("Telemetry data refreshed successfully!", "success");
            setTimeout(() => { refreshBtn.disabled = false; }, 1000);
        });
    }
});

async function loadDashboardSummary() {
    try {
        const res = await api.get("/data/summary");
        if (res.success && res.data) {
            const data = res.data;

            // Stat Cards
            const whEl = document.getElementById("stat-warehouses-count");
            if (whEl) whEl.textContent = data.warehouses.total ?? 0;

            const vehEl = document.getElementById("stat-vehicles-count");
            if (vehEl) vehEl.textContent = data.vehicles.total ?? 0;

            const devEl = document.getElementById("stat-devices-count");
            if (devEl) devEl.textContent = data.devices.total ?? 0;

            const alertEl = document.getElementById("stat-alerts-count");
            if (alertEl) alertEl.textContent = data.alerts.total ?? 0;

            const compEl = document.getElementById("stat-compliance-rate");
            if (compEl) compEl.textContent = data.compliance.rate === null ? "—" : `${data.compliance.rate}%`;

            lastChartPoints = data.chartPoints || [];
            renderTelemetryChart(lastChartPoints, currentChartFilter);
        }
    } catch (error) {
        console.error("Failed to load dashboard summary:", error);
        lastChartPoints = [];
        renderTelemetryChart([], currentChartFilter);
    }
}

function renderTelemetryChart(points, filterType = "all") {
    const canvas = document.getElementById("telemetryMainChart");
    if (!canvas) return;
    if (mainTelemetryChart) mainTelemetryChart.destroy();

    const filtered = (points || []).filter((point) => filterType === "all" || point.entity_type === (filterType === "vehicles" ? "vehicle" : "warehouse"));
    const labels = filtered.map((point) => new Date(point.created_at).toLocaleString());
    const entities = [...new Set(filtered.map((point) => point.entity_name))];
    const colors = ["#2563eb", "#0ea5e9", "#10b981", "#8b5cf6", "#f59e0b"];
    const datasets = entities.map((name, index) => ({
        label: name,
        data: filtered.map((point) => point.entity_name === name ? Number(point.temperature) : null),
        borderColor: colors[index % colors.length],
        backgroundColor: "transparent",
        borderWidth: 2,
        tension: 0.2,
        spanGaps: false,
        pointRadius: 3
    }));
    const subtitle = document.getElementById("chart-subtitle");
    if (subtitle) subtitle.textContent = filtered.length ? "Telemetry readings persisted in PostgreSQL" : "No telemetry readings are available for this filter.";
    const legend = document.getElementById("chart-legend-row");
    if (legend) legend.innerHTML = entities.map((name, index) => `<div class="legend-item"><span class="legend-color-bar" style="background:${colors[index % colors.length]};"></span><span>${name}</span></div>`).join("");

    mainTelemetryChart = new Chart(canvas, {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: "index" },
            plugins: {
                legend: { display: false },
                safeBand: true,
                tooltip: {
                    callbacks: {
                        label(context) {
                            const value = context.parsed.y;
                            return value === null ? "" : `${context.dataset.label}: ${value.toFixed(1)}°C`;
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: "#64748b", maxTicksLimit: 8 } },
                y: { suggestedMin: 0, suggestedMax: 12, ticks: { callback: (value) => `${value}°C` } }
            }
        },
        plugins: [SAFE_BAND_PLUGIN]
    });
}
function initChartFilters() {
    const filterButtons = document.querySelectorAll(".chart-controls-area .pill-btn");
    filterButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            filterButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentChartFilter = btn.getAttribute("data-filter") || "all";
            renderTelemetryChart(lastChartPoints, currentChartFilter);
        });
    });
}

async function loadRecentAlerts() {
    const tbody = document.getElementById("recent-alerts-tbody");
    if (!tbody) return;
    try {
        const res = await api.get("/alerts", { limit: 5 });
        const alerts = res.success && Array.isArray(res.data) ? res.data : [];
        if (!alerts.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:#64748b;">No alerts recorded in the database.</td></tr>';
            return;
        }
        tbody.innerHTML = alerts.map((alert) => {
            const rawType = String(alert.alert_type || "");
            const high = /high|cao/i.test(rawType);
            const low = /low|thấp/i.test(rawType);
            const severity = high || low ? "Critical" : "Warning";
            const asset = alert.license_plate ? `Vehicle ${alert.license_plate}` : (alert.warehouse_name || alert.device_token || `Device #${alert.device_id}`);
            const value = alert.temperature === null || alert.temperature === undefined ? "—" : `${Number(alert.temperature).toFixed(1)}°C`;
            return `<tr><td><span class="badge ${severity === "Critical" ? "badge-critical" : "badge-warning"}"><span class="badge-dot"></span>${severity}</span></td><td class="cell-code">${alert.device_token || `#${alert.device_id}`}</td><td class="cell-bold">${asset}</td><td>${rawType}</td><td>${value}</td><td>${new Date(alert.created_at).toLocaleString()}</td><td><button type="button" class="btn-table-action" onclick="window.location.href='pages/alerts.html?id=${alert.id}'">Inspect</button></td></tr>`;
        }).join("");
    } catch (error) {
        console.error("Error loading recent alerts:", error);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:#b91c1c;">Unable to load alerts from the database.</td></tr>';
    }
}
// Export system telemetry logs to standard CSV format
window.exportSystemTelemetryLog = async function() {
    if (window.Roles && !Roles.guard("export", "Staff accounts cannot export system logs.")) return;
    showToast("Generating system-wide telemetry CSV dataset...", "info");
    try {
        const res = await api.get("/data", { limit: 100 });
        let list = [];
        if (res.success && res.data && res.data.list) {
            list = res.data.list;
        }

        const headers = ["ID", "Device ID", "Token", "Entity", "Type", "Temperature (C)", "Humidity (%)", "Timestamp UTC+7"];
        const rows = list.map(item => [
            `"${item.id}"`,
            `"${item.device_token || item.device_id}"`,
            `"${item.device_token || ''}"`,
            `"${item.warehouse_name || item.license_plate || item.device_token || ''}"`,
            `"${item.warehouse_name ? 'Warehouse' : (item.license_plate ? 'Vehicle' : 'Device')}"`,
            `"${item.temperature}"`,
            `"${item.humidity == null ? '' : item.humidity}"`,
            `"${item.created_at || ''}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const link = document.createElement("a");
        link.href = encodeURI(csvContent);
        link.download = `coldchain_telemetry_system_log_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        showToast("System log exported successfully!", "success");
    } catch (e) {
        console.error("Export error:", e);
        showToast("Error exporting system log", "error");
    }
};

// Listen for time range filter changes (Last 24h, 7 Days, 30 Days)
document.addEventListener("DOMContentLoaded", () => {
    const rangeSelect = document.getElementById("time-range-select");
    if (rangeSelect) {
        rangeSelect.addEventListener("change", (e) => {
            const val = e.target.value;
            showToast(`Analyzing telemetry window: ${val}`, "info");
            loadDashboardSummary();
        });
    }
});

// Refresh dashboard only after an API-confirmed telemetry write.
window.onTelemetryLiveUpdate = async function(packet) {
    if (!packet || !packet.persisted) return;
    await loadDashboardSummary();
    if (packet.alertGenerated) await loadRecentAlerts();
};
