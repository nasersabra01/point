const Shift = require("../models/Shift.model");
const SaleStatment = require("../models/saleStatment.model");
const Expenses = require("../models/expenses.model");
const Payment = require('../models/payment.model');
const Product = require("../models/Product.model");
const Invoice = require("../models/Invoice.model");
const recalculateShiftStats = require("../utils/calcFhift");
const recalculateSupplierBalance = require("../utils/calcSupplier");
const recalculateSaleStatements = require("../utils/recalculateSaleStatements");
const recalculateProductStats = require('../utils/recalculateProductStats');
const PDFDocument = require('pdfkit');
const path = require('path');

const dayjs = require('dayjs');
require('dayjs/locale/ar');
dayjs.locale('ar');



async function recalculateInvoiceTotal(invoiceId) {
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return;

    const products = await Product.find({ invoice: invoiceId });

    let total = 0;

    for (const p of products) {
        if (invoice.invoiceType === 'شراء') {
            total += p.purchaseData?.totalCost || 0;
        }

        if (invoice.invoiceType === 'كمسيون') {
            total += p.commissionData?.supplierAmount || 0;
        }
    }


    if (invoice.invoiceType === 'كمسيون') {
        total -= Number(invoice.transportCost || 0);
        total -= Number(invoice.takenVal || 0);
    }

    invoice.total = Number(total.toFixed(2));
    await invoice.save();
}

exports.createProductPage = async (req, res) => {
    try {
        // const openShift = res.locals.openShift;
        // if (!openShift) {
        //     return res.status(400).json({ success: false, msg: 'لا يوجد يوم مفتوح' });
        // }
        const invoice = await Invoice.findById(req.params.id);
        if (!invoice) {
            return res.status(400).json({ success: false, msg: 'الفاتورة المضاف اليها غير موجودة' });
        }

        const shift = await Shift.findById(invoice.day);
        if (!shift) {
            return res.status(400).json({ success: false, msg: 'اليوم الذي تريد الاضافة اليه غير موجود' });
        }

        console.log(dayjs(shift.startTime).format('DD-MM-YYYY'));

        res.render('products/addProduct', {
            page: 'اليوم', activeProductId: null, invoice
        })
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, msg: error.message });
    }
}

exports.createProduct = async (req, res) => {
    try {
        // const openShift = res.locals.openShift;

        // if (!openShift) {
        //     return res.status(400).json({ success: false, msg: 'لا يوجد يوم مفتوح' });
        // }

        const invoice = await Invoice.findById(req.params.id);
        if (!invoice) {
            return res.status(400).json({ success: false, msg: 'الفاتورة المضاف اليها غير موجودة' });
        }

        const shift = await Shift.findById(invoice.day);
        if (!shift) {
            return res.status(400).json({ success: false, msg: 'اليوم الذي تريد الاضافة اليه غير موجود' });
        }

        const { productName, unit, mainWeight, notes } = req.body;

        if (!productName || !unit || mainWeight === '') {
            return res.json({ success: false, msg: 'يرجى إدخال جميع القيم المطلوبة.' });
        }

        const numericmainWeight = Number(mainWeight);

        if (isNaN(numericmainWeight) || numericmainWeight <= 0) {
            return res.json({ success: false, msg: 'الوزن يجب أن يكون رقمًا أكبر من صفر' });
        }

        let productData = {
            invoice: invoice._id,
            productName,
            unit,
            mainWeight: numericmainWeight,
            notes,
            remainingWeight: numericmainWeight,
        };

        if (invoice.invoiceType === 'شراء') {
            const wholesalePrice = Number(req.body.wholesalePrice);

            if (isNaN(wholesalePrice) || wholesalePrice <= 0) {
                return res.json({ success: false, msg: 'سعر الجملة غير صحيح' });
            }

            const totalCost = Number((wholesalePrice * numericmainWeight).toFixed(2));

            productData.purchaseData = {
                wholesalePrice,
                totalCost
            };
        }

        if (invoice.invoiceType === 'كمسيون') {
            const commissionRate = Number(req.body.commissionRate);

            if (isNaN(commissionRate) || commissionRate <= 0) {
                return res.json({ success: false, msg: 'نسبة العمولة غير صحيحة' });
            }

            productData.commissionData = {
                commissionRate
            };
        }

        const product = new Product(productData);

        if (product.purchaseData) {
            product.profit = Number(
                ((product.sales || 0) - (product.purchaseData.totalCost || 0)).toFixed(2)
            );
        }

        await product.save();
        await recalculateInvoiceTotal(invoice._id);
        await recalculateSupplierBalance(invoice.supplier);
        await recalculateShiftStats(invoice.day);

        return res.json({
            success: true,
            redirect: `/invoiceDetailes/${invoice._id}?msg=تم إضافة الصنف بنجاح`,
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, msg: err.message });
    }
};


