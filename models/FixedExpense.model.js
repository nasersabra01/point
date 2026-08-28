const mongoose = require("mongoose");

const fixedExpenseSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        enum: ['إيجار', "رسم بلدية", "يوميات عمال"],
    },
    amount: {
        type: Number,
        required: true
    },

}, { timestamps: true });

module.exports = mongoose.model("FixedExpense", fixedExpenseSchema);