const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
    {
        supplier: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Supplier",
            required: true
        },

        day: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Shift',
            required: true,
        },

        amount: {
            type: Number,
            required: true,
            min: 0
        },

        paymentMethod: {
            type: String,
            enum: ["cash", "bank_transfer", "staf", "trans", "other"],
            required: true
        },

        // Bank Transfer Details
        senderAccountName: {
            type: String,
            default: null
        },

        senderAccountType: {
            type: String,
            default: null
        },

        receiverAccountName: {
            type: String,
            default: null
        },

        receiverAccountType: {
            type: String,
            default: null
        },

        notes: {
            type: String,
            default: ""
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);