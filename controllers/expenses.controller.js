const Shift = require("../models/Shift.model");
const Expenses = require("../models/expenses.model");
const recalculateShiftStats = require("../utils/calcFhift");
const PDFDocument = require('pdfkit');
const path = require('path');


exports.addExpensesPage = async (req, res) => {
    const openShift = res.locals.openShift;

    if (!openShift) {
        return res.status(400).json({ success: false, msg: 'لا يوجد يوم مفتوح' });
    }
    res.render('expenses/addExpenses', {
        page: 'إضافة مصروف', activeProductId: null
    })
}

exports.editExpensesPage = async (req, res) => {
    try {
        const openShift = res.locals.openShift;

        if (!openShift) {
            return res.status(400).json({ success: false, msg: 'لا يوجد يوم مفتوح' });
        }
        const expense = await Expenses.findById(req.params.id);
        if (!expense) {
            return res.status(400).json({ success: false, msg: 'هذا المصروف غير موجود.' });
        }

        return res.render('expenses/editExpenses', {
            page: 'تعديل المصروف', expense, activeProductId: null
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, msg: error.message });
    }
}

exports.addExpenses = async (req, res) => {
    try {
        const openShift = res.locals.openShift;
        if (!openShift) {
            return res.json({ success: false, msg: 'لايوجد يوم مفتوح لإضافة مصروفات.' });
        }
        const { expType, amount, details } = req.body;

        if (!expType || !amount) {
            return res.json({ success: false, msg: 'يرجى إدخال جميع القيم المطلوبة.' });
        }

        const numericAmount = Number(amount);

        if (isNaN(numericAmount)) {
            return res.json({ success: false, msg: 'يرجى إدخال قيم رقمية صحيحة  .' });
        }

        if (numericAmount <= 0) {
            return res.json({ success: false, msg: 'المبلغ يجب أن يكون أكبر من صفر' });
        }

        const expense = await Expenses.create({
            day: openShift._id,
            expType,
            amount: numericAmount,
            details: details || '-----',
        });

        await recalculateShiftStats(openShift._id);

        return res.json({
            success: true,
            redirect: `/dayPage/${openShift._id}?msg=تم إضافة المصروف بنجاح`,
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, msg: error.message });
    }
}

exports.updateExpenses = async (req, res) => {
    try {
        const expense = await Expenses.findById(req.params.id);
        if (!expense) {
            return res.json({ success: false, msg: 'هذا المصروف غير موجود.' });
        }

        const openShift = await Shift.findById(expense.day);
        if (!openShift) {
            return res.json({ success: false, msg: 'لايوجد يوم مرتبط بهذا المصروف.' });
        }

        const { expType, amount, details } = req.body;
        if (!expType || !amount) {
            return res.json({ success: false, msg: 'يرجى إدخال جميع القيم المطلوبة.' });
        }

        const numericAmount = Number(amount);
        if (isNaN(numericAmount)) {
            return res.json({ success: false, msg: 'يرجى إدخال قيم رقمية صحيحة  .' });
        }

        if (numericAmount <= 0) {
            return res.json({ success: false, msg: 'المبلغ يجب أن يكون أكبر من صفر' });
        }


        expense.expType = expType;
        expense.amount = numericAmount;
        expense.details = details;
        await expense.save();
        await recalculateShiftStats(openShift._id);


        return res.json({
            success: true,
            redirect: `/dayPage/${openShift._id}?msg=تم تعديل المصروف بنجاح`,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, msg: error.message });
    }
}

exports.deleteExpenses = async (req, res) => {
    try {
        const expense = await Expenses.findById(req.params.id);
        if (!expense) {
            return res.status(400).send('هذا المصروف غير موجود.');
        }


        await Expenses.findByIdAndDelete(expense._id);
        await recalculateShiftStats(expense.day);

        return res.redirect(`/dayPage/${expense.day}?msg=تم حذف المصروف بنجاح`);
    } catch (error) {
        console.error(error);
        return res.status(500).send(error.message);
    }
}

exports.expensesReport = async (req, res) => {
    try {
        const selectedStartDate = req.query.from || new Date().toISOString().slice(0, 10);
        const selectedEndDate = req.query.to || selectedStartDate;

        const start = new Date(selectedStartDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(selectedEndDate);
        end.setHours(23, 59, 59, 999);

        const shifts = await Shift.find({ startTime: { $gte: start, $lte: end } });

        const shiftIds = shifts.map(shift => shift._id);
        
        const expenses = shiftIds.length
            ? await Expenses.find({ day: { $in: shiftIds } }).populate('day')
            : [];

        const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);

        return res.render('expenses/expensesReport', {
            page: 'مصاريف عامة',
            expenses,
            selectedStartDate,
            selectedEndDate,
            totalAmount,
            msg: req.query.msg,
            openShift: res.locals.openShift,
            activeProductId: null,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, msg: error.message });
    }
}

