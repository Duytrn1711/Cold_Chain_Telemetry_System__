/**
 * Telemetry Data Stream Controller - Cold Chain Telemetry System
 * Manages real-time sensor streams, packet inspector, time-series telemetry charts & filtering
 */

let allTelemetry = [];
let filteredTelemetry = [];
let currentPage = 1;
const pageSize = 20;

let devicesList = [];
let warehousesList = [];
let vehiclesList = [];

let streamChart = null;
let pieChart = null;
let isStreamingActive = true;
let searchDebounceTimer = null;
const knownTelemetryIds = new Set();
let telemetryPollingSeeded = false;
let telemetryPollRunning = false;
let telemetryPollTimer = null;
const activeExcursionDevices = new Set();

document.addEventListener("DOMContentLoaded", async () => {
    await initTelemetryPage();
    wireLiveTelemetryListener();
});

/**
 * Initialize telemetry page data and filters
 */
async function initTelemetryPage() {
    try {
        await Promise.allSettled([
            fetchDevices(),
            fetchWarehouses(),
            fetchVehicles(),
            loadTelemetryList(),
            loadTelemetrySummary()
        ]);
    } catch (err) {
        console.warn("Init telemetry page warning:", err);
    }

    // Support query parameters (e.g. data.html?search=DEV-004 or data.html?status=HIGH)
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get("search");
    const devParam = urlParams.get("device_id") || urlParams.get("device");
    const statusParam = urlParams.get("status");

    if (searchParam) {
        const searchInput = document.getElementById("telemetry-search-input");
        if (searchInput) searchInput.value = searchParam;
    }
    if (devParam) {
        const devSelect = document.getElementById("filter-device");
        if (devSelect) devSelect.value = devParam;
    }
    if (statusParam) {
        const statusSelect = document.getElementById("filter-status");
        if (statusSelect) statusSelect.value = statusParam;
    }
    if (searchParam || devParam || statusParam) {
        applyTelemetryFilters();
    }

    initCharts();
    startTelemetryPolling();
}

/**
 * Wire real-time packet listener from app-enhanced.js
 */
function wireLiveTelemetryListener() {
    window.onTelemetryLiveUpdate = (packet) => {
        if (!isStreamingActive) return;

        const newRow = formatRawPacket(packet);
        if (newRow.id !== undefined && newRow.id !== null && knownTelemetryIds.has(String(newRow.id))) return;
        rememberTelemetryId(newRow.id);
        allTelemetry.unshift(newRow);
        if (allTelemetry.length > 200) allTelemetry.pop();

        applyTelemetryFilters();
        updateTopStats(allTelemetry);
        pushToChart(newRow);
        notifyTelemetryExcursion(newRow);

        const lastSyncEl = document.getElementById("header-last-sync");
        if (lastSyncEl) {
            const now = new Date();
            lastSyncEl.textContent = `Updated: ${now.toLocaleTimeString()}`;
        }
    };
}

/**
 * Fetch devices for dropdowns
 */
async function fetchDevices() {
    try {
        const res = await api.get("/devices");
        if (res.success && Array.isArray(res.data)) {
            devicesList = res.data;
            populateDeviceDropdowns();
        }
    } catch (err) {
        console.warn("Could not fetch devices:", err);
        devicesList = [];
        populateDeviceDropdowns();
    }
}

/**
 * Fetch warehouses for dropdowns
 */
async function fetchWarehouses() {
    try {
        const res = await api.get("/warehouses");
        if (res.success && Array.isArray(res.data)) {
            warehousesList = res.data;
            populateWarehouseDropdown();
        }
    } catch (err) {
        console.warn("Could not fetch warehouses:", err);
        warehousesList = [];
        populateWarehouseDropdown();
    }
}

/**
 * Fetch vehicles for dropdowns
 */
async function fetchVehicles() {
    try {
        const res = await api.get("/vehicles");
        if (res.success && Array.isArray(res.data)) {
            vehiclesList = res.data;
            populateVehicleDropdown();
        }
    } catch (err) {
        console.warn("Could not fetch vehicles:", err);
        vehiclesList = [];
        populateVehicleDropdown();
    }
}