exports.dayPage = async (req, res) => {
    try {
        const openShift = await Shift.findById(req.params.id);


        if (!openShift) {
            return res.status(400).json({
                success: false,
                msg: 'لا يوجد يوم مفتوح'
            });
        }

        

        // Invoices
        const invoices = await Invoice.find({
            day: openShift._id
        }).populate('supplier').sort({ createdAt: -1 });

        const invoiceIds = invoices.map(inv => inv._id);

        // Products
        const products = await Product.find({
            invoice: { $in: invoiceIds }
        }).populate({
            path: 'invoice',
            populate: { path: 'supplier' }
        });

        const loseWeightProducts = await Product.find({
            saleStatus: 'closed', weightStatus: 'نقص', invoice: { $in: invoiceIds }
        }).populate({
            path: 'invoice',
            populate: { path: 'supplier' }
        });

        // Add products count to each invoice
        const invoicesWithCount = invoices.map(invoice => {
            const productsCount = products.filter(
                product => product.invoice._id.toString() === invoice._id.toString()
            ).length;

            return {
                ...invoice.toObject(),
                productsCount
            };
        });

        // Expenses
        const expenses = await Expenses.find({
            day: openShift._id
        });

        const payments = await Payment.find({
            day: openShift._id
        })
            .populate('supplier')
            .populate('day')
            .sort({ createdAt: -1 });


        await recalculateShiftStats(openShift);

        return res.render('day', {
            page: 'اليوم',
            msg: req.query.msg,
            openShift,
            invoices: invoicesWithCount,
            products, isArchive: false,
            expenses, payments, loseWeightProducts
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            msg: error.message
        });
    }
};


exports.productSaleStatment = async (req, res) => {
    try {
        const openShift = res.locals.openShift;
        if (!openShift) {
            return res.status(400).json({ success: false, msg: 'لا يوجد يوم مفتوح' });
        }
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(400).json({ success: false, msg: 'هذا المنتج غير موجود' });
        }
        const invoice = await Invoice.findById({ _id: product.invoice });
        if (!invoice) {
            return res.status(400).json({ success: false, msg: 'الفاتورة المضاف اليها غير موجودة' });
        }


        const saleStatment = await SaleStatment.find({ product: product._id }).populate('day').sort({ createdAt: -1 });
        return res.render('products/productSaleStatment', {
            page: 'كشف بيع', product, saleStatment, activeProductId: product._id.toString(), msg: req.query.msg || '', invoice
        })
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, msg: error.message });
    }
};

