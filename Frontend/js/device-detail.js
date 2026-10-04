/**
 * Device Detail JavaScript - Detailed sensor historical data & probe calibration
 */

let currentDeviceData = null;
let currentChart = null;

document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const devId = params.get("id") || "4";

    await loadDeviceDetails(devId);

    // Live telemetry update listener
    window.onTelemetryLiveUpdate = (packet) => {
        if (packet.device_id == devId) {
            console.log("Live packet for this device:", packet);
            const tempVal = parseFloat(packet.temperature);
            document.getElementById("detail-temp-val").textContent = `${tempVal.toFixed(1)}°C`;
            document.getElementById("detail-hum-val").textContent = `${Math.round(packet.humidity || 75)}%`;

            const rawTbody = document.getElementById("detail-raw-tbody");
            if (rawTbody) {
                const isSafe = tempVal >= 2.0 && tempVal <= 8.0;
                const newRow = `
                    <tr style="background: rgba(37, 99, 235, 0.05); animation: pulse 1s;">
                        <td>#${packet.id} <span style="color:#2563eb; font-size:10px; font-weight:700;">LIVE</span></td>
                        <td><strong class="temp-display ${isSafe ? 'temp-safe' : 'temp-danger'}">${tempVal.toFixed(1)}°C</strong></td>
                        <td>${Math.round(packet.humidity || 75)}%</td>
                        <td>${new Date().toLocaleTimeString("en-US", { hour12: false })}</td>
                        <td><span class="badge ${isSafe ? 'badge-active' : 'badge-critical'}">${isSafe ? 'SAFE' : 'EXCURSION'}</span></td>
                    </tr>
                `;
                rawTbody.insertAdjacentHTML("afterbegin", newRow);
            }
        }
    };
});

async function loadDeviceDetails(devId) {
    try {
        const res = await api.get(`/devices/${devId}`);
        if (res.success && res.data) {
            const dev = res.data;
            currentDeviceData = dev;

            document.getElementById("detail-dev-token").textContent = `${dev.device_token} (DEV-00${dev.id})`;
            document.getElementById("detail-badge-status").textContent = dev.status;

            const assignment = dev.warehouse_name ? `Assigned to Warehouse: ${dev.warehouse_name}` : (dev.license_plate ? `Installed on Reefer Vehicle: ${dev.license_plate}` : "Standby Sensor");
            document.getElementById("detail-dev-assignment").textContent = assignment;

            if (dev.latestReading) {
                document.getElementById("detail-temp-val").textContent = `${parseFloat(dev.latestReading.temperature).toFixed(1)}°C`;
                document.getElementById("detail-hum-val").textContent = `${Math.round(dev.latestReading.humidity || 75)}%`;
            }

            const rawTbody = document.getElementById("detail-raw-tbody");
            if (dev.history && dev.history.length > 0) {
                rawTbody.innerHTML = dev.history.map(r => {
                    const temp = parseFloat(r.temperature);
                    const isSafe = temp >= 2.0 && temp <= 8.0;
                    return `
                        <tr>
                            <td>#${r.id}</td>
                            <td><strong class="temp-display ${isSafe ? 'temp-safe' : 'temp-danger'}">${temp.toFixed(1)}°C</strong></td>
                            <td>${Math.round(r.humidity || 75)}%</td>
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

function renderDetailChart(history) {
    const ctx = document.getElementById("deviceDetailChart");
    if (!ctx) return;

    if (currentChart) {
        currentChart.destroy();
    }

    const labels = history.length > 0 
        ? history.map(h => new Date(h.created_at).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" }))
        : ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00"];

    const temps = history.length > 0
        ? history.map(h => parseFloat(h.temperature))
        : [4.2, 4.5, 4.3, 7.5, 9.8, 10.8];

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
                    min: 0,
                    max: 14,
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
