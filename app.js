const express = require("express");
const path = require('path');

const dayjs = require('dayjs');
require('dayjs/locale/ar');
dayjs.locale('ar');

const app = express();

const Shift = require("./models/Shift.model");
const Product = require("./models/Product.model");
const Invoice = require("./models/Invoice.model");
const Supplier = require('./models/Supplier.model');

// ======================
// Middleware
app.locals.dayjs = dayjs;

app.use(async (req, res, next) => {
    try {
        const products = await Product.find({
            stayStatus: 'ontherDay',
            saleStatus: 'open'
        }).populate({
            path: 'invoice',
            populate: [
                { path: 'supplier' },
                { path: 'day' }
            ]
        });
        res.locals.onthCount = products.length;
        next();
    } catch (err) {
        console.error(err);
        next(err);
    }
})

// open shift
app.use(async (req, res, next) => {
    try {
        const shift = await Shift.findOne({ status: "open" });
        if (!shift) {
            res.locals.openShift = null;
            res.locals.invoices = [];
            // res.locals.produ = [];
            return next();
        }
        const invoices = await Invoice.find({ day: shift._id });
        // const produ = await Product.find({ invoice: invoices._id });

        res.locals.openShift = shift;
        res.locals.invoices = invoices;
        // res.locals.produ = produ;
        next();
    } catch (err) {
        console.error(err);
        next(err);
    }
});

app.use(async (req, res, next) => {
    try {
        const nowDte = dayjs().format('D/M/YYYY');
        const nowTime = dayjs().format('hh:mm:ss A');
        res.locals.nowDte = nowDte;
        res.locals.nowTime = nowTime;
        next();
    } catch (err) {
        console.error(err);
        next(err);
    }
});

app.use(async (req, res, next) => {
    try {
        const supplier = await Supplier.find();
        res.locals.supplier = supplier;
        next();
    } catch (err) {
        console.error(err);
        next(err);
    }
});
// ======================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
// قراءة JSON
app.use(express.json());

// قراءة بيانات الفورم
app.use(express.urlencoded({ extended: true }));


// ======================
// Routes
// ======================
const shift = require('./routes/shift.route');
const product = require('./routes/product.route');
const expenses = require('./routes/expenses.route');
const suppliers = require('./routes/suppliers.route');
const invoice = require('./routes/invoice.route');
const payment = require('./routes/payments.route');
const employeeRoutes = require('./routes/employee.route');
const set = require('./routes/set.route');
const reports = require('./routes/reports');


app.use(shift);
app.use(product);
app.use(expenses);
app.use(suppliers);
app.use(invoice);
app.use(payment);
app.use(employeeRoutes);
app.use(set);
app.use(reports);

app.get("/", async (req, res) => {
    const openShift = await Shift.findOne({ status: "open" });
    res.render('index', {
        page: 'الرئيسية', activeProductId: null
    })
});




// ======================
// Export App
// ======================

module.exports = app;