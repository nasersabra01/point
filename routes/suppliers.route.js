const express = require('express');
const router = express.Router();
const suppliersController = require('../controllers/suppliers.controller');

router.get('/addSupplierPage', suppliersController.addSupplierPage);
router.post('/addSupplier', suppliersController.addSupplier);
router.get('/suppliersList', suppliersController.suppliersList);
router.get('/exportSuppliersExcel', suppliersController.exportSuppliersExcel);
router.get('/printSuppliersList', suppliersController.printSuppliersList);
router.get('/supplierPage/:id', suppliersController.supplierPage);
router.get('/editSupplierPage/:id', suppliersController.editSupplierPage);
router.post('/updateSupplier/:id', suppliersController.updateSupplier);
router.post('/deleteSupplier/:id', suppliersController.deleteSupplier);
router.get('/supplierStatement/:id', suppliersController.supplierStatement);
router.get('/supplierStatementReport/:id', suppliersController.supplierStatementReport);
router.get('/supplierPaymentsReport/:id',suppliersController.supplierPaymentsReport);
router.get(
    '/supplierInvoicesReport/:id',
    suppliersController.supplierInvoicesReport
);
router.get(
    '/supplierProductsReport/:id',
    suppliersController.supplierProductsReport
);

router.post('/matchSupplierAccount/:id', suppliersController.matchSupplierAccount);

module.exports = router;