exports.addSaleStatment = async (req, res) => {
    try {
        const openShift = res.locals.openShift;
        if (!openShift) {
            return res.status(400).json({ success: false, msg: 'لا يوجد يوم مفتوح' });
        }

        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(400).json({ success: false, msg: 'هذا الصنف غير موجود.' });
        }

        const invoice = await Invoice.findById(product.invoice);
        if (!invoice) {
            return res.status(400).json({ success: false, msg: 'الفاتورة المضاف اليها غير موجودة' });
        }

        const { customerName, quantity, price } = req.body;

        if (!quantity || !price || quantity === '' || price === '') {
            return res.json({ success: false, msg: 'يرجى إدخال جميع القيم المطلوبة.' });
        }

        const numericquantity = Number(quantity);
        const numericprice = Number(price);

        if (isNaN(numericquantity) || isNaN(numericprice)) {
            return res.json({ success: false, msg: 'يرجى إدخال قيم رقمية صحيحة للأسعار والكمية.' });
        }

        if (numericquantity <= 0 || numericprice <= 0) {
            return res.json({
                success: false,
                msg: 'الكمية وسعر البيع يجب أن يكونا أكبر من صفر',
            });
        }

        if (numericquantity > product.remainingWeight) {
            return res.json({
                success: false,
                msg: 'الكمية المباعة أكبر من الكمية المتوفرة.',
            });
        }

        const total = Number((numericquantity * numericprice).toFixed(2));

        let saleProfit = 0;
        if (invoice.invoiceType === 'شراء') {
            const totalCost = numericquantity * product.purchaseData.wholesalePrice;

            saleProfit = Number((total - totalCost).toFixed(2));
        }

        if (invoice.invoiceType === 'كمسيون') {
            saleProfit = Number((total * (product.commissionData.commissionRate / 100)).toFixed(2));
        }


        await SaleStatment.create({
            product: product._id,
            day: openShift._id,
            customerName: customerName || 'غير معروف',
            quantity: numericquantity,
            price: numericprice,
            total,
            profit: saleProfit
        });

        // حساب متوسط سعر البيع
        let sumSelPrice = 0;
        const allSales = await SaleStatment.find({ product: product._id });

        allSales.forEach(s => {
            sumSelPrice += s.price;
        });

        const avarageSaPrice = sumSelPrice / allSales.length;

        // await product.save();
        await recalculateProductStats(product._id);
        await recalculateInvoiceTotal(invoice._id);
        await recalculateSupplierBalance(invoice.supplier);
        await recalculateShiftStats(openShift._id);

        return res.json({
            success: true,
            redirect: `/productSaleStatment/${product._id}`,
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, msg: error.message });
    }
};

exports.editSaleStatment = async (req, res) => {
    try {
        const sale = await SaleStatment.findById(req.params.id);
        if (!sale) {
            return res.status(400).json({
                success: false,
                msg: 'كشف البيع غير موجود'
            });
        }

        const product = await Product.findById(sale.product);
        if (!product) {
            return res.status(400).json({ success: false, msg: 'هذا الصنف غير موجود.' });
        }

        const invoice = await Invoice.findById(product.invoice);
        if (!invoice) {
            return res.status(400).json({ success: false, msg: 'الفاتورة المضاف اليها غير موجودة' });
        }

        if (product.saleStatus !== 'open') {
            return res.json({ success: false, msg: 'لا يمكن تعديل المبيعات بعد إغلاق الكشف.' });
        }

        const { customerName, quantity, price } = req.body;

        if (!quantity || !price || quantity === '' || price === '') {
            return res.json({ success: false, msg: 'يرجى إدخال جميع القيم المطلوبة.' });
        }

        const numericquantity = Number(quantity);
        const numericprice = Number(price);

        if (isNaN(numericquantity) || isNaN(numericprice)) {
            return res.json({ success: false, msg: 'يرجى إدخال قيم رقمية صحيحة للأسعار والكمية.' });
        }

        if (numericquantity <= 0 || numericprice <= 0) {
            return res.json({ success: false, msg: 'الكمية وسعر البيع يجب أن يكونا أكبر من صفر' });
        }

        const otherSales = await SaleStatment.find({ product: product._id, _id: { $ne: sale._id } });
        const soldWeightWithoutCurrent = otherSales.reduce((sum, item) => sum + (item.quantity || 0), 0);
        const maxAllowedQuantity = product.mainWeight - soldWeightWithoutCurrent;

        if (numericquantity > maxAllowedQuantity) {
            return res.json({
                success: false,
                msg: 'الكمية المباعة أكبر من الكمية المتوفرة.'
            });
        }

        const total = Number((numericquantity * numericprice).toFixed(2));

        let saleProfit = 0;
        if (invoice.invoiceType === 'شراء') {
            const totalCost = numericquantity * product.purchaseData.wholesalePrice;
            saleProfit = Number((total - totalCost).toFixed(2));
        }

        if (invoice.invoiceType === 'كمسيون') {
            saleProfit = Number((total * (product.commissionData.commissionRate / 100)).toFixed(2));
        }

        sale.customerName = (customerName || '').trim() || 'غير معروف';
        sale.quantity = numericquantity;
        sale.price = numericprice;
        sale.total = total;
        sale.profit = saleProfit;
        await sale.save();

        await recalculateProductStats(product._id);
        await recalculateInvoiceTotal(invoice._id);
        await recalculateSupplierBalance(invoice.supplier);
        await recalculateShiftStats(sale.day);

        return res.json({
            success: true,
            redirect: `/productSaleStatment/${product._id}?msg=تم تعديل البيع بنجاح`,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, msg: error.message });
    }
};

