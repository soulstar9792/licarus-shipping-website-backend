const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const passport = require("passport");
const path = require("path");
const users = require("./routes/api/users");
const admin = require("./routes/api/admin");
const verifyToken = require("./routes/api/verifyToken.js");
const cors = require("cors");
require('dotenv').config();
const app = express();

// Bodyparser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
// app.use(cors({
//   origin: '*', // allow requests from this origin
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
// }));
app.use(cors());  // allow all origins
// DB Config
const db = process.env.mongoURI;

// Connect to MongoDB
mongoose
  .connect(db, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB successfully connected"))
  .catch((err) => console.log(err));

// Routes
app.use("/api/users", users);
app.use("/api/admin", admin);
app.use("/api/verify-token", verifyToken);

// Serve static assets if in production
if (process.env.NODE_ENV === "production") {
  // Set static folder
  app.use(express.static("client/build"));

  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "client", "build", "index.html"));
  });
}

// const port = process.env.PORT || 5000;

app.listen(5000, () => console.log(`Server up and running on port ${5000} !`));
