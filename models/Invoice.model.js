const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
    {
        invoiceNo: {
            type: String,
            required: true,
            // unique: true,
        },
        supplierInvoiceNo: {
            type: String,
            default: '',
        },
        supplier: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Supplier',
            required: true,
        },
        invoiceType: {
            type: String,
            enum: ['شراء', 'كمسيون'],
            required: true,
        },
        total: {
            type: Number,
            default: 0,
        },
        day: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Shift',
            required: true,
        },
        transportCost: {
            type: Number,
            default: 0,
        },

        taken: {
            type: String,
            default: '',
        },

        takenVal: {
            type: Number,
            default: 0,
        },
        notes: {
            type: String,
            default: '',
        },
        isMatched: {
            type: Boolean,
            default: false
        },
        matchedAt: {
            type: Date,
            default: null
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Invoice', invoiceSchema);
