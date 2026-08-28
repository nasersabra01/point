const mongoose = require("mongoose");


const productSchema = new mongoose.Schema({
    invoice: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Invoice',
    },
    productName: {
        type: String,
        required: true,
    },
    unit: {
        type: String,
        required: true,
    },
    mainWeight: {
        type: Number,
        required: true,
    },
    soldWeight: {
        type: Number,
        required: true,
        default: 0
    },
    remainingWeight: {
        type: Number,
        required: true,
        default: 0
    },
    loseWeight: {
        type: Number,
        required: true,
        default: 0
    },
    salePercentage: {
        type: Number,
        required: true,
        default: 0
    },
    avarageSePrice: {
        type: Number,
        required: true,
        default: 0,
    },
    sales: {
        type: Number,
        required: true,
        default: 0,
    },
    profit: {
        type: Number,
        required: true,
        default: 0,
    },
    notes: {
        type: String,
    },
    saleStatus: {
        type: String,
        enum: ["open", "closed"],
        default: "open",
    },
    weightStatus: {
        type: String,
        enum: ["متطابق", "نقص", "لم يبع"],
        default: "لم يبع",
    },
    stayStatus: {
        type: String,
        enum: ["today", "ontherDay"],
        default: "today",
    },


    purchaseData: {
        wholesalePrice: {
            type: Number,
            default: 0
        },
        totalCost: {
            type: Number,
            default: 0,
        },
    },

    commissionData: {
        commissionRate: {
            type: Number,
        },
        commissionAmount: {
            type: Number,
            default: 0,
        },
        supplierAmount: {
            type: Number,
            default: 0,
        },
    }

}, { timestamps: true, });


module.exports = mongoose.model('product', productSchema);