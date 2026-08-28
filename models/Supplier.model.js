const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
        phone: {
            type: String,
            required: true,
        },
        address: {
            type: String,
            required: true,
        },
        openingBalance: {
            type: Number,
            default: 0
        },
        balance: {
            type: Number,
            default: 0,
        },
        notes: {
            type: String,
        },
        lastMatchedAt: {
            type: Date,
            default: null
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Supplier", supplierSchema);
