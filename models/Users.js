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
        default: 'allow' // Default activation is allow
    },
    services : {
        type: Array,
        default: []
    },
    totalSpent:{
        type:Number,
        default: 0
    },
    totalDeposit:{
        type:Number,
        default:0
    }
});

const User = mongoose.model('User', userSchema);

module.exports = User;