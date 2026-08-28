const FixedExpense = require('../models/FixedExpense.model');
const Expense = require('../models/expenses.model');
const Shift = require('../models/Shift.model');
const Employee = require('../models/Employee.model');


exports.getSettingsPage = async (req, res) => {
    try {
        const fixedExpenses = await FixedExpense.find();

        res.render('setting/setPage', {
            page: 'الإعدادات', msg: '',
            fixedExpenses
        });

    } catch (error) {
        console.log(error);
        res.redirect('/');
    }
};

exports.addFixedExpensesPage = async (req, res) => {
    try {

        res.render('setting/addFiEx', {
            page: 'إضافة مصروف ثابت', msg: '',
        });

    } catch (error) {
        console.log(error);
        res.redirect('/');
    }
};


exports.addFixedExpenses = async (req, res) => {
    try {
        const { title, amount } = req.body;

        if (!title || amount === '') {
            return res.render('setting/addFiEx', {
                page: 'إضافة مصروف ثابت', msg: 'ادخل البيانات المطلوبة',
            });
        }



        const existingExpense = await FixedExpense.findOne({ title });

        if (existingExpense) {
            return res.json({
                success: false,
                msg: 'هذا المصروف موجود مسبقاً'
            });
        }

        const employees = await Employee.find();

        const totalS = employees.reduce((sum, e) => {
            return sum + (e.dailyWage || 0);
        }, 0);

        if (title === "يوميات عمال") {
            await FixedExpense.create({
                title: title,
                amount: totalS,
            });

            return res.json({
                success: true,
                redirect: '/settings'
            });
        }

        await FixedExpense.create({
            title,
            amount
        });

        return res.json({
            success: true,
            redirect: '/settings'
        });

    } catch (error) {
        console.log(error);
        return res.json({
            success: false,
            msg: 'حدث خطأ'
        });
    }
};

// exports.updateFixedExpense = async (req, res) => {
//     try {
//         const { title, amount } = req.body;
//         const id = req.params.id;

//         if (!title || !amount) {
//             return res.json({
//                 success: false,
//                 msg: 'ادخل البيانات المطلوبة'
//             });
//         }

//         const existingExpense = await FixedExpense.findOne({
//             title,
//             _id: { $ne: id }
//         });

//         if (existingExpense) {
//             return res.json({
//                 success: false,
//                 msg: 'هذا المصروف موجود مسبقاً'
//             });
//         }

//         let finalAmount = amount;

//         if (title === "يوميات عمال") {
//             const employees = await Employee.find();

//             finalAmount = employees.reduce((sum, e) => {
//                 return sum + (e.dailyWage || 0);
//             }, 0);
//         }

//         await FixedExpense.findByIdAndUpdate(id, {
//             title,
//             amount: finalAmount
//         });

//         return res.json({
//             success: true,
//             msg: 'تم التعديل بنجاح'
//         });

//     } catch (error) {
//         console.log(error);
//         return res.json({
//             success: false,
//             msg: 'حدث خطأ'
//         });
//     }
// };

exports.deleteFixedExpense = async (req, res) => {
    try {
        const deleted = await FixedExpense.findByIdAndDelete(req.params.id);

        if (!deleted) {
            return res.json({
                success: false,
                msg: 'العنصر غير موجود'
            });
        }

        return res.json({
            success: true,
            msg: 'تم الحذف بنجاح'
        });

    } catch (error) {
        console.log(error);
        return res.json({
            success: false,
            msg: 'حدث خطأ أثناء الحذف'
        });
    }
};