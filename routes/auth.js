const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/Users');
const router = express.Router();
const LabelServicesType = require('../LabelServicesType.json')
// const dotenv = require('dotenv');
// dotenv.config();

const auth = require('../middleware/auth');

// Register
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, email, password: hashedPassword, services: LabelServicesType });
        console.log(LabelServicesType)
        await newUser.save();

        res.status(201).json({
            ok: true,
            message: 'User registered successfully'
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Login
router.post('/login', async (req, res) => {
    console.log(req.body);

    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        if (user.activation === 'block') {
            return res.status(400).json({ message: 'Account is blocked' });
        }
        const token = jwt.sign({ id: user._id, email: user.email }, process.env.SECRET_KEY);
        res.json({ token, user });
    } catch (error) {
        console.error("Error during login:", error); // Log the error details
        res.status(500).json({ error: error.message });
    }
});

// Get all users (Admin only)
router.get('/users', auth, async (req, res) => {
    try {
        const users = await User.find();
        console.log(users);
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Update user role
router.post('/users/role/:id', auth, async (req, res) => {
    const { user_role } = req.body; // Accept role in the body
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        user.user_role = user_role; // Update user role
        console.log(user);
        await user.save();
        res.status(200).json({ message: 'User role updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update user activation status
router.post('/users/activation/:id', auth, async (req, res) => {
    const { activation } = req.body; // Accept activation status in the body
    console.log(req.body);

    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.activation = activation; // Update activation status
        await user.save();

        res.status(200).json({ message: 'User activation status updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/users/balance/:id', auth, async (req, res) => {
    const { balance } = req.body; // Accept balance in the body
    console.log(req.body);

    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.balance = Number(balance); // Update balance
        await user.save();

        res.status(200).json({ message: 'User balance updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating user balance', error: error.message });
    }
}); 

// Delete user
router.delete('/users/:id', auth, async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/verify', auth, async (req, res) => {
    const { email } = req.user;
    const user = await User.findOne({ email });
    res.json({ user: user });
});

router.post('/save-address/:userId', async(req,res)=>{

        try {
            const {userId} = req.params; 
            const newAddress = req.body.formData;
            console.log("New adress",newAddress); 
            if(!newAddress){
                return res.status(400).json({message:"Please Provide a address"}); 
            } 
            const Updateduser = await User.findByIdAndUpdate(userId,
                {$push: {savedAddresss:newAddress}},
                {new:true, runValidators: true}
            );
            console.log(Updateduser);
            if(!Updateduser){
                return res.status(404).json({message: "User not Found"}); 
            } 
            return res.status(200).json({
                message: "Addres Added Succesfully ", 
                savedAddresss: Updateduser.savedAddresss
            })
        } catch (error) {
            console.error('Error adding address:', error);
            res.status(500).json({ message: 'Error adding address', error });
        }
})

router.post('/delete-address/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      console.log(userId); 
      console.log("the body " , req.body); 
      const addressToDelete = req.body.address;  
        console.log(addressToDelete); 
      if (!addressToDelete) {
        return res.status(400).json({ message: "Please provide the address to delete" });
      }
  
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $pull: { savedAddresses: addressToDelete } },  
        { new: true }
      );
  
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
  
      return res.status(200).json({
        message: "Address deleted successfully",
        savedAddresses: updatedUser.savedAddresses  
      });
  
    } catch (error) {
      console.log("An error occurred:", error);
      res.status(500).json({ message: "An error occurred", error });
    }
  });
  

router.get('/get-address/:userId',async(req,res)=>{
    try {
        const {userId} = req.params; 
        const foundUser =await User.findById(userId); 
        if(!foundUser){
            return res.status(404).json({message:"User not found"}); 
        }
        const savedAddress = foundUser.savedAddresss; 
        if(!savedAddress){
            return res.status(404).json({message:"No Saved address"}); 
        }
        return res.status(200).json({message:"Address found ", savedAddress: savedAddress}); 
    } catch (error) {
        
    }
})

module.exports = router;