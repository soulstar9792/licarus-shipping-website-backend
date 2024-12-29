const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    courier: { 
        type: String, 
        required: true 
    },
    service_name: {
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
    label: { 
        type: Object, 
        required: true 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model('Order', orderSchema);