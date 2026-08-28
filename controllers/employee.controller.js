const Employee = require('../models/Employee.model');


exports.getEmployeesPage = async (req, res) => {
    try {
        const employees = await Employee.find().sort({ createdAt: -1 });

        res.render('employee/employeeList', {
            page: 'العاملين',
            employees,
            msg: null
        });

    } catch (error) {
        console.log(error);

        res.render('employee/employeeList', {
            page: 'العاملين',
            employees: [],
            msg: 'حدث خطأ'
        });
    }
};
exports.addEmPage = async (req, res) => {
    try {
        res.render('employee/addEmployee', {
            page: 'إضافة عامل',
            msg: null
        });
    } catch (error) {
        console.log(error);
        res.redirect('/employees');
    }
};


exports.createEmployee = async (req, res) => {
    try {
        const { name, phone, dailyWage, notes } = req.body;

        if (!name || !dailyWage) {
            return res.status(400).json({
                success: false,
                message: 'الاسم والراتب اليومي مطلوبان'
            });
        }

        await Employee.create({
            name,
            phone,
            dailyWage,
            notes
        });

        return res.status(200).json({
            success: true,
            message: 'تم إضافة العامل بنجاح',
            redirect: '/employees'
        });

    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم'
        });
    }
};

exports.updateEmployee = async (req, res) => {
    try {
        const { name, phone, dailyWage, notes } = req.body;

        if (!name || !dailyWage) {
            return res.status(400).json({
                success: false,
                message: 'الاسم والراتب اليومي مطلوبان'
            });
        }

        await Employee.findByIdAndUpdate(req.params.id, {
            name,
            phone,
            dailyWage,
            notes
        });

        return res.status(200).json({
            success: true,
            message: 'تم تعديل العامل بنجاح',
            redirect: '/employees'
        });

    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            message: 'حدث خطأ في الخادم'
        });
    }
};

exports.getEditEmployeePage = async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id);

        if (!employee) {
            return res.redirect('/employees');
        }

        res.render('employee/editEmployee', {
            page: 'تعديل عامل',
            employee,
            msg: null
        });

    } catch (error) {
        console.log(error);
        res.redirect('/employees');
    }
};

exports.deleteEmployee = async (req, res) => {
    try {
        await Employee.findByIdAndDelete(req.params.id);

        res.redirect('/employees');

    } catch (error) {
        console.log(error);
        res.redirect('/employees');
    }
};