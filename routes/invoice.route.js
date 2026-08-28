

const express = require('express');
const router = express.Router();

const invoiceController = require('../controllers/invoice.controller');

// Create
router.get('/createInvoice/:id', invoiceController.createInvoice);
router.post('/storeInvoice/:id', invoiceController.storeInvoice);

// // Read
router.get('/invoiceDetailes/:id', invoiceController.invoiceDetailes);


// // Edit
router.get('/editInvoice/:shiftId/:id', invoiceController.editInvoice);
router.post('/updateInvoice/:shiftId/:id', invoiceController.updateInvoice);

// // Delete
router.post('/deleteInvoice/:id', invoiceController.deleteInvoice);
router.get('/print/:id', invoiceController.print);
router.get('/printA5/:id', invoiceController.printA5);
router.post('/toggleInvoiceMatch/:id', invoiceController.toggleInvoiceMatch);

module.exports = router;