exports.expensesReportPdf = async (req, res) => {
    try {
        const selectedStartDate = req.query.startDate || new Date().toISOString().slice(0, 10);
        const selectedEndDate = req.query.endDate || selectedStartDate;

        const start = new Date(selectedStartDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(selectedEndDate);
        end.setHours(23, 59, 59, 999);

        const shifts = await Shift.find({ startTime: { $gte: start, $lte: end } });
        const shiftIds = shifts.map(shift => shift._id);
        const expenses = shiftIds.length
            ? await Expenses.find({ day: { $in: shiftIds } }).populate('day')
            : [];

        const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);

        const fontPath = path.join(__dirname, '../public/fonts/Tajawal/Tajawal-Regular.ttf');
        const doc = new PDFDocument({ size: 'A4', margin: 40 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=expenses-report-${selectedStartDate}-to-${selectedEndDate}.pdf`);

        doc.font(fontPath);
        doc.pipe(res);

        const startY = 40;

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
            .text(`المصاريف إدارة`, 340, startY + 35, {
                width: 200,
                align: 'right'
            });

        // العنوان في الوسط (مقتصر على النص فقط)
        doc.font(fontPath)
            .fontSize(12)
            .text(`مصاريف تقرير`, 180, startY + 10, {
                width: 230,
                align: 'center'
            });

        // السطر تحت العنوان يوضح الفترة المحددة
        doc.font(fontPath)
            .fontSize(10)
            .text(`${selectedEndDate} إلى ${selectedStartDate} الفترة: من`, 180, startY + 32, {
                width: 230,
                align: 'center'
            });

        // ====== القسم اليسار (Date/Time بالإنجليزية) ======
        const nowDteEn = new Date().toISOString().slice(0, 10);
        const nowTimeEn = new Date().toLocaleTimeString('en-GB');

        doc.font(fontPath)
            .fontSize(10)
            .text(`${nowDteEn} Date:`, 45, startY + 5, {
                width: 180,
                align: 'left'
            });

        doc.font(fontPath)
            .fontSize(10)
            .text(`${nowTimeEn} Time:`, 50, startY + 25, {
                width: 180,
                align: 'left'
            });

        doc.moveTo(50, 95)
            .lineTo(550, 95)
            .stroke();

        doc.moveDown(1);

        const tableTop = 140;
        const itemX = 50;
        const dateX = 100;
        const timeX = 170;
        const typeX = 240;
        const amountX = 380;
        const notesX = 440;
        const rowHeight = 20;

        doc.fontSize(10).text('#', itemX, tableTop);
        doc.text('التاريخ', dateX, tableTop);
        doc.text('الوقت', timeX, tableTop);
        doc.text('المصروف نوع', typeX, tableTop);
        doc.text('المبلغ', amountX, tableTop);
        doc.text('ملاحظات', notesX, tableTop);

        let y = tableTop + 25;
        expenses.forEach((exp, index) => {
            if (y > 720) {
                doc.addPage();
                y = 50;
            }
            const dayText = exp.day ? new Date(exp.day.startTime).toISOString().slice(0, 10) : '-';
            const timeText = exp.day ? new Date(exp.day.startTime).toLocaleTimeString('en-GB') : '-';

            doc.text(index + 1, itemX, y);
            doc.text(dayText, dateX, y);
            doc.text(timeText, timeX, y);
            doc.text(exp.expType, typeX, y);
            doc.text(exp.amount.toFixed(2), amountX, y);
            doc.text(exp.details || '-', notesX, y, { width: 120 });
            y += rowHeight;
        });

        // إضافة سطر المجموع النهائي في نهاية التقرير
        if (y > 720) {
            doc.addPage();
            y = 50;
        }
        // فاصل قبل المجموع
        doc.moveTo(50, y).lineTo(550, y).stroke();
        y += 10;
        doc.font(fontPath).fontSize(12).text(`${totalAmount.toFixed(2)} ₪ للفترة: المصاريف إجمالي `, 50, y, { width: 500, align: 'center' });

        doc.end();
    } catch (error) {
        console.error(error);
        return res.status(500).send(error.message);
    }
}