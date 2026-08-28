const Shift = require("../models/Shift.model");
const Expenses = require("../models/expenses.model");
const Product = require("../models/Product.model");
const Invoice = require("../models/Invoice.model");
const saleStatment = require("../models/saleStatment.model");
const recalculateSupplierBalance = require("../utils/calcSupplier");

const recalculateShiftStats = require("../utils/calcFhift");
const dayjs = require('dayjs');
require('dayjs/locale/ar');
dayjs.locale('ar');
const path = require('path');

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


exports.createInvoice = async (req, res) => {
    const shift = await Shift.findById(req.params.id);

    if (!shift) {
        return res.status(404).send("اليوم غير موجود");
    }

    const invoices = await Invoice.find()
        .populate('day').populate('supplier')
        .sort({ createdAt: -1 });

    return res.render('invoices/addInvice', {
        page: 'إنشاء فاتورة',
        activeProductId: null
        , msg: req.query.msg, shift, invoices
    });

};

exports.storeInvoice = async (req, res) => {
    try {
        const shift = await Shift.findById(req.params.id);
        if (!shift) {
            return res.status(404).json({
                success: false,
                msg: "اليوم غير موجود"
            });
        }
        const {supplierInvoiceNo,supplier, invoiceType, transportCost, taken, takenVal, notes, } = req.body;
        if (!supplier || !invoiceType) {
            return res.status(400).json({
                success: false,
                msg: 'بعض الحقول مطلوبة'
            });
        }
        const prefix = invoiceType === 'شراء' ? 'PUR' : 'COM';
        const normalizedTransportCost = Number(transportCost || 0);
        if (invoiceType === "كمسيون" && (!transportCost || normalizedTransportCost < 0)) {
            return res.json({
                success: false,
                msg: 'يرجى إدخال تكلفة النقل'
            });
        }
        const parsedTakenVal = Number(takenVal || 0);
        const normalizedTakenVal = Number.isFinite(parsedTakenVal) ? parsedTakenVal : 0;
        const normalizedTaken = invoiceType === 'كمسيون' ? (taken || '') : '';
        const normalizedNotes = notes || '';
        const lastInvoice = await Invoice.findOne({ invoiceType })
            .sort({ createdAt: -1 });

        let nextNumber = 1;

        if (lastInvoice) {
            const lastNumber = parseInt(lastInvoice.invoiceNo.split('-')[1]);
            nextNumber = lastNumber + 1;
        }
        const invoiceNo = `${prefix}-${String(nextNumber).padStart(4, '0')}`;
        // console.log('last inv', lastInvoice)
        console.log('last invno', lastInvoice?.invoiceNo);
        // console.log('next number', nextNumber);
        // console.log('inv number', invoiceNo)

        
        const existingInvoice = await Invoice.findOne({ invoiceNo });

        if (existingInvoice) {
            // console.log(existingInvoice)
            return res.status(400).json({
                success: false,
                msg: 'رقم الفاتورة موجود مسبقاً'
            });
        }

        const invoice = new Invoice({invoiceNo, supplierInvoiceNo, supplier, invoiceType, day: shift._id,
            transportCost: invoiceType === "كمسيون" ? normalizedTransportCost : 0,taken: normalizedTaken,
            takenVal: invoiceType === "كمسيون" ? normalizedTakenVal : 0,notes: normalizedNotes, });

        await invoice.save();
        await recalculateShiftStats(shift._id);


        return res.json({
            success: true,
            msg: 'تمت إضافة الفاتورة بنجاح',
            redirect: `/dayPage/${shift._id}`
        });
    } catch (error) {
        console.log("SERVER ERROR:", error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getAllInvoices = async (req, res) => {
    try {
        const invoices = await Invoice.find()
            .populate('day')
            .sort({ createdAt: -1 });

        res.render('invoices/allInvoices', {
            page: 'الفواتير',
            invoices
        });

    } catch (error) {
        console.log(error);

        res.status(500).render('error', {
            message: 'حدث خطأ أثناء تحميل الفواتير'
        });
    }
};

exports.editInvoice = async (req, res) => {
    try {
        const shift = await Shift.findById(req.params.shiftId);
        if (!shift) {
            return res.status(404).send("اليوم غير موجود");
        }

        const invoice = await Invoice.findById(req.params.id).populate("supplier");
        if (!invoice) {
            return res.status(404).send("الفاتورة غير موجودة");
        }

        res.render('invoices/editInvoice', {
            page: 'تعديل الفاتورة',
            invoice, shift
        });

    } catch (error) {
        console.log(error);
        res.status(500).send('حدث خطأ');
    }
};

exports.updateInvoice = async (req, res) => {
    try {

        const shift = await Shift.findById(req.params.shiftId);

        if (!shift) {
            return res.status(404).json({
                success: false,
                msg: "اليوم غير موجود"
            });
        }

        const {
            invoiceNo,
            supplierInvoiceNo,
            supplier,
            transportCost,
            taken,
            takenVal,
            notes,
        } = req.body;

        const invoice = await Invoice.findById(req.params.id);

        if (!invoice) {
            return res.status(404).json({
                success: false,
                msg: 'الفاتورة غير موجودة'
            });
        }

        if (invoice.day.toString() !== shift._id.toString()) {
            return res.status(400).json({
                success: false,
                msg: "الفاتورة لا تنتمي إلى هذا اليوم"
            });
        }

        const normalizedTransportCost = Number(transportCost || 0);

        if (invoice.invoiceType === "كمسيون" && (!transportCost || normalizedTransportCost < 0)) {
            return res.json({
                success: false,
                msg: 'يرجى إدخال تكلفة النقل'
            });
        }

        const parsedTakenVal = Number(takenVal || 0);
        const normalizedTakenVal = Number.isFinite(parsedTakenVal) ? parsedTakenVal : 0;
        const normalizedTaken = invoice.invoiceType === 'كمسيون' ? (taken || '') : '';
        const normalizedNotes = notes || '';

        invoice.invoiceNo = invoiceNo || invoice.invoiceNo;
        invoice.supplierInvoiceNo = supplierInvoiceNo || '';
        invoice.supplier = supplier || invoice.supplier;
        invoice.transportCost = invoice.invoiceType === "كمسيون" ? normalizedTransportCost : 0;
        invoice.taken = normalizedTaken;
        invoice.takenVal = invoice.invoiceType === "كمسيون" ? normalizedTakenVal : 0;
        invoice.notes = normalizedNotes;

        await invoice.save();
        await recalculateInvoiceTotal(invoice._id);
        await recalculateSupplierBalance(invoice.supplier);
        await recalculateShiftStats(invoice.day);

        return res.json({
            success: true,
            msg: 'تم تعديل الفاتورة بنجاح',
            redirect: `/dayPage/${shift._id}`
        });

    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            msg: 'حدث خطأ أثناء التعديل'
        });
    }
};

exports.invoiceDetailes = async (req, res) => {
    try {

        const invoice = await Invoice.findById(req.params.id).populate('day').populate('supplier');
        if (!invoice) {
            return res.status(400).json({ success: false, msg: 'الفاتورة غير موجودة' });
        }
        const inDate = dayjs(invoice.createdAt).format('D/M/YYYY');
        const products = await Product.find({ invoice: invoice._id }).populate('invoice');

        // let totalSales = 0;
        // let totalCommission = 0;
        // let comRate = 0;

        // products.forEach(p => {
        //     comRate = p.commissionData.commissionRate;
        //     totalSales += p.sales || 0;
        //     totalCommission += p.commissionData?.commissionAmount || 0;
        // });

        // let totalProfit = 0;

        // products.forEach(product => {
        //     totalProfit += product.profit || 0;
        // });

        let totalSales = 0;
        let totalCommission = 0;
        let totalProfit = 0;
        let comRate = 0;

        products.forEach(product => {
            comRate = product.commissionData?.commissionRate || 0;
            totalSales += product.sales || 0;
            totalCommission += product.commissionData?.commissionAmount || 0;
            totalProfit += product.profit || 0;
        });

        return res.render('invoices/invoiceDetaiels', {
            page: 'فاتورة',
            activeProductId: null,
            invoice,
            products,
            inDate,
            totalSales,
            totalCommission,
            comRate,
            totalProfit
        });
    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            msg: 'حدث خطأ أثناء التعديل'
        });
    }

}

