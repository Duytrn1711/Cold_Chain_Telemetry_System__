const pool = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "coldchain_secret_jwt_key_2026_super_secure";
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
            "SELECT id, username, password, full_name, role, status, created_at FROM users WHERE username = $1",
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

        if (user.status && user.status !== "ACTIVE") {
            return res.status(403).json({
                success: false,
                data: null,
                message: "Tài khoản của bạn đã bị vô hiệu hóa"
            });
        }

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
exports.verifyToken = (req, res, next) => {
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
        req.user = decoded;
        next();
    } catch (err) {
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

