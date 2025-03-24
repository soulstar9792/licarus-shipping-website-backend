const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const router = express.Router();
const LabelServicesType = require("../LabelServicesType.json");
// const dotenv = require('dotenv');
// dotenv.config();

const auth = require("../middleware/auth");
const User = require("../models/Users");
const { default: axios } = require("axios");

// Register
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      services: LabelServicesType,
    });
    await newUser.save();

    res.status(201).json({
      ok: true,
      message: "User registered successfully",
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Login
router.post("/login", async (req, res) => {
  console.log(req.body);

  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    if (user.activation === "block") {
      return res.status(400).json({ message: "Account is blocked" });
    }
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.SECRET_KEY
    );
    res.json({ token, user });
  } catch (error) {
    console.error("Error during login:", error); // Log the error details
    res.status(500).json({ error: error.message });
  }
});

// Get Api Balance 

router.get("/api/balance", async (req,res)=>{
  try {

    const url = `https://api.labelexpress.io/v1/client/information`;

    const response = await axios.request({
      method: "GET",
      url: "https://api.labelexpress.io/v1/client/information",
      headers: { "Content-Type": "application/json" },
      data: { api_key: process.env.API_KEY } 
    });

  console.log("Response from the Api ", response  );     
  res.json({message: "success",balance: response.data.data.client_balance}); 
  } catch (error) {
    console.log("An Error Occured", error); 
    res.json({message: "An Error occured"}); 
  }
})

router.get("/api/deposit", async (req,res)=>{
  console.log("----------------API------------------"); 
  try {


    const response = await axios.request({
      method: "GET",
      url: "https://api.labelexpress.io/v1/client/deposit/fetch/all",
      headers: { "Content-Type": "application/json" },
      data: { api_key: process.env.API_KEY } 
    });

  console.log("Response from the Api ", response.data);     
  res.json({message: "success",deposits: response.data.data}); 
  } catch (error) {
    console.log("An Error Occured", error); 
    res.json({message: "An Error occured"}); 
  }
})



// Get all users (Admin only)
router.get("/users", auth, async (req, res) => {
  try {
    const users = await User.find();
    console.log(users);
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Update user role
router.post("/users/role/:id", auth, async (req, res) => {
  const { user_role } = req.body; // Accept role in the body
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    user.user_role = user_role; // Update user role
    console.log(user);
    await user.save();
    res.status(200).json({ message: "User role updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user activation status
router.post("/users/activation/:id", auth, async (req, res) => {
  const { activation } = req.body; // Accept activation status in the body
  console.log(req.body);

  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.activation = activation; // Update activation status
    await user.save();

    res
      .status(200)
      .json({ message: "User activation status updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/users/balance/:id", auth, async (req, res) => {
  const { balance } = req.body; // Accept balance in the body
  console.log(req.body);

  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.balance = Number(balance); // Update balance
    await user.save();

    res.status(200).json({ message: "User balance updated successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error updating user balance", error: error.message });
  }
});

// Delete user
router.delete("/users/:id", auth, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/verify", auth, async (req, res) => {
  const { email } = req.user;
  const user = await User.findOne({ email });
  res.json({ user: user });
});

router.post("/save-address/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const newAddress = req.body.formData;
    if (!newAddress) {
      return res.status(400).json({ message: "Please Provide a address" });
    }
    const Updateduser = await User.findByIdAndUpdate(
      userId,
      { $push: { savedAddresss: newAddress } },
      { new: true, runValidators: true }
    );
    if (!Updateduser) {
      return res.status(404).json({ message: "User not Found" });
    }
    return res.status(200).json({
      message: "Address Added Succesfully ",
      savedAddresss: Updateduser.savedAddresss,
    });
  } catch (error) {
    console.error("Error adding address:", error);
    res.status(500).json({ message: "Error adding address", error });
  }
});

router.post("/delete-address/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const addressToDeleteId = req.body.id;
    if (!addressToDeleteId) {
      return res
        .status(400)
        .json({ message: "Please provide the address to delete" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $pull: { savedAddresss: { _id: addressToDeleteId } } },
      { new: true }
    );
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "Address deleted successfully",
      savedAddresses: updatedUser.savedAddresses,
    });
  } catch (error) {
    console.log("An error occurred:", error);
    res.status(500).json({ message: "An error occurred", error });
  }
});

router.get("/get-address/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const foundUser = await User.findById(userId);
    if (!foundUser) {
      return res.status(404).json({ message: "User not found" });
    }
    const savedAddress = foundUser.savedAddresss;
    if (!savedAddress) {
      return res.status(404).json({ message: "No Saved address" });
    }
    return res
      .status(200)
      .json({ message: "Address found ", savedAddress: savedAddress });
  } catch (error) {}
});

router.post('/update-address/:userId/:addressId',async(req,res)=>{
      try {
        const {userId} = req.params; 
        const {addressId} = req.params; 
        const {formData} = req.body; 

        console.log("Form Data",formData)
        if(!formData){
          return res.status(400).json({message: "Please Provide an Updated Address"}); 
        }

        const UpdatedUser = await User.findOneAndUpdate(
          {_id:userId, "savedAddresss._id": addressId},
          {
            $set:{
            "savedAddresss.$.address_id":formData.address_id,
            "savedAddresss.$.name":formData.name,
            "savedAddresss.$.phone":formData.phone,
            "savedAddresss.$.company":formData.company,
            "savedAddresss.$.street1":formData.street,
            "savedAddresss.$.street2":formData.street2,
            "savedAddresss.$.city":formData.city,
            "savedAddresss.$.state":formData.state,
            "savedAddresss.$.zip":formData.zip,
            "savedAddresss.$.country":formData.country,
          }
        },
          {new:true,runValidators:true}
        )
        if(!UpdatedUser) {
          return res.status(404).json({ message: "User or address not found" });
        }
        console.log("Updated User",UpdatedUser); 

        return res.status(200).json({
          message: "Address updated successfully",
          updatedAddress: UpdatedUser.savedAddresss,
        });
      } catch (error) {
        console.log("Error Occured: ",error)
        res.status(500).json({ message: "Error updating address", error });
      }
})

router.get("/get-sku/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const foundUser = await User.findById(userId);
    if (!foundUser) {
      return res.status(404).json({ message: "User not Found" });
    }
    const SkuData = foundUser.UserSKU;
    res.status(200).json({ message: "SKU's Found ", SkuData });
  } catch (error) {
    console.log("Error Occured : ", error);
    res.status(500).json({ message: "An Error Occured" });
  }
});

