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
        default: 'user' // Default role is admin
    },
    balance: {
        type: Number,
        default: 0  // Default balance is 0
    },
    activation: {
        type: String,
        default: 'allow' // Default activation is allow
    }
});

const User = mongoose.model('User', userSchema);

module.exports = User;