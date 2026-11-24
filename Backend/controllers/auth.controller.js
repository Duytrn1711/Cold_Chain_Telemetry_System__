const pool = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be configured with at least 32 characters");
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// POST /api/auth/login
exports.login = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const identity = (username || email || "").trim();

        if (!identity || !password) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "Vui lòng nhập tên đăng nhập/email và mật khẩu"
            });
        }

        // Tìm user theo username
        const result = await pool.query(
            "SELECT id, username, email, password, full_name, role, status, created_at FROM users WHERE username = $1 OR LOWER(email) = LOWER($1) LIMIT 1",
            [identity]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                data: null,
                message: "Tài khoản hoặc mật khẩu không chính xác"
            });
        }

        const user = result.rows[0];

        // Kiểm tra mật khẩu (hỗ trợ cả hash bcrypt lẫn mật khẩu gốc ban đầu trong database)
        let isMatch = false;
        try {
            isMatch = await bcrypt.compare(password, user.password);
        } catch (e) {
            isMatch = false;
        }

        if (!isMatch && password === user.password) {
            isMatch = true;
            // Nâng cấp mật khẩu thành hash bcrypt trong cơ sở dữ liệu
            try {
                const hashed = await bcrypt.hash(password, 10);
                await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hashed, user.id]);
            } catch (updateErr) {
                console.warn("Could not upgrade user password hash:", updateErr.message);
            }
        }

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                data: null,
                message: "Tài khoản hoặc mật khẩu không chính xác"
            });
        }

        if (user.status !== "ACTIVE") {
            const statusMessage = user.status === "PENDING"
                ? "Tài khoản đang chờ quản trị viên phê duyệt"
                : (user.status === "REJECTED" ? "Yêu cầu đăng ký chưa được phê duyệt. Vui lòng liên hệ quản trị viên" : "Tài khoản của bạn đã bị vô hiệu hóa");
            return res.status(403).json({ success: false, data: null, message: statusMessage });
        }

        // Tạo JWT Token
        const tokenPayload = {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            role: user.role
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        return res.json({
            success: true,
            data: {
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    full_name: user.full_name,
                    role: user.role,
                    status: user.status
                }
            },
            message: "Đăng nhập thành công"
        });
    } catch (error) {
        console.error("Auth login error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ nội bộ khi đăng nhập"
        });
    }
};

// POST /api/auth/register - Tạo yêu cầu tài khoản chờ admin phê duyệt
exports.register = async (req, res) => {
    const body = req.body || {};
    const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = String(body.role || "").toUpperCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (fullName.length < 2 || fullName.length > 255 || username.length < 3 || username.length > 100 ||
        !emailPattern.test(email) || email.length > 255 || password.length < 10 || password.length > 128 ||
        !["STAFF", "MANAGER"].includes(role)) {
        return res.status(400).json({
            success: false,
            data: null,
            message: "Vui lòng nhập họ tên, username, email hợp lệ, mật khẩu từ 10 ký tự và vai trò Staff hoặc Manager"
        });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(91743021)");
        const existing = await client.query(
            "SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2) LIMIT 1",
            [username, email]
        );
        if (existing.rowCount) {
            await client.query("ROLLBACK");
            return res.status(409).json({ success: false, data: null, message: "Username hoặc email đã được sử dụng" });
        }

        const nextId = await client.query("SELECT COALESCE(MAX(id), 0) + 1 AS id FROM users");
        await client.query(`
            INSERT INTO users (id, username, email, password, full_name, role, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', CURRENT_TIMESTAMP)
        `, [nextId.rows[0].id, username, email, passwordHash, fullName, role]);
        await client.query("COMMIT");
        return res.status(201).json({
            success: true,
            data: { username, status: "PENDING" },
            message: "Đã gửi yêu cầu. Tài khoản sẽ đăng nhập được sau khi admin phê duyệt."
        });
    } catch (error) {
        await client.query("ROLLBACK");
        if (error.code === "23505") {
            return res.status(409).json({ success: false, data: null, message: "Username hoặc email đã được sử dụng" });
        }
        console.error("Auth registration error:", error);
        return res.status(500).json({ success: false, data: null, message: "Không thể gửi yêu cầu đăng ký" });
    } finally {
        client.release();
    }
};

// GET /api/auth/registration-requests - ADMIN only
exports.listRegistrationRequests = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, username, email, full_name, role AS requested_role, status, created_at
            FROM users WHERE status = 'PENDING' ORDER BY created_at ASC
        `);
        return res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Registration request list error:", error);
        return res.status(500).json({ success: false, data: null, message: "Không thể tải yêu cầu đăng ký" });
    }
};

// GET /api/auth/users - ADMIN only. Never return password hashes.
exports.listUsers = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, username, email, full_name, role, status, created_at
            FROM users
            ORDER BY created_at DESC NULLS LAST, id DESC
        `);
        return res.json({ success: true, data: result.rows, message: "Lấy danh sách tài khoản thành công" });
    } catch (error) {
        console.error("User management list error:", error.code || "unknown");
        return res.status(500).json({ success: false, data: null, message: "Không thể tải danh sách tài khoản" });
    }
};

