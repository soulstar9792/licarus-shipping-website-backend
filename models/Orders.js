const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    courier: {
        type: String,
        required: true
    },
    service_name: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    tracking_number: {
        type: String,
        required: true
    },
    sender: {
        type: Object,
        required: true
    },
    receiver: {
        type: Object,
        required: true
    },
    package: {
        type: Object,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Order', orderSchema);