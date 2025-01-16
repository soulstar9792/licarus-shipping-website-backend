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

// Sample GET endpoint to retrieve orders
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    const orders = await Order.find({ userId });
    return res
      .status(200)
      .json({ message: "Orders retrieved successfully", orders });
  } catch (error) {
    console.error("Error retrieving orders:", error);
    return res
      .status(500)
      .json({ message: "Error retrieving orders", error: error.message });
  }
});

router.post("/service-price/:userId", async (req, res) => {
  const { userId } = req.params;
  const { service, costType, value } = req.body;
  const val = Number(value);
  if (!service || !costType || val === undefined) {
    return res
      .status(400)
      .json({
        message: "Invalid input: service, costType, and val are required",
      });
  }

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let serviceUpdated = false;
    user.services = user.services.map((serviceObj) => {
      if (serviceObj.services && serviceObj.services[service]) {
        serviceObj.services[service][costType] = val; // Update cost
        serviceUpdated = true;
      }
      return serviceObj;
    });
    if (!serviceUpdated) {
      return res
        .status(400)
        .json({ message: "Service not found for this user" });
    }

    await user.save();
    const newUser = await User.findByIdAndUpdate(
      user.id,
      { $set: { services: user.services } },
      { new: true }
    );
    return res.status(200).json({
      message: "Service cost updated successfully",
      services: user.services,
    });
  } catch (error) {
    console.error("Error updating service price:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const shipment = {
      api_key: process.env.API_KEY,
      service_name: req.body.service_name,
      manifested: false,
      sender: req.body.sender,
      receiver: req.body.receiver,
      package: req.body.package,
    };

    const service_type = req.body.service_name;
    const services = await User.findById(req.body.user_id);
    var service_cost = 0;
    if (req.body.courier == "UPS") {
      service_cost = services.services[0].services[service_type].standard_cost;
    } else {
      service_cost = services.services[1].services[service_type].standard_cost;
    }

    const user = await User.findById(req.body.user_id);

    // Check if user has sufficient balance to process the order
    if (user.balance < service_cost) {
      //Otherwise return insufficient balance
      return res.status(400).json({ message: "Insufficent Balance " });
    }

    user.balance = Number(user.balance) - Number(service_cost);
    user.totalSpent += Number(service_cost);
    await user.save();

    const response = await axios.post(
      "https://api.labelexpress.io/v1/" + req.body.courier + "/image/create",
      shipment
    );

    const order = new Order({
      userId: req.body.user_id,
      courier: req.body.courier,
      service_name: req.body.service_name,
      image: response.data.data.base64_encoded_image,
      tracking_number: response.data.data.tracking_number,
      sender: req.body.sender,
      receiver: req.body.receiver,
      package: req.body.package,
    });

    const savedOrder = await order.save();

    return res.status(200).json({
      message: "Order created successfully",
      data: savedOrder,
      service_cost: service_cost,
    });
  } catch (error) {
    console.error("Error creating order:", error);

    // Determine the error type and respond accordingly
    if (error.response) {
      return res.status(error.response.status).json({
        message: error.response.data.message || "Error from Label Express API",
        error: error.response.data,
      });
    } else if (error.request) {
      // The request was made but no response was received
      return res.status(500).json({
        message: "No response received from Label Express API",
        error: error.request,
      });
    } else {
      // Something happened in setting up the request that triggered an Error
      return res.status(500).json({
        message: "Error creating order",
        error: error.message,
      });
    }
  }
});

router.post("/price/single", async (req, res) => {
  const { userId, courier, service } = req.body;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({ message: "User not Found" });
    }
    var price = 0;
    if (service) {
      if (courier == "UPS") {
        price = user.services[0].services[service].standard_cost;
      } else {
        price = user.services[1].services[service].standard_cost;
      }
      return res.status(200).json({ price });
    } else {
      return res.status(400).json({ message: "No Service Provided" });
    }
  } catch (error) {
    console.log("Error Occured: ", error);
  }
});