function populateDeviceDropdowns() {
    const filterSelect = document.getElementById("filter-device");
    const simSelect = document.getElementById("sim-device-select");
    const ingestSelect = document.getElementById("ingest-device-select");

    const optionsHtml = devicesList.map(d => `<option value="${d.id}">${d.device_token || `Device #${d.id}`}</option>`).join("");

    if (filterSelect) {
        filterSelect.innerHTML = `<option value="">All Devices (All Nodes)</option>` + optionsHtml;
    }
    if (simSelect) {
        simSelect.innerHTML = optionsHtml;
    }
    if (ingestSelect) {
        ingestSelect.innerHTML = optionsHtml;
    }
}

function populateWarehouseDropdown() {
    const filterSelect = document.getElementById("filter-warehouse");
    if (!filterSelect) return;
    filterSelect.innerHTML = `<option value="">All Warehouses</option>` +
        warehousesList.map(w => `<option value="${w.id}">${w.warehouse_name}</option>`).join("");
}

function populateVehicleDropdown() {
    const filterSelect = document.getElementById("filter-vehicle");
    if (!filterSelect) return;
    filterSelect.innerHTML = `<option value="">All Vehicles</option>` +
        vehiclesList.map(v => `<option value="${v.id}">${v.license_plate}</option>`).join("");
}

/**
 * Fetch telemetry list from /api/data
 */
async function loadTelemetryList() {
    try {
        const res = await api.get("/data", { limit: 100 });
        if (res.success && res.data && Array.isArray(res.data.list)) {
            allTelemetry = res.data.list.map(formatRawPacket);
            allTelemetry.forEach((row) => rememberTelemetryId(row.id));
            telemetryPollingSeeded = true;
        } else {
            allTelemetry = [];
        }
    } catch (err) {
        console.warn("Could not load telemetry list from server:", err);
        allTelemetry = [];
    }

    filteredTelemetry = [...allTelemetry];
    renderTelemetryTable();
    updateTopStats(allTelemetry);
}

/**
 * Format raw telemetry row from backend or live socket
 */
function formatRawPacket(row) {
    const temperature = row.temperature === null || row.temperature === undefined ? null : Number(row.temperature);
    const humidity = row.humidity === null || row.humidity === undefined ? null : Number(row.humidity);
    const deviceId = row.device_id ?? row.device?.id ?? null;
    const deviceToken = row.device_token || row.device?.device_token || "—";
    const warehouseName = row.warehouse_name || row.device?.warehouse_name;
    const licensePlate = row.license_plate || row.device?.license_plate;
    const entity = licensePlate ? `Vehicle ${licensePlate}` : (warehouseName || deviceToken);
    const status = temperature === null ? "UNKNOWN" : (temperature > 8 ? "HIGH" : (temperature < 2 ? "LOW" : (humidity !== null && humidity > 80 ? "WARNING" : "NORMAL")));
    return {
        id: row.id,
        device_id: deviceId,
        device_token: deviceToken,
        entity,
        isVehicle: Boolean(licensePlate),
        warehouse_id: row.warehouse_id ?? row.device?.warehouse_id ?? null,
        vehicle_id: row.vehicle_id ?? row.device?.vehicle_id ?? null,
        temperature,
        humidity,
        battery: null,
        rssi: null,
        latency: null,
        created_at_raw: row.created_at || null,
        created_at: row.created_at ? new Date(row.created_at).toLocaleString() : "—",
        status,
        raw: row
    };
}
async function loadTelemetrySummary() {
    try {
        const res = await api.get("/data/summary");
        if (res.success && res.data) {
            const c = res.data.compliance;
            if (c) {
                const rateEl = document.getElementById("stat-compliance-rate");
                if (rateEl) {
                    rateEl.innerHTML = `${c.rate}% <span style="font-size:12px; color:#10b981;">Target ≥99%</span>`;
                }
                const excEl = document.getElementById("stat-excursions-count");
                if (excEl) {
                    excEl.textContent = `${(c.high_excursions || 0) + (c.low_excursions || 0)}`;
                }
            }
            if (res.data.devices) {
                const devEl = document.getElementById("stat-active-nodes");
                if (devEl) {
                    devEl.textContent = `${res.data.devices.active ?? 0} / ${res.data.devices.total ?? 0}`;
                }
            }
        }
    } catch (err) {
        console.warn("Could not load summary metrics:", err);
    }
}

/**
 * Update top KPI metrics dynamically based on current list
 */
function updateTopStats(list) {
    if (!list || list.length === 0) {
        ["stat-compliance-rate", "stat-excursions-count", "stat-excursion-detail", "band-safe-val", "band-low-val", "band-high-val"].forEach((id) => {
            const element = document.getElementById(id);
            if (element) element.textContent = id === "stat-compliance-rate" ? "—" : "0";
        });
        if (pieChart) {
            pieChart.data.datasets[0].data = [0, 0, 0];
            pieChart.update();
        }
        return;
    }

    const total = list.length;
    const safe = list.filter(r => r.temperature >= 2.0 && r.temperature <= 8.0).length;
    const high = list.filter(r => r.temperature > 8.0).length;
    const low = list.filter(r => r.temperature < 2.0).length;
    const excursions = high + low;
    const measuredTotal = list.filter((row) => row.temperature !== null).length;
    const rate = measuredTotal ? ((safe / measuredTotal) * 100).toFixed(1) : null;

    const rateEl = document.getElementById("stat-compliance-rate");
    if (rateEl) rateEl.textContent = rate === null ? "—" : `${rate}%`;

    const excEl = document.getElementById("stat-excursions-count");
    if (excEl) excEl.textContent = excursions;

    const excDetail = document.getElementById("stat-excursion-detail");
    if (excDetail && measuredTotal > 0) {
        if (high > 0) {
            const firstHigh = list.find(r => r.temperature > 8.0);
            excDetail.textContent = `${firstHigh.entity} (${firstHigh.temperature.toFixed(1)}°C)`;
            excDetail.style.color = "#b91c1c";
        } else if (low > 0) {
            const firstLow = list.find(r => r.temperature < 2.0);
            excDetail.textContent = `${firstLow.entity} (${firstLow.temperature.toFixed(1)}°C)`;
            excDetail.style.color = "#2563eb";
        } else {
            excDetail.textContent = "All nodes within safe 2-8°C band";
            excDetail.style.color = "#10b981";
        }
    }

    // Update Band Distribution values
    const safeSpan = document.getElementById("band-safe-val");
    if (safeSpan) safeSpan.textContent = safe;
    const lowSpan = document.getElementById("band-low-val");
    if (lowSpan) lowSpan.textContent = low;
    const highSpan = document.getElementById("band-high-val");
    if (highSpan) highSpan.textContent = high;

    if (pieChart) {
        pieChart.data.datasets[0].data = [low, safe, high];
        pieChart.update();
    }
}

/**
 * Render telemetry table rows
 */
function renderTelemetryTable() {
    const tbody = document.getElementById("telemetry-stream-tbody");
    if (!tbody) return;

    if (filteredTelemetry.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align:center; padding:36px; color:#94a3b8;">
                    No telemetry records match the selected filters.
                </td>
            </tr>
        `;
        updatePaginationDisplay(0);
        return;
    }

    const startIndex = (currentPage - 1) * pageSize;
    const pageItems = filteredTelemetry.slice(startIndex, startIndex + pageSize);

    tbody.innerHTML = pageItems.map(row => {
        const tid = `TL-${row.id}`;
        const temp = row.temperature;
        const hum = row.humidity;
        const isHigh = temp > 8.0;
        const isLow = temp < 2.0;
        const isHumWarning = hum > 80;

        let statusBadge = temp === null ? "badge-neutral" : "badge-online";
        let statusText = temp === null ? "NO READING" : "NORMAL";
        let tempColor = "#0f172a";
        let tempPrefix = "";

        if (isHigh) {
            statusBadge = "badge-critical";
            statusText = "CRITICAL HIGH";
            tempColor = "#ef4444";
            tempPrefix = "▲ ";
        } else if (isLow) {
            statusBadge = "badge-warning";
            statusText = "CRITICAL LOW";
            tempColor = "#2563eb";
            tempPrefix = "▼ ";
        } else if (isHumWarning) {
            statusBadge = "badge-warning";
            statusText = "HUMIDITY WARN";
        }

        return `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:6px;">
                        ${isHigh ? '<span style="width:3px; height:18px; background:#ef4444; border-radius:2px;"></span>' : (isLow ? '<span style="width:3px; height:18px; background:#2563eb; border-radius:2px;"></span>' : '')}
                        <strong class="cell-bold">${tid}</strong>
                    </div>
                </td>
                <td>
                    <span class="cell-code" style="font-weight:600; color:#1e293b;">${row.device_token}</span>
                </td>
                <td>
                    <div style="display:flex; align-items:center; gap:6px; font-weight:600;">
                        <span>${row.isVehicle ? '🚚' : '🏢'}</span>
                        <span>${row.entity}</span>
                    </div>
                </td>
                <td>
                    <strong style="font-size:14px; color:${tempColor}; font-family:'JetBrains Mono',monospace;">
                        ${temp === null ? "—" : `${tempPrefix}${temp.toFixed(1)}°C`}
                    </strong>
                </td>
                <td>
                    <span style="${isHumWarning ? 'background:#fffbeb; color:#b45309; padding:2px 6px; border-radius:4px; font-weight:700;' : ''}">${hum === null ? "—" : `${hum}% RH`}</span>
                </td>
                <td>
                    <span style="color:#64748b;">Not recorded</span>
                </td>
                <td>
                    <div class="signal-indicator">
                        <div class="signal-bars">
                            <span class="signal-bar active" style="height:4px;"></span>
                            <span class="signal-bar active" style="height:7px;"></span>
                            <span class="signal-bar active" style="height:10px;"></span>
                            <span class="signal-bar" style="height:12px;"></span>
                        </div>
                        <span style="color:#64748b;">Not recorded</span>
                    </div>
                </td>
                <td style="font-size:12px; color:#64748b; font-family:'JetBrains Mono',monospace;">
                    ${row.created_at}
                </td>
                <td>
                    <span class="badge ${statusBadge}">${statusText}</span>
                </td>
                <td>
                    <button type="button" class="btn-table-action" style="font-weight:600; color:#2563eb; border-color:#bfdbfe;" onclick="inspectTelemetryPacket(${row.id})">
                        🔍 Inspect
                    </button>
                </td>
            </tr>
        `;
    }).join("");

    updatePaginationDisplay(filteredTelemetry.length);
}

/**
 * Filter telemetry records
 */
function applyTelemetryFilters() {
    const devVal = document.getElementById("filter-device") ? document.getElementById("filter-device").value : "";
    const whVal = document.getElementById("filter-warehouse") ? document.getElementById("filter-warehouse").value : "";
    const vehVal = document.getElementById("filter-vehicle") ? document.getElementById("filter-vehicle").value : "";
    const statusVal = document.getElementById("filter-status") ? document.getElementById("filter-status").value : "";
    const searchVal = document.getElementById("telemetry-search-input") ? document.getElementById("telemetry-search-input").value.trim().toLowerCase() : "";

    filteredTelemetry = allTelemetry.filter(row => {
        if (devVal && String(row.device_id) !== String(devVal)) return false;
        if (whVal && String(row.warehouse_id) !== String(whVal)) return false;
        if (vehVal && String(row.vehicle_id) !== String(vehVal)) return false;

        if (statusVal) {
            if (statusVal === "NORMAL" && row.status !== "NORMAL") return false;
            if (statusVal === "HIGH" && row.status !== "HIGH") return false;
            if (statusVal === "LOW" && row.status !== "LOW") return false;
            if (statusVal === "WARNING" && row.status !== "WARNING") return false;
        }

        if (searchVal) {
            const textMatch = 
                `tl-${row.id}`.includes(searchVal) ||
                row.device_token.toLowerCase().includes(searchVal) ||
                row.entity.toLowerCase().includes(searchVal) ||
                `${row.temperature}`.includes(searchVal);
            if (!textMatch) return false;
        }

        return true;
    });

    currentPage = 1;
    renderTelemetryTable();
}

function debounceFilter() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        applyTelemetryFilters();
    }, 250);
}

function resetTelemetryFilters() {
    if (document.getElementById("filter-device")) document.getElementById("filter-device").value = "";
    if (document.getElementById("filter-warehouse")) document.getElementById("filter-warehouse").value = "";
    if (document.getElementById("filter-vehicle")) document.getElementById("filter-vehicle").value = "";
    if (document.getElementById("filter-status")) document.getElementById("filter-status").value = "";
    if (document.getElementById("telemetry-search-input")) document.getElementById("telemetry-search-input").value = "";

    applyTelemetryFilters();
    showToast("Filters reset to default stream view", "info");
}

/**
 * Pagination Controls
 */
function updatePaginationDisplay(totalItems) {
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, totalItems);

    const infoEl = document.getElementById("pagination-info-text");
    if (infoEl) {
        infoEl.textContent = `Showing ${start} - ${end} of ${totalItems} readings`;
    }

    const prevBtn = document.getElementById("btn-prev-page");
    if (prevBtn) prevBtn.disabled = currentPage <= 1;

    const nextBtn = document.getElementById("btn-next-page");
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

    const pills = document.getElementById("pagination-page-pills");
    if (pills) {
        let html = "";
        for (let i = 1; i <= Math.min(totalPages, 5); i++) {
            html += `<button type="button" class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="goToTelemetryPage(${i})">${i}</button>`;
        }
        if (totalPages > 5) {
            html += `<span>...</span><button type="button" class="pagination-btn ${totalPages === currentPage ? 'active' : ''}" onclick="goToTelemetryPage(${totalPages})">${totalPages}</button>`;
        }
        pills.innerHTML = html;
    }
}

function changeTelemetryPage(delta) {
    const totalPages = Math.ceil(filteredTelemetry.length / pageSize) || 1;
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderTelemetryTable();
    }
}

function goToTelemetryPage(page) {
    currentPage = page;
    renderTelemetryTable();
}

/**
 * Toggle live telemetry streaming on/off
 */
function toggleTelemetryStreaming() {
    isStreamingActive = !isStreamingActive;
    const iconEl = document.getElementById("stream-toggle-icon");
    const textEl = document.getElementById("stream-toggle-text");
    const badgeEl = document.getElementById("badge-stream-state");

    if (isStreamingActive) {
        if (iconEl) iconEl.textContent = "🟢";
        if (textEl) textEl.textContent = "Stream: Active";
        if (badgeEl) {
            badgeEl.className = "badge badge-active";
            badgeEl.textContent = "● REALTIME STREAM";
        }
        showToast("Live telemetry stream resumed", "success");
    } else {
        if (iconEl) iconEl.textContent = "⏸️";
        if (textEl) textEl.textContent = "Stream: Paused";
        if (badgeEl) {
            badgeEl.className = "badge badge-warning";
            badgeEl.textContent = "⏸️ STREAM PAUSED";
        }
        showToast("Live telemetry stream paused", "info");
    }
}

/**
 * Packet Inspector Modal handler
 */
function inspectTelemetryPacket(packetId) {
    const item = allTelemetry.find(r => r.id === packetId);
    if (!item) {
        showToast("Packet data not found", "error");
        return;
    }

    if (typeof window.openPacketInspector === "function") {
        window.openPacketInspector({
            id: item.id,
            device_token: item.device_token,
            device_id: item.device_id,
            temperature: item.temperature,
            humidity: item.humidity,
            created_at: item.created_at,
            warehouse_name: !item.isVehicle ? item.entity : null,
            license_plate: item.isVehicle ? item.entity.replace("Vehicle ", "") : null
        });
    } else {
        showToast(`Packet #${item.id}: ${item.temperature}°C, ${item.humidity}% RH`, "info");
    }
}



/**
 * Manual Ingest Modal Helpers
 */
function openIngestModal() {
    const modal = document.getElementById("ingest-modal");
    if (modal) modal.classList.add("show");
}

function closeIngestModal() {
    const modal = document.getElementById("ingest-modal");
    if (modal) modal.classList.remove("show");
}

async function handleIngestSubmit(e) {
    e.preventDefault();
    const devId = document.getElementById("ingest-device-select").value;
    const temp = parseFloat(document.getElementById("ingest-temp").value);
    const humidityInput = document.getElementById("ingest-humidity").value.trim();
    const hum = humidityInput === "" ? null : parseFloat(humidityInput);
    if (!devId || !Number.isFinite(temp) || (hum !== null && !Number.isFinite(hum))) {
        showToast("Choose a device and enter valid measurements.", "warning");
        return;
    }

    const submitBtn = document.getElementById("btn-submit-ingest");
    if (submitBtn) submitBtn.disabled = true;

    try {
        await api.post("/data", {
            device_id: parseInt(devId, 10),
            temperature: temp,
            humidity: hum
        });

        showToast("Telemetry reading successfully logged to database!", "success");
        closeIngestModal();
        await loadTelemetryList();
    } catch (err) {
        showToast(err.message || "Failed to log telemetry reading", "error");
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

/**
 * Export Telemetry data to CSV
 */
function exportTelemetryData() {
    if (!filteredTelemetry || filteredTelemetry.length === 0) {
        showToast("No telemetry data to export!", "warning");
        return;
    }

    const headers = ["Telemetry ID", "Device Token", "Monitored Entity", "Temperature (C)", "Humidity (%)", "Timestamp", "Status"];
    const rows = filteredTelemetry.map(r => [
        `TL-${r.id}`,
        r.device_token,
        `"${r.entity.replace(/"/g, '""')}"`,
        r.temperature,
        r.humidity,
        r.created_at,
        r.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `coldchain_telemetry_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("✓ Telemetry dataset exported successfully (CSV)!", "success");
}

/**
 * Charts Initialization
 */
function initCharts() {
    initStreamChart();
    initPieChart();
}

function initStreamChart() {
    const canvas = document.getElementById("telemetryStreamChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const reversed = [...allTelemetry].slice(0, 16).reverse();
    const labels = reversed.map(telemetryTimeLabel);
    const tempData = reversed.map(r => r.temperature);

    streamChart = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Live Temperature (°C)",
                    data: tempData,
                    borderColor: "#2563eb",
                    backgroundColor: "rgba(37, 99, 235, 0.08)",
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.35,
                    pointBackgroundColor: tempData.map(t => t > 8.0 ? "#ef4444" : (t < 2.0 ? "#3b82f6" : "#2563eb")),
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: "Safe High Threshold (8.0°C)",
                    data: labels.map(() => 8.0),
                    borderColor: "rgba(239, 68, 68, 0.5)",
                    borderDash: [5, 5],
                    borderWidth: 1.5,
                    fill: false,
                    pointRadius: 0
                },
                {
                    label: "Safe Low Threshold (2.0°C)",
                    data: labels.map(() => 2.0),
                    borderColor: "rgba(59, 130, 246, 0.5)",
                    borderDash: [5, 5],
                    borderWidth: 1.5,
                    fill: false,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "top",
                    labels: {
                        boxWidth: 12,
                        font: { family: "'Inter', sans-serif", size: 11 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw}°C`
                    }
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 10,
                    ticks: {
                        callback: (v) => `${v}°C`
                    },
                    grid: {
                        color: "#f1f5f9"
                    }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
    updateStreamChartScale();
}

function initPieChart() {
    const canvas = document.getElementById("thermalBandsPieChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const safe = allTelemetry.filter(r => r.temperature !== null && r.temperature >= 2.0 && r.temperature <= 8.0).length;
    const low = allTelemetry.filter(r => r.temperature !== null && r.temperature < 2.0).length;
    const high = allTelemetry.filter(r => r.temperature !== null && r.temperature > 8.0).length;

    pieChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: ["Sub-zero (<2°C)", "Safe Band (2-8°C)", "Excursion (>8°C)"],
            datasets: [{
                data: [low, safe, high],
                backgroundColor: ["#3b82f6", "#10b981", "#ef4444"],
                borderWidth: 2,
                borderColor: "#ffffff"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "68%",
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function pushToChart(packet) {
    if (!streamChart) return;
    const label = telemetryTimeLabel(packet);
    streamChart.data.labels.push(label);
    streamChart.data.datasets[0].data.push(packet.temperature);
    streamChart.data.datasets[1].data.push(8.0);
    streamChart.data.datasets[2].data.push(2.0);

    if (streamChart.data.labels.length > 20) {
        streamChart.data.labels.shift();
        streamChart.data.datasets[0].data.shift();
        streamChart.data.datasets[1].data.shift();
        streamChart.data.datasets[2].data.shift();
    }

    updateStreamChartScale();
    streamChart.update();
}

function refreshTelemetryChart() {
    if (streamChart) {
        const reversed = [...allTelemetry].slice(0, 16).reverse();
        streamChart.data.labels = reversed.map(telemetryTimeLabel);
        streamChart.data.datasets[0].data = reversed.map(r => r.temperature);
        streamChart.data.datasets[1].data = reversed.map(() => 8.0);
        streamChart.data.datasets[2].data = reversed.map(() => 2.0);
        updateStreamChartScale();
        streamChart.update();
        showToast("Telemetry stream chart synchronized", "info");
    }
}

function telemetryTimeLabel(row) {
    const timestamp = row.created_at_raw || row.raw?.created_at;
    const date = timestamp ? new Date(timestamp) : new Date(row.created_at);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function updateStreamChartScale() {
    if (!streamChart) return;
    const values = streamChart.data.datasets[0].data.map(Number).filter(Number.isFinite);
    const minValue = Math.min(2, ...values);
    const maxValue = Math.max(8, ...values);
    const span = Math.max(maxValue - minValue, 6);
    const margin = Math.max(1, span * 0.12);
    const min = Math.floor((minValue - margin) / 2) * 2;
    const max = Math.ceil((maxValue + margin) / 2) * 2;
    streamChart.options.scales.y.min = min;
    streamChart.options.scales.y.max = max;
}

function rememberTelemetryId(id) {
    if (id !== undefined && id !== null) knownTelemetryIds.add(String(id));
}

function notifyTelemetryExcursion(row) {
    if (!Number.isFinite(row.temperature)) return;
    const key = String(row.device_id ?? row.device_token ?? "unknown");
    const outside = row.temperature < 2 || row.temperature > 8;
    if (outside && !activeExcursionDevices.has(key)) {
        activeExcursionDevices.add(key);
        const direction = row.temperature < 2 ? "thấp hơn 2°C" : "cao hơn 8°C";
        if (typeof showToast === "function") {
            showToast(`Cảnh báo nhiệt độ ${row.temperature}°C (${direction}) · ${row.device_token}`, "error");
        }
    } else if (!outside) {
        activeExcursionDevices.delete(key);
    }
}

function startTelemetryPolling() {
    if (telemetryPollTimer) window.clearInterval(telemetryPollTimer);
    telemetryPollTimer = window.setInterval(pollTelemetryFromDatabase, 3000);
}

async function pollTelemetryFromDatabase() {
    if (telemetryPollRunning || !isStreamingActive) return;
    telemetryPollRunning = true;
    try {
        const response = await api.get("/data", { limit: 100 });
        const rows = response.success && Array.isArray(response.data?.list) ? response.data.list : null;
        if (!rows) return;
        if (!telemetryPollingSeeded) {
            rows.forEach((row) => rememberTelemetryId(row.id));
            telemetryPollingSeeded = true;
            return;
        }
        const freshRows = rows.filter((row) => row.id !== undefined && row.id !== null && !knownTelemetryIds.has(String(row.id)));
        freshRows.reverse().forEach((raw) => {
            const row = formatRawPacket(raw);
            rememberTelemetryId(row.id);
            allTelemetry.unshift(row);
            if (allTelemetry.length > 200) allTelemetry.pop();
            pushToChart(row);
            notifyTelemetryExcursion(row);
        });
        if (freshRows.length) {
            filteredTelemetry = [...allTelemetry];
            applyTelemetryFilters();
            updateTopStats(allTelemetry);
            if (pieChart) {
                const safeCount = allTelemetry.filter((row) => row.temperature !== null && row.temperature >= 2 && row.temperature <= 8).length;
                const lowCount = allTelemetry.filter((row) => row.temperature !== null && row.temperature < 2).length;
                const highCount = allTelemetry.filter((row) => row.temperature !== null && row.temperature > 8).length;
                pieChart.data.datasets[0].data = [lowCount, safeCount, highCount];
                pieChart.update();
            }
            const lastSyncEl = document.getElementById("header-last-sync");
            if (lastSyncEl) lastSyncEl.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
        }
    } catch (error) {
        console.warn("Could not poll telemetry from database:", error);
    } finally {
        telemetryPollRunning = false;
    }
}
