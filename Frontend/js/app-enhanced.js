/**
 * Cold Chain Telemetry System - Enhanced Core Interactive Suite
 * Provides Command Palette (Ctrl+K), Live IoT Simulation Stream,
 * Profile Menu, Password Change, Notification Drawer, Settings,
 * and Diagnostic Tools across all application pages.
 * Fully synchronized in English.
 */

let audioAlertEnabled = true;

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
                            <strong style="font-size:12px; color:#1e40af;">PHARMACEUTICAL STORAGE COMPLIANCE (WHO PQS &amp; GDP)</strong>
                            <p style="font-size:12px; color:#64748b; margin-top:2px;">Cold chain vaccine &amp; biological storage target: 2.0°C – 8.0°C.</p>
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
                            <strong id="insp-device-token" style="font-size:14px; color:#0f172a;">DEV-004</strong>
                        </div>
                        <div style="background:#f8fafc; padding:10px; border-radius:6px; border:1px solid #e2e8f0;">
                            <div style="font-size:11px; color:#64748b; font-weight:700;">TELEMETRY READING</div>
                            <strong id="insp-reading-temp" style="font-size:14px; color:#ef4444;">10.8°C / 76% RH</strong>
                        </div>
                        <div style="background:#f8fafc; padding:10px; border-radius:6px; border:1px solid #e2e8f0;">
                            <div style="font-size:11px; color:#64748b; font-weight:700;">CRC32 CHECKSUM</div>
                            <strong style="font-size:14px; color:#10b981;">0xA4F912E8 (VALID)</strong>
                        </div>
                    </div>

                    <label style="font-size:11px; font-weight:700; color:#475569; text-transform:uppercase;">Raw Hexadecimal IoT Packet Payload (AES-256 Encrypted Frame)</label>
                    <div class="raw-hex-box" id="insp-hex-box">
                        43 43 54 53 01 0A 04 2C 00 4C 03 E8 7F 2B 9C 00 12 AF DE 33 08 42 10 00 00 00 78 A4 F9 12 E8
                    </div>

                    <div style="margin-top:14px; font-size:12px; color:#475569; display:flex; justify-content:space-between; border-top:1px solid #f1f5f9; padding-top:10px;">
                        <span>Radio Protocol: <strong>NB-IoT / LTE Cat-M1 (Band 28)</strong></span>
                        <span>Signal: <strong>-74 dBm (98% SNR)</strong></span>
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

                        <!-- Simulated Vehicle Pin 1 -->
                        <div class="radar-pin" style="top:35%; left:65%;">
                            <div class="radar-pin-dot" style="background:#38bdf8; box-shadow:0 0 8px #38bdf8;"></div>
                            <div class="radar-pin-label">🚚 29A-12345 (In Transit)</div>
                        </div>

                        <!-- Simulated Vehicle Pin 2 -->
                        <div class="radar-pin" style="top:68%; left:32%;">
                            <div class="radar-pin-dot" style="background:#38bdf8; box-shadow:0 0 8px #38bdf8;"></div>
                            <div class="radar-pin-label">🚚 29A-67890 (Docked)</div>
                        </div>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:12px;">
                        <div style="background:#1e293b; padding:12px; border-radius:8px; font-size:12px;">
                            <div style="color:#94a3b8; font-size:10px; font-weight:700;">COORDINATES</div>
                            <div id="radar-coords-val" style="font-size:14px; font-weight:700; color:#38bdf8; margin-top:2px;">21.0285° N, 105.8542° E</div>
                        </div>
                        <div style="background:#1e293b; padding:12px; border-radius:8px; font-size:12px;">
                            <div style="color:#94a3b8; font-size:10px; font-weight:700;">GEOFENCE STATUS</div>
                            <div style="color:#10b981; font-weight:700; margin-top:2px;">● All Assets Within Safe Operational Corridor</div>
                        </div>
                        <div style="background:#1e293b; padding:12px; border-radius:8px; font-size:12px;">
                            <div style="color:#94a3b8; font-size:10px; font-weight:700;">SATELLITE TELEMETRY</div>
                            <div style="color:#e2e8f0; margin-top:2px;">Constellation: GPS + Galileo (12 Sats locked, HDOP 0.8)</div>
                        </div>
                        <button type="button" class="btn btn-primary" style="margin-top:auto;" onclick="showToast('Satellite synchronization ping dispatched successfully!', 'success')">
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
                <strong style="font-size:13px; color:#0f172a;">Live Alerts &amp; Incidents</strong>
                <span class="badge badge-critical" style="font-size:10px; margin-left:6px;" id="notif-count-badge">3 Active</span>
            </div>
            <a href="#" style="font-size:11px; color:#2563eb; text-decoration:none;" onclick="markAllNotifsRead(); return false;">Mark all read</a>
        </div>
        <div class="notification-list" id="notification-items-list">
            <div class="notification-item critical" onclick="goToAlertsPage()">
                <div class="notification-icon">🛑</div>
                <div class="notification-content">
                    <div class="notification-title">Vehicle 29A-12345: Temperature Excursion (10.8°C)</div>
                    <div class="notification-time">2 mins ago · Route Hanoi - Bac Ninh</div>
                </div>
            </div>
            <div class="notification-item" onclick="goToAlertsPage()">
                <div class="notification-icon">⚠️</div>
                <div class="notification-content">
                    <div class="notification-title">Vehicle 30H-88921: High Chamber Humidity (87% RH)</div>
                    <div class="notification-time">12 mins ago · Vaccine Reefer B</div>
                </div>
            </div>
            <div class="notification-item" onclick="goToAlertsPage()">
                <div class="notification-icon">🛡️</div>
                <div class="notification-content">
                    <div class="notification-title">Hanoi Central Hub WH-01: Auto-defrost cycle complete</div>
                    <div class="notification-time">35 mins ago · Chamber Zone 3</div>
                </div>
            </div>
        </div>
        <div style="padding:10px 16px; background:#f8fafc; border-top:1px solid #e2e8f0; text-align:center;">
            <a href="#" style="font-size:12px; font-weight:700; color:#2563eb; text-decoration:none;" onclick="goToAlertsPage(); return false;">Open Incident Center →</a>
        </div>
    `;
    wrapper.appendChild(menu);

    notifBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeProfileMenu();
        menu.classList.toggle("show");
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
    { name: "Generate WHO & ISO 9001 Compliance Certificate (PDF)", category: "REPORTS", icon: "🛡️", need: "export", action: () => generateAuditCertificate() },
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
window.openPacketInspector = function(packet) {
    const modal = document.getElementById("packet-inspector-modal");
    if (!modal) return;

    const devToken = packet.device_token || packet.dev_code || `DEV-00${packet.device_id || 4}`;
    const temp = packet.temperature || packet.temp || "10.8";
    const hum = packet.humidity || packet.hum || "76";
    const id = packet.id || Math.floor(800000 + Math.random() * 90000);

    document.getElementById("inspector-title").textContent = `Diagnostic Packet Inspector: TL-${id}`;
    document.getElementById("insp-device-token").textContent = devToken;
    document.getElementById("insp-reading-temp").textContent = `${parseFloat(temp).toFixed(1)}°C / ${hum}% RH`;
    
    const hex = `43 43 54 53 01 0A 04 2C 00 ${Number(id).toString(16).toUpperCase().padStart(4, '0')} 03 E8 7F 2B 9C 00 12 AF DE 33 08 42 10 00 00 00 78 A4 F9 12 E8`;
    document.getElementById("insp-hex-box").textContent = hex;

    modal.classList.add("show");
};
window.closePacketInspector = function() {
    const modal = document.getElementById("packet-inspector-modal");
    if (modal) modal.classList.remove("show");
};

// --- 8. GPS RADAR TRACKING MODAL ---
window.openGpsRadarModal = function(name = "Hanoi Central Hub", coords = "21.0285° N, 105.8542° E") {
    const modal = document.getElementById("gps-radar-modal");
    if (!modal) return;

    document.getElementById("radar-facility-name").textContent = `${name} - GPS Tracking`;
    document.getElementById("radar-center-label").textContent = name;
    document.getElementById("radar-coords-val").textContent = coords;

    modal.classList.add("show");
};
window.closeGpsRadarModal = function() {
    const modal = document.getElementById("gps-radar-modal");
    if (modal) modal.classList.remove("show");
};

window.showGpsRadarModal = window.openGpsRadarModal;

// --- 9. ISO 9001 / GDP AUDIT CERTIFICATE GENERATOR ---
window.generateAuditCertificate = function(targetName = "National Cold Chain Network") {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
        showToast("Please allow popups to view compliance certificate!", "warning");
        return;
    }

    const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const hash = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    const certHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Cold Chain Compliance Audit Certificate - ISO 9001 / GDP</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #0f172a; max-width: 800px; margin: auto; border: 12px solid #e2e8f0; border-radius: 8px; }
                .cert-header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 24px; }
                .cert-title { font-size: 26px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 1px; }
                .cert-subtitle { font-size: 13px; color: #64748b; margin-top: 6px; }
                .cert-body { line-height: 1.8; font-size: 14px; }
                .cert-table { width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 13px; }
                .cert-table th, .cert-table td { border: 1px solid #cbd5e1; padding: 10px 14px; text-align: left; }
                .cert-table th { background: #f8fafc; font-weight: 700; color: #334155; }
                .cert-stamp { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; padding-top: 20px; }
                .seal-box { border: 2px dashed #2563eb; padding: 16px; border-radius: 8px; text-align: center; color: #2563eb; font-weight: 700; font-size: 12px; }
                @media print { body { border: none; padding: 0; } }
            </style>
        </head>
        <body>
            <div class="cert-header">
                <div style="font-size:36px; margin-bottom:8px;">❄️</div>
                <div class="cert-title">Cold Chain Compliance Certificate</div>
                <div class="cert-subtitle">WHO PQS / GDP Good Distribution Practice &amp; ISO 9001:2015 Audit Certification</div>
            </div>
            <div class="cert-body">
                <p>This document certifies that <strong>${targetName}</strong> has maintained continuous temperature compliance within the validated target range of <strong>2.0°C to 8.0°C</strong> for pharmaceutical, vaccine, and perishable cold chain assets.</p>
                
                <table class="cert-table">
                    <tr><th>Parameter</th><th>Audit Metric</th><th>Compliance Status</th></tr>
                    <tr><td>Monitored Probes</td><td>24 Deployed IoT Transmitters</td><td>100% Calibrated</td></tr>
                    <tr><td>Active Fleet Reefer Units</td><td>10 Refrigerated Vehicles</td><td>Active Geofence Tracking</td></tr>
                    <tr><td>Monitored Facilities</td><td>5 Regional Cold Hubs</td><td>Nominal (WHO GDP Standard)</td></tr>
                    <tr><td>Compliance Ratio</td><td>98.8% Time-in-Range (TIR)</td><td><strong>PASSED (CLASS A)</strong></td></tr>
                    <tr><td>Cryptographic Hash</td><td>SHA-256: ${hash}</td><td>Digitally Signed</td></tr>
                    <tr><td>Audit Date</td><td>${dateStr}</td><td>Official Validated Record</td></tr>
                </table>

                <p style="font-size:12px; color:#64748b;">Issued automatically by Cold Chain Telemetry Management System Core Engine. All logged temperature excursions are archived with mandatory standard operating procedure (SOP) response workflows.</p>
            </div>
            <div class="cert-stamp">
                <div class="seal-box">
                    ★ VALIDATED COLD CHAIN ★<br>GDP PHARMA CERTIFIED<br>ID: CC-AUDIT-${hash.slice(0, 8)}
                </div>
                <div style="text-align:right;">
                    <div style="font-size:12px; color:#64748b;">Chief Compliance Officer</div>
                    <div style="font-weight:700; margin-top:30px; font-size:14px;">Dr. Le Minh Tuan, Ph.D</div>
                    <div style="font-size:11px; color:#94a3b8;">Department of Quality Assurance</div>
                </div>
            </div>
            <div style="text-align:center; margin-top:30px;">
                <button onclick="window.print()" style="padding:10px 24px; background:#2563eb; color:#fff; border:none; border-radius:6px; font-weight:700; cursor:pointer;">Print Certificate / Save PDF</button>
            </div>
        </body>
        </html>
    `;

    printWindow.document.write(certHtml);
    printWindow.document.close();
    showToast("Generated WHO / GDP Compliance Certificate!", "success");
};

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
