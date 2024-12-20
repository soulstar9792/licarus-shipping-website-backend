const jwt = require("jsonwebtoken");

module.exports = function (req, res, next) {
  const token = req.headers.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);

  console.log("Token received:", token); // Output received token

  if (!token) {
    return res.status(401).json({ message: "No token, authorization denied" });
  }

  try {
    const decoded = jwt.verify(token, process.env.secretOrKey); // Replace 'your_secret_key' for testing
    req.user = decoded; // Attach user details to req
    console.log("Decoded User:", req.user); // Output decoded user info
    next();
  } catch (err) {
    console.error('Error verifying token:', err.message); // Log the error details
    return res.status(401).json({ message: "Token is not valid" });
  }
};