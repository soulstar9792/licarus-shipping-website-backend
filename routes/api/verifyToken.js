const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();


const secretOrKey = process.env.secretOrKey; // Ensure this is set in your .env file

router.post("/", (req, res) => {
    console.log(req.body);
    
  const authHeader = req.body.token;

  // Log the authorization header
  console.log("Authorization Header:", authHeader);

  if (!authHeader) {
    return res.status(401).json({ valid: false, message: 'No token provided' });
  }

  // Extract the token from the header
  const token = authHeader.split(' ')[1]; // This will get the token part after 'Bearer'

  console.log("Token received:", token); // Log the received token for debugging

  // Verify the token
  jwt.verify(token, process.env.secretOrKey, (err, decoded) => {
    if (err) {
      console.log("Verification error:", err);
      return res.status(401).json({ valid: false, message: 'Token is invalid or expired' });
    }

    // Token is valid
    res.json({ valid: true, user: decoded }); // Return user data if desired
  });
});

module.exports = router;