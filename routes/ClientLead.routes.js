const express = require("express");
const router = express.Router();
const {
  upload,
  uploadFile,
  getClientLeads,
  assignExecutive,
} = require("../controllers/ClientLead.controller");

router.post("/upload", upload.single("file"), uploadFile);
router.get("/getClients", getClientLeads);
router.put("/assign-executive/:id", assignExecutive);

module.exports = router;
