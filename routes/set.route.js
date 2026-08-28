const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/set.controller');

// عرض صفحة الإعدادات
router.get('/settings', settingsController.getSettingsPage);

// إضافة مصروف ثابت
router.post('/addFixedExpenses', settingsController.addFixedExpenses);
router.get('/addFixedExpensesPage', settingsController.addFixedExpensesPage);

// تعديل مصروف ثابت
// router.post('//:id', settingsController.updateFixedExpense);

// حذف مصروف ثابت
router.post('/deleteFixedExpense/:id', settingsController.deleteFixedExpense);

module.exports = router;