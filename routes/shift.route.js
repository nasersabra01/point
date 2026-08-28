const express = require("express");
const router = express.Router();

const { openNewShift, closeShift, archiveDaysPage, searchDayArchive, dayReport } = require("../controllers/shift.controller");

// فتح شيفت
router.post("/openNewShift", openNewShift);

router.post("/closeShift/:id", closeShift);
router.get('/archiveDays', archiveDaysPage);
router.get('/searchDayArchive', searchDayArchive);
router.get('/dayReport/:id', dayReport);

module.exports = router;