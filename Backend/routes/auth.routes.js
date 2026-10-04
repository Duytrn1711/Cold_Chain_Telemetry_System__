const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");

// Route đăng nhập
router.post("/login", authController.login);

// Route lấy thông tin người dùng hiện tại (yêu cầu đăng nhập)
router.get("/me", authController.verifyToken, authController.getMe);

// Route đổi mật khẩu
router.put("/change-password", authController.verifyToken, authController.changePassword);

module.exports = router;

