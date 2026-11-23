/**
 * Device Detail JavaScript - Detailed sensor historical data & probe calibration
 */

let currentDeviceData = null;
let currentChart = null;
let detailDeviceId = null;
let detailRefreshTimer = null;
const knownDeviceReadingIds = new Set();
let deviceHistorySeeded = false;
let detailRefreshRunning = false;
let deviceInExcursion = false;

document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const devId = params.get("id");
    detailDeviceId = devId;

    if (!devId) {
        document.getElementById("detail-dev-token").textContent = "Select a device from the device list.";
        return;
    }

    await loadDeviceDetails(devId);
    detailRefreshTimer = window.setInterval(refreshDeviceTelemetry, 3000);
});

async function loadDeviceDetails(devId) {
    try {
        const res = await api.get(`/devices/${devId}`);
        if (res.success && res.data) {
            const dev = res.data;
            currentDeviceData = dev;

            document.getElementById("detail-dev-token").textContent = `${dev.device_token} (DEV-00${dev.id})`;
            setDeviceConnectionBadge(dev.is_online === true);

            const assignment = dev.warehouse_name ? `Assigned to Warehouse: ${dev.warehouse_name}` : (dev.license_plate ? `Installed on Reefer Vehicle: ${dev.license_plate}` : "Standby Sensor");
            document.getElementById("detail-dev-assignment").textContent = assignment;

            if (dev.latestReading && dev.is_online) {
                document.getElementById("detail-temp-val").textContent = `${parseFloat(dev.latestReading.temperature).toFixed(1)}°C`;
                document.getElementById("detail-hum-val").textContent = dev.latestReading.humidity === null ? "—" : `${Number(dev.latestReading.humidity).toFixed(0)}%`;
            } else {
                document.getElementById("detail-temp-val").textContent = "No live data";
                document.getElementById("detail-hum-val").textContent = "—";
            }

            const rawTbody = document.getElementById("detail-raw-tbody");
            if (!deviceHistorySeeded) {
                (dev.history || []).forEach((reading) => rememberDeviceReading(reading.id));
                deviceHistorySeeded = true;
            }
            if (dev.history && dev.history.length > 0) {
                rawTbody.innerHTML = [...dev.history].reverse().map(r => {
                    const temp = parseFloat(r.temperature);
                    const isSafe = temp >= 2.0 && temp <= 8.0;
                    return `
                        <tr>
                            <td>#${r.id}</td>
                            <td><strong class="temp-display ${isSafe ? 'temp-safe' : 'temp-danger'}">${temp.toFixed(1)}°C</strong></td>
                            <td>${r.humidity === null ? "—" : `${Number(r.humidity).toFixed(0)}%`}</td>
                            <td>${new Date(r.created_at).toLocaleString("en-US", { hour12: false })}</td>
                            <td><span class="badge ${isSafe ? 'badge-active' : 'badge-critical'}">${isSafe ? 'SAFE' : 'EXCURSION'}</span></td>
                        </tr>
                    `;
                }).join("");

                renderDetailChart(dev.history);
            } else {
                rawTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#94a3b8;">No telemetry records logged for this sensor device</td></tr>`;
                renderDetailChart([]);
            }
        }
    } catch (err) {
        console.error("Error loading device detail:", err);
        showToast("Error loading device details", "error");
    }
}

async function refreshDeviceTelemetry() {
    if (!detailDeviceId || detailRefreshRunning) return;
    detailRefreshRunning = true;
    try {
        const response = await api.get(`/devices/${detailDeviceId}`);
        if (!response.success || !response.data) return;
        const device = response.data;
        const history = Array.isArray(device.history) ? device.history : [];
        const fresh = history.filter((reading) => reading.id !== undefined && !knownDeviceReadingIds.has(String(reading.id)));

        if (!deviceHistorySeeded) {
            history.forEach((reading) => rememberDeviceReading(reading.id));
            deviceHistorySeeded = true;
            return;
        }
        currentDeviceData = device;
        setDeviceConnectionBadge(device.is_online === true);
        const latest = device.latestReading || history[0];
        if (latest && device.is_online) {
            const temperature = Number(latest.temperature);
            document.getElementById("detail-temp-val").textContent = `${temperature.toFixed(1)}°C`;
            document.getElementById("detail-hum-val").textContent = latest.humidity === null || latest.humidity === undefined ? "—" : `${Number(latest.humidity).toFixed(0)}%`;
        } else {
            document.getElementById("detail-temp-val").textContent = "No live data";
            document.getElementById("detail-hum-val").textContent = "—";
        }
        if (!fresh.length) return;

        fresh.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).forEach((reading) => {
            rememberDeviceReading(reading.id);
            if (device.is_online) notifyDeviceTemperature(Number(reading.temperature));
        });
        const rawTbody = document.getElementById("detail-raw-tbody");
        if (rawTbody) {
            rawTbody.innerHTML = [...history].reverse().map(renderDeviceReadingRow).join("");
        }
        renderDetailChart(history);
    } catch (error) {
        console.warn("Could not refresh device telemetry:", error);
    } finally {
        detailRefreshRunning = false;
    }
}