exports.deleteInvoice = async (req, res) => {
    try {

        const invoiceId = req.params.id;
        const forceDelete = req.query.force === 'true';

        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) {
            return res.status(404).json({
                success: false,
                msg: 'الفاتورة غير موجودة'
            });
        }

        const shift = await Shift.findById(invoice.day);
        if (!shift) {
            return res.status(404).json({
                success: false,
                msg: 'اليوم غير موجود'
            });
        }


        const shiftId = shift._id;

        // جلب الأصناف التابعة للفاتورة
        const products = await Product.find({
            invoice: invoiceId
        });

        // الحالة 1: لا يوجد أصناف → حذف مباشر
        if (products.length === 0) {
            await Invoice.findByIdAndDelete(invoiceId);

            await recalculateShiftStats(shiftId);

            return res.json({
                success: true,
                msg: 'تم حذف الفاتورة بنجاح'
            });
        }

        const productIds = products.map(p => p._id);

        // فحص وجود كشوف بيع
        const salesCount = await saleStatment.countDocuments({
            product: { $in: productIds }
        });

        // الحالة 3: يوجد مبيعات → ممنوع
        if (salesCount > 0) {
            return res.status(400).json({
                success: false,
                msg: 'لا يمكن حذف الفاتورة لأنها تحتوي على مبيعات'
            });
        }

        // الحالة 2: يوجد أصناف فقط → يحتاج تأكيد
        if (!forceDelete) {
            return res.status(400).json({
                success: false,
                needsConfirmation: true,
                msg: 'هذه الفاتورة تحتوي على أصناف، هل تريد حذفها مع جميع الأصناف؟'
            });
        }

        // حذف الأصناف
        await Product.deleteMany({
            invoice: invoiceId
        });

        // حذف الفاتورة
        await Invoice.findByIdAndDelete(invoiceId);

        // تحديث إحصائيات اليوم
        await recalculateShiftStats(shiftId);

        return res.json({
            success: true,
            msg: 'تم حذف الفاتورة وجميع الأصناف التابعة لها بنجاح'
        });

    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            msg: 'حدث خطأ أثناء حذف الفاتورة'
        });
    }
};

