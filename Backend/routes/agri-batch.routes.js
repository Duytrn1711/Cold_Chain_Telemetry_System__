const express = require("express");
const controller = require("../controllers/agri-batch.controller");
const { verifyToken, requireMinRole } = require("../controllers/auth.controller");

const router = express.Router();
router.post("/pickup-requests", controller.requireAgriSecret, controller.createPickupRequest);
router.post("/:batchCode/inspection-decision", controller.requireAgriSecret, controller.updateInspectionDecision);
router.get("/", verifyToken, requireMinRole("STAFF"), controller.listBatches);
router.get("/:id", verifyToken, requireMinRole("STAFF"), controller.getBatch);
router.patch("/:id/logistics-status", verifyToken, requireMinRole("STAFF"), controller.transitionBatch);

module.exports = router;
