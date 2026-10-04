/**
 * Authentication management for Cold Chain Telemetry System
 */

document.addEventListener("DOMContentLoaded", () => {
    // 1. Logic cho trang Login (nếu có form login)
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        // Nếu đã có token hợp lệ thì chuyển thẳng vào dashboard
        if (api.getToken()) {
            window.location.href = "dashboard.html";
            return;
        }

        const usernameInput = document.getElementById("username");
        const passwordInput = document.getElementById("password");
        const rememberCheckbox = document.getElementById("remember-me");
        const togglePasswordBtn = document.getElementById("toggle-password");
        const submitBtn = document.getElementById("login-submit-btn");
        const errorAlert = document.getElementById("login-error");

        // Toggle password visibility
        if (togglePasswordBtn && passwordInput) {
            togglePasswordBtn.addEventListener("click", () => {
                const isPassword = passwordInput.type === "password";
                passwordInput.type = isPassword ? "text" : "password";
                togglePasswordBtn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
            });
        }

        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = usernameInput.value.trim();
            const password = passwordInput.value;
            const remember = rememberCheckbox ? rememberCheckbox.checked : true;

            if (!username || !password) {
                if (errorAlert) {
                    errorAlert.textContent = "Please enter your username/email and password";
                    errorAlert.style.display = "block";
                }
                return;
            }

            try {
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = `<span>Signing in...</span>`;
                }
                if (errorAlert) errorAlert.style.display = "none";

                const response = await api.post("/auth/login", {
                    username,
                    password
                });

                if (response.success && response.data) {
                    api.setToken(response.data.token, remember);
                    api.setCurrentUser(response.data.user, remember);
                    
                    showToast("Signed in successfully! Redirecting...", "success");
                    setTimeout(() => {
                        window.location.href = "dashboard.html";
                    }, 500);
                } else {
                    if (errorAlert) {
                        errorAlert.textContent = response.message || "Invalid username or password";
                        errorAlert.style.display = "block";
                    } else {
                        showToast(response.message || "Sign in failed", "error");
                    }
                }
            } catch (err) {
                if (errorAlert) {
                    errorAlert.textContent = err.message || "Unable to connect to server. Please try again.";
                    errorAlert.style.display = "block";
                } else {
                    showToast(err.message || "Connection error", "error");
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = `<span>Sign In to Dashboard</span> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`;
                }
            }
        });
    }

    // 2. Logic for protected pages (Sidebar user profile & logout)
    initProtectedPage();
});

function initProtectedPage() {
    // Skip auth check if on login page
    if (window.location.pathname.endsWith("login.html") || window.location.pathname === "/") {
        return;
    }

    const token = api.getToken();
    if (!token) {
        const isSubpage = window.location.pathname.includes("/pages/");
        window.location.href = isSubpage ? "../login.html" : "login.html";
        return;
    }

    if (window.Roles) {
        Roles.renderSidebar();
        Roles.applyUi();
    }

    const currentUser = api.getCurrentUser();
    const userNameEl = document.getElementById("sidebar-user-name");
    const userRoleEl = document.getElementById("sidebar-user-role");
    const userAvatarEl = document.getElementById("sidebar-user-avatar");

    if (currentUser) {
        if (userNameEl) userNameEl.textContent = currentUser.full_name || currentUser.username;
        if (userRoleEl) userRoleEl.textContent = Roles ? Roles.label(currentUser.role) : (currentUser.role || "User");
        if (userAvatarEl && Roles) userAvatarEl.textContent = Roles.initials(currentUser);
    }

    const logoutBtn = document.getElementById("sidebar-logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            if (confirm("Are you sure you want to sign out?")) {
                api.logout();
            }
        });
    }
}

// Global quick fill helper for demo logins
window.quickFillLogin = function(u, p, autoSubmit = false) {
    const uInput = document.getElementById("username");
    const pInput = document.getElementById("password");
    if (uInput && pInput) {
        uInput.value = u;
        pInput.value = p;
        showToast(`Selected account: ${u}`, "success");
        if (autoSubmit) {
            const submitBtn = document.getElementById("login-submit-btn");
            if (submitBtn) {
                setTimeout(() => submitBtn.click(), 100);
            }
        }
    }
};

