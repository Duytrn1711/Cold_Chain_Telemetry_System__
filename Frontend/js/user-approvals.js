const approvalSafe = (value) => String(value ?? "—").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const approvalRoles = ["USER", "STAFF", "ADMIN"];
const approvalRoleLabel = (role) => ({ USER: "User", STAFF: "Staff", ADMIN: "Admin" }[role] || role);

document.addEventListener("DOMContentLoaded", async () => {
    if (!window.Roles || Roles.current() !== "ADMIN") {
        window.location.href = "../dashboard.html";
        return;
    }
    document.getElementById("refresh-requests").addEventListener("click", loadManagedUsers);
    document.getElementById("requests-body").addEventListener("click", handleUserAction);
    await loadManagedUsers();
});

async function loadManagedUsers() {
    const body = document.getElementById("requests-body");
    body.innerHTML = '<tr><td class="approval-message" colspan="7">Đang tải tài khoản…</td></tr>';
    try {
        const response = await api.get("/auth/users");
        if (!response.success || !Array.isArray(response.data)) throw new Error(response.message || "Không thể tải danh sách tài khoản");
        if (!response.data.length) {
            body.innerHTML = '<tr><td class="approval-message" colspan="7">Chưa có tài khoản nào.</td></tr>';
            return;
        }

        const currentUserId = String((api.getCurrentUser() || {}).id || "");
        body.innerHTML = response.data.map((user) => {
            const userId = String(user.id);
            const role = String(user.role || "USER").toUpperCase();
            const status = String(user.status || "UNKNOWN").toUpperCase();
            const isPending = status === "PENDING";
            const isSelf = userId === currentUserId;
            const options = [...new Set([...(isPending ? ["USER", "STAFF"] : approvalRoles), role])].map((option) =>
                `<option value="${approvalSafe(option)}" ${role === option ? "selected" : ""}>${approvalSafe(approvalRoleLabel(option))}</option>`
            ).join("");
            const statusClass = status === "ACTIVE" ? "active" : status === "PENDING" ? "pending" : status === "REJECTED" || status === "INACTIVE" ? "rejected" : "";
            const approvalButtons = isPending
                ? `<button type="button" class="btn btn-primary" data-action="approve" data-user-id="${approvalSafe(userId)}">Phê duyệt</button><button type="button" class="btn btn-reject" data-action="reject" data-user-id="${approvalSafe(userId)}">Từ chối</button>`
                : "";
            return `<tr>
                <td><strong>${approvalSafe(user.full_name)}</strong></td>
                <td>${approvalSafe(user.username)}</td>
                <td>${approvalSafe(user.email)}</td>
                <td><select class="approval-role" aria-label="Vai trò của ${approvalSafe(user.username)}" ${isSelf ? "disabled" : ""}>${options}</select></td>
                <td><span class="approval-status ${statusClass ? `approval-status-${statusClass}` : ""}">${approvalSafe(status)}</span></td>
                <td>${user.created_at ? new Date(user.created_at).toLocaleString() : "—"}</td>
                <td><div class="approval-actions">
                    <button type="button" class="btn btn-secondary" data-action="save-role" data-user-id="${approvalSafe(userId)}" ${isSelf ? "disabled" : ""}>Lưu vai trò</button>
                    ${approvalButtons}
                    <button type="button" class="btn btn-reject" data-action="delete" data-user-id="${approvalSafe(userId)}" ${isSelf ? "disabled" : ""}>Xóa</button>
                </div></td>
            </tr>`;
        }).join("");
    } catch (error) {
        body.innerHTML = `<tr><td class="approval-message" colspan="7">${approvalSafe(error.message || "Không thể tải danh sách tài khoản")}</td></tr>`;
    }
}

async function handleUserAction(event) {
    const button = event.target.closest("button[data-action][data-user-id]");
    if (!button) return;
    const action = button.dataset.action;
    const userId = button.dataset.userId;
    const row = button.closest("tr");
    const roleSelect = row.querySelector(".approval-role");
    const role = roleSelect?.value;

    if (action === "reject" && !window.confirm("Từ chối yêu cầu đăng ký này?")) return;
    if (action === "delete" && !window.confirm("Xóa tài khoản này? Thao tác này không thể hoàn tác.")) return;

    button.disabled = true;
    try {
        let response;
        if (action === "approve" || action === "reject") {
            response = await api.request(`/auth/users/${encodeURIComponent(userId)}/approval`, {
                method: "PATCH",
                body: JSON.stringify({ decision: action === "approve" ? "APPROVE" : "REJECT", role })
            });
        } else if (action === "save-role") {
            response = await api.request(`/auth/users/${encodeURIComponent(userId)}/role`, {
                method: "PATCH",
                body: JSON.stringify({ role })
            });
        } else if (action === "delete") {
            response = await api.request(`/auth/users/${encodeURIComponent(userId)}`, { method: "DELETE" });
        }
        if (!response?.success) throw new Error(response?.message || "Không thể cập nhật tài khoản");
        await loadManagedUsers();
    } catch (error) {
        window.alert(error.message || "Không thể cập nhật tài khoản");
        button.disabled = false;
    }
}
