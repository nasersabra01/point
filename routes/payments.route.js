const express = require('express');
const router = express.Router();

const paymentsController = require('../controllers/payments.controller');

router.get('/payments', paymentsController.paymentsList);

router.get('/addPaymentPage', paymentsController.addPaymentPage);
router.get('/editPaymentPage/:id', paymentsController.editPaymentPage);
router.post('/updatePayment/:id', paymentsController.updatePayment);

router.post('/createPayment', paymentsController.createPayment);

router.post('/deletePayment/:id', paymentsController.deletePayment);
router.get('/paymentsReport', paymentsController.paymentsReport);

module.exports = router;