function rememberDeviceReading(id) {
    if (id !== undefined && id !== null) knownDeviceReadingIds.add(String(id));
}

function setDeviceConnectionBadge(isOnline) {
    const badge = document.getElementById("detail-badge-status");
    if (!badge) return;
    badge.textContent = isOnline ? "ONLINE" : "OFFLINE";
    badge.classList.remove("badge-active", "badge-online", "badge-critical", "badge-neutral");
    badge.classList.add(isOnline ? "badge-active" : "badge-neutral");
}

function renderDeviceReadingRow(reading) {
    const temperature = Number(reading.temperature);
    const isSafe = temperature >= 2 && temperature <= 8;
    const humidity = reading.humidity === null || reading.humidity === undefined ? "—" : `${Number(reading.humidity).toFixed(0)}%`;
    return `<tr><td>#${reading.id}</td><td><strong class="temp-display ${isSafe ? "temp-safe" : "temp-danger"}">${temperature.toFixed(1)}°C</strong></td><td>${humidity}</td><td>${new Date(reading.created_at).toLocaleString("en-US", { hour12: false })}</td><td><span class="badge ${isSafe ? "badge-active" : "badge-critical"}">${isSafe ? "SAFE" : "EXCURSION"}</span></td></tr>`;
}

function notifyDeviceTemperature(temperature) {
    if (!Number.isFinite(temperature)) return;
    const outside = temperature < 2 || temperature > 8;
    if (outside && !deviceInExcursion) {
        deviceInExcursion = true;
        const direction = temperature < 2 ? "dưới 2°C" : "trên 8°C";
        if (typeof showToast === "function") showToast(`Cảnh báo nhiệt độ thiết bị ${currentDeviceData?.device_token || "sensor"}: ${temperature.toFixed(1)}°C (${direction})`, "error");
    } else if (!outside) {
        deviceInExcursion = false;
    }
}

function renderDetailChart(history) {
    const ctx = document.getElementById("deviceDetailChart");
    if (!ctx) return;

    if (currentChart) {
        currentChart.destroy();
    }

    const orderedHistory = [...history];
    const labels = orderedHistory.length > 0
        ? orderedHistory.map(h => new Date(h.created_at).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }))
        : [];

    const temps = orderedHistory.length > 0
        ? orderedHistory.map(h => parseFloat(h.temperature))
        : [];
    const minTemp = Math.min(2, ...temps.filter(Number.isFinite));
    const maxTemp = Math.max(8, ...temps.filter(Number.isFinite));
    const padding = Math.max(1, (maxTemp - minTemp) * 0.12);
    const yMin = Math.floor((minTemp - padding) / 2) * 2;
    const yMax = Math.ceil((maxTemp + padding) / 2) * 2;

    currentChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Observed Temperature (°C)",
                    data: temps,
                    borderColor: "#2563eb",
                    backgroundColor: "rgba(37, 99, 235, 0.08)",
                    borderWidth: 2.5,
                    tension: 0.35,
                    fill: true,
                    pointBackgroundColor: (c) => c.raw > 8.0 || c.raw < 2.0 ? "#ef4444" : "#2563eb",
                    pointRadius: (c) => c.raw > 8.0 || c.raw < 2.0 ? 6 : 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: yMin,
                    max: yMax,
                    ticks: { callback: (v) => `${v}°C` },
                    grid: {
                        color: (c) => c.tick.value === 2 || c.tick.value === 8 ? "rgba(37,99,235,0.3)" : "rgba(226,232,240,0.6)"
                    }
                }
            }
        }
    });
}

function triggerDeviceCalibration() {
    const token = currentDeviceData ? currentDeviceData.device_token : "DEV-SENSOR";
    if (typeof window.calibrateSensorNode === "function") {
        window.calibrateSensorNode(token);
    } else {
        showToast(`Sent 3-point calibration command to device ${token}`, "success");
    }
}

function exportDeviceCertificate() {
    const token = currentDeviceData ? currentDeviceData.device_token : "DEV-SENSOR";
    if (typeof window.generateAuditCertificate === "function") {
        window.generateAuditCertificate(`IoT Sensor Node: ${token}`);
    } else {
        showToast("Generating ISO 9001 calibration audit certificate...", "info");
    }
}
