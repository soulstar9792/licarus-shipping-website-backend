const express = require("express");
const router = express.Router();
const User = require("../../models/User");
const auth = require("../../middlewares/passport");

// Middleware to check if user is admin
// const isAdmin = (req, res, next) => {
//   if (req.user.user_role === 1) { // Assuming 1 is the role ID for admin
//     next();
//   } else {
//     return res.status(403).json({ message: "Access denied" });
//   }
// };

// Admin route to get all users
router.get("/get_users", (req, res) => {
  User.find({})
    .select("-password") // Do not return passwords
    .then(users => res.json(users))
    .catch(err => res.status(500).json({ error: err.message }));
});

module.exports = router;