router.post("/add-sku/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { parsedData } = req.body;
    if (!parsedData) {
      return res.status(400).json({ message: "Please Provide SKU Data" });
    }
    const skuData = [
      {
        sku: parsedData[0].SKU || parsedData[0].sku,
        maxQty: parsedData[0].MaxQTYPerBox || parsedData[0].maxQty,
        weight: parsedData[0].WeightPerUnit || parsedData[0].weight,
        length: parsedData[0].Length || parsedData[0].length,
        width: parsedData[0].Width || parsedData[0].width,
        height: parsedData[0].Height || parsedData[0].height,
        description: parsedData[0].Description || parsedData[0].description,
      },
    ];
    const Updateduser = await User.findByIdAndUpdate(
      userId,
      { $push: { UserSKU: skuData } },
      { new: true, runValidators: true }
    );
    if (!Updateduser) {
      return res.status(404).json({ message: "User not Found" });
    }
    return res.status(200).json({
      message: "SKU Added Succesfully ",
      savedAddresss: Updateduser.UserSKU,
    });
  } catch (error) {
    console.log("Error Occured : ", error);
  }
});

router.post("/delete-sku/:skuId", async (req, res) => {
  try {
    const { skuId } = req.params;

    const user = await User.findOneAndUpdate(
      { "UserSKU._id": skuId },
      { $pull: { UserSKU: { _id: skuId } } },
      { new: true }
    );

    if (!user) {
      return res
        .status(404)
        .json({ message: "SKU not found or already deleted." });
    }
    res.status(200).json({ message: "SKU deleted successfully", user });
  } catch (error) {
    console.error("Error deleting SKU:", error);
    res.status(500).json({ error: "An error occurred while deleting SKU." });
  }
});

router.post("/update-sku/:userId/:skuId", async (req, res) => {
  try {
    const { userId, skuId } = req.params;
    const { skuData } = req.body;
    if (!skuData) {
      return res
        .status(400)
        .json({ message: "Please provide SKU data to update." });
    }

    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, "UserSKU._id": skuId },
      {
        $set: {
          "UserSKU.$.sku": skuData.sku,
          "UserSKU.$.maxQty": skuData.maxQty,
          "UserSKU.$.weight": skuData.weight,
          "UserSKU.$.length": skuData.length,
          "UserSKU.$.width": skuData.width,
          "UserSKU.$.height": skuData.height,
          "UserSKU.$.description": skuData.description,
        },
      },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User or SKU not found." });
    }

    res.status(200).json({
      message: "SKU updated successfully.",
      updatedUserSKU: updatedUser.UserSKU,
    });
  } catch (error) {
    console.error("Error occurred:", error);
    res
      .status(500)
      .json({ message: "An error occurred while updating the SKU." });
  }
});

module.exports = router;