router.post("/price/bulk", async (req, res) => {
  const { userId } = req.body;
  const ordersArray = req.body.shipments;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    let totalPrice = 0;

    // Iterate over each order in the bulk array and calculate the total price
    for (const orderData of ordersArray) {
      const courier = orderData.courier;
      const service_type = orderData.service_name;
      let service_cost = 0;
      if (courier === "UPS" && service_type?.split(" ")[0] === "UPS") {
        service_cost = user.services[0].services[service_type].standard_cost;
      } else {
        service_cost = user.services[1].services[service_type].standard_cost;
      }

      totalPrice += service_cost; // Add each service cost to the total price
    }
    return res.status(200).json({
      totalPrice, // Return the calculated total price
    });
  } catch (error) {
    console.log("Error occurred:", error);
    res
      .status(500)
      .json({
        message: "Error calculating bulk order price",
        error: error.message,
      });
  }
});

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
    quantity: order.package?.order_item_quanity || "",
    shipdate: currentDate,
    courier_code: order?.courier || "",
    courier_name: order?.service_name || "",
    tracking_number: order?.tracking_number || "",
    ship_method: order?.ship_method || "shippo",
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
router.post("/bulk/:userId", async (req, res) => {
  const { userId } = req.params;
  let courier;
  const ordersArray = req.body;
  const bulkOrderData = {
    orders: [],
  };

  try {
    let isTxt = false;
    for (const orderData of ordersArray) {
      courier = orderData.courier;
      if (orderData.sender.order_id != null) {
        isTxt = true;
      }
      const service_type = orderData.service_name;
      const services = await User.findById(userId);
      var service_cost = 0;
      if (courier == "UPS" && service_type?.split(" ")[0] == "UPS") {
        service_cost =
          services.services[0].services[service_type].standard_cost;
      } else {
        service_cost =
          services.services[1].services[service_type].standard_cost;
      }

      const user = await User.findById(userId);
      // Check if user balance is sufficient for the current order and skip if there is not sufficient balance
      if (user.balance < service_cost) {
        console.log(` Insufficient Balance ${userId} balance skipped .`);
        continue;
      }
      user.balance = Number(user.balance) - Number(service_cost);
      user.totalSpent += Number(service_cost);
      await user.save();
      const shipment = {
        api_key: process.env.API_KEY,
        service_name: orderData.service_name,
        manifested: false,
        sender: orderData.sender,
        receiver: orderData.receiver,
        package: orderData.package,
      };

      const response = await axios.post(
        `https://api.labelexpress.io/v1/${courier}/image/create`,
        shipment
      );
      const order = {
        sender: orderData.sender,
        receiver: orderData.receiver,
        package: orderData.package,
        label: response.data.data,
        tracking_number: response.data.data.tracking_number,
        courier: orderData.courier,
        service_name: orderData.service_name,
        ship_data: response.data.shippo,
      };

      bulkOrderData.orders.push(order);
    }
    // Generate PDF
    let fileName = "";
    const currentTime = new Date();
    const year = currentTime.getFullYear();
    const month = String(currentTime.getMonth() + 1).padStart(2, "0");
    const day = String(currentTime.getDate()).padStart(2, "0");
    const hours = String(currentTime.getHours()).padStart(2, "0");
    const minutes = String(currentTime.getMinutes()).padStart(2, "0");
    const seconds = String(currentTime.getSeconds()).padStart(2, "0");
    const formattedTime = `${year}${month}${day}${hours}${minutes}${seconds}`;
    if (!isTxt) {
      const pdfDoc = new PDFDocument({ autoFirstPage: false });

      // Concatenate with no symbols or spaces
      const pdfPath = path.join(
        __dirname,
        `../uploads/bulk-orders${formattedTime}.pdf`
      );
      pdfDoc.pipe(fs.createWriteStream(pdfPath));

      // Add each order's image to the PDF
      for (const order of bulkOrderData.orders) {
        if (order.label.base64_encoded_image) {
          const imgBuffer = Buffer.from(
            order.label.base64_encoded_image,
            "base64"
          );

          // Get image dimensions
          const dimensions = sizeOf(imgBuffer);
          const { width, height } = dimensions;
          // Set the page size to the dimensions of the image
          pdfDoc
            .addPage({ size: [width, height] })
            .image(imgBuffer, 0, 0, { width, height })
            .moveDown();
        }
      }

      pdfDoc.end();

      fileName = `bulk-orders${formattedTime}.pdf`;
    } else if (isTxt) {
      const csvFileName = `bulk-orders${formattedTime}.csv`; // Set the file name for CSV
      const csvFilePath = path.join(__dirname, `../uploads/${csvFileName}`);

      // Write orders to CSV
      const ordersToWrite =
        bulkOrderData.orders && bulkOrderData.orders.length > 0
          ? bulkOrderData.orders
          : ordersArray;

      isCsvWritten = await writeOrdersToCSV(ordersToWrite, csvFilePath);
      if (isCsvWritten) {
        fileName = csvFileName;
      } else {
        throw new Error("Error generating CSV file");
      }
    }
    const bulkOrder = new BulkOrder({
      userId: userId,
      courier: courier,
      bulkOrderData: bulkOrderData,
      __filename: fileName,
    });
    const savedBulkOrder = await bulkOrder.save();

    res.status(200).json({
      message: "Bulk orders created successfully",
      fileName: fileName,
      data: savedBulkOrder,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error creating bulk orders",
      error: error.message,
    });
  }
});

router.get("/bulk/:userId", async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }
  try {
    const bulkOrders = await BulkOrder.find({ userId });
    res.status(200).json(bulkOrders);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/download/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, "../uploads/", filename);
  console.log(filePath);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).json({ message: "File not found" });
    }
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.sendFile(filePath);
  });
});

module.exports = router;
