const express = require('express');
const router = express.Router();
const axios = require('axios');
const Order = require('../models/Orders');

// Sample GET endpoint to retrieve orders
router.get('/', async (req, res) => {    
    res.json({ message: 'Get all orders' });
});

router.post('/', async (req, res) => {
    console.log(req.body);
    
    const shipment = {
        "api_key": process.env.API_KEY,
        "service_name" : req.body.service_name,
        "manifested": false,
        "sender": req.body.sender,
        "receiver" : req.body.receiver,
        "package": req.body.package,
    }
    const response = await axios.post('https://api.labelexpress.io/v1/'+ req.body.courier +'/image/create', shipment);

    const order = new Order({
        courier: req.body.courier,
        service_name: req.body.service_name,
        sender: req.body.sender,
        receiver: req.body.receiver,
        package: req.body.package,
        label: response.data
    });
    console.log(response.data.data.base64_encoded_image);
    
    const savedOrder = await order.save();
    res.json(response.data, {message: 'Order created successfully'}, 200);
});

module.exports = router;