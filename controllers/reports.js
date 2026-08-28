const Shift = require("../models/Shift.model");
const SaleStatment = require("../models/saleStatment.model");
const Expenses = require("../models/expenses.model");
const Payment = require('../models/payment.model');
const Product = require("../models/Product.model");
const Invoice = require("../models/Invoice.model");
const recalculateShiftStats = require("../utils/calcFhift");
const path = require('path');

exports.periodReport = async (req, res) => {
    try {
        const selectedStartDate = req.query.from || new Date().toISOString().slice(0, 10);
        const selectedEndDate = req.query.to || selectedStartDate;

        const start = new Date(selectedStartDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(selectedEndDate);
        end.setHours(23, 59, 59, 999);

        const shifts = await Shift.find({
            startTime: {
                $gte: start,
                $lte: end
            }
        }).sort({ startTime: -1 });

        // const shiftIds = shifts.map(shift => shift._id);
        // console.log(shifts);

        return res.render('reports/daysReports', {
            page: 'تقرير فترة',
            selectedStartDate,
            selectedEndDate,
            msg: req.query.msg,
            activeProductId: null, shifts
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, msg: error.message });
    }
}


exports.piredView = async (req, res) => {
    try {
        const selectedStartDate = req.params.from;
        const selectedEndDate = req.params.to;

        const start = new Date(selectedStartDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(selectedEndDate);
        end.setHours(23, 59, 59, 999);

        // Find shifts whose startTime falls inside the requested period
        const shifts = await Shift.find({
            startTime: {
                $gte: start,
                $lte: end
            }
        }).sort({ startTime: -1 });
        const shiftsIds = shifts.map(sh => sh._id);

        // Invoices
        const invoices = await Invoice.find({
            day: { $in: shiftsIds }
        }).populate('supplier').sort({ createdAt: -1 });
        const invoiceIds = invoices.map(inv => inv._id);


        // Products
        const products = await Product.find({
            invoice: { $in: invoiceIds }
        }).populate({
            path: 'invoice',
            populate: { path: 'supplier' }
        });

        const invoiceProfitMap = {};
        const productsMap = {};

        products.forEach(product => {

            const invoiceId = product.invoice._id.toString();

            productsMap[invoiceId] =
                (productsMap[invoiceId] || 0) + 1;

            invoiceProfitMap[invoiceId] =
                (invoiceProfitMap[invoiceId] || 0) + (product.profit || 0);

        });

        const loseWeightProducts = await Product.find({
            saleStatus: 'closed', weightStatus: 'نقص', invoice: { $in: invoiceIds }
        }).populate({
            path: 'invoice',
            populate: { path: 'supplier' }
        });





        // Add products count to each invoice
        const invoicesWithCount = invoices.map(invoice => {
            const id = invoice._id.toString();

            return {
                ...invoice.toObject(),
                productsCount: productsMap[id] || 0,
                totalProfit: invoiceProfitMap[id] || 0,
            };
        });

        const purchaseInvoicesss = invoicesWithCount.filter(
            i => i.invoiceType === "شراء"
        );

        const commissionInvoicesss = invoicesWithCount.filter(
            i => i.invoiceType === "كمسيون"
        );

        // Expenses
        const expenses = await Expenses.find({
            day: { $in: shiftsIds }
        });

        const groupedExpenses = Object.values(
            expenses.reduce((acc, expense) => {
                const type = expense.expType || 'غير محدد';
                if (!acc[type]) {
                    acc[type] = {
                        expType: type,
                        totalAmount: 0,
                        count: 0
                    };
                }

                acc[type].totalAmount += Number(expense.amount || 0);
                acc[type].count += 1;
                return acc;
            }, {})
        ).sort((a, b) => b.totalAmount - a.totalAmount);

        const payments = await Payment.find({
            day: { $in: shiftsIds }
        })
            .populate('supplier')
            .populate('day')
            .sort({ createdAt: -1 });

        const report = {
            totalSales: 0,
            totalProfit: 0,
            totalExpenses: 0,
            netProfit: 0,

            purchaseInvoices: 0,
            commissionInvoices: 0,

            openProducts: 0,
            closedProducts: 0,
            delayedProducts: 0
        };

        shifts.forEach(day => {

            report.totalSales += day.totalSales;

            report.totalProfit += day.totalProfit;

            report.totalExpenses += day.totalExpenses;

            report.netProfit += day.netProfit;

            report.purchaseInvoices += day.purchaseInvoices;

            report.commissionInvoices += day.commissionInvoices;

            report.openProducts += day.openProducts;

            report.closedProducts += day.closedProducts;

            report.delayedProducts += day.delayedProducts;

        });



        return res.render('reports/piredView', {
            page: 'تقرير فترة',
            msg: req.query.msg,
            invoices: invoicesWithCount,
            purchaseInvoicesss, commissionInvoicesss,
            products, isArchive: false, report,
            expenses, groupedExpenses, payments, loseWeightProducts, from: selectedStartDate, to: selectedEndDate,
            shifts
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            msg: error.message
        });
    }
};