// PATCH /api/auth/users/:id/role - ADMIN only
exports.updateUserRole = async (req, res) => {
    const requestedRole = String((req.body || {}).role || "").trim().toUpperCase();
    const rawUserId = String(req.params.id || "");
    if (!/^\d{1,19}$/.test(rawUserId) || BigInt(rawUserId) <= 0n || BigInt(rawUserId) > 9223372036854775807n || !["USER", "STAFF", "MANAGER", "ADMIN"].includes(requestedRole)) {
        return res.status(400).json({ success: false, data: null, message: "Tài khoản hoặc vai trò không hợp lệ" });
    }
    const userId = BigInt(rawUserId).toString();
    if (String(req.user.id) === userId) {
        return res.status(409).json({ success: false, data: null, message: "Bạn không thể tự thay đổi vai trò của mình" });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(91743022)");
        const target = await client.query("SELECT id, role, status FROM users WHERE id = $1::BIGINT FOR UPDATE", [userId]);
        if (!target.rowCount) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, data: null, message: "Không tìm thấy tài khoản" });
        }
        if (target.rows[0].status === "PENDING" && !["STAFF", "MANAGER"].includes(requestedRole)) {
            await client.query("ROLLBACK");
            return res.status(400).json({ success: false, data: null, message: "Yêu cầu đang chờ duyệt chỉ được gán vai trò Staff hoặc Manager" });
        }
        if (target.rows[0].role === "ADMIN" && target.rows[0].status === "ACTIVE" && requestedRole !== "ADMIN") {
            const admins = await client.query("SELECT COUNT(*)::INT AS count FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE'");
            if (admins.rows[0].count <= 1) {
                await client.query("ROLLBACK");
                return res.status(409).json({ success: false, data: null, message: "Không thể hạ quyền quản trị viên cuối cùng đang hoạt động" });
            }
        }
        const updated = await client.query(`
            UPDATE users SET role = $2::VARCHAR
            WHERE id = $1::BIGINT
            RETURNING id, username, email, full_name, role, status, created_at
        `, [userId, requestedRole]);
        await client.query("COMMIT");
        return res.json({ success: true, data: updated.rows[0], message: "Đã cập nhật vai trò tài khoản" });
    } catch (error) {
        try { await client.query("ROLLBACK"); } catch {}
        console.error("User role update error:", error.code || "unknown");
        return res.status(500).json({ success: false, data: null, message: "Không thể cập nhật vai trò tài khoản" });
    } finally {
        client.release();
    }
};

// DELETE /api/auth/users/:id - ADMIN only
exports.deleteUser = async (req, res) => {
    const rawUserId = String(req.params.id || "");
    if (!/^\d{1,19}$/.test(rawUserId) || BigInt(rawUserId) <= 0n || BigInt(rawUserId) > 9223372036854775807n) {
        return res.status(400).json({ success: false, data: null, message: "Mã tài khoản không hợp lệ" });
    }
    const userId = BigInt(rawUserId).toString();
    if (String(req.user.id) === userId) {
        return res.status(409).json({ success: false, data: null, message: "Bạn không thể xóa tài khoản đang đăng nhập" });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(91743022)");
        const target = await client.query("SELECT id, role, status FROM users WHERE id = $1::BIGINT FOR UPDATE", [userId]);
        if (!target.rowCount) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, data: null, message: "Không tìm thấy tài khoản" });
        }
        if (target.rows[0].role === "ADMIN" && target.rows[0].status === "ACTIVE") {
            const admins = await client.query("SELECT COUNT(*)::INT AS count FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE'");
            if (admins.rows[0].count <= 1) {
                await client.query("ROLLBACK");
                return res.status(409).json({ success: false, data: null, message: "Không thể xóa quản trị viên cuối cùng đang hoạt động" });
            }
        }
        await client.query("DELETE FROM users WHERE id = $1::BIGINT", [userId]);
        await client.query("COMMIT");
        return res.json({ success: true, data: { id: userId }, message: "Đã xóa tài khoản" });
    } catch (error) {
        try { await client.query("ROLLBACK"); } catch {}
        if (error.code === "23503") {
            return res.status(409).json({ success: false, data: null, message: "Tài khoản đang được tham chiếu bởi dữ liệu khác và không thể xóa" });
        }
        console.error("User deletion error:", error.code || "unknown");
        return res.status(500).json({ success: false, data: null, message: "Không thể xóa tài khoản" });
    } finally {
        client.release();
    }
};

