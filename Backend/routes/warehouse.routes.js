const express = require("express");
const router = express.Router();
const warehouseController = require("../controllers/warehouse.controller");
const authController = require("../controllers/auth.controller");
const { verifyToken, requireMinRole } = authController;

router.get("/", warehouseController.getAllWarehouses);
router.get("/:id", warehouseController.getWarehouseById);
router.post("/", verifyToken, requireMinRole("MANAGER"), warehouseController.createWarehouse);
router.put("/:id", verifyToken, requireMinRole("MANAGER"), warehouseController.updateWarehouse);
router.delete("/:id", verifyToken, requireMinRole("ADMIN"), warehouseController.deleteWarehouse);

module.exports = router;
