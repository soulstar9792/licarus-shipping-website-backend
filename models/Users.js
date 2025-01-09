const mongoose = require('mongoose');
const LabelServiceTypes = require('../LabelServicesType.json');


const savedAddressSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['sender', 'receiver'], 
        required: true,
    },
    name: {
        type: String,
        required: true, 
    },
    phone: {
        type: String,
        required: true, 
    },
    company: {
        type: String || Number, 
    },
    street: {
        type: String,
        required: true, 
    },
    street2: {
        type: String, 
    },
    city: {
        type: String,
        required: true, 
    },
    state: {
        type: String,
        required: true, 
    },
    zip: {
        type: String,
        required: true, 
    },
    country: {
        type: String,
        default: 'United States', 
    },
    isDefault: {
        type: Boolean,
        default: false, 
    },
});

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
    },
    savedAddresss: [savedAddressSchema]
});

const User = mongoose.model('User', userSchema);

module.exports = User;