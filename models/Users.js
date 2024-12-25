const mongoose = require('mongoose');

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
        default: 'admin' // Default role is admin
    },
    activation: {
        type: String,
        default: 'allow' // Default activation is allow
    }
});

const User = mongoose.model('User', userSchema);

module.exports = User;