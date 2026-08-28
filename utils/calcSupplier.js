const Supplier = require('../models/Supplier.model');
const Invoice = require('../models/Invoice.model');
const Payment = require('../models/payment.model');

async function recalculateSupplierBalance(supplierId) {
    const supplier = await Supplier.findById(supplierId);
    if (!supplier) return;

    const invoices = await Invoice.find({ supplier: supplierId });
    const payments = await Payment.find({ supplier: supplierId });

    const totalInvoices = invoices.reduce((sum, invoice) => {
        return sum + (invoice.total || 0);
    }, 0);

    const totalPayments = payments.reduce((sum, payment) => {
        return sum + (payment.amount || 0);
    }, 0);

    supplier.balance =
        (supplier.openingBalance || 0) +
        totalInvoices -
        totalPayments;

    await supplier.save();
}

module.exports = recalculateSupplierBalance;