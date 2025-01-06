const mongoose = require('mongoose');
const LabelServiceTypes = require('../LabelServicesType.json');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true
    },
    user_role: {
        type: String,
        default: 'user' // Default role is admin
    },
    balance: {
        type: Number,
        default: 0  // Default balance is 0
    },
    activation: {
        type: String,
        default: 'block' // Default activation is allow
    },
    services : {
        type: Array,
        default: []
    }
});

const User = mongoose.model('User', userSchema);

module.exports = User;