exports.deleteSaleStatment = async (req, res) => {
    try {
        const sale = await SaleStatment.findById(req.params.id);

        if (!sale) {
            return res.status(400).json({
                success: false,
                msg: 'كشف البيع غير موجود'
            });
        }

        const product = await Product.findById(sale.product);
        const invoice = await Invoice.findById(product.invoice);

        const affectedDay = sale.day;

        await SaleStatment.findByIdAndDelete(req.params.id);

        await recalculateProductStats(product._id);
        await recalculateInvoiceTotal(invoice._id);
        await recalculateSupplierBalance(invoice.supplier);
        await recalculateShiftStats(affectedDay);

        return res.redirect(`/productSaleStatment/${product._id}`);

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            msg: error.message
        });
    }
};

exports.closeSaleStatment = async (req, res) => {
    try {
        const openShift = res.locals.openShift;
        if (!openShift) {
            return res.status(400).json({ success: false, msg: 'لا يوجد يوم مفتوح' });
        }
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(400).json({
                success: false,
                msg: 'هذا الكشف غير موجود.'
            });
        }

        const invoice = await Invoice.findById({ _id: product.invoice });
        if (!invoice) {
            return res.status(400).json({ success: false, msg: 'الفاتورة المضاف اليها غير موجودة' });
        }

        const invoices = await Invoice.find({ day: openShift._id });
        const invoiceIds = invoices.map(invoice => invoice._id);

        const products = await Product.find({
            invoice: { $in: invoiceIds }
        }).populate('invoice');

        const saleStatment = await SaleStatment.find({ product: product._id });

        const { loseWeightStatus } = req.body;

        if (product.remainingWeight > 0) {

            if (!loseWeightStatus) {
                return res.render('products/productSaleStatment', {
                    saleStatment,
                    page: 'كشف بيع',
                    product,
                    activeProductId: product._id.toString(), products,
                    msg: 'يجب تحديد حالة الوزن المتبقي.', invoice
                });
            }

            if (loseWeightStatus === 'exist') {
                product.stayStatus = 'ontherDay';
                await product.save();
                await recalculateProductStats(product._id);
                await recalculateInvoiceTotal(invoice._id);
                await recalculateSupplierBalance(invoice.supplier);
                await recalculateShiftStats(openShift._id);

                return res.redirect(`/dayPage/${openShift._id}`);
            }
        }

        product.saleStatus = 'closed';
        product.stayStatus = 'today';
        product.loseWeight = product.remainingWeight;
        product.remainingWeight = 0;
        await product.save();
        await recalculateProductStats(product._id);
        await recalculateInvoiceTotal(invoice._id);
        await recalculateSupplierBalance(invoice.supplier);
        await recalculateShiftStats(openShift._id);

        return res.redirect(`/productSaleStatment/${req.params.id}`);

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            msg: error.message
        });
    }
}