// PATCH /api/auth/users/:id/approval - ADMIN only
exports.reviewRegistrationRequest = async (req, res) => {
    const decision = String((req.body || {}).decision || "").toUpperCase();
    const requestedRole = String((req.body || {}).role || "").toUpperCase();
    if (!["APPROVE", "REJECT"].includes(decision) || (decision === "APPROVE" && !["STAFF", "MANAGER"].includes(requestedRole))) {
        return res.status(400).json({ success: false, data: null, message: "Quyết định hoặc vai trò phê duyệt không hợp lệ" });
    }

    try {
        const result = await pool.query(`
            UPDATE users SET
                status = $2::VARCHAR,
                role = CASE WHEN $2::VARCHAR = 'ACTIVE'::VARCHAR THEN $3::VARCHAR ELSE role END,
                reviewed_by = $4::BIGINT,
                reviewed_at = CURRENT_TIMESTAMP
            WHERE id = $1::BIGINT AND status = 'PENDING'::VARCHAR
            RETURNING id, username, email, full_name, role, status, reviewed_by, reviewed_at
        `, [req.params.id, decision === "APPROVE" ? "ACTIVE" : "REJECTED", requestedRole || null, req.user.id]);
        if (!result.rowCount) {
            return res.status(409).json({ success: false, data: null, message: "Yêu cầu không còn ở trạng thái chờ duyệt" });
        }
        return res.json({ success: true, data: result.rows[0], message: decision === "APPROVE" ? "Đã phê duyệt tài khoản" : "Đã từ chối yêu cầu đăng ký" });
    } catch (error) {
        console.error("Registration review error:", error);
        return res.status(500).json({ success: false, data: null, message: "Không thể xử lý yêu cầu đăng ký" });
    }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            "SELECT id, username, full_name, role, status, created_at FROM users WHERE id = $1",
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                data: null,
                message: "Không tìm thấy người dùng"
            });
        }

        return res.json({
            success: true,
            data: result.rows[0],
            message: "Lấy thông tin người dùng thành công"
        });
    } catch (error) {
        console.error("Auth getMe error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi lấy thông tin người dùng"
        });
    }
};

// Middleware verifyToken
exports.verifyToken = async (req, res, next) => {
    const authHeader = req.headers["authorization"] || req.headers["Authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            data: null,
            message: "Không có token xác thực hoặc sai định dạng"
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const currentUser = await pool.query(
            "SELECT role, status FROM users WHERE id = $1::BIGINT",
            [decoded.id]
        );
        if (!currentUser.rowCount || currentUser.rows[0].status !== "ACTIVE") {
            return res.status(401).json({ success: false, data: null, message: "Tài khoản không còn quyền truy cập. Hãy đăng nhập lại." });
        }
        req.user = { ...decoded, role: currentUser.rows[0].role };
        return next();
    } catch (err) {
        if (err.name !== "JsonWebTokenError" && err.name !== "TokenExpiredError" && err.name !== "NotBeforeError") {
            console.error("Auth token database check failed:", err.code || "unknown");
            return res.status(500).json({ success: false, data: null, message: "Không thể xác minh phiên đăng nhập" });
        }
        return res.status(401).json({
            success: false,
            data: null,
            message: "Token không hợp lệ hoặc đã hết hạn"
        });
    }
};

const ROLE_RANK = { STAFF: 1, USER: 1, OPERATOR: 1, MANAGER: 2, ADMIN: 3 };

exports.requireMinRole = (minRole) => {
    return (req, res, next) => {
        const raw = String((req.user && req.user.role) || "STAFF").toUpperCase();
        const userRank = ROLE_RANK[raw] || 1;
        const needed = ROLE_RANK[String(minRole).toUpperCase()] || 3;
        if (userRank < needed) {
            return res.status(403).json({
                success: false,
                data: null,
                message: "Tài khoản của bạn không đủ quyền thực hiện thao tác này"
            });
        }
        next();
    };
};

// PUT /api/auth/change-password
exports.changePassword = async (req, res) => {
    try {
        const userId = req.user.id;
        const { current_password, new_password } = req.body;

        if (!current_password || !new_password) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "Vui lòng nhập mật khẩu hiện tại và mật khẩu mới"
            });
        }

        if (new_password.length < 6) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "Mật khẩu mới phải có ít nhất 6 ký tự"
            });
        }

        const userRes = await pool.query("SELECT password FROM users WHERE id = $1", [userId]);
        if (userRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                data: null,
                message: "Người dùng không tồn tại"
            });
        }

        const user = userRes.rows[0];
        let isMatch = false;
        try {
            isMatch = await bcrypt.compare(current_password, user.password);
        } catch (e) {
            isMatch = false;
        }

        if (!isMatch && current_password === user.password) {
            isMatch = true;
        }

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "Mật khẩu hiện tại không chính xác"
            });
        }

        const hashedPassword = await bcrypt.hash(new_password, 10);
        await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hashedPassword, userId]);

        return res.json({
            success: true,
            data: null,
            message: "Đổi mật khẩu thành công!"
        });
    } catch (error) {
        console.error("Auth changePassword error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi đổi mật khẩu"
        });
    }
};

