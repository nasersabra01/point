const mongoose = require("mongoose");

const expensesSchema = new mongoose.Schema(
    {
        day: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Shift',
            required: true,
        },
        expType: {
            type: String,
            required: true,
        },
        amount: {
            type: Number,
            default: 0,
            required: true,
        },
        details: {
            type: String,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("expenses", expensesSchema);