exports.openSaleStatm = async (req, res) => {
    try {
        const openShift = res.locals.openShift;
        if (!openShift) {
            return res.status(400).json({ success: false, msg: 'لا يوجد يوم مفتوح' });
        }
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(400).json({
                success: false,
                msg: 'هذا الكشف غير موجود.'
            });
        }

        const invoice = await Invoice.findById({ _id: product.invoice });
        if (!invoice) {
            return res.status(400).json({ success: false, msg: 'الفاتورة المضاف اليها غير موجودة' });
        }

        const invoices = await Invoice.find({ day: openShift._id });
        const invoiceIds = invoices.map(invoice => invoice._id);

        const products = await Product.find({
            invoice: { $in: invoiceIds }
        }).populate('invoice');

        const saleStatment = await SaleStatment.find({ product: product._id });

        product.saleStatus = 'open';
        await product.save();
        await recalculateShiftStats(openShift._id);

        return res.redirect(`/productSaleStatment/${req.params.id}`);

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            msg: error.message
        });
    }
}

exports.productDetailsPage = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(400).json({ success: false, msg: 'هذا الصنف غير موجود.' });
        }

        const invoice = await Invoice.findById({ _id: product.invoice }).populate('day');
        if (!invoice) {
            return res.status(400).json({ success: false, msg: 'الفاتورة المضاف اليها غير موجودة' });
        }

        const saleStatment = await SaleStatment.find({ product: product._id });
        return res.render('products/productDetails', {
            page: 'تفاصيل ',
            product, activeProductId: product._id.toString(), saleStatment, msg: '', invoice
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, msg: error.message });
    }
}

exports.editProductPage = async (req, res) => {
    try {

        // const openShift = res.locals.openShift;
        // if (!openShift) {
        //     return res.status(400).json({ success: false, msg: 'لا يوجد يوم مفتوح' });
        // }

        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(400).json({ success: false, msg: 'هذا الصنف غير موجود.' });
        }

        const invoice = await Invoice.findById({ _id: product.invoice });
        if (!invoice) {
            return res.status(400).json({ success: false, msg: 'الفاتورة المضاف اليها غير موجودة' });
        }

        return res.render('products/editProduct', {
            page: 'تعديل الصنف',
            product,
            activeProductId: product._id.toString(),
            msg: '', invoice
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, msg: error.message });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        // const openShift = res.locals.openShift;

        // if (!openShift) {
        //     return res.status(400).json({ success: false, msg: 'لا يوجد يوم مفتوح' });
        // }

        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(400).json({ success: false, msg: 'الصنف غير موجود' });
        }

        const invoice = await Invoice.findById(product.invoice);
        if (!invoice) {
            return res.status(400).json({ success: false, msg: 'الفاتورة غير موجودة' });
        }

        const { productName, unit, mainWeight, notes } = req.body;

        if (!productName || !unit || mainWeight === '') {
            return res.json({ success: false, msg: 'يرجى إدخال جميع القيم المطلوبة.' });
        }

        const numericmainWeight = Number(mainWeight);

        if (isNaN(numericmainWeight)) {
            return res.json({ success: false, msg: 'يرجى إدخال قيم رقمية صحيحة للوزن.' });
        }

        if (numericmainWeight <= 0) {
            return res.json({ success: false, msg: 'الوزن يجب أن يكون أكبر من صفر' });
        }

        if (numericmainWeight < product.soldWeight) {
            return res.json({
                success: false,
                msg: 'الوزن الأساسي لا يمكن أن يكون أقل من الكمية المباعة.'
            });
        }

        // تحديث البيانات الأساسية
        product.productName = productName;
        product.unit = unit;
        product.mainWeight = numericmainWeight;
        product.notes = notes;
        product.remainingWeight = Number((numericmainWeight - product.soldWeight).toFixed(2));
        product.salePercentage = Number(
            ((product.soldWeight / numericmainWeight) * 100).toFixed(2)
        );

        // weight status
        if (product.soldWeight === 0) {
            product.weightStatus = 'لم يبع';
        } else if (product.soldWeight === numericmainWeight) {
            product.weightStatus = 'متطابق';
        } else if (product.soldWeight < numericmainWeight) {
            product.weightStatus = 'نقص';
        } else {
            product.weightStatus = 'زيادة';
        }

        // ================= شراء =================
        if (invoice.invoiceType === 'شراء') {
            const wholesalePrice = Number(req.body.wholesalePrice);

            if (isNaN(wholesalePrice) || wholesalePrice <= 0) {
                return res.json({
                    success: false,
                    msg: 'سعر الجملة يجب أن يكون رقمًا أكبر من صفر'
                });
            }

            const totalCost = Number((wholesalePrice * numericmainWeight).toFixed(2));

            product.purchaseData = {
                wholesalePrice,
                totalCost
            };

            product.profit = Number(
                ((product.sales || 0) - totalCost).toFixed(2)
            );
        }

        // ================= كمسيون =================
        if (invoice.invoiceType === 'كمسيون') {
            const commissionRate = Number(req.body.commissionRate);

            if (isNaN(commissionRate) || commissionRate <= 0) {
                return res.json({
                    success: false,
                    msg: 'نسبة العمولة يجب أن تكون رقمًا أكبر من صفر'
                });
            }

            if (!product.commissionData) {
                product.commissionData = {};
            }

            const commissionAmount = Number(
                ((product.sales * commissionRate) / 100).toFixed(2)
            );

            const supplierAmount = Number(
                (product.sales - commissionAmount).toFixed(2)
            );

            product.commissionData.commissionRate = commissionRate;
            product.commissionData.commissionAmount = commissionAmount;
            product.commissionData.supplierAmount = supplierAmount;
            product.profit = commissionAmount;
        }

        await product.save();
        await recalculateSaleStatements(product._id);
        await recalculateInvoiceTotal(invoice._id)
        await recalculateShiftStats(invoice.day);

        return res.json({
            success: true,
            redirect: `/dayPage/${invoice.day}?msg=تم تعديل الصنف بنجاح`
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            msg: err.message
        });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(400).json({
                success: false,
                msg: 'هذا الصنف غير موجود.'
            });
        }

        const openShift = res.locals.openShift;
        const invoice = await Invoice.findById(product.invoice);

        if (!invoice) {
            return res.status(400).json({
                success: false,
                msg: 'الفاتورة غير موجودة.'
            });
        }

        await SaleStatment.deleteMany({ product: product._id });
        await Product.findByIdAndDelete(product._id);

        await recalculateInvoiceTotal(invoice._id);
        await recalculateSupplierBalance(invoice.supplier);
        await recalculateShiftStats(openShift._id);

        return res.redirect(`/invoiceDetailes/${invoice._id}?msg=تم حذف الصنف بنجاح`);

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            msg: error.message
        });
    }
};


