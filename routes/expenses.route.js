const express = require('express');
const router = express.Router();

const expensesController = require('../controllers/expenses.controller');

// router.get('/expenseHome/:id', expensesController.expenseHome);
router.get('/addExpensesPage/:id', expensesController.addExpensesPage);
router.get('/editExpensesPage/:id', expensesController.editExpensesPage);
router.get('/expensesReport', expensesController.expensesReport);
router.get('/expensesReportPdf', expensesController.expensesReportPdf);
router.post('/addExpenses', expensesController.addExpenses);
router.post('/updateExpenses/:id', expensesController.updateExpenses);
router.post('/deleteExpenses/:id', expensesController.deleteExpenses);

module.exports = router;