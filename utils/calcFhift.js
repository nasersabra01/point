const Shift = require('../models/Shift.model');
const Invoice = require('../models/Invoice.model');
const SaleStatment = require("../models/saleStatment.model");
const Product = require('../models/Product.model');
const Expenses = require('../models/expenses.model');

async function recalculateShiftStats(shiftId) {
    try {
        const shift = await Shift.findById(shiftId);
        if (!shift) return;

        const saleStatements = await SaleStatment.find({ day: shiftId });

        const invoices = await Invoice.find({ day: shiftId });
        const invoiceIds = invoices.map(inv => inv._id);

        const products = await Product.find({
            invoice: { $in: invoiceIds }
        });

        const expenses = await Expenses.find({ day: shiftId });

        // const totalSales = saleStatements.reduce(
        //     (sum, s) => sum + (s.total || 0),
        //     0
        // );

        const totalSales = products.reduce(
            (sum, s) => sum + (s.sales || 0),
            0
        );

        // const totalProfit = saleStatements.reduce(
        //     (sum, s) => sum + (s.profit || 0),
        //     0
        // );

        const totalProfit = products.reduce(
            (sum, s) => sum + (s.profit || 0),
            0
        );

        const totalExpenses = expenses.reduce(
            (sum, e) => sum + (e.amount || 0),
            0
        );

        const purchaseInvoices = invoices.filter(
            inv => inv.invoiceType === 'شراء'
        ).length;

        const commissionInvoices = invoices.filter(
            inv => inv.invoiceType === 'كمسيون'
        ).length;

        const openProducts = products.filter(
            p => p.saleStatus === 'open'
        ).length;

        const closedProducts = products.filter(
            p => p.saleStatus === 'closed'
        ).length;

        const delayedProducts = products.filter(
            p => p.stayStatus === 'ontherDay'
        ).length;

        const netProfit = Number(
            (totalProfit - totalExpenses).toFixed(2)
        );

        shift.totalSales = Number(totalSales.toFixed(2));
        shift.totalProfit = Number(totalProfit.toFixed(2));
        shift.totalExpenses = Number(totalExpenses.toFixed(2));
        shift.netProfit = netProfit;

        shift.totalInvoices = invoices.length;
        shift.purchaseInvoices = purchaseInvoices;
        shift.commissionInvoices = commissionInvoices;

        shift.totalProducts = products.length;
        shift.openProducts = openProducts;
        shift.closedProducts = closedProducts;
        shift.delayedProducts = delayedProducts;

        await shift.save();

    } catch (error) {
        console.error('Shift Stats Error:', error);
    }
}

module.exports = recalculateShiftStats;