exports.anotherdayPage = async (req, res) => {
    try {
        const products = await Product.find({
            stayStatus: 'ontherDay',
            saleStatus: 'open'
        }).populate({
            path: 'invoice',
            populate: [
                { path: 'supplier' },
                { path: 'day' }
            ]
        });

        return res.render('products/anotherDay', {
            page: 'كشوف آجلة',
            products, activeProductId: null, dayjs
            , msg: req.query.msg
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, msg: error.message });
    }
};

exports.productReport = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).send('المنتج غير موجود');
        }

        const invoice = await Invoice.findById({ _id: product.invoice }).populate('day');
        if (!invoice) {
            return res.status(400).json({ success: false, msg: 'الفاتورة المضاف اليها غير موجودة' });
        }


        const fontPath = path.join(__dirname, '../public/fonts/Tajawal/Tajawal-Regular.ttf');
        const nowDte = res.locals.nowDte || '';
        const nowTime = res.locals.nowTime || '';

        console.log(product.productName);
        console.log(res.locals.nowDte);
        console.log(res.locals.nowTime);

        const doc = new PDFDocument();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=product-report.pdf');
        doc.font(fontPath);
        doc.pipe(res);

        const startY = 40;

        function reverseWords(text) {
            if (!text) return '';
            return String(text).split(' ').reverse().join(' ');
        }

        // ====== القسم اليمين ======
        doc.font(fontPath)
            .fontSize(14)
            .text(`)المتربيعي( النصر شركة`, 340, startY, {
                width: 200,
                align: 'right'
            });
        doc.font(fontPath)
            .fontSize(10)
            .text(`والفواكه الخضروات لتجارة`, 340, startY + 20, {
                width: 200,
                align: 'right'
            });
        doc.font(fontPath)
            .fontSize(10)
            .text(`المبيعات إدارة`, 340, startY + 35, {
                width: 200,
                align: 'right'
            });
        doc.font(fontPath)
            .fontSize(12)
            .text(`منتج  تقرير`, 180, startY + 15, {
                width: 230,
                align: 'center'
            });
        // ====== القسم اليسار ======
        doc.font(fontPath)
            .fontSize(10)
            .text(`${res.locals.nowDte} التاريخ:`, 45, startY + 5, {
                width: 180,
                align: 'left'
            });

        doc.font(fontPath)
            .fontSize(10)
            .text(`${res.locals.nowTime} الوقت:`, 50, startY + 25, {
                width: 180,
                align: 'left'
            });

        doc.moveTo(50, 95)
            .lineTo(550, 95)
            .stroke();

        let tableX = 50;
        let tableY = 130;
        let tableWidth = 500;
        let rowHeight = 35;


        doc.roundedRect(tableX, tableY, tableWidth, rowHeight * 11, 5).stroke();

        function drawRow(label, value, y, valueColor = 'black') {
            doc.moveTo(tableX, y)
                .lineTo(tableX + tableWidth, y)
                .stroke();

            doc.font(fontPath)
                .fillColor('black')
                .fontSize(11)
                .text(label, 420, y + 10, {
                    width: 100,
                    align: 'right'
                });

            doc.fillColor(valueColor)
                .text(String(value), 180, y + 10, {
                    width: 180,
                    align: 'center'
                });

            doc.fillColor('black');
        }

        const profitColor = product.profit >= 0 ? '#27AE60' : '#E74C3C';

        if (invoice.invoiceType === 'شراء') {
            drawRow('الصنف: اسم', product.productName, tableY);
            drawRow('المورد: اسم', reverseWords(invoice.supplier), tableY + rowHeight);
            drawRow('التنزيل: يوم', invoice.day.startTime.toLocaleString('EG'), tableY + rowHeight * 2);
            drawRow('الوزن: ', product.mainWeight.toFixed(2), tableY + rowHeight * 3);
            drawRow('ناقص: وزن', product.loseWeight.toFixed(2), tableY + rowHeight * 4);
            drawRow('الجملة: سعر', product.purchaseData.wholesalePrice.toFixed(2), tableY + rowHeight * 5);
            drawRow('التكلفة: إجمالي', product.purchaseData.totalCost.toFixed(2), tableY + rowHeight * 6);
            drawRow('البيع: سعر متوسط', product.avarageSePrice.toFixed(2), tableY + rowHeight * 7);
            drawRow('مبيعات:', product.sales.toFixed(2), tableY + rowHeight * 8);
            drawRow('ربح-خسارة:', product.profit.toFixed(2), tableY + rowHeight * 9, profitColor);
            drawRow('ملاحظات:', reverseWords(product.notes || 'لا يوجد'), tableY + rowHeight * 10);
        }

        if (invoice.invoiceType === 'كمسيون') {
            drawRow('الصنف: اسم', product.productName, tableY);
            drawRow('المورد: اسم', reverseWords(invoice.supplier), tableY + rowHeight);
            drawRow('التنزيل: يوم', invoice.day.startTime.toLocaleString('EG'), tableY + rowHeight * 2);
            drawRow('الوزن: ', product.mainWeight.toFixed(2), tableY + rowHeight * 3);
            drawRow('ناقص: وزن', product.loseWeight.toFixed(2), tableY + rowHeight * 4);
            drawRow('العمولة: نسبة', product.commissionData.commissionRate.toFixed(2), tableY + rowHeight * 5);
            drawRow('البيع: سعر متوسط', product.avarageSePrice.toFixed(2), tableY + rowHeight * 6);
            drawRow('مبيعات:', product.sales.toFixed(2), tableY + rowHeight * 7);
            drawRow('المورد: مستحق', product.commissionData.supplierAmount.toFixed(2), tableY + rowHeight * 8);
            drawRow('العمولة: مستحق', product.commissionData.commissionAmount.toFixed(2), tableY + rowHeight * 9);
            drawRow('ملاحظات:', reverseWords(product.notes || 'لا يوجد'), tableY + rowHeight * 10);
        }



        doc.end();

    } catch (error) {
        console.log(error);
        res.status(500).send(error.message);
    }
};



