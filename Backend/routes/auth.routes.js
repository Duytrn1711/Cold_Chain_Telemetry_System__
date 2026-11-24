const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");

// Route đăng nhập
router.post("/login", authController.login);
router.post("/register", authController.register);
router.get("/users", authController.verifyToken, authController.requireMinRole("ADMIN"), authController.listUsers);
router.patch("/users/:id/role", authController.verifyToken, authController.requireMinRole("ADMIN"), authController.updateUserRole);
router.delete("/users/:id", authController.verifyToken, authController.requireMinRole("ADMIN"), authController.deleteUser);
router.get("/registration-requests", authController.verifyToken, authController.requireMinRole("ADMIN"), authController.listRegistrationRequests);
router.patch("/users/:id/approval", authController.verifyToken, authController.requireMinRole("ADMIN"), authController.reviewRegistrationRequest);

// Route lấy thông tin người dùng hiện tại (yêu cầu đăng nhập)
router.get("/me", authController.verifyToken, authController.getMe);

// Route đổi mật khẩu
router.put("/change-password", authController.verifyToken, authController.changePassword);

module.exports = router;

