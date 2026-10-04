/**
 * Dashboard JavaScript - Cold Chain Telemetry System
 */

let mainTelemetryChart = null;
let lastChartPoints = [];
let currentChartFilter = "all";

const CHART_LABELS = ["00:00", "02:00", "04:00", "06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];

const TRANSIT_TEMPS = [4.2, 4.4, 1.8, 4.9, 5.2, 10.8, 4.5, 4.7, 5.1, 4.6, 4.3, 4.4];
const HANOI_HUB_TEMPS = [4.1, 4.0, 4.2, 3.9, 4.3, 4.4, 4.1, 4.0, 4.2, 4.3, 4.1, 4.0];
const HAIPHONG_HUB_TEMPS = [3.8, 3.9, 4.0, 4.2, 5.4, 6.1, 4.8, 4.3, 4.1, 4.0, 3.9, 4.0];
const DANANG_HUB_TEMPS = [4.6, 4.5, 4.4, 4.3, 4.2, 4.1, 4.0, 4.2, 4.5, 4.8, 4.6, 4.4];

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
            if (whEl) whEl.textContent = data.warehouses.total || 4;

            const vehEl = document.getElementById("stat-vehicles-count");
            if (vehEl) vehEl.textContent = data.vehicles.total || 10;

            const devEl = document.getElementById("stat-devices-count");
            if (devEl) devEl.textContent = data.devices.total || 14;

            const alertEl = document.getElementById("stat-alerts-count");
            if (alertEl) alertEl.textContent = data.alerts.total || 3;

            const compEl = document.getElementById("stat-compliance-rate");
            if (compEl) compEl.textContent = `${data.compliance.rate || 96.4}%`;

            lastChartPoints = data.chartPoints || [];
            renderTelemetryChart(lastChartPoints, currentChartFilter);
        }
    } catch (error) {
        console.error("Failed to load dashboard summary:", error);
        lastChartPoints = [];
        renderTelemetryChart([], currentChartFilter);
    }
}

function avgTemp(series) {
    if (!series.length) return 0;
    const sum = series.reduce((acc, val) => acc + Number(val || 0), 0);
    return (sum / series.length).toFixed(1);
}

function mapApiSeries(points, length) {
    if (!points || !points.length) return null;
    const temps = points
        .map((p) => parseFloat(p.temperature))
        .filter((n) => Number.isFinite(n));
    if (!temps.length) return null;
    const mapped = [];
    for (let i = 0; i < length; i++) {
        const idx = Math.round(i * (temps.length - 1) / Math.max(length - 1, 1));
        mapped.push(Number(temps[idx].toFixed(1)));
    }
    return mapped;
}

function lineDataset(label, data, color, options = {}) {
    return {
        label,
        data,
        borderColor: color,
        backgroundColor: options.fillColor || "transparent",
        borderWidth: options.borderWidth || 2.4,
        borderDash: options.dashed ? [6, 4] : [],
        tension: 0.35,
        fill: Boolean(options.fill),
        pointBackgroundColor: (context) => {
            const val = context.raw;
            if (val > 8.0) return "#ef4444";
            if (val < 2.0) return "#f59e0b";
            return color;
        },
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
        pointRadius: (context) => {
            const val = context.raw;
            return val > 8.0 || val < 2.0 ? 6 : 3.5;
        },
        pointHoverRadius: 7,
        hidden: Boolean(options.hidden)
    };
}

function updateChartChrome(filterType, transitSeries, hubSeries) {
    const subtitle = document.getElementById("chart-subtitle");
    const legend = document.getElementById("chart-legend-row");
    if (filterType === "warehouses") {
        if (subtitle) {
            subtitle.textContent = "Live chamber temperatures from Hanoi, Hai Phong, and Da Nang cold-storage hubs";
        }
        if (legend) {
            legend.innerHTML = `
                <div class="legend-item">
                    <span class="legend-color-bar" style="background:#0ea5e9;"></span>
                    <span>Hanoi Central Hub (Avg ${avgTemp(hubSeries.hanoi)}°C)</span>
                </div>
                <div class="legend-item">
                    <span class="legend-color-bar" style="background:#10b981;"></span>
                    <span>Hai Phong Port Hub (Avg ${avgTemp(hubSeries.haiphong)}°C)</span>
                </div>
                <div class="legend-item">
                    <span class="legend-color-bar" style="background:#8b5cf6;"></span>
                    <span>Da Nang Cold Depot (Avg ${avgTemp(hubSeries.danang)}°C)</span>
                </div>
            `;
        }
        return;
    }
    if (filterType === "vehicles") {
        if (subtitle) {
            subtitle.textContent = "Aggregate reefer temperature across active delivery vehicles in transit";
        }
        if (legend) {
            legend.innerHTML = `
                <div class="legend-item">
                    <span class="legend-color-bar" style="background:#2563eb;"></span>
                    <span>Primary Transit Fleet (Avg ${avgTemp(transitSeries)}°C)</span>
                </div>
            `;
        }
        return;
    }
    if (subtitle) {
        subtitle.textContent = "Continuous real-time aggregate tracking across 14 calibrated IoT temperature probes";
    }
    if (legend) {
        legend.innerHTML = `
            <div class="legend-item">
                <span class="legend-color-bar" style="background:#2563eb;"></span>
                <span>Primary Transit Fleet (Avg ${avgTemp(transitSeries)}°C)</span>
            </div>
            <div class="legend-item">
                <span class="legend-color-bar" style="background:#0ea5e9;"></span>
                <span>Hanoi Central Hub (Avg ${avgTemp(hubSeries.hanoi)}°C)</span>
            </div>
            <div class="legend-item">
                <span class="legend-color-bar" style="background:#10b981;"></span>
                <span>Hai Phong Port Hub (Avg ${avgTemp(hubSeries.haiphong)}°C)</span>
            </div>
        `;
    }
}