exports.productsAnalytics = async (req, res) => {
    try {
        const { from, to } = req.query;

        let filter = {};

        if (from || to) {
            filter.createdAt = {};

            if (from) {
                const fromDate = new Date(from);
                fromDate.setHours(0, 0, 0, 0);
                filter.createdAt.$gte = fromDate;
            }

            if (to) {
                const toDate = new Date(to);
                toDate.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = toDate;
            }
        }

        const products = await Product.find(filter);

        const groupedProducts = {};

        products.forEach(product => {
            const key = `${product.productName}_${product.unit}`;

            if (!groupedProducts[key]) {
                groupedProducts[key] = {
                    productName: product.productName,
                    unit: product.unit,
                    totalWeight: 0,
                    soldWeight: 0,
                    remainingWeight: 0,
                    totalSales: 0,
                    averageSalePrice: 0
                };
            }

            groupedProducts[key].totalWeight += product.mainWeight || 0;
            groupedProducts[key].soldWeight += product.soldWeight || 0;
            groupedProducts[key].remainingWeight += product.remainingWeight || 0;
            groupedProducts[key].totalSales += product.sales || 0;
        });

        Object.values(groupedProducts).forEach(product => {
            product.averageSalePrice =
                product.soldWeight > 0
                    ? product.totalSales / product.soldWeight
                    : 0;
        });

        res.render('reports/productsAnalytics', {
            page: 'الأصناف',
            products: Object.values(groupedProducts),
            filters: { from, to }
        });

    } catch (error) {
        console.log(error);
        res.status(500).send('حدث خطأ');
    }
};


