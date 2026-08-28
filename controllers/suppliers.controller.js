const Supplier = require('../models/Supplier.model');
const Invoice = require('../models/Invoice.model');
const Product = require('../models/Product.model');
const Payment = require('../models/payment.model');
const recalculateSupplierBalance = require('../utils/calcSupplier');

const dayjs = require('dayjs');
const ExcelJS = require('exceljs');
require('dayjs/locale/ar');
dayjs.locale('ar');

function normalizePhone(p) {
    if (!p) return '';
    return p.toString().replace(/[^0-9]/g, '');
}

// Get Add Supplier page
exports.addSupplierPage = async (req, res) => {
    try {
        res.render('suppliers/addSupplier', {
            page: 'إضافة مورد', activeProductId: null,
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('حدث خطأ');
    }
};

// Add new supplier
exports.addSupplier = async (req, res) => {
    try {
        const {
            name,
            phone,
            address,
            balance,
            notes
        } = req.body;

        if (!name || !phone || !address || balance === '') {
            return res.status(400).json({
                success: false,
                message: 'الرجاء ملء جميع الحقول المطلوبة'
            });
        }

        // Normalize phone and check for existing supplier by name or phone
        const normPhone = normalizePhone(phone);

        const existingByName = await Supplier.findOne({ name: { $regex: `^${name.trim()}$`, $options: 'i' } });
        if (existingByName) {
            return res.json({ success: false, message: 'المورد موجود بالفعل' });
        }

        // check phone duplicates by normalizing stored phones
        const allSuppliers = await Supplier.find({}, 'phone');
        const phoneExists = allSuppliers.find(s => normalizePhone(s.phone) === normPhone);
        if (phoneExists) {
            return res.json({ success: false, message: 'رقم الهاتف مستخدم بالفعل' });
        }

        const openingNum = Number(balance || 0);

        const newSupplier = new Supplier({
            name: name.trim(),
            phone: phone.trim(),
            address: address.trim(),
            openingBalance: openingNum,
            balance: openingNum,
            notes,
        });

        await newSupplier.save();

        res.json({
            success: true,
            message: 'تم إضافة المورد بنجاح',
            redirect: '/suppliersList',
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في إضافة المورد'
        });
    }
};

// Get Suppliers List page
exports.suppliersList = async (req, res) => {
    try {
        const suppliers = await Supplier.find().sort({ name: 1, createdAt: -1 });



        res.render('suppliers/suppliersList', {
            page: 'قائمة الموردين',
            suppliers, activeProductId: null, msg: ''
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('حدث خطأ');
    }
};

exports.printSuppliersList = async (req, res) => {
    try {
        const search = (req.query.search || '').toString().trim().toLowerCase();
        const governorate = (req.query.governorate || '').toString().trim().toLowerCase();
        const balance = (req.query.balance || '').toString().trim().toLowerCase();

        let suppliers = await Supplier.find().sort({ name: 1, createdAt: -1 });

        suppliers = suppliers.filter(supplier => {
            const rowText = [supplier.name, supplier.phone, supplier.address, supplier.notes, supplier.balance]
                .join(' ')
                .toLowerCase();

            const matchesSearch = !search || rowText.includes(search);
            const supplierGovernorate = (supplier.address || '').split(',')[0].trim().toLowerCase();
            const matchesGovernorate = !governorate || supplierGovernorate === governorate;

            let matchesBalance = true;
            const supplierBalance = Number(supplier.balance || 0);
            if (balance === 'zero') {
                matchesBalance = supplierBalance === 0;
            } else if (balance === 'positive') {
                matchesBalance = supplierBalance > 0;
            } else if (balance === 'negative') {
                matchesBalance = supplierBalance < 0;
            }

            return matchesSearch && matchesGovernorate && matchesBalance;
        });

        if (balance === 'asc') {
            suppliers.sort((a, b) => Number(a.balance || 0) - Number(b.balance || 0));
        } else if (balance === 'desc') {
            suppliers.sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0));
        }

        res.render('suppliers/printSuppliersList', {
            page: 'طباعة قائمة الموردين',
            suppliers,
            printDate: new Date().toLocaleDateString('ar-EG'),
            printTime: new Date().toLocaleTimeString('ar-EG')
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('حدث خطأ أثناء تجهيز صفحة الطباعة');
    }
};

exports.exportSuppliersExcel = async (req, res) => {
    try {
        const search = (req.query.search || '').toString().trim().toLowerCase();
        const governorate = (req.query.governorate || '').toString().trim().toLowerCase();
        const balance = (req.query.balance || '').toString().trim().toLowerCase();

        let suppliers = await Supplier.find().sort({ name: 1, createdAt: -1 });

        suppliers = suppliers.filter(supplier => {
            const rowText = [
                supplier.name,
                supplier.phone,
                supplier.address,
                supplier.notes,
                supplier.balance
            ].join(' ').toLowerCase();

            const matchesSearch = !search || rowText.includes(search);
            const supplierGovernorate = (supplier.address || '').split(',')[0].trim().toLowerCase();
            const matchesGovernorate = !governorate || supplierGovernorate === governorate;

            let matchesBalance = true;
            const supplierBalance = Number(supplier.balance || 0);
            if (balance === 'zero') {
                matchesBalance = supplierBalance === 0;
            } else if (balance === 'positive') {
                matchesBalance = supplierBalance > 0;
            } else if (balance === 'negative') {
                matchesBalance = supplierBalance < 0;
            }

            return matchesSearch && matchesGovernorate && matchesBalance;
        });

        if (balance === 'asc') {
            suppliers.sort((a, b) => Number(a.balance || 0) - Number(b.balance || 0));
        } else if (balance === 'desc') {
            suppliers.sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0));
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('الموردين');

        worksheet.columns = [
            { header: 'اسم المورد', key: 'name', width: 28 },
            { header: 'رقم الهاتف', key: 'phone', width: 18 },
            { header: 'العنوان', key: 'address', width: 28 },
            { header: 'الرصيد', key: 'balance', width: 16 },
            { header: 'ملاحظات', key: 'notes', width: 40 }
        ];

        suppliers.forEach(supplier => {
            worksheet.addRow({
                name: supplier.name || '',
                phone: supplier.phone || '',
                address: supplier.address || '',
                balance: Number(supplier.balance || 0).toFixed(2),
                notes: supplier.notes || ''
            });
        });

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).alignment = { horizontal: 'center' };
        worksheet.eachRow((row) => {
            row.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="suppliers.xlsx"');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error(error);
        res.status(500).send('حدث خطأ أثناء تصدير ملف Excel');
    }
};

exports.supplierPage = async (req, res) => {
    try {
        const {
            from,
            to,
            tab,
            paymentsFrom,
            paymentsTo,
            invoicesFrom,
            invoicesTo,
            productsFrom,
            productsTo,
            status
        } = req.query;
        const supplier = await Supplier.findById(req.params.id);

        if (!supplier) {
            return res.json({
                success: false,
                message: 'المورد غير موجود'
            });
        }

        const invoices = await Invoice.find({
            supplier: supplier._id
        }).populate('day');

        let filteredInvoices = [...invoices];

        if (invoicesFrom || invoicesTo) {
            filteredInvoices = invoices.filter(invoice => {
                const invoiceDate = new Date(invoice.createdAt);

                let valid = true;

                if (invoicesFrom) {
                    const fromDate = new Date(invoicesFrom);
                    fromDate.setHours(0, 0, 0, 0);
                    valid = valid && invoiceDate >= fromDate;
                }

                if (invoicesTo) {
                    const toDate = new Date(invoicesTo);
                    toDate.setHours(23, 59, 59, 999);
                    valid = valid && invoiceDate <= toDate;
                }

                return valid;
            });
        }

        const payments = await Payment.find({
            supplier: supplier._id
        })
            .populate('day')
            .sort({ createdAt: -1 });

        let filteredPayments = [...payments];

        if (paymentsFrom || paymentsTo) {
            filteredPayments = payments.filter(payment => {
                const paymentDate = new Date(payment.createdAt);

                let valid = true;

                if (paymentsFrom) {
                    const fromDate = new Date(paymentsFrom);
                    fromDate.setHours(0, 0, 0, 0);
                    valid = valid && paymentDate >= fromDate;
                }

                if (paymentsTo) {
                    const toDate = new Date(paymentsTo);
                    toDate.setHours(23, 59, 59, 999);
                    valid = valid && paymentDate <= toDate;
                }

                return valid;
            });
        }

        let statement = [];

        statement.push({
            date: supplier.createdAt,
            type: 'رصيد افتتاحي',
            debit: supplier.openingBalance || 0,
            credit: 0
        });

        invoices.forEach(invoice => {
            statement.push({
                date: invoice.createdAt,
                type: `فاتورة ${invoice.invoiceType}`,
                debit: invoice.total || 0,
                credit: 0,
                invoice: {
                    invoiceNo: invoice.invoiceNo || null,
                    invoiceType: invoice.invoiceType,
                    total: invoice.total
                }
            });
        });

        const paymentTypes = {
            cash: 'دفعة كاش',
            bank_transfer: 'تحويل بنكي',
            trans: 'تكاليف نقل',
            staf: 'بضاعة',
            other: 'أخرى'
        };

        payments.forEach(payment => {
            statement.push({
                date: payment.createdAt,
                type: paymentTypes[payment.paymentMethod] || 'غير معروف',
                debit: 0,
                credit: payment.amount || 0
            });
        });

        statement.sort((a, b) => new Date(a.date) - new Date(b.date));

        if (from || to) {
            statement = statement.filter(item => {
                const itemDate = new Date(item.date);

                let valid = true;

                if (from) {
                    const fromDate = new Date(from);
                    fromDate.setHours(0, 0, 0, 0);
                    valid = valid && itemDate >= fromDate;
                }

                if (to) {
                    const toDate = new Date(to);
                    toDate.setHours(23, 59, 59, 999);
                    valid = valid && itemDate <= toDate;
                }

                return valid;
            });
        }

        let runningBalance = 0;

        statement = statement.map(item => {
            runningBalance += item.debit;
            runningBalance -= item.credit;

            return {
                ...item,
                balance: runningBalance
            };
        });

        const invoiceIds = filteredInvoices.map(inv => inv._id);

        const products = await Product.find({
            invoice: { $in: invoiceIds }
        }).populate({
            path: 'invoice',
            populate: { path: 'supplier' }
        });

        if (productsFrom || productsTo || status) {
            filteredProducts = products.filter(product => {
                let valid = true;

                const productDate = new Date(product.createdAt);

                if (productsFrom) {
                    const fromDate = new Date(productsFrom);
                    fromDate.setHours(0, 0, 0, 0);
                    valid = valid && productDate >= fromDate;
                }

                if (productsTo) {
                    const toDate = new Date(productsTo);
                    toDate.setHours(23, 59, 59, 999);
                    valid = valid && productDate <= toDate;
                }

                if (status) {
                    valid = valid && product.saleStatus === status;
                }

                return valid;
            });
        }

        // Calculate running balance for each invoice
        const invoicesWithCount = filteredInvoices.map((invoice, index) => {
            const productsCount = products.filter(
                product =>
                    product.invoice._id.toString() ===
                    invoice._id.toString()
            ).length;

            // Calculate running balance from statement
            let cumulativeBalance = 0;
            statement.forEach(item => {
                if (item.date <= invoice.createdAt) {
                    cumulativeBalance += item.debit;
                    cumulativeBalance -= item.credit;
                }
            });

            return {
                ...invoice.toObject(),
                productsCount,
                runningBalance: cumulativeBalance
            };
        });

        res.render('suppliers/supplierDetails', {
            page: 'صفحة مورد',
            activeProductId: null,
            msg: '',
            supplier,
            dayjs, products,
            invoices: invoicesWithCount,
            payments: filteredPayments,
            statement,
            activeTab: tab || 'invoices',
            filters: {
                from,
                to
            },
            paymentFilters: {
                from: paymentsFrom,
                to: paymentsTo
            },
            invoiceFilters: {
                from: invoicesFrom,
                to: invoicesTo
            },
            productFilters: {
                from: productsFrom,
                to: productsTo,
                status
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('حدث خطأ');
    }
};






// Get Edit Supplier page
exports.editSupplierPage = async (req, res) => {
    try {
        const supplier = await Supplier.findById(req.params.id);

        if (!supplier) {
            return res.status(404).send('المورد غير موجود');
        }

        res.render('suppliers/editSupplier', {
            page: 'تعديل مورد',
            supplier, activeProductId: null, msg: ''
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('حدث خطأ');
    }
};

// Update supplier
exports.updateSupplier = async (req, res) => {
    try {
        const {
            name,
            phone,
            address,
            balance,
            notes
        } = req.body;

        // Prevent changing to a phone that another supplier uses
        const normPhone = normalizePhone(phone);
        const all = await Supplier.find({}, 'phone');
        const conflict = all.find(s => normalizePhone(s.phone) === normPhone && s._id.toString() !== req.params.id);
        if (conflict) {
            return res.status(400).json({ success: false, message: 'رقم الهاتف مستخدم من قبل مورد آخر' });
        }

        const existingByName = await Supplier.findOne({
            name: { $regex: `^${name.trim()}$`, $options: 'i' }
        });

        if (existingByName && existingByName._id.toString() !== req.params.id) {
            return res.status(400).json({
                success: false,
                message: 'اسم المورد مستخدم من قبل مورد آخر'
            });
        }
        const openingNum = Number(balance || 0);

        const supplier = await Supplier.findByIdAndUpdate(
            req.params.id,
            {
                name,
                phone,
                address,
                openingBalance: openingNum,
                notes,
            },
            { new: true }
        );
        await recalculateSupplierBalance(supplier._id);

        res.json({
            success: true,
            message: 'تم تحديث المورد بنجاح',
            redirect: '/suppliersList',
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في تحديث المورد'
        });
    }
};

// Delete supplier
exports.deleteSupplier = async (req, res) => {
    try {
        const invoicesCount = await Invoice.countDocuments({
            supplier: req.params.id
        });

        if (invoicesCount > 0) {
            return res.status(400).json({
                success: false,
                message: 'لا يمكن حذف المورد لأنه مرتبط بفواتير'
            });
        }

        await Supplier.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'تم حذف المورد بنجاح',
            redirect: '/suppliersList',
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ في حذف المورد'
        });
    }
};


exports.supplierStatement = async (req, res) => {
    try {
        const supplier = await Supplier.findById(req.params.id);

        if (!supplier) {
            return res.status(404).send('المورد غير موجود');
        }

        const invoices = await Invoice.find({
            supplier: supplier._id
        }).populate('day');

        const payments = await Payment.find({
            supplier: supplier._id
        }).populate('day');

        let statement = [];

        // Opening balance
        statement.push({
            date: supplier.createdAt,
            type: 'opening',
            description: 'رصيد افتتاحي',
            debit: supplier.balance || 0,
            credit: 0
        });

        // Invoices
        invoices.forEach(invoice => {
            statement.push({
                date: invoice.createdAt,
                type: 'invoice',
                description: `فاتورة ${invoice.invoiceNo}`,
                debit: invoice.total || 0,
                credit: 0
            });
        });

        // Payments
        payments.forEach(payment => {
            statement.push({
                date: payment.createdAt,
                type: 'payment',
                description: `دفعة ${payment.paymentMethod === 'cash' ? 'كاش' : 'تحويل بنكي'}`,
                debit: 0,
                credit: payment.amount || 0
            });
        });

        // Sort
        statement.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Running balance
        let runningBalance = 0;

        statement = statement.map(item => {
            runningBalance += item.debit;
            runningBalance -= item.credit;

            return {
                ...item,
                balance: runningBalance
            };
        });

        res.render('suppliers/supplierStatement', {
            page: 'كشف حساب المورد',
            supplier,
            statement
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('حدث خطأ');
    }
};


exports.supplierStatementReport = async (req, res) => {
    try {
        const supplier = await Supplier.findById(req.params.id);
        if (!supplier) {
            return res.status(404).send('المورد غير موجود');
        }





        const { from, to } = req.query;

        const invoices = await Invoice.find({
            supplier: supplier._id
        }).populate('day');

        const products = await Product.find({
            invoice: { $in: invoices.map(inv => inv._id) }
        }).populate({
            path: 'invoice',
            populate: { path: 'supplier' }
        });

        const payments = await Payment.find({
            supplier: supplier._id
        });

        let statement = [];

        statement.push({
            date: supplier.createdAt,
            type: 'رصيد افتتاحي',
            debit: supplier.openingBalance || 0,
            credit: 0
        });

        invoices.forEach(invoice => {
            statement.push({
                date: invoice.createdAt,
                type: `فاتورة ${invoice.invoiceType}`,
                debit: invoice.total || 0,
                credit: 0,
                invoice: invoice,
            });
        });

        payments.forEach(payment => {
            statement.push({
                date: payment.createdAt,
                type: payment.paymentMethod === 'cash'
                    ? 'دفعة كاش'
                    : 'تحويل بنكي',
                debit: 0,
                credit: payment.amount || 0
            });
        });

        statement.sort((a, b) => new Date(a.date) - new Date(b.date));
        if (from || to) {
            statement = statement.filter(item => {
                const itemDate = new Date(item.date);

                let valid = true;

                if (from) {
                    const fromDate = new Date(from);
                    fromDate.setHours(0, 0, 0, 0);
                    valid = valid && itemDate >= fromDate;
                }

                if (to) {
                    const toDate = new Date(to);
                    toDate.setHours(23, 59, 59, 999);
                    valid = valid && itemDate <= toDate;
                }

                return valid;
            });
        }
        let runningBalance = 0;

        statement = statement.map(item => {
            runningBalance += item.debit;
            runningBalance -= item.credit;

            return {
                ...item,
                balance: runningBalance
            };
        });
        const totalDebit = statement.reduce((sum, item) => sum + item.debit, 0);
        const totalCredit = statement.reduce((sum, item) => sum + item.credit, 0);
        res.render('suppliers/statmentPrint', {
            page: 'طباعة كشف الحساب',
            supplier,
            statement, products,
            from,
            to,
            totalDebit,
            totalCredit
        });

    } catch (error) {
        console.error(error);
        res.status(500).send(error.message);
    }
};


exports.supplierPaymentsReport = async (req, res) => {
    try {
        const supplier = await Supplier.findById(req.params.id);

        if (!supplier) {
            return res.status(404).send('المورد غير موجود');
        }

        const { from, to } = req.query;

        let payments = await Payment.find({
            supplier: supplier._id
        })
            .populate('day')
            .sort({ createdAt: -1 });

        if (from || to) {
            payments = payments.filter(payment => {
                const paymentDate = new Date(payment.createdAt);

                let valid = true;

                if (from) {
                    const fromDate = new Date(from);
                    fromDate.setHours(0, 0, 0, 0);
                    valid = valid && paymentDate >= fromDate;
                }

                if (to) {
                    const toDate = new Date(to);
                    toDate.setHours(23, 59, 59, 999);
                    valid = valid && paymentDate <= toDate;
                }

                return valid;
            });
        }

        const totalPayments = payments.reduce(
            (sum, payment) => sum + payment.amount,
            0
        );

        const totalCash = payments
            .filter(payment => payment.paymentMethod === 'cash')
            .reduce((sum, payment) => sum + payment.amount, 0);

        const totalBank = payments
            .filter(payment => payment.paymentMethod === 'bank_transfer')
            .reduce((sum, payment) => sum + payment.amount, 0);

        res.render('suppliers/paymentsPrint', {
            page: 'تقرير مدفوعات المورد',
            supplier,
            payments,
            from, dayjs,
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


exports.supplierInvoicesReport = async (req, res) => {
    try {
        const supplier = await Supplier.findById(req.params.id);

        if (!supplier) {
            return res.status(404).send('المورد غير موجود');
        }

        const { from, to } = req.query;

        let invoices = await Invoice.find({
            supplier: supplier._id
        }).populate('day');

        if (from || to) {
            invoices = invoices.filter(invoice => {
                const invoiceDate = new Date(invoice.createdAt);

                let valid = true;

                if (from) {
                    const fromDate = new Date(from);
                    fromDate.setHours(0, 0, 0, 0);
                    valid = valid && invoiceDate >= fromDate;
                }

                if (to) {
                    const toDate = new Date(to);
                    toDate.setHours(23, 59, 59, 999);
                    valid = valid && invoiceDate <= toDate;
                }

                return valid;
            });
        }

        const invoiceIds = invoices.map(inv => inv._id);

        const products = await Product.find({
            invoice: { $in: invoiceIds }
        }).populate({
            path: 'invoice',
            populate: { path: 'supplier' }
        });

        const invoicesWithCount = invoices.map(invoice => {
            const productsCount = products.filter(
                product =>
                    product.invoice._id.toString() ===
                    invoice._id.toString()
            ).length;

            return {
                ...invoice.toObject(),
                productsCount
            };
        });

        const totalInvoices = invoices.length;

        const totalAmount = invoices.reduce(
            (sum, invoice) => sum + (invoice.total || 0),
            0
        );

        res.render('suppliers/invoicesPrint', {
            page: 'تقرير فواتير المورد',
            supplier,
            invoices: invoicesWithCount,
            from, dayjs,
            to,
            stats: {
                totalInvoices,
                totalAmount
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).send(error.message);
    }
};


exports.supplierProductsReport = async (req, res) => {
    try {
        const supplier = await Supplier.findById(req.params.id);

        if (!supplier) {
            return res.status(404).send('المورد غير موجود');
        }

        const { from, to, status } = req.query;

        const invoices = await Invoice.find({
            supplier: supplier._id
        });

        const invoiceIds = invoices.map(inv => inv._id);

        let products = await Product.find({
            invoice: { $in: invoiceIds }
        }).populate({
            path: 'invoice',
            populate: { path: 'supplier' }
        });

        if (from || to || status) {
            products = products.filter(product => {
                let valid = true;

                const productDate = new Date(product.createdAt);

                if (from) {
                    const fromDate = new Date(from);
                    fromDate.setHours(0, 0, 0, 0);
                    valid = valid && productDate >= fromDate;
                }

                if (to) {
                    const toDate = new Date(to);
                    toDate.setHours(23, 59, 59, 999);
                    valid = valid && productDate <= toDate;
                }

                if (status) {
                    valid = valid && product.saleStatus === status;
                }

                return valid;
            });
        }

        const totalProducts = products.length;

        const totalSales = products.reduce(
            (sum, product) => sum + (product.sales || 0),
            0
        );

        const totalProfit = products.reduce(
            (sum, product) => sum + (product.profit || 0),
            0
        );

        res.render('suppliers/productsPrint', {
            page: 'تقرير أصناف المورد',
            supplier,
            products,
            from, dayjs,
            to,
            status,
            stats: {
                totalProducts,
                totalSales,
                totalProfit
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).send(error.message);
    }
};

exports.matchSupplierAccount = async (req, res) => {
    try {
        const supplier = await Supplier.findById(req.params.id);

        if (!supplier) {
            return res.json({
                success: false,
                msg: 'المورد غير موجود'
            });
        }

        supplier.lastMatchedAt = new Date();
        await supplier.save();

        return res.json({
            success: true,
            msg: 'تمت مطابقة الحساب بنجاح'
        });

    } catch (error) {
        console.log(error);

        return res.json({
            success: false,
            msg: 'حدث خطأ'
        });
    }
};