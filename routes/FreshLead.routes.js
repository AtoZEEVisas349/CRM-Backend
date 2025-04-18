const express = require("express");
const router = express.Router();
const freshLeadController = require("../controllers/FreshLead.controller");

// POST - Create a new fresh lead
router.post("/", freshLeadController.createFreshLead);
router.put("/update-followup/:id", freshLeadController.updateFollowUp);

module.exports = router;
