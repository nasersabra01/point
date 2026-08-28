const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employee.controller');

router.get('/employees', employeeController.getEmployeesPage);
router.get('/addEmPage', employeeController.addEmPage);

router.post('/createEmployee', employeeController.createEmployee);

router.post('/updateEmployee/:id', employeeController.updateEmployee);

router.post('/deleteEmployee/:id', employeeController.deleteEmployee);
router.get('/getEditEmployeePage/:id', employeeController.getEditEmployeePage);

module.exports = router;