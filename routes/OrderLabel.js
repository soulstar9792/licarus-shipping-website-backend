const express = require("express");
const router = express.Router();
const axios = require("axios");
const Order = require("../models/Orders");
const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");
const sizeOf = require("image-size");
const BulkOrder = require("../models/BulkOrders");
const User = require("../models/Users");
const { createObjectCsvWriter } = require("csv-writer");

// Utility function to ensure a directory exists
const ensureDirectoryExists = (directoryPath) => {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
};

// Sample GET endpoint to retrieve orders
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    const orders = await Order.find({ userId });
    return res.status(200).json({ message: "Orders retrieved successfully", orders });
  } catch (error) {
    console.error("Error retrieving orders:", error);
    return res.status(500).json({ message: "Error retrieving orders", error: error.message });
  }
});

// Endpoint to update service price
router.post("/service-price/:userId", async (req, res) => {
  const { userId } = req.params;
  const { service, costType, value } = req.body;

  if (!service || !costType || value === undefined) {
    return res.status(400).json({ message: "Invalid input: service, costType, and value are required" });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let serviceUpdated = false;
    user.services.forEach(serviceObj => {
      if (serviceObj.services && serviceObj.services[service]) {
        serviceObj.services[service][costType] = Number(value); // Update cost
        serviceUpdated = true;
      }
    });

    if (!serviceUpdated) {
      return res.status(400).json({ message: "Service not found for this user" });
    }

    await user.save();
    return res.status(200).json({ message: "Service cost updated successfully", services: user.services });
  } catch (error) {
    console.error("Error updating service price:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Endpoint to create an order
router.post("/", async (req, res) => {
  const { user_id, courier, service_name, sender, receiver, package } = req.body;

  try {
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const service_type = service_name.trim();
    const service_cost = getServiceCost(user, courier, service_type);
    
    // Check user balance
    if (user.balance < service_cost) {
      return res.status(400).json({ message: "Insufficient Balance" });
    }

    // Update user balance and total spent
    user.balance -= service_cost;
    user.totalSpent += service_cost;
    await user.save();

    // Create shipment request
    const shipment = {
      api_key: process.env.API_KEY,
      version: req.body.version,
      service_name: service_name,
      manifested: false,
      sender,
      receiver,
      package,
    };

    // Make API call to Label Express
    const response = await axios.post(`https://api.labelexpress.io/v1/${courier}/image/create`, shipment);
    
    // Create new order
    const order = new Order({
      userId: user_id,
      courier,
      service_name,
      image: response.data.data.base64_encoded_image,
      tracking_number: response.data.data.tracking_number,
      sender,
      receiver,
      package,
    });

    const savedOrder = await order.save();
    return res.status(200).json({ message: "Order created successfully", data: savedOrder, service_cost });
  } catch (error) {
    return handleError(res, error);
  }
});

// Retrieve service prices for single shipment
router.post("/price/single", async (req, res) => {
  const { userId, courier, service } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not Found" });
    }

    if (!service) {
      return res.status(400).json({ message: "No Service Provided" });
    }

    const price = getServiceCost(user, courier, service);
    return res.status(200).json({ price });
  } catch (error) {
    console.error("Error occurred:", error);
    return res.status(500).json({ message: "Error retrieving service price", error: error.message });
  }
});

// Retrieve total price for bulk orders
router.post("/price/bulk", async (req, res) => {
  const { userId, shipments } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const totalPrice = shipments.reduce((total, orderData) => {
      const serviceCost = getServiceCost(user, orderData.courier, orderData.service_name.trim());
      return total + serviceCost;
    }, 0);

    return res.status(200).json({ totalPrice });
  } catch (error) {
    console.error("Error occurred:", error);
    return res.status(500).json({ message: "Error calculating bulk order price", error: error.message });
  }
});

// Function to get service cost based on user and courier
function getServiceCost(user, courier, service_type) {
  if (courier === "UPS") {
    return user.services[0].services[service_type]?.standard_cost || 0;
  } else {
    return user.services[1].services[service_type]?.standard_cost || 0;
  }
}

// Function to handle CSV writing
async function writeOrdersToCSV(orders, outputPath) {
  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: "order_id", title: "Order ID" },
      { id: "order_item_id", title: "Order-item-id" },
      { id: "quantity", title: "Quantity" },
      { id: "shipdate", title: "Ship-date" },
      { id: "courier_code", title: "Courier-code" },
      { id: "courier_name", title: "Courier-name" },
      { id: "tracking_number", title: "Tracking-number" },
      { id: "ship_method", title: "Ship-method" },
    ],
  });

  const currentDate = new Date().toISOString().split("T")[0];
  const records = orders.map((order) => ({
    order_id: order.sender?.order_id || "",
    order_item_id: order.package?.order_item_id || "",
    quantity: order.package?.order_item_quantity || "",
    shipdate: currentDate,
    courier_code: order?.courier || "",
    courier_name: order?.service_name || "",
    tracking_number: order?.tracking_number || "",
    ship_method: order?.ship_data || "",
  }));

  try {
    await csvWriter.writeRecords(records);
    console.log("CSV file written successfully.");
    return true;
  } catch (error) {
    console.error("Error writing CSV:", error);
    throw error;
  }
}

