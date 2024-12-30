const express = require('express');
const router = express.Router();
const axios = require('axios');
const Order = require('../models/Orders');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const sizeOf = require('image-size');
const BulkOrder = require('../models/BulkOrders');

// Sample GET endpoint to retrieve orders
router.get('/', async (req, res) => {
    res.json({ message: 'Get all orders' });
});

router.post('/', async (req, res) => {
    console.log(req.body);

    const shipment = {
        "api_key": process.env.API_KEY,
        "service_name": req.body.service_name,
        "manifested": false,
        "sender": req.body.sender,
        "receiver": req.body.receiver,
        "package": req.body.package,
    }
    const response = await axios.post('https://api.labelexpress.io/v1/' + req.body.courier + '/image/create', shipment);

    const order = new Order({
        courier: req.body.courier,
        service_name: req.body.service_name,
        sender: req.body.sender,
        receiver: req.body.receiver,
        package: req.body.package,
        label: response.data.data
    });
    const savedOrder = await order.save();
    res.json(response.data, { message: 'Order created successfully' }, 200);
});


router.post('/bulk', async (req, res) => {
    let courier;
    const ordersArray = req.body; // Assuming you're passing an array of orders
    console.log(ordersArray);
    const bulkOrderData = {
        orders: []
    };

    try {
        // Iterate over each order in the array
        for (const orderData of ordersArray) {
            courier = orderData.courier;
            const shipment = {
                "api_key": process.env.API_KEY,
                "service_name": orderData.service_name,
                "manifested": false,
                "sender": orderData.sender,
                "receiver": orderData.receiver,
                "package": orderData.package,
            };

            const response = await axios.post(`https://api.labelexpress.io/v1/${courier}/image/create`, shipment);

            // Create an order object to store in the bulk order
            const order = {
                sender: orderData.sender,
                receiver: orderData.receiver,
                package: orderData.package,
                label: response.data.data
            };

            bulkOrderData.orders.push(order);
        }
        // Generate PDF
        const pdfDoc = new PDFDocument({ autoFirstPage: false });
        const currentTime = new Date();

        // Retrieve the date and time components
        const year = currentTime.getFullYear(); // Get the full year
        const month = String(currentTime.getMonth() + 1).padStart(2, '0');
        const day = String(currentTime.getDate()).padStart(2, '0');
        const hours = String(currentTime.getHours()).padStart(2, '0');
        const minutes = String(currentTime.getMinutes()).padStart(2, '0');
        const seconds = String(currentTime.getSeconds()).padStart(2, '0');

        // Concatenate with no symbols or spaces
        const formattedTime = `${year}${month}${day}${hours}${minutes}${seconds}`;
        const pdfPath = path.join(__dirname, `../uploads/bulk-orders${formattedTime}.pdf`);
        pdfDoc.pipe(fs.createWriteStream(pdfPath));

        // Add each order's image to the PDF
        for (const order of bulkOrderData.orders) {
            if (order.label.base64_encoded_image) {
                const imgBuffer = Buffer.from(order.label.base64_encoded_image, 'base64');

                // Get image dimensions
                const dimensions = sizeOf(imgBuffer);
                const { width, height } = dimensions;
                console.log(width, height);
                // Set the page size to the dimensions of the image
                pdfDoc.addPage({ size: [width, height] })
                    .image(imgBuffer, 0, 0, { width, height })
                    .moveDown();
            }
        }

        pdfDoc.end();

        const fileName = `bulk-orders${formattedTime}.pdf`;

        const bulkOrder = new BulkOrder({
            courier: courier,
            bulkOrderData: ordersArray,
            __filename: fileName
        });
        const savedBulkOrder = await bulkOrder.save();

        res.status(200).json({
            message: 'Bulk orders created successfully',
            fileName : fileName
            // data: savedBulkOrder,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Error creating bulk orders',
            error: error.message
        });
    }
});


router.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, "../uploads/", filename);
    console.log(filePath);
    
    // Check if the file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            return res.status(404).json({ message: 'File not found' });
        }
        // Set the headers to force download
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/pdf');
        // Send the file for download
        res.sendFile(filePath);
    });
});

module.exports = router;
