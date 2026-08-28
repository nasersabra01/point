const Product = require('../models/Product.model');
const Invoice = require('../models/Invoice.model');
const SaleStatment = require('../models/saleStatment.model');

async function recalculateProductStats(productId) {
    try {
        const product = await Product.findById(productId);
        if (!product) return;

        const invoice = await Invoice.findById(product.invoice);
        if (!invoice) return;

        const sales = await SaleStatment.find({ product: productId });

        const soldWeight = sales.reduce(
            (sum, sale) => sum + (sale.quantity || 0),
            0
        );

        const totalSales = sales.reduce(
            (sum, sale) => sum + (sale.total || 0),
            0
        );

        // const totalPrice = sales.reduce(
        //     (sum, sale) => sum + (sale.price || 0),
        //     0
        // );

        // const averageSalePrice = sales.length > 0 ? totalPrice / sales.length : 0;

        const averageSalePrice =
            soldWeight > 0
                ? totalSales / soldWeight
                : 0;

        product.soldWeight = Number(soldWeight.toFixed(2));


        let remainingWeight = product.mainWeight - soldWeight;

        if (product.saleStatus === 'closed') {
            remainingWeight -= product.loseWeight;
        }

        product.remainingWeight = Number(
            remainingWeight.toFixed(2)
        );

        product.sales = Number(totalSales.toFixed(2));
        product.avarageSePrice = Number(averageSalePrice.toFixed(2));

        product.salePercentage =
            product.mainWeight > 0
                ? Number(
                    ((soldWeight / product.mainWeight) * 100).toFixed(2)
                )
                : 0;

        // weight status
        if (product.soldWeight === 0) {
            product.weightStatus = 'لم يبع';
        } else if (product.soldWeight === product.mainWeight) {
            product.weightStatus = 'متطابق';
        } else {
            product.weightStatus = 'نقص';
        }

        // شراء
        if (invoice.invoiceType === 'شراء') {
            product.profit = Number(
                (product.sales - product.purchaseData.totalCost).toFixed(2)
            );
        }

        // كمسيون
        if (invoice.invoiceType === 'كمسيون') {
            const commissionAmount = Number(
                (
                    product.sales *
                    (product.commissionData.commissionRate / 100)
                ).toFixed(2)
            );

            product.commissionData.commissionAmount = commissionAmount;

            product.commissionData.supplierAmount = Number(
                (product.sales - commissionAmount).toFixed(2)
            );

            product.profit = commissionAmount;
        }

        await product.save();

    } catch (error) {
        console.error('recalculateProductStats error:', error);
    }
}

module.exports = recalculateProductStats;