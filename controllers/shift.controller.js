const Shift = require("../models/Shift.model");
const Product = require("../models/Product.model");
const Invoice = require('../models/Invoice.model');
const Expenses = require('../models/expenses.model');
const SaleStatment = require('../models/saleStatment.model');
const Payment = require('../models/payment.model');

const FixedExpense = require('../models/FixedExpense.model');
const recalculateShiftStats = require("../utils/calcFhift");

// فتح شيفت جديد
exports.openNewShift = async (req, res) => {
    try {
        // 1) البحث عن شيفت مفتوح
        const openShift = await Shift.findOne({ status: "open" });

        if (openShift) {
            return res.redirect(`/dayPage/${openShift._id}`);
        }

        // 2) تحديد بداية ونهاية اليوم
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        // 3) البحث عن شيفت اليوم
        const todayShift = await Shift.findOne({
            startTime: {
                $gte: todayStart,
                $lte: todayEnd
            }
        });

        // 4) إذا وجد شيفت اليوم → افتحه من جديد
        if (todayShift) {
            todayShift.status = "open";
            todayShift.endTime = null;
            await todayShift.save();

            return res.redirect(`/dayPage/${todayShift._id}`);
        }

        // 5) إنشاء شيفت جديد إذا لا يوجد شيفت اليوم
        const shift = await Shift.create({
            openingCash: Number(req.body.openingCash) || 0,
            startTime: new Date()
        });

        const fixedExpenses = await FixedExpense.find();

        for (let exp of fixedExpenses) {
            const exists = await Expenses.findOne({
                day: shift._id,
                expType: exp.title
            });

            if (!exists) {
                await Expenses.create({
                    day: shift._id,
                    expType: exp.title,
                    amount: exp.amount,
                });
            }
        }

        

        await recalculateShiftStats(shift._id);

        return res.redirect(`/dayPage/${shift._id}`);

    } catch (err) {
        console.error(err.message);

        res.render('index', {
            page: 'الرئيسية',
            msg: 'هناك خلل أعد المحاولة.'
        });
    }
};


exports.closeShift = async (req, res) => {
    try {
        const shift = await Shift.findById(req.params.id);

        if (!shift) {
            return res.redirect('/');
        }

        if (shift.status === 'closed') {
            return res.redirect('/');
        }

        const invoices = await Invoice.find({ day: shift._id }).select('_id');
        const invoiceIds = invoices.map(inv => inv._id);
        const openProducts = await Product.countDocuments({
            invoice: { $in: invoiceIds },
            stayStatus: 'today',
            saleStatus: 'open'
        });

        if (openProducts > 0) {
            return res.redirect(`/dayPage/${shift._id}?msg=لا يمكن إغلاق اليوم قبل إغلاق الكشوفات المفتوحة أو تأجيلها.`)
        }

        await recalculateShiftStats(req.params.id);
        await Shift.findByIdAndUpdate(req.params.id, {
            status: 'closed',
            endTime: Date.now(),
        });

        return res.redirect('/');

    } catch (err) {
        console.error(err.message);

        res.render('day', {
            page: 'اليوم',
            msg: 'هناك خلل أعد المحاولة.'
        });
    }
}

exports.archiveDaysPage = async (req, res) => {
    try {
        const days = await Shift.find({
            status: 'closed'
        }).sort({ startTime: -1 });

        res.render('archive/archiveDays', {
            page: 'أرشيف الأيام', days,
            msg: ''
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('حدث خطأ');
    }
};



exports.searchDayArchive = async (req, res) => {
    try {
        const { date } = req.query;

        if (!date) {
            return res.redirect('/archiveDays');
        }

        const days = await Shift.find({
            status: 'closed'
        }).sort({ startTime: -1 });

        const start = new Date(date);
        start.setHours(0, 0, 0, 0);

        const end = new Date(date);
        end.setHours(23, 59, 59, 999);

        const shift = await Shift.findOne({
            status: 'closed',
            startTime: {
                $gte: start,
                $lte: end
            }
        });



        if (!shift) {
            return res.render('archive/archiveDays', {
                page: 'أرشيف الأيام', days,
                msg: 'لا يوجد يوم بهذا التاريخ'
            });
        }

        const invoices = await Invoice.find({
            day: shift._id
        }).populate('supplier');

        const invoiceIds = invoices.map(i => i._id);

        const products = await Product.find({
            invoice: { $in: invoiceIds }
        }).populate({
            path: 'invoice',
            populate: { path: 'supplier' }
        });

        const expenses = await Expenses.find({
            day: shift._id
        });

        const invoicesWithCount = invoices.map(invoice => {
            const productsCount = products.filter(
                p => p.invoice._id.toString() === invoice._id.toString()
            ).length;

            return {
                ...invoice.toObject(),
                productsCount
            };
        });

        const payments = await Payment.find({
            day: shift._id
        })
            .populate('supplier')
            .populate('day')
            .sort({ createdAt: -1 });

        res.render('day', {
            page: 'تفاصيل يوم',
            openShift: shift,
            invoices: invoicesWithCount,
            products,
            expenses,payments,
            msg: '',
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('حدث خطأ');
    }
};


exports.dayReport = async (req, res) => {
    try {
        const shiftId = req.params.id;

        const shift = await Shift.findById(shiftId);
        if (!shift) {
            return res.status(404).send('اليوم غير موجود');
        }
        await recalculateShiftStats(shift);

        const invoices = await Invoice.find({ day: shiftId }).populate('supplier');

        const invoiceIds = invoices.map(inv => inv._id);

        const products = await Product.find({
            invoice: { $in: invoiceIds }
        });

        const expenses = await Expenses.find({ day: shiftId });

        const saleStatements = await SaleStatment.find({ day: shiftId });

        const totalSales = saleStatements.reduce((sum, s) => sum + (s.total || 0), 0);
        const totalProfit = saleStatements.reduce((sum, s) => sum + (s.profit || 0), 0);
        const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const netProfit = totalProfit - totalExpenses;

        const purchaseInvoices = invoices.filter(i => i.invoiceType === 'شراء');
        const commissionInvoices = invoices.filter(i => i.invoiceType === 'كمسيون');

        res.render('dayPrint', {
            page: 'تقرير يومي',
            shift,
            invoices,
            products,
            expenses,
            stats: {
                totalSales,
                totalProfit,
                totalExpenses,
                netProfit,
                totalInvoices: invoices.length,
                totalProducts: products.length,
                purchaseInvoices,
                commissionInvoices
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).send(error.message);
    }
};