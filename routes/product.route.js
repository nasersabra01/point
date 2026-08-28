const express = require('express');
const router = express.Router();

const productController = require('../controllers/products.controller');


router.get('/createProductPage/:id', productController.createProductPage);
router.post('/createProduct/:id', productController.createProduct);
router.get("/dayPage/:id", productController.dayPage);


router.get('/productSaleStatment/:id', productController.productSaleStatment);
router.post('/addSaleStatment/:id', productController.addSaleStatment);
router.post('/editSaleStatment/:id', productController.editSaleStatment);
router.post('/closeSaleStatment/:id', productController.closeSaleStatment);
router.get('/openSaleStatm/:id', productController.openSaleStatm);


router.get('/productDetailsPage/:id', productController.productDetailsPage);
router.get('/editProductPage/:id', productController.editProductPage);
router.post('/updateProduct/:id', productController.updateProduct);
router.post('/deleteProduct/:id', productController.deleteProduct);
router.get('/anotherdayPage', productController.anotherdayPage);
router.get('/productReport/:id', productController.productReport);

// router.get('/editSaleStatmentPage/:id', productsController.editSaleStatmentPage);

// router.post('/updateSaleStatment/:id', productsController.updateSaleStatment);

router.post('/deleteSaleStatment/:id', productController.deleteSaleStatment);

router.get('/productsAnalytics', productController.productsAnalytics);
router.get('/printProductsAnalytics', productController.printProductsAnalytics);

module.exports = router;