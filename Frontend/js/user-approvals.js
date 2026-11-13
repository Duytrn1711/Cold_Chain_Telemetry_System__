const approvalSafe = (value) => String(value ?? "—").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

document.addEventListener("DOMContentLoaded", async () => {
    if (!window.Roles || Roles.current() !== "ADMIN") {
        window.location.href = "../dashboard.html";
        return;
    }
    document.getElementById("refresh-requests").addEventListener("click", loadRegistrationRequests);
    document.getElementById("requests-body").addEventListener("click", handleApprovalAction);
    await loadRegistrationRequests();
});

async function loadRegistrationRequests() {
    const body = document.getElementById("requests-body");
    body.innerHTML = '<tr><td class="approval-message" colspan="6">Đang tải yêu cầu…</td></tr>';
    try {
        const response = await api.get("/auth/registration-requests");
        if (!response.success || !Array.isArray(response.data)) throw new Error(response.message || "Không thể tải yêu cầu");
        if (!response.data.length) {
            body.innerHTML = '<tr><td class="approval-message" colspan="6">Không có yêu cầu đăng ký đang chờ duyệt.</td></tr>';
            return;
        }
        body.innerHTML = response.data.map((user) => `<tr>
            <td><strong>${approvalSafe(user.full_name)}</strong></td>
            <td>${approvalSafe(user.username)}</td>
            <td>${approvalSafe(user.email)}</td>
            <td><select class="approval-role" aria-label="Vai trò cấp cho ${approvalSafe(user.username)}"><option value="STAFF" ${user.requested_role === "STAFF" ? "selected" : ""}>Staff</option><option value="MANAGER" ${user.requested_role === "MANAGER" ? "selected" : ""}>Manager</option></select></td>
            <td>${user.created_at ? new Date(user.created_at).toLocaleString() : "—"}</td>
            <td><div class="approval-actions"><button type="button" class="btn btn-primary" data-user-id="${Number(user.id)}" data-decision="APPROVE">Phê duyệt</button><button type="button" class="btn btn-reject" data-user-id="${Number(user.id)}" data-decision="REJECT">Từ chối</button></div></td>
        </tr>`).join("");
    } catch (error) {
        body.innerHTML = `<tr><td class="approval-message" colspan="6">${approvalSafe(error.message || "Không thể tải yêu cầu đăng ký")}</td></tr>`;
    }
}

async function handleApprovalAction(event) {
    const button = event.target.closest("button[data-user-id]");
    if (!button) return;
    const decision = button.dataset.decision;
    const row = button.closest("tr");
    const role = row.querySelector(".approval-role").value;
    if (decision === "REJECT" && !window.confirm("Từ chối yêu cầu đăng ký này?")) return;
    button.disabled = true;
    try {
        const response = await api.request(`/auth/users/${button.dataset.userId}/approval`, {
            method: "PATCH",
            body: JSON.stringify({ decision, role })
        });
        if (!response.success) throw new Error(response.message || "Không thể cập nhật yêu cầu");
        await loadRegistrationRequests();
    } catch (error) {
        window.alert(error.message || "Không thể cập nhật yêu cầu");
        button.disabled = false;
    }
}
