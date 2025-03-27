const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const bodyParser = require("body-parser");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

// Hook Server
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};


// API Server
const authRouter = require("./routes/auth");
const OrderRouter = require("./routes/OrderLabel");
const paymentRouter = require("./routes/payment");
const hookRouter = require('./routes/hook');

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString('utf8'); // Store raw body for later verification
    },
  })
);


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

app.use('/hook', hookRouter);
app.use("/api/auth", authRouter);
app.use("/api/orders", OrderRouter);
app.use("/api/payment", paymentRouter);

console.log("--------------");

mongoose
.connect(process.env.MONGO_URI)
.then(() => console.log("Connected to MongoDB"))
.catch((err) => console.error("MongoDB connection error:", err));

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening at ${port}`);
});