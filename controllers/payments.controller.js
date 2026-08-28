const Supplier = require('../models/Supplier.model');
const Payment = require('../models/payment.model');
const Shift = require('../models/Shift.model');
const recalculateSupplierBalance = require('../utils/calcSupplier');


exports.addPaymentPage = async (req, res) => {
    try {
        const suppliers = await Supplier.find().sort({ createdAt: -1 });

        res.render('payments/addPayment', {
            page: 'إضافة دفعة',
            suppliers,
            msg: ''
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('حدث خطأ');
    }
};

exports.createPayment = async (req, res) => {
    try {
        const openShift = res.locals.openShift;

        if (!openShift) {
            return res.status(400).json({
                success: false,
                message: 'لا يوجد يوم مفتوح'
            });
        }

        const {
            supplier,
            amount,
            paymentMethod,
            senderAccountName,
            senderAccountType,
            receiverAccountName,
            receiverAccountType,
            notes
        } = req.body;

        if (!supplier || !amount || !paymentMethod) {
            return res.status(400).json({
                success: false,
                message: 'الرجاء تعبئة الحقول المطلوبة'
            });
        }

        if (paymentMethod === 'bank_transfer') {
            if (
                !senderAccountName ||
                !senderAccountType ||
                !receiverAccountName ||
                !receiverAccountType
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'بيانات التحويل البنكي مطلوبة'
                });
            }
        }

        const payment = new Payment({
            supplier,
            day: openShift._id,
            amount: Number(amount),
            paymentMethod,
            senderAccountName: senderAccountName || null,
            senderAccountType: senderAccountType || null,
            receiverAccountName: receiverAccountName || null,
            receiverAccountType: receiverAccountType || null,
            notes
        });

        await payment.save();
        await recalculateSupplierBalance(payment.supplier);

        return res.redirect('/payments?msg=تمت إضافة الدفعة بنجاح');

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في إضافة الدفعة'
        });
    }
};

exports.paymentsList = async (req, res) => {
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

        const payments = await Payment.find(filter)
            .populate('supplier')
            .populate('day')
            .sort({ createdAt: -1 });

        res.render('payments/paymentsList', {
            page: 'المدفوعات',
            payments,
            msg: req.query.msg,
            filters: {
                from,
                to
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('حدث خطأ');
    }
};

exports.editPaymentPage = async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id).populate('day');
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'الدفعة غير موجودة'
            });
        }

        const suppliers = await Supplier.find().sort({ createdAt: -1 });

        res.render('payments/editPayments', {
            page: 'تعديل دفعة',
            payment,
            suppliers,
            msg: ''
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('حدث خطأ');
    }
};

exports.updatePayment = async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id);

        if (!payment) {
            return res.json({
                success: false,
                msg: 'الدفعة غير موجودة'
            });
        }

        const {
            supplier,
            amount,
            paymentMethod,
            paymentDate,
            senderAccountName,
            senderAccountType,
            receiverAccountName,
            receiverAccountType,
            notes
        } = req.body;

        if (!supplier || !amount || !paymentMethod) {
            return res.json({
                success: false,
                msg: 'الرجاء تعبئة الحقول المطلوبة'
            });
        }

        if (paymentMethod === 'bank_transfer') {
            if (
                !senderAccountName ||
                !senderAccountType ||
                !receiverAccountName ||
                !receiverAccountType
            ) {
                return res.json({
                    success: false,
                    msg: 'بيانات التحويل البنكي مطلوبة'
                });
            }
        }

        const oldSupplier = payment.supplier;

        // تعديل اليوم بناءً على التاريخ
        if (paymentDate) {
            const dayStart = new Date(paymentDate);
            dayStart.setHours(0, 0, 0, 0);

            const dayEnd = new Date(paymentDate);
            dayEnd.setHours(23, 59, 59, 999);

            const targetShift = await Shift.findOne({
                startTime: {
                    $gte: dayStart,
                    $lte: dayEnd
                }
            });

            if (!targetShift) {
                return res.json({
                    success: false,
                    msg: 'لا يوجد يوم مسجل بهذا التاريخ'
                });
            }

            payment.day = targetShift._id;
        }

        payment.supplier = supplier;
        payment.amount = Number(amount);
        payment.paymentMethod = paymentMethod;
        payment.senderAccountName = senderAccountName || null;
        payment.senderAccountType = senderAccountType || null;
        payment.receiverAccountName = receiverAccountName || null;
        payment.receiverAccountType = receiverAccountType || null;
        payment.notes = notes || '';

        await payment.save();

        await recalculateSupplierBalance(oldSupplier);

        if (String(oldSupplier) !== String(supplier)) {
            await recalculateSupplierBalance(supplier);
        }

        return res.json({
            success: true,
            msg: 'تم تعديل الدفعة بنجاح',
            redirect: '/payments'
        });

    } catch (error) {
        console.error(error);

        return res.json({
            success: false,
            msg: 'حدث خطأ أثناء تعديل الدفعة'
        });
    }
};


exports.deletePayment = async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id);

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'الدفعة غير موجودة'
            });
        }

        const shift = await Shift.findById(payment.day);

        if (!shift) {
            return res.status(404).json({
                success: false,
                message: 'اليوم غير موجود'
            });
        }

        // if (shift.status === 'closed') {
        //     return res.status(400).json({
        //         success: false,
        //         message: 'لا يمكن حذف دفعة من يوم مغلق'
        //     });
        // }

        await Payment.findByIdAndDelete(payment._id);
        await recalculateSupplierBalance(payment.supplier);

        return res.json({
            success: true,
            message: 'تم حذف الدفعة بنجاح',
            redirect: '/payments'
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: 'حدث خطأ في حذف الدفعة'
        });
    }
};




exports.paymentsReport = async (req, res) => {
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

        const payments = await Payment.find(filter)
            .populate('supplier')
            .sort({ createdAt: -1 });

        const totalPayments = payments.reduce(
            (sum, payment) => sum + payment.amount,
            0
        );
        const paymentsCount = payments.length;

        const totalCash = payments
            .filter(payment => payment.paymentMethod === 'cash')
            .reduce((sum, payment) => sum + payment.amount, 0);

        const totalBank = payments
            .filter(payment => payment.paymentMethod === 'bank_transfer')
            .reduce((sum, payment) => sum + payment.amount, 0);

        const now = new Date();

        const printDate = now.toLocaleDateString('ar-EG');
        const printTime = now.toLocaleTimeString('ar-EG', {
            hour: '2-digit',
            minute: '2-digit'
        });

        res.render('payments/print', {
            page: 'تقرير المدفوعات',
            payments,
            printDate, printTime,
            from, paymentsCount,
            to,
            stats: {
                totalPayments,
                totalCash,
                totalBank
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).send(error.message);
    }
};