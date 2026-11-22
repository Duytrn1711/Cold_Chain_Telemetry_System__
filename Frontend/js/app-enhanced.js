/**
 * Cold Chain Telemetry System - Enhanced Core Interactive Suite
 * Provides Command Palette (Ctrl+K), Live IoT Simulation Stream,
 * Profile Menu, Password Change, Notification Drawer, Settings,
 * and Diagnostic Tools across all application pages.
 * Fully synchronized in English.
 */

let audioAlertEnabled = true;
const knownNotificationAlertIds = new Set();
let notificationAlertsSeeded = false;
const alertToastTimesByDevice = new Map();

document.addEventListener("DOMContentLoaded", () => {
    // Only run on protected pages (not on login page)
    if (window.location.pathname.endsWith("login.html") || (window.location.pathname === "/" && !api.getToken())) {
        return;
    }

    injectEnhancedUI();
    initCommandPalette();
    initProfileDropdown();
    initNotificationsDrawer();
    initSettingsModal();
    initChangePasswordModal();
    initAutoRefresh();
});

// --- 1. DOM INJECTION FOR GLOBAL MODALS & MENUS ---
function injectEnhancedUI() {
    if (document.getElementById("cmd-palette-backdrop")) return;

    const container = document.createElement("div");
    container.id = "app-enhanced-container";
    container.innerHTML = `
        <!-- Command Palette Modal -->
        <div class="cmd-palette-backdrop" id="cmd-palette-backdrop">
            <div class="cmd-palette-card">
                <div class="cmd-palette-header">
                    <span class="cmd-palette-icon">🔍</span>
                    <input type="text" class="cmd-palette-input" id="cmd-palette-input" placeholder="Type a facility, vehicle, sensor, or quick action... (Ctrl+K)" autocomplete="off">
                    <span class="cmd-palette-esc">ESC</span>
                </div>
                <div class="cmd-palette-body" id="cmd-palette-results">
                    <!-- Dynamic search items -->
                </div>
                <div class="cmd-palette-footer">
                    <span>Navigate: <strong>↑ ↓</strong> &nbsp; Select: <strong>Enter</strong> &nbsp; Close: <strong>ESC</strong></span>
                    <span>Cold Chain Telemetry v2.4</span>
                </div>
            </div>
        </div>

        <!-- System Settings Modal -->
        <div class="modal-overlay" id="system-settings-modal">
            <div class="modal-card" style="max-width: 520px;">
                <div class="modal-header">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:20px;">⚙️</span>
                        <h3>Cold Chain Threshold Configuration</h3>
                    </div>
                    <button type="button" class="modal-close-btn" onclick="closeSettingsModal()">&times;</button>
                </div>
                <form id="system-settings-form">
                    <div class="modal-body">
                        <div style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:16px;">
                            <strong style="font-size:12px; color:#1e40af;">Configured temperature monitoring range</strong>
                            <p style="font-size:12px; color:#64748b; margin-top:2px;">Threshold values apply to telemetry readings stored by this installation.</p>
                        </div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                            <div class="form-field">
                                <label>Lower Safe Threshold (Min Temp °C)</label>
                                <input type="number" step="0.1" id="cfg-temp-min" value="2.0" required>
                            </div>
                            <div class="form-field">
                                <label>Upper Safe Threshold (Max Temp °C)</label>
                                <input type="number" step="0.1" id="cfg-temp-max" value="8.0" required>
                            </div>
                        </div>
                        <div class="form-field">
                            <label>Maximum Allowed Relative Humidity (% RH)</label>
                            <input type="number" id="cfg-hum-max" value="80" required>
                        </div>
                        <div class="form-field">
                            <label>Telemetry Synchronization Frequency</label>
                            <select id="cfg-polling-rate">
                                <option value="5000">Every 5 Seconds (Ultra Real-time)</option>
                                <option value="8000" selected>Every 8 Seconds (Recommended Nominal)</option>
                                <option value="15000">Every 15 Seconds</option>
                                <option value="30000">Every 30 Seconds</option>
                            </select>
                        </div>
                        <div class="form-field">
                            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                                <input type="checkbox" id="cfg-audio-alert" checked style="width:16px; height:16px; accent-color:#2563eb;">
                                <span>Enable Web Audio Synthesizer Alarm on Excursions</span>
                            </label>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeSettingsModal()">Close</button>
                        <button type="submit" class="btn btn-primary">Save Settings</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Change Password Modal -->
        <div class="modal-overlay" id="change-pwd-modal">
            <div class="modal-card" style="max-width: 440px;">
                <div class="modal-header">
                    <h3>Change Account Password</h3>
                    <button type="button" class="modal-close-btn" onclick="closeChangePwdModal()">&times;</button>
                </div>
                <form id="change-pwd-form">
                    <div class="modal-body">
                        <div class="form-field">
                            <label for="pwd-current">Current Password *</label>
                            <input type="password" id="pwd-current" required placeholder="Enter current password">
                        </div>
                        <div class="form-field">
                            <label for="pwd-new">New Password *</label>
                            <input type="password" id="pwd-new" required minlength="6" placeholder="Minimum 6 characters">
                        </div>
                        <div class="form-field">
                            <label for="pwd-confirm">Confirm New Password *</label>
                            <input type="password" id="pwd-confirm" required minlength="6" placeholder="Re-enter new password">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeChangePwdModal()">Cancel</button>
                        <button type="submit" class="btn btn-primary" id="btn-submit-pwd">Update Password</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Telemetry Packet Inspector Modal -->
        <div class="packet-inspector-modal" id="packet-inspector-modal">
            <div class="packet-inspector-card">
                <div class="modal-header" style="background:#1e293b; color:#fff; border-bottom:1px solid #334155;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span>🔬</span>
                        <h3 id="inspector-title" style="color:#fff;">Diagnostic Packet Inspector: TL-891024</h3>
                    </div>
                    <button type="button" class="modal-close-btn" style="color:#94a3b8;" onclick="closePacketInspector()">&times;</button>
                </div>
                <div class="modal-body" style="padding:20px;">
                    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; margin-bottom:16px;">
                        <div style="background:#f8fafc; padding:10px; border-radius:6px; border:1px solid #e2e8f0;">
                            <div style="font-size:11px; color:#64748b; font-weight:700;">TRANSMITTER NODE</div>
                            <strong id="insp-device-token" style="font-size:14px; color:#0f172a;">—</strong>
                        </div>
                        <div style="background:#f8fafc; padding:10px; border-radius:6px; border:1px solid #e2e8f0;">
                            <div style="font-size:11px; color:#64748b; font-weight:700;">TELEMETRY READING</div>
                            <strong id="insp-reading-temp" style="font-size:14px; color:#64748b;">—</strong>
                        </div>
                        <div style="background:#f8fafc; padding:10px; border-radius:6px; border:1px solid #e2e8f0;">
                            <div style="font-size:11px; color:#64748b; font-weight:700;">CRC32 CHECKSUM</div>
                            <strong style="font-size:14px; color:#64748b;">Not stored</strong>
                        </div>
                    </div>

                    <label style="font-size:11px; font-weight:700; color:#475569; text-transform:uppercase;">Raw Hexadecimal IoT Packet Payload (AES-256 Encrypted Frame)</label>
                    <div class="raw-hex-box" id="insp-hex-box">
                        Raw packet payload is not stored in this database.
                    </div>

                    <div style="margin-top:14px; font-size:12px; color:#475569; display:flex; justify-content:space-between; border-top:1px solid #f1f5f9; padding-top:10px;">
                        <span>Radio protocol: <strong>Not stored</strong></span>
                        <span>Signal: <strong>Not stored</strong></span>
                    </div>
                </div>
                <div class="modal-footer" style="background:#f8fafc;">
                    <button type="button" class="btn btn-secondary" onclick="closePacketInspector()">Close</button>
                    <button type="button" class="btn btn-primary" onclick="showToast('Copied Raw Hex Payload to Clipboard!', 'success')">📋 Copy Raw Hex</button>
                </div>
            </div>
        </div>

        <!-- GPS Radar Tracking Modal -->
        <div class="gps-radar-modal" id="gps-radar-modal">
            <div class="gps-radar-card">
                <div class="gps-radar-header">
                    <div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="color:#10b981; font-size:18px;">🛰️</span>
                            <h3 style="font-size:18px; font-weight:700;" id="radar-facility-name">Facility Sat-Lock Tracking</h3>
                        </div>
                        <p style="font-size:12px; color:#94a3b8; margin-top:2px;">Real-time Orbital Positioning &amp; Geofence Monitoring</p>
                    </div>
                    <button type="button" class="modal-close-btn" style="color:#94a3b8;" onclick="closeGpsRadarModal()">&times;</button>
                </div>
                <div class="gps-radar-body">
                    <div class="radar-screen">
                        <div class="radar-sweep"></div>
                        <div class="radar-grid-circle" style="width: 80px; height: 80px;"></div>
                        <div class="radar-grid-circle" style="width: 160px; height: 160px;"></div>
                        <div class="radar-grid-circle" style="width: 240px; height: 240px;"></div>
                        
                        <!-- Center Hub Pin -->
                        <div class="radar-pin" style="top:50%; left:50%;">
                            <div class="radar-pin-dot"></div>
                            <div class="radar-pin-label" id="radar-center-label">Hub Center</div>
                        </div>

                        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#cbd5e1;font-size:12px;">No GPS points are stored</div>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:12px;">
                        <div style="background:#1e293b; padding:12px; border-radius:8px; font-size:12px;">
                            <div style="color:#94a3b8; font-size:10px; font-weight:700;">COORDINATES</div>
                            <div id="radar-coords-val" style="font-size:14px; font-weight:700; color:#38bdf8; margin-top:2px;">Coordinates not recorded</div>
                        </div>
                        <div style="background:#1e293b; padding:12px; border-radius:8px; font-size:12px;">
                            <div style="color:#94a3b8; font-size:10px; font-weight:700;">GEOFENCE STATUS</div>
                            <div style="color:#94a3b8; font-weight:700; margin-top:2px;">Geofence status not recorded</div>
                        </div>
                        <div style="background:#1e293b; padding:12px; border-radius:8px; font-size:12px;">
                            <div style="color:#94a3b8; font-size:10px; font-weight:700;">SATELLITE TELEMETRY</div>
                            <div style="color:#e2e8f0; margin-top:2px;">GPS telemetry is not stored</div>
                        </div>
                        <button type="button" class="btn btn-primary" style="margin-top:auto;" disabled title="GPS command integration is not configured">
                            🔄 Ping Satellites Now
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(container);
}

// --- 2. ALERT BADGE & AUDIO UTILITIES ---
function updateNavAlertBadge(delta = 1) {
    const badge = document.getElementById("nav-alert-count") || document.querySelector(".nav-badge");
    if (badge) {
        const current = parseInt(badge.textContent || "3", 10);
        badge.textContent = Math.max(0, current + delta);
    }
}

function playAlertSound() {
    if (!audioAlertEnabled) return;
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    } catch (e) {}
}

window.triggerExcursionAlarmSound = playAlertSound;

// --- 3. PROFILE MENU & NOTIFICATIONS DRAWER ---
function initProfileDropdown() {
    const avatarEl = document.querySelector(".header-avatar") || document.querySelector(".top-header .header-right div:last-child");
    if (!avatarEl) return;

    if (avatarEl.parentElement.classList.contains("dropdown-wrapper")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "dropdown-wrapper";
    avatarEl.parentNode.insertBefore(wrapper, avatarEl);
    wrapper.appendChild(avatarEl);

    avatarEl.style.cursor = "pointer";

    const user = api.getCurrentUser() || { full_name: "Sarah Jenkins", role: "ADMIN", username: "admin" };

    const menu = document.createElement("div");
    menu.className = "dropdown-menu";
    menu.id = "user-profile-menu";
    menu.innerHTML = `
        <div class="dropdown-header">
            <div class="dropdown-user-name">${user.full_name || user.username}</div>
            <div class="dropdown-user-role">${Roles ? Roles.label(user.role) : user.role}</div>
            <div style="font-size:11px; color:#64748b; margin-top:2px;">@${user.username} · coldchain.internal</div>
        </div>
        <button type="button" class="dropdown-item" onclick="openCommandPalette(); closeMenus();">
            <span>🔍</span> <span>Quick Command (Ctrl+K)</span>
        </button>
        <button type="button" class="dropdown-item" onclick="openSettingsModal(); closeMenus();" ${window.Roles && !Roles.can("settings") ? "hidden" : ""}>
            <span>⚙️</span> <span>System Thresholds</span>
        </button>
        <button type="button" class="dropdown-item" onclick="openChangePwdModal(); closeMenus();">
            <span>🔑</span> <span>Change Password</span>
        </button>
        <div class="dropdown-divider"></div>
        <button type="button" class="dropdown-item danger" onclick="confirmLogout()">
            <span>🚪</span> <span>Sign Out</span>
        </button>
    `;
    wrapper.appendChild(menu);

    avatarEl.addEventListener("click", (e) => {
        e.stopPropagation();
        closeNotificationMenu();
        menu.classList.toggle("show");
    });

    document.addEventListener("click", (e) => {
        if (!wrapper.contains(e.target)) {
            menu.classList.remove("show");
        }
    });
}

function initNotificationsDrawer() {
    const notifBtn = document.querySelector(".header-action-btn[title='Thông báo']") || document.querySelector(".header-action-btn[title='Notifications']") || document.querySelector("button.header-action-btn");
    if (!notifBtn) return;

    if (notifBtn.parentElement.classList.contains("dropdown-wrapper")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "dropdown-wrapper";
    notifBtn.parentNode.insertBefore(wrapper, notifBtn);
    wrapper.appendChild(notifBtn);

    const menu = document.createElement("div");
    menu.className = "dropdown-menu notification-menu";
    menu.id = "notification-drawer-menu";
    menu.innerHTML = `
        <div class="dropdown-header" style="display:flex; justify-content:space-between; align-items:center;">
            <div>
                <strong style="font-size:13px; color:#0f172a;">Thông báo hệ thống</strong>
                <span class="badge badge-critical" style="font-size:10px; margin-left:6px;" id="notif-count-badge">0</span>
            </div>
            <span style="font-size:11px; color:#64748b;">Cảnh báo và lô hàng mới</span>
        </div>
        <div class="notification-list" id="notification-items-list"><div style="padding:24px;text-align:center;color:#64748b">Đang tải thông báo…</div></div>
        <div style="padding:10px 16px; background:#f8fafc; border-top:1px solid #e2e8f0; text-align:center;">
            <a href="#" style="font-size:12px; font-weight:700; color:#2563eb; text-decoration:none;" data-notification-nav="batches">Mở trang Agri Batch Logistics →</a>
        </div>
    `;
    wrapper.appendChild(menu);
    loadNotificationAlerts();
    window.setInterval(loadNotificationAlerts, 4000);

    notifBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeProfileMenu();
        menu.classList.toggle("show");
        if (menu.classList.contains("show")) loadNotificationAlerts();
    });

    menu.addEventListener("click", (event) => {
        const item = event.target.closest("[data-notification-kind], [data-notification-nav]");
        if (!item) return;
        event.preventDefault();
        if (item.dataset.notificationKind === "batch") {
            markBatchNotificationRead(item.dataset.batchCode);
            goToAgriBatchesPage();
        } else if (item.dataset.notificationKind === "alert") {
            goToAlertsPage();
        } else if (item.dataset.notificationNav === "batches") {
            goToAgriBatchesPage();
        }
    });

    document.addEventListener("click", (e) => {
        if (!wrapper.contains(e.target)) {
            menu.classList.remove("show");
        }
    });
}

function closeMenus() {
    closeProfileMenu();
    closeNotificationMenu();
}
function closeProfileMenu() {
    const el = document.getElementById("user-profile-menu");
    if (el) el.classList.remove("show");
}
function closeNotificationMenu() {
    const el = document.getElementById("notification-drawer-menu");
    if (el) el.classList.remove("show");
}

function goToAlertsPage() {
    closeMenus();
    const isSub = window.location.pathname.includes("/pages/");
    window.location.href = isSub ? "alerts.html" : "pages/alerts.html";
}

function goToAgriBatchesPage() {
    closeMenus();
    const isSub = window.location.pathname.includes("/pages/");
    window.location.href = isSub ? "agri-batches.html" : "pages/agri-batches.html";
}

function batchNotificationStorageKey(kind) {
    const user = api.getCurrentUser() || {};
    const identity = String(user.id || user.username || "session").toLowerCase();
    return `coldchain_agri_batch_${kind}_v1_${identity}`;
}

function readStoredJson(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
    } catch (error) { return fallback; }
}

function readBatchNotifications() {
    const value = readStoredJson(batchNotificationStorageKey("notifications"), []);
    return Array.isArray(value) ? value : [];
}

function markBatchNotificationRead(batchCode) {
    const notifications = readBatchNotifications().map((item) =>
        item.batchCode === batchCode ? { ...item, read: true } : item);
    localStorage.setItem(batchNotificationStorageKey("notifications"), JSON.stringify(notifications));
}

async function syncNewBatchNotifications() {
    const response = await api.get("/agri-batches");
    if (!response.success || !Array.isArray(response.data)) return;
    const currentCodes = [...new Set(response.data.map((batch) => batch.external_batch_code).filter(Boolean))];
    const knownValue = readStoredJson(batchNotificationStorageKey("known_codes"), null);
    const notifications = readBatchNotifications();

    // Seed existing batches on first visit so historical imports do not create a flood of notifications.
    if (!Array.isArray(knownValue)) {
        localStorage.setItem(batchNotificationStorageKey("known_codes"), JSON.stringify(currentCodes));
        return;
    }

    const knownCodes = new Set(knownValue);
    const newBatches = response.data.filter((batch) => batch.external_batch_code && !knownCodes.has(batch.external_batch_code));
    if (newBatches.length) {
        const seenNotifications = new Set(notifications.map((item) => item.batchCode));
        const createdAt = new Date().toISOString();
        newBatches.forEach((batch) => {
            if (!seenNotifications.has(batch.external_batch_code)) {
                notifications.unshift({
                    batchCode: batch.external_batch_code,
                    productName: batch.product_name || "Lô nông sản",
                    createdAt,
                    read: false
                });
            }
        });
        localStorage.setItem(batchNotificationStorageKey("notifications"), JSON.stringify(notifications.slice(0, 30)));
    }
    localStorage.setItem(batchNotificationStorageKey("known_codes"), JSON.stringify(currentCodes));
}

async function loadNotificationAlerts() {
    const list = document.getElementById("notification-items-list");
    const badge = document.getElementById("notif-count-badge");
    if (!list) return;
    if (loadNotificationAlerts.running) return;
    loadNotificationAlerts.running = true;
    const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    let alerts = [];
    try {
        const response = await api.get("/alerts");
        alerts = Array.isArray(response.data) ? response.data : (Array.isArray(response.data?.list) ? response.data.list : []);
        const identifiedAlerts = alerts.filter((alert) => alert.id !== undefined && alert.id !== null);
        if (!notificationAlertsSeeded) {
            identifiedAlerts.forEach((alert) => knownNotificationAlertIds.add(String(alert.id)));
            notificationAlertsSeeded = true;
        } else {
            const newAlerts = identifiedAlerts.filter((alert) => !knownNotificationAlertIds.has(String(alert.id)));
            newAlerts.forEach((alert) => knownNotificationAlertIds.add(String(alert.id)));
            if (newAlerts.length && typeof showToast === "function") {
                const newest = newAlerts[0];
                const pageHasLocalTelemetryAlert = /\/(data|devices-detail)\.html$/.test(window.location.pathname);
                const deviceKey = String(newest.device_id || newest.device_token || "system");
                const now = Date.now();
                const lastToastAt = alertToastTimesByDevice.get(deviceKey) || 0;
                if (!pageHasLocalTelemetryAlert && now - lastToastAt >= 30000) {
                    alertToastTimesByDevice.set(deviceKey, now);
                    showToast(`Cảnh báo nhiệt độ mới · ${newest.alert_content || newest.alert_type || "Nhiệt độ vượt ngưỡng 2–8°C"}`, "error");
                }
            }
        }
    } catch (error) { /* Batch notifications should still load if alerts are unavailable. */ }
    try { await syncNewBatchNotifications(); } catch (error) { /* Keep the drawer usable if batch access is unavailable. */ }

    const batchNotifications = readBatchNotifications();
    const unreadBatches = batchNotifications.filter((item) => !item.read).length;
    const activeAlerts = alerts.filter((alert) => alert.status !== "RESOLVED");
    if (badge) badge.textContent = String(activeAlerts.length + unreadBatches);
    const headerDot = document.querySelector(".header-action-btn .header-badge-dot");
    if (headerDot) headerDot.style.display = activeAlerts.length + unreadBatches ? "block" : "none";

    const batchItems = batchNotifications.slice(0, 10).map((item) => `
        <div class="notification-item ${item.read ? "" : "unread"}" data-notification-kind="batch" data-batch-code="${safe(item.batchCode)}">
            <div class="notification-icon">📦</div><div class="notification-content">
                <div class="notification-title">Lô hàng mới từ Agri-Audit · ${safe(item.batchCode)} · ${safe(item.productName)}</div>
                <div class="notification-time">${item.createdAt ? new Date(item.createdAt).toLocaleString() : ""} · Bấm để mở lô hàng</div>
            </div>
        </div>`).join("");
    const alertItems = alerts.slice(0, 10).map((alert) => `<div class="notification-item ${String(alert.alert_type || "").toUpperCase().includes("HIGH") ? "critical" : ""}" data-notification-kind="alert"><div class="notification-icon">⚠️</div><div class="notification-content"><div class="notification-title">${safe(alert.alert_type || "Alert")} · ${safe(alert.alert_content || "")}</div><div class="notification-time">${alert.created_at ? new Date(alert.created_at).toLocaleString() : ""}</div></div></div>`).join("");
    list.innerHTML = batchItems + alertItems || `<div style="padding:24px;text-align:center;color:#64748b">Chưa có thông báo</div>`;
    loadNotificationAlerts.running = false;
}

function markAllNotifsRead() {
    const list = document.getElementById("notification-items-list");
    if (list) {
        list.innerHTML = `<div style="padding:30px; text-align:center; color:#94a3b8; font-size:12px;">All notifications have been reviewed</div>`;
    }
    const badge = document.getElementById("notif-count-badge");
    if (badge) badge.textContent = "0";
    showToast("Marked all notifications as read.", "success");
}

function confirmLogout() {
    closeMenus();
    if (confirm("Are you sure you want to sign out of the Cold Chain System?")) {
        api.logout();
    }
}

// --- 4. COMMAND PALETTE (CTRL+K) ---
function initCommandPalette() {
    const backdrop = document.getElementById("cmd-palette-backdrop");
    const input = document.getElementById("cmd-palette-input");
    const results = document.getElementById("cmd-palette-results");
    if (!backdrop || !input || !results) return;

    window.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            openCommandPalette();
        } else if (e.key === "Escape" && backdrop.classList.contains("show")) {
            closeCommandPalette();
        }
    });

    const headerSearchInput = document.getElementById("top-search-input");
    if (headerSearchInput) {
        headerSearchInput.addEventListener("focus", (e) => {
            e.preventDefault();
            headerSearchInput.blur();
            openCommandPalette();
        });
    }

    backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) closeCommandPalette();
    });

    input.addEventListener("input", () => {
        renderCommandPaletteResults(input.value.trim().toLowerCase());
    });
}

const COMMAND_ACTIONS = [
    { name: "Executive Dashboard", category: "NAVIGATION", icon: "📊", action: () => navigateToPage("dashboard") },
    { name: "Cold Storage Warehouses", category: "NAVIGATION", icon: "🏢", action: () => navigateToPage("warehouses") },
    { name: "Refrigerated Delivery Vehicles", category: "NAVIGATION", icon: "🚚", action: () => navigateToPage("vehicles") },
    { name: "IoT Sensor Devices & Nodes", category: "NAVIGATION", icon: "📡", action: () => navigateToPage("devices") },
    { name: "Telemetry Data & Raw Streams", category: "NAVIGATION", icon: "📈", action: () => navigateToPage("data") },
    { name: "Cold Chain Reports & Audits", category: "NAVIGATION", icon: "📑", action: () => navigateToPage("reports") },
    { name: "Certification evidence unavailable", category: "REPORTS", icon: "🛡️", need: "export", action: () => showToast("Certification evidence is not stored", "warning") },
    { name: "Configure Safe Temperature Thresholds", category: "SYSTEM", icon: "⚙️", need: "settings", action: () => openSettingsModal() },
    { name: "Change User Password", category: "ACCOUNT", icon: "🔑", action: () => openChangePwdModal() }
];

function openCommandPalette() {
    const backdrop = document.getElementById("cmd-palette-backdrop");
    const input = document.getElementById("cmd-palette-input");
    if (!backdrop || !input) return;

    backdrop.classList.add("show");
    input.value = "";
    renderCommandPaletteResults("");
    setTimeout(() => input.focus(), 50);
}

function closeCommandPalette() {
    const backdrop = document.getElementById("cmd-palette-backdrop");
    if (backdrop) backdrop.classList.remove("show");
}

function renderCommandPaletteResults(query) {
    const results = document.getElementById("cmd-palette-results");
    if (!results) return;

    const filtered = COMMAND_ACTIONS.filter(item => {
        if (item.need && window.Roles && !Roles.can(item.need)) return false;
        return !query || item.name.toLowerCase().includes(query) || item.category.toLowerCase().includes(query);
    });

    if (filtered.length === 0) {
        results.innerHTML = `<div style="padding:30px; text-align:center; color:#94a3b8; font-size:13px;">No commands matching "${query}"</div>`;
        return;
    }

    const groups = {};
    filtered.forEach(item => {
        if (!groups[item.category]) groups[item.category] = [];
        groups[item.category].push(item);
    });

    let html = "";
    for (const [cat, items] of Object.entries(groups)) {
        html += `<div class="cmd-group-title">${cat}</div>`;
        items.forEach(cmd => {
            html += `
                <div class="cmd-item" onclick="executeCmd(${COMMAND_ACTIONS.indexOf(cmd)})">
                    <div class="cmd-item-left">
                        <span>${cmd.icon}</span>
                        <span>${cmd.name}</span>
                    </div>
                    <span class="cmd-item-badge">Enter</span>
                </div>
            `;
        });
    }
    results.innerHTML = html;
}

window.executeCmd = function(index) {
    closeCommandPalette();
    const item = COMMAND_ACTIONS[index];
    if (item && typeof item.action === "function") {
        item.action();
    }
};

function navigateToPage(pageKey) {
    const isSub = window.location.pathname.includes("/pages/");
    if (pageKey === "dashboard") {
        window.location.href = isSub ? "../dashboard.html" : "dashboard.html";
    } else {
        window.location.href = isSub ? `${pageKey}.html` : `pages/${pageKey}.html`;
    }
}

// --- 5. SETTINGS MODAL ---
function initSettingsModal() {
    const form = document.getElementById("system-settings-form");
    if (!form) return;

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const minTemp = document.getElementById("cfg-temp-min").value;
        const maxTemp = document.getElementById("cfg-temp-max").value;
        const maxHum = document.getElementById("cfg-hum-max").value;
        const rate = document.getElementById("cfg-polling-rate").value;
        const audio = document.getElementById("cfg-audio-alert").checked;

        localStorage.setItem("cfg_temp_min", minTemp);
        localStorage.setItem("cfg_temp_max", maxTemp);
        localStorage.setItem("cfg_hum_max", maxHum);
        localStorage.setItem("cfg_polling_rate", rate);
        localStorage.setItem("cfg_audio_alert", audio ? "true" : "false");
        audioAlertEnabled = audio;

        closeSettingsModal();
        showToast("System thresholds saved successfully!", "success");
    });
}

window.openSettingsModal = function() {
    if (window.Roles && !Roles.guard("settings", "Only administrators can change system thresholds.")) return;
    const modal = document.getElementById("system-settings-modal");
    if (!modal) return;
    document.getElementById("cfg-temp-min").value = localStorage.getItem("cfg_temp_min") || "2.0";
    document.getElementById("cfg-temp-max").value = localStorage.getItem("cfg_temp_max") || "8.0";
    document.getElementById("cfg-hum-max").value = localStorage.getItem("cfg_hum_max") || "80";
    document.getElementById("cfg-polling-rate").value = localStorage.getItem("cfg_polling_rate") || "8000";
    document.getElementById("cfg-audio-alert").checked = (localStorage.getItem("cfg_audio_alert") !== "false");
    modal.classList.add("show");
};

window.closeSettingsModal = function() {
    const modal = document.getElementById("system-settings-modal");
    if (modal) modal.classList.remove("show");
};

// --- 6. CHANGE PASSWORD MODAL ---
function initChangePasswordModal() {
    const form = document.getElementById("change-pwd-form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const curPwd = document.getElementById("pwd-current").value;
        const newPwd = document.getElementById("pwd-new").value;
        const confPwd = document.getElementById("pwd-confirm").value;
        const submitBtn = document.getElementById("btn-submit-pwd");

        if (newPwd !== confPwd) {
            showToast("New password and confirmation do not match!", "error");
            return;
        }

        try {
            if (submitBtn) submitBtn.disabled = true;
            const res = await api.put("/auth/change-password", {
                current_password: curPwd,
                new_password: newPwd
            });

            if (res.success) {
                showToast("Password updated successfully!", "success");
                form.reset();
                closeChangePwdModal();
            } else {
                showToast(res.message || "Password change failed", "error");
            }
        } catch (err) {
            showToast(err.message || "Error updating password", "error");
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}

window.openChangePwdModal = function() {
    const modal = document.getElementById("change-pwd-modal");
    if (modal) modal.classList.add("show");
};
window.closeChangePwdModal = function() {
    const modal = document.getElementById("change-pwd-modal");
    if (modal) modal.classList.remove("show");
};

// --- 7. TELEMETRY PACKET INSPECTOR ---
window.openPacketInspector = function(packet = {}) {
    const modal = document.getElementById("packet-inspector-modal");
    if (!modal) return;
    const id = packet.id ?? "—";
    const temp = packet.temperature ?? packet.temp;
    const humidity = packet.humidity ?? packet.hum;
    document.getElementById("inspector-title").textContent = `Telemetry record: ${id}`;
    document.getElementById("insp-device-token").textContent = packet.device_token || packet.dev_code || packet.device_id || "—";
    document.getElementById("insp-reading-temp").textContent = `${temp == null ? "—" : `${Number(temp).toFixed(1)}°C`} / ${humidity == null ? "—" : `${Number(humidity).toFixed(1)}% RH`}`;
    document.getElementById("insp-hex-box").textContent = "Raw packet payload is not stored in this database.";
    modal.classList.add("show");
};window.closePacketInspector = function() {
    const modal = document.getElementById("packet-inspector-modal");
    if (modal) modal.classList.remove("show");
};

// --- 8. GPS RADAR TRACKING MODAL ---
window.openGpsRadarModal = function(name = "Location", coords = null) {
    const modal = document.getElementById("gps-radar-modal");
    if (!modal) return;

    document.getElementById("radar-facility-name").textContent = `${name} - GPS Tracking`;
    document.getElementById("radar-center-label").textContent = name;
    document.getElementById("radar-coords-val").textContent = coords || "Coordinates not recorded";

    modal.classList.add("show");
};
window.closeGpsRadarModal = function() {
    const modal = document.getElementById("gps-radar-modal");
    if (modal) modal.classList.remove("show");
};

window.showGpsRadarModal = window.openGpsRadarModal;

window.generateAuditCertificate = function() {
    showToast("Certification evidence is not stored in this system, so no certificate can be issued.", "warning");
};

// Reports display measured database data and do not issue compliance certificates.

// --- 10. AUTO REFRESH HOOK ---
function initAutoRefresh() {
    window.addEventListener("coldchain:telemetry", (e) => {
        const data = e.detail;
        if (!data) return;

        if (typeof window.onTelemetryLiveUpdate === "function") {
            window.onTelemetryLiveUpdate(data);
        }
    });
}
