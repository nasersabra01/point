const Product = require('../models/Product.model');
const Invoice = require('../models/Invoice.model');
const SaleStatment = require('../models/saleStatment.model');

async function recalculateSaleStatements(productId) {
    const product = await Product.findById(productId);
    if (!product) return;

    const invoice = await Invoice.findById(product.invoice);
    if (!invoice) return;

    const sales = await SaleStatment.find({ product: productId });

    for (const sale of sales) {
        let profit = 0;

        if (invoice.invoiceType === 'شراء') {
            const totalCost =
                sale.quantity * product.purchaseData.wholesalePrice;

            profit = sale.total - totalCost;
        }

        if (invoice.invoiceType === 'كمسيون') {
            profit =
                sale.total *
                (product.commissionData.commissionRate / 100);
        }

        sale.profit = Number(profit.toFixed(2));
        await sale.save();
    }
}

module.exports = recalculateSaleStatements;