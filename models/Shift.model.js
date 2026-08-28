const mongoose = require("mongoose");

const shiftSchema = new mongoose.Schema(
    {
        startTime: {
            type: Date,
            default: Date.now,
        },
        endTime: {
            type: Date,
        },
        status: {
            type: String,
            enum: ["open", "closed"],
            default: "open",
        },


        totalSales: {
            type: Number,
            default: 0
        },

        totalExpenses: {
            type: Number,
            default: 0
        },

        totalProfit: {
            type: Number,
            default: 0
        },

        netProfit: {
            type: Number,
            default: 0
        },

        totalInvoices: {
            type: Number,
            default: 0
        },

        totalProducts: {
            type: Number,
            default: 0
        },

        closedProducts: {
            type: Number,
            default: 0
        },

        openProducts: {
            type: Number,
            default: 0
        },

        delayedProducts: {
            type: Number,
            default: 0
        },


        purchaseInvoices: {
            type: Number,
            default: 0
        },

        commissionInvoices: {
            type: Number,
            default: 0
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Shift", shiftSchema);