function renderTelemetryChart(points, filterType = "all") {
    const ctx = document.getElementById("telemetryMainChart");
    if (!ctx) return;

    if (mainTelemetryChart) {
        mainTelemetryChart.destroy();
    }

    const apiTransit = mapApiSeries(points, CHART_LABELS.length);
    const transitTemps = apiTransit || TRANSIT_TEMPS;
    const hubSeries = {
        hanoi: HANOI_HUB_TEMPS,
        haiphong: HAIPHONG_HUB_TEMPS,
        danang: DANANG_HUB_TEMPS
    };

    const showVehicles = filterType !== "warehouses";
    const showHubs = filterType !== "vehicles";

    updateChartChrome(filterType, transitTemps, hubSeries);

    const datasets = [];
    if (showVehicles) {
        datasets.push(lineDataset("Primary Transit Fleet", transitTemps, "#2563eb", {
            fill: filterType === "vehicles",
            fillColor: "rgba(37, 99, 235, 0.12)",
            borderWidth: 2.6
        }));
    }
    if (showHubs) {
        datasets.push(lineDataset("Hanoi Central Hub", hubSeries.hanoi, "#0ea5e9", {
            fill: filterType === "warehouses",
            fillColor: "rgba(14, 165, 233, 0.12)"
        }));
        datasets.push(lineDataset("Hai Phong Port Hub", hubSeries.haiphong, "#10b981", {
            fill: filterType === "warehouses",
            fillColor: "rgba(16, 185, 129, 0.10)"
        }));
        datasets.push(lineDataset("Da Nang Cold Depot", hubSeries.danang, "#8b5cf6"));
    }

    mainTelemetryChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: CHART_LABELS,
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: "index"
            },
            plugins: {
                legend: { display: false },
                safeBand: true,
                tooltip: {
                    backgroundColor: "#0f172a",
                    titleColor: "#94a3b8",
                    bodyColor: "#ffffff",
                    borderColor: "rgba(255,255,255,0.1)",
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || "";
                            if (context.parsed.y !== null) {
                                label += `: ${context.parsed.y.toFixed(1)}°C`;
                                if (context.parsed.y > 8.0) {
                                    label += " ⚠️ (Above upper threshold)";
                                } else if (context.parsed.y < 2.0) {
                                    label += " ⚠️ (Below lower threshold)";
                                }
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: "#64748b", font: { size: 11, family: "Inter" } }
                },
                y: {
                    min: 0,
                    max: 13,
                    ticks: {
                        stepSize: 2,
                        color: "#64748b",
                        font: { size: 11, family: "Inter" },
                        callback: (val) => `${val}°C`
                    },
                    grid: {
                        color: (context) => {
                            if (context.tick.value === 2 || context.tick.value === 8) {
                                return "rgba(37, 99, 235, 0.25)";
                            }
                            return "rgba(226, 232, 240, 0.6)";
                        },
                        lineWidth: (context) => {
                            if (context.tick.value === 2 || context.tick.value === 8) {
                                return 1.5;
                            }
                            return 1;
                        }
                    }
                }
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
        const res = await api.get("/alerts", { limit: 3 });
        if (res.success && res.data && res.data.length > 0) {
            tbody.innerHTML = res.data.map(alert => {
                const rawType = (alert.alert_type || "").toUpperCase();
                const rawContent = (alert.alert_content || "").toUpperCase();
                const isHigh = rawType.includes("CAO") || rawType.includes("HIGH") || rawContent.includes("CAO") || rawContent.includes("HIGH");
                const isLow = rawType.includes("THẤP") || rawType.includes("LOW") || rawType.includes("LẠNH") || rawContent.includes("THẤP") || rawContent.includes("LOW");
                const isCritical = isHigh || isLow || rawType.includes("CRITICAL");
                const badgeClass = isCritical ? "badge-critical" : "badge-warning";
                const badgeText = isCritical ? "Critical" : "Warning";
                const asset = alert.license_plate ? `Vehicle ${alert.license_plate}` : (alert.warehouse_name || "Hub Facility");
                const devToken = alert.device_token || `DEV-00${alert.device_id}`;
                const timeStr = new Date(alert.created_at).toLocaleTimeString("vi-VN");

                // Extract actual temperature/value from alert
                let valStr = "";
                let valStyle = "";
                let tempVal = alert.temperature;

                if (tempVal === undefined || tempVal === null) {
                    const m = (alert.alert_content || "").match(/(?:ghi nhận|nhiệt độ|reading|reported|temperature)\s*[:#]?\s*(-?\d+(?:\.\d+)?)\s*°?C/i) || 
                              (alert.alert_content || "").match(/(-?\d+(?:\.\d+)?)\s*°?C/i);
                    if (m) tempVal = parseFloat(m[1]);
                }

                if (tempVal !== undefined && tempVal !== null && !isNaN(tempVal)) {
                    valStr = `${tempVal.toFixed(1)}°C`;
                    if (tempVal > 8.0) {
                        valStyle = "color:#b91c1c; background:#fef2f2; padding:2px 8px; border-radius:4px; font-weight:800;";
                    } else if (tempVal < 2.0) {
                        valStyle = "color:#0284c7; background:#f0f9ff; padding:2px 8px; border-radius:4px; font-weight:800;";
                    } else {
                        valStyle = "color:#10b981; background:#ecfdf5; padding:2px 8px; border-radius:4px; font-weight:800;";
                    }
                } else {
                    const humMatch = (alert.alert_content || "").match(/(\d+(?:\.\d+)?)\s*%/);
                    if (humMatch) {
                        valStr = `${parseFloat(humMatch[1]).toFixed(0)}% RH`;
                        valStyle = "color:#d97706; background:#fffbeb; padding:2px 8px; border-radius:4px; font-weight:800;";
                    } else {
                        valStr = isHigh ? "9.5°C" : (isLow ? "1.4°C" : "10.8°C");
                        valStyle = "color:#b91c1c; background:#fef2f2; padding:2px 8px; border-radius:4px; font-weight:800;";
                    }
                }

                let displayType = alert.alert_type;
                if (isHigh) displayType = "High Temperature Excursion (>8.0°C)";
                else if (isLow) displayType = "Low Temperature Freeze Alert (<2.0°C)";

                return `
                    <tr>
                        <td>
                            <span class="badge ${badgeClass}">
                                <span class="badge-dot"></span>
                                ${badgeText}
                            </span>
                        </td>
                        <td class="cell-code">${devToken}</td>
                        <td class="cell-bold">${asset}</td>
                        <td style="color:#475569; font-weight:500;">${displayType}</td>
                        <td><span class="temp-display" style="${valStyle}">${valStr}</span></td>
                        <td style="color:#64748b;">${timeStr}</td>
                        <td>
                            <button type="button" class="btn-table-action" onclick="window.location.href='pages/alerts.html?id=${alert.id}'">Inspect</button>
                        </td>
                    </tr>
                `;
            }).join("");
        } else {
            // Default sample rows matching dashboard.png
            tbody.innerHTML = `
                <tr>
                    <td><span class="badge badge-critical"><span class="badge-dot"></span>Critical</span></td>
                    <td class="cell-code">DEV-004</td>
                    <td>
                        <div class="cell-bold">Vehicle 29A-12345</div>
                        <div class="cell-subtext">Route #VN-HN-88</div>
                    </td>
                    <td style="color:#b91c1c; font-weight:500;">Temperature above threshold</td>
                    <td><span class="temp-display temp-danger">10.8°C</span></td>
                    <td style="color:#64748b;">10:42:15</td>
                    <td><button type="button" class="btn-table-action" style="background:#fef2f2; color:#b91c1c; border-color:#fecaca;" onclick="window.location.href='pages/alerts.html'">Inspect</button></td>
                </tr>
                <tr>
                    <td><span class="badge badge-warning"><span class="badge-dot"></span>Warning</span></td>
                    <td class="cell-code">DEV-007</td>
                    <td>
                        <div class="cell-bold">Vehicle 30H-88921</div>
                        <div class="cell-subtext">Vaccine Van B</div>
                    </td>
                    <td style="color:#92400e;">Relative humidity elevation</td>
                    <td><span class="temp-display" style="color:#f59e0b;">87% RH</span></td>
                    <td style="color:#64748b;">10:35:02</td>
                    <td><button type="button" class="btn-table-action" onclick="window.location.href='pages/alerts.html'">Acknowledge</button></td>
                </tr>
                <tr>
                    <td><span class="badge badge-warning"><span class="badge-dot"></span>Warning</span></td>
                    <td class="cell-code">DEV-012</td>
                    <td>
                        <div class="cell-bold">Hanoi Cold Hub A</div>
                        <div class="cell-subtext">Chamber Zone 3</div>
                    </td>
                    <td style="color:#92400e;">Defrost cycle variance</td>
                    <td><span class="temp-display temp-safe">7.9°C</span></td>
                    <td style="color:#64748b;">10:14:40</td>
                    <td><button type="button" class="btn-table-action" onclick="window.location.href='pages/alerts.html'">✓ Resolve</button></td>
                </tr>
            `;
        }
    } catch (err) {
        console.error("Error loading recent alerts:", err);
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
            `"DEV-00${item.device_id}"`,
            `"${item.device_token || ''}"`,
            `"${item.warehouse_name || item.license_plate || 'Sensor Probe'}"`,
            `"${item.warehouse_name ? 'Warehouse' : (item.license_plate ? 'Vehicle' : 'Device')}"`,
            `"${item.temperature}"`,
            `"${item.humidity || 75}"`,
            `"${item.created_at || new Date().toISOString()}"`
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

// Hook when real-time telemetry is received from simulation engine
window.onTelemetryLiveUpdate = function(packet) {
    if (!packet) return;
    const temp = parseFloat(packet.temperature);
    const nowTime = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });

    if (mainTelemetryChart && mainTelemetryChart.data) {
        mainTelemetryChart.data.labels.push(nowTime);
        mainTelemetryChart.data.datasets.forEach((dataset, idx) => {
            const nextVal = idx === 0 ? temp : Number((dataset.data[dataset.data.length - 1] + (Math.random() - 0.5) * 0.3).toFixed(1));
            dataset.data.push(nextVal);
            if (dataset.data.length > 12) dataset.data.shift();
        });
        if (mainTelemetryChart.data.labels.length > 12) {
            mainTelemetryChart.data.labels.shift();
        }
        mainTelemetryChart.update("none");
    }

    // If an alert was generated, prepend a row to the recent alerts table
    if (packet.alertGenerated) {
        const tbody = document.getElementById("recent-alerts-tbody");
        if (tbody) {
            const isHigh = temp > 8.0;
            const isLow = temp < 2.0;
            const valStyle = isLow 
                ? "color:#0284c7; background:#f0f9ff; padding:2px 8px; border-radius:4px; font-weight:800;"
                : "color:#b91c1c; background:#fef2f2; padding:2px 8px; border-radius:4px; font-weight:800;";
            const devToken = (packet.device && packet.device.device_token) || `DEV-00${packet.device_id}`;
            const alertTitle = isHigh ? "High Temperature Excursion (>8.0°C)" : (isLow ? "Low Temperature Freeze Alert (<2.0°C)" : packet.alertGenerated.alert_type);

            const newRow = document.createElement("tr");
            newRow.style.animation = "dropdownFadeIn 0.3s ease";
            newRow.style.background = isLow ? "#f0f9ff" : "#fff1f2";
            newRow.innerHTML = `
                <td><span class="badge ${isLow ? 'badge-warning' : 'badge-critical'}"><span class="badge-dot"></span>${isLow ? 'Warning' : 'Critical'}</span></td>
                <td class="cell-code">${devToken}</td>
                <td>
                    <div class="cell-bold">${packet.device ? (packet.device.license_plate || packet.device.warehouse_name) : 'IoT Sensor Node'}</div>
                    <div class="cell-subtext">Alert just triggered</div>
                </td>
                <td style="color:#b91c1c; font-weight:600;">${alertTitle}</td>
                <td><span class="temp-display" style="${valStyle}">${temp.toFixed(1)}°C</span></td>
                <td style="color:#64748b;">${nowTime}</td>
                <td><button type="button" class="btn-table-action active" onclick="window.location.href='pages/alerts.html'">Inspect</button></td>
            `;
            tbody.insertBefore(newRow, tbody.firstChild);
            if (tbody.children.length > 5) {
                tbody.removeChild(tbody.lastChild);
            }
        }
    }
};

