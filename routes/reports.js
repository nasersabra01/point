const express = require('express');
const router = express.Router();
const periodController = require('../controllers/reports');

router.get('/periodReport', periodController.periodReport );
router.get('/piredView/:from/:to', periodController.piredView );


module.exports = router;