exports.print = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id).populate('day').populate('supplier');
        if (!invoice) {
            return res.status(400).json({ success: false, msg: 'الفاتورة غير موجودة' });
        }

        const inDate = dayjs(invoice.createdAt).format('D/M/YYYY');

        if (invoice.invoiceType === 'شراء') {
            const products = await Product.find({ invoice: invoice._id }).populate('invoice');

            let totalProfit = 0;
            let totalSales= 0;

            products.forEach(product => {
                totalProfit += product.profit || 0;
                totalSales += product.sales || 0;
            });


            return res.render('invoices/print', {
                page: 'طباعة فاتورة', activeProductId: null, invoice, products, inDate, totalProfit, totalSales
            })
        }


        if (invoice.invoiceType === 'كمسيون') {
            const products = await Product.find({ invoice: invoice._id });
            const productIds = products.map(p => p._id);
            const saleStatmentt = await saleStatment.find({
                product: { $in: productIds }
            });



            let totalSales = 0;
            let totalCommission = 0;
            let comRate = 0;

            products.forEach(p => {
                comRate = p.commissionData.commissionRate;
                totalSales += p.sales || 0;
                totalCommission += p.commissionData?.commissionAmount || 0;
            });
            return res.render('invoices/print', {
                page: 'طباعة فاتورة', activeProductId: null, invoice, products, inDate, saleStatmentt, totalSales, totalCommission, comRate
            })
        }

    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            msg: 'حدث خطأ أثناء التعديل'
        });
    }

}

exports.printA5 = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id).populate('day').populate('supplier');
        if (!invoice) {
            return res.status(400).json({ success: false, msg: 'الفاتورة غير موجودة' });
        }

        invoice.isMatched = !invoice.isMatched;
        invoice.matchedAt = invoice.isMatched ? new Date() : null;

        await invoice.save();



        const inDate = dayjs(invoice.createdAt).format('D/M/YYYY');

        if (invoice.invoiceType === 'شراء') {
            const products = await Product.find({ invoice: invoice._id }).populate('invoice');
            return res.render('invoices/printA5', {
                page: 'طباعة فاتورة A5', activeProductId: null, invoice, products, inDate
            });
        }

        if (invoice.invoiceType === 'كمسيون') {
            const products = await Product.find({ invoice: invoice._id });
            const productIds = products.map(p => p._id);
            const saleStatmentt = await saleStatment.find({ product: { $in: productIds } });

            let totalSales = 0;
            let totalCommission = 0;
            let comRate = 0;

            products.forEach(p => {
                comRate = p.commissionData.commissionRate;
                totalSales += p.sales || 0;
                totalCommission += p.commissionData?.commissionAmount || 0;
            });

            return res.render('invoices/printA5', {
                page: 'طباعة فاتورة A5', activeProductId: null, invoice, products, inDate, saleStatmentt, totalSales, totalCommission, comRate
            });
        }


    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, msg: 'حدث خطأ أثناء الطباعة' });
    }
};

exports.toggleInvoiceMatch = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id);

        if (!invoice) {
            return res.json({
                success: false,
                msg: 'الفاتورة غير موجودة'
            });
        }

        invoice.isMatched = !invoice.isMatched;
        invoice.matchedAt = invoice.isMatched ? new Date() : null;

        await invoice.save();

        return res.json({
            success: true,
            isMatched: invoice.isMatched,
            msg: invoice.isMatched ? 'تمت مطابقة الفاتورة' : 'تم إلغاء مطابقة الفاتورة'
        });

    } catch (error) {
        console.log(error);

        return res.json({
            success: false,
            msg: 'حدث خطأ'
        });
    }
};