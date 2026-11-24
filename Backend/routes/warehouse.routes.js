const express = require("express");
const router = express.Router();
const warehouseController = require("../controllers/warehouse.controller");
const authController = require("../controllers/auth.controller");
const { verifyToken, requireMinRole } = authController;

router.get("/", verifyToken, requireMinRole("STAFF"), warehouseController.getAllWarehouses);
router.get("/:id", verifyToken, requireMinRole("STAFF"), warehouseController.getWarehouseById);
router.post("/", verifyToken, requireMinRole("STAFF"), warehouseController.createWarehouse);
router.put("/:id", verifyToken, requireMinRole("STAFF"), warehouseController.updateWarehouse);
router.delete("/:id", verifyToken, requireMinRole("ADMIN"), warehouseController.deleteWarehouse);

module.exports = router;