exports.printProductsAnalytics = async (req, res) => {
    try {
        const { from, to } = req.query;

        let filter = {};

        if (from || to) {
            filter.createdAt = {};

            if (from) {
                const fromDate = new Date(from);
                fromDate.setHours(0, 0, 0, 0);
                filter.createdAt.$gte = fromDate;
            }

            if (to) {
                const toDate = new Date(to);
                toDate.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = toDate;
            }
        }

        const products = await Product.find(filter);

        const groupedProducts = {};

        products.forEach(product => {
            const key = `${product.productName}_${product.unit}`;

            if (!groupedProducts[key]) {
                groupedProducts[key] = {
                    productName: product.productName,
                    unit: product.unit,
                    totalWeight: 0,
                    soldWeight: 0,
                    remainingWeight: 0,
                    totalSales: 0,
                    averageSalePrice: 0
                };
            }

            groupedProducts[key].totalWeight += product.mainWeight || 0;
            groupedProducts[key].soldWeight += product.soldWeight || 0;
            groupedProducts[key].remainingWeight += product.remainingWeight || 0;
            groupedProducts[key].totalSales += product.sales || 0;
        });

        const finalProducts = Object.values(groupedProducts);

        finalProducts.forEach(product => {
            product.averageSalePrice =
                product.soldWeight > 0
                    ? product.totalSales / product.soldWeight
                    : 0;
        });

        const stats = {
            totalWeight: finalProducts.reduce((sum, p) => sum + p.totalWeight, 0),
            totalSold: finalProducts.reduce((sum, p) => sum + p.soldWeight, 0),
            totalSales: finalProducts.reduce((sum, p) => sum + p.totalSales, 0)
        };

        const now = new Date();

        res.render('reports/printProduct', {
            products: finalProducts,
            from,
            to,
            stats,
            printDate: now.toLocaleDateString('ar-EG'),
            printTime: now.toLocaleTimeString('ar-EG')
        });

    } catch (error) {
        console.log(error);
        res.status(500).send('حدث خطأ');
    }
};