// Bulk order processing
router.post("/bulk/:userId", async (req, res) => {
  const { userId } = req.params;
  const ordersArray = req.body;
  const bulkOrderData = { orders: [],cost:0, orderCnt: ordersArray.length};

  try {
    let isTxt = false;

    for (const orderData of ordersArray) {
      const courier = orderData.courier;
      if (orderData.sender.order_id != null) {
        isTxt = true;
      }

      const service_type = orderData.service_name.trim();
      const services = await User.findById(userId);
      
      const service_cost = getServiceCost(services, courier, service_type);
      const user = await User.findById(userId);
      
      // Skip if user balance is insufficient
      if (user.balance < service_cost) {
        console.log(`Insufficient balance for user ${userId}. Skipping order.`);
        continue;
      }
      
      user.balance -= service_cost;
      user.totalSpent += service_cost;
      await user.save();

      const shipment = {
        api_key: process.env.API_KEY,
        service_name: service_type,
        version: orderData.package.provider,
        manifested: false,
        sender: orderData.sender,
        receiver: orderData.receiver,
        package: orderData.package,
      };

      const response = await axios.post(`https://api.labelexpress.io/v1/${courier}/image/create`, shipment);
      const order = {
        sender: orderData.sender,
        receiver: orderData.receiver,
        package: orderData.package,
        label: response.data.data,
        tracking_number: response.data.data.tracking_number,
        courier,
        service_name: orderData.service_name.trim(),
        ship_data: orderData.package.provider,
      };
      bulkOrderData.orders.push(order);
      bulkOrderData.cost += service_cost;
    }

    // Generate filenames and paths
    const uploadsDir = path.join(__dirname, '../uploads');
    ensureDirectoryExists(uploadsDir);

    const currentTime = new Date();
    const formattedTime = `${currentTime.getFullYear()}${String(currentTime.getMonth() + 1).padStart(2, '0')}${String(currentTime.getDate()).padStart(2, '0')}${String(currentTime.getHours()).padStart(2, '0')}${String(currentTime.getMinutes()).padStart(2, '0')}${String(currentTime.getSeconds()).padStart(2, '0')}`;
    let fileName = "";

    if (!isTxt) {
      const pdfDoc = new PDFDocument({ autoFirstPage: false });
      const pdfPath = path.join(uploadsDir, `bulk-orders-${formattedTime}.pdf`);
      pdfDoc.pipe(fs.createWriteStream(pdfPath));

      for (const order of bulkOrderData.orders) {
        if (order.label.base64_encoded_image) {
          const imgBuffer = Buffer.from(order.label.base64_encoded_image, "base64");
          const dimensions = sizeOf(imgBuffer);

          pdfDoc.addPage({ size: [dimensions.width, dimensions.height] })
            .image(imgBuffer, 0, 0, { width: dimensions.width, height: dimensions.height })
            .moveDown();
        }
      }

      pdfDoc.end();
      fileName = `bulk-orders-${formattedTime}.pdf`;
    } else {
      const csvFileName = `bulk-orders-${formattedTime}.csv`;
      const csvFilePath = path.join(uploadsDir, csvFileName);
      const isCsvWritten = await writeOrdersToCSV(bulkOrderData.orders, csvFilePath);
      if (isCsvWritten) {
        fileName = csvFileName;
      } else {
        throw new Error("Error generating CSV file");
      }
    }

    const bulkOrder = new BulkOrder({
      userId,
      courier:bulkOrderData.orders[0].courier,
      bulkOrderData,
      fileName,
    });
    const savedBulkOrder = await bulkOrder.save();

    res.status(200).json({
      message: "Bulk orders created successfully",
      fileName,
      data: savedBulkOrder,
    });
  } catch (error) {
    console.error("Error creating bulk orders:", error);
    return res.status(500).json({ message: "Error creating bulk orders", error: error.message });
  }
});

// Retrieve bulk orders by userId
router.get("/bulk/:userId", async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    const bulkOrders = await BulkOrder.find({ userId });
    return res.status(200).json(bulkOrders);
  } catch (error) {
    console.error("Error retrieving bulk orders:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

// Download file by filename
router.get("/download/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, "../uploads/", filename);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).json({ message: "File not found" });
    }

    res.download(filePath, filename, (downloadError) => {
      if (downloadError) {
        console.error("File download error:", downloadError);
        res.status(500).send("Error occurred while downloading the file.");
      }
    });
  });
});

// Provide a template CSV file for download
router.get("/file/template", async (req, res) => {
  try {
    const filename = "BulkTemplate.csv";
    const filePath = path.join(__dirname, "../resources/", filename);

    res.download(filePath, "Bulk_Template.csv", (err) => {
      if (err) {
        console.error("File download error:", err);
        res.status(500).send("Error occurred while downloading the file.");
      }
    });
  } catch (error) {
    console.error("Error occurred while providing template:", error);
    res.status(500).send("An unexpected error occurred.");
  }
});

// Generic error handler
const handleError = (res, error) => {
  console.error("Error occurred:", error);
  if (error.response) {
    return res.status(error.response.status).json({
      message: error.response.data.message || "Error from Label Express API",
      error: error.response.data,
    });
  } 
  return res.status(500).json({
    message: "Unknown error",
    error: error.message,
  });
};

module.exports = router;