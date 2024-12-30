const mongoose = require('mongoose');

const bulkOrderSchema = new mongoose.Schema({
    courier: { 
        type: String, 
        required: true 
    },

    bulkOrderData: {
        type: Object,
        required: true
    },
    __filename: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('BulkOrder', bulkOrderSchema);