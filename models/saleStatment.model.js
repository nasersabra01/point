const mongoose = require("mongoose");

const saleStatmentSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'product',
            required: true,
        },
        customerName: {
            type: String,
            default: '',
        },
        quantity: {
            type: Number,
            default: 0,
            required: true,
        },
        price: {
            type: Number,
            default: 0,
            required: true,
        },
        total: {
            type: Number,
            default: 0,
            required: true,
        },
        day: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Shift",
            required: true
        },
        profit: {
            type: Number,
            default: 0
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("saleStatment", saleStatmentSchema);