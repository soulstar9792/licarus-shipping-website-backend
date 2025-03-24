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
      const serviceCost = orderData.service_name ? getServiceCost(user, orderData.courier, orderData.service_name.trim()) : 0;
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

// Function to make result csv file of bulk order.
async function writeOrdersToResultCSV(orders, outputPath) {
  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: "service_name", title: "ServiceName" },
      { id: "sender_name", title: "FromSenderName" },
      { id: "sender_phone", title: "FromPhone" },
      { id: "sender_company", title: "FromCompany" },
      { id: "sender_address1", title: "FromStreet1" },
      { id: "sender_address2", title: "FromStreet2" },
      { id: "sender_city", title: "FromCity" },
      { id: "sender_state_province", title: "FromStateProvince" },
      { id: "sender_zip_postal", title: "FromZipPostal" },
      { id: "sender_country", title: "FromCountry" },

      { id: "receiver_name", title: "ToRecipientName" },
      { id: "receiver_phone", title: "ToPhone" },
      { id: "receiver_company", title: "ToCompany" },
      { id: "receiver_address1", title: "ToStreet1" },
      { id: "receiver_address2", title: "ToStreet2" },
      { id: "receiver_city", title: "ToCity" },
      { id: "receiver_state_province", title: "ToStateProvince" },
      { id: "receiver_zip_postal", title: "ToZipPostal" },
      { id: "receiver_country", title: "ToCountry" },

      { id: "quantity", title: "Quantity" },
      { id: "sku", title: "SKU" },

      { id: "package_length", title: "PackageLength" },
      { id: "package_width", title: "PackageWidth" },
      { id: "package_height", title: "PackageHeight" },
      { id: "package_weight", title: "PackageWeight" },
      { id: "package_description", title: "PackageDescription" },

      { id: "tracking_number", title: "TrackingNumber" },
    ],
  });

  const records = orders.map((order) => ({
    order_id: order.sender?.order_id || "",
    service_name: order.service_name || "",

    sender_name: order.sender?.sender_name || "",
    sender_phone: order.sender?.sender_phone || "",
    sender_company: order.sender?.sender_company || "",
    sender_address1: order.sender?.sender_address1 || "",
    sender_address2: order.sender?.sender_address2 || "",
    sender_city: order.sender?.sender_city || "",
    sender_state_province: order.sender?.sender_state_province || "",
    sender_zip_postal: order.sender?.sender_zip_postal || "",
    sender_country: order.sender?.sender_country || "",

    receiver_name: order.receiver?.receiver_name || "",
    receiver_phone: order.receiver?.receiver_phone || "",
    receiver_company: order.receiver?.receiver_company || "",
    receiver_address1: order.receiver?.receiver_address1 || "",
    receiver_address2: order.receiver?.receiver_address2 || "",
    receiver_city: order.receiver?.receiver_city || "",
    receiver_state_province: order.receiver?.receiver_state_province || "",
    receiver_zip_postal: order.receiver?.receiver_zip_postal || "",
    receiver_country: order.receiver?.receiver_country || "",

    quantity: order.package?.quantity || "",
    sku: order.package?.sku || "",

    package_length: order.package?.package_length || "",
    package_width: order.package?.package_width || "",
    package_height: order.package?.package_height || "",
    package_weight: order.package?.package_weight || "",
    package_description: order.package?.package_description || "",

    tracking_number: order.tracking_number || "",
  }));

  try {
    await csvWriter.writeRecords(records);
    console.log("Bulk order result CSV file written successfully.");
    return true;
  } catch (error) {
    console.error("Error writing bulk order result CSV:", error);
    throw error;
  }
}

// generate auto confirm csv file from the bulk order.
async function writeOrdersToAutoConfirmCSV(orders, outputPath) {
  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: "order_id", title: "order-id" },
      { id: "order_item_id", title: "order-item-id" },
      { id: "quantity", title: "quantity" },
      { id: "shipdate", title: "ship-date" },
      { id: "courier_code", title: "carrier-code" },
      { id: "courier_name", title: "carrier-name" },
      { id: "tracking_number", title: "tracking-number" },
      { id: "ship_method", title: "ship-method" },
    ],
  });

  const currentDate = new Date().toISOString().split("T")[0];
  const records = orders.map((order) => ({
    order_id: order.sender?.order_id || "",
    order_item_id: order.package?.order_item_id || "",
    quantity: order.package?.package_reference1 || "",
    shipdate: currentDate,
    courier_code: order?.courier || "",
    courier_name: order?.service_name || "",
    tracking_number: order?.tracking_number || "",
    ship_method: order?.ship_data || "",
  }));

  try {
    await csvWriter.writeRecords(records);
    console.log("Auto confirm CSV file written successfully.");
    return true;
  } catch (error) {
    console.error("Error writing Auto confirm CSV:", error);
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

      const service_type = ordersArray[0].service_name.trim();
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
    const pdfName = `bulk-orders-${formattedTime}.pdf`;
    const resultCSVName = `bulk-orders-${formattedTime}-result.csv`;
    const autoConfirmCSVName = isTxt ? `bulk-orders-${formattedTime}-auto-confirm.csv` : null;  
    
    // generating label pdf.
    const pdfDoc = new PDFDocument({ autoFirstPage: false });
    const pdfPath = path.join(uploadsDir, pdfName);
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
    
    // generating result csv file.
    const resultCSVPath = path.join(uploadsDir, resultCSVName);
    const isCsvWritten = await writeOrdersToResultCSV(bulkOrderData.orders, resultCSVPath);
    if (!isCsvWritten) {
      throw new Error("Error generating bulk order result csv file.");
    }
    let autoConfirmCSVPath = null;
    // generating auto-confirm file if the source is from Amazon.
    if (isTxt) {
      autoConfirmCSVPath = path.join(uploadsDir, autoConfirmCSVName);
      const isCsvWritten = await writeOrdersToAutoConfirmCSV(bulkOrderData.orders, autoConfirmCSVPath);
      if (!isCsvWritten) {
        throw new Error("Error generating CSV file");
      }
    }

    const bulkOrder = new BulkOrder({
      userId,
      courier:bulkOrderData.orders[0].courier,
      bulkOrderData,
      pdfName,
      resultCSVName,
      autoConfirmCSVName,
    });
    const savedBulkOrder = await bulkOrder.save();

    res.status(200).json({
      message: "Bulk orders created successfully",
      fileData: {
        pdfName,
        resultCSVName,
        autoConfirmCSVName,
      },
      data: savedBulkOrder,
    });
  } catch (error) {
    console.error("Error creating bulk orders:", error);
    return res.status(error.status || 500).json({ message: "Error creating bulk orders", data: error.response && error.response.data }); 
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
    return res.status(500).json({ error: error.data });
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