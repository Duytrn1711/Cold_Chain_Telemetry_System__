const express = require("express");
const router = express.Router();
const dataController = require("../controllers/data.controller");
const authController = require("../controllers/auth.controller");
const { verifyToken, requireMinRole } = authController;

router.get("/summary", verifyToken, requireMinRole("STAFF"), dataController.getSummary);
router.get("/reports", verifyToken, requireMinRole("STAFF"), dataController.getReportsData);
router.get("/", verifyToken, requireMinRole("STAFF"), dataController.getAllData);
router.get("/device/:deviceId", verifyToken, requireMinRole("STAFF"), dataController.getDeviceData);
router.post("/", verifyToken, requireMinRole("STAFF"), dataController.createData);

module.exports = router;
