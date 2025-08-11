const express = require("express");
const http = require("http");
const fs = require("fs");
const app = express();
const server = http.createServer(app);
const socket = require("socket.io");
const io = socket(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

const users = {};
const chatHistoryPath = 'chat_history.json';

// --- Chat History Management ---

// Ensure chat history file exists on startup
if (!fs.existsSync(chatHistoryPath)) {
    fs.writeFileSync(chatHistoryPath, JSON.stringify([]));
}

const readChatHistory = () => {
    try {
        const data = fs.readFileSync(chatHistoryPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading chat history:", error);
        return [];
    }
};

const writeChatHistory = (history) => {
    try {
        let historyToSave = [...history];
        let jsonHistory = JSON.stringify(historyToSave, null, 2);
        const MAX_SIZE_BYTES = 5 * 1024 * 1024;

        while (Buffer.from(jsonHistory, 'utf8').length > MAX_SIZE_BYTES && historyToSave.length > 0) {
            historyToSave.shift(); // Remove the oldest message
            jsonHistory = JSON.stringify(historyToSave, null, 2);
        }

        fs.writeFileSync(chatHistoryPath, jsonHistory);
        return historyToSave; // Return the potentially trimmed array
    } catch (error) {
        console.error("Error writing chat history:", error);
        return history; // On error, return the original untrimmed history
    }
};

// --- Socket.IO Connection Handling ---

io.on('connection', socket => {
    // --- User & WebRTC Connection Logic ---
    if (!users[socket.id]) {
        users[socket.id] = socket.id;
    }
    socket.emit("yourID", socket.id);
    io.sockets.emit("allUsers", Object.keys(users));
    socket.on('disconnect', () => {
        delete users[socket.id];
        io.sockets.emit("allUsers", Object.keys(users)); // Notify clients of user disconnection
    });

    // --- Chat Logic ---
    // Send the current chat history to the connecting client
    socket.emit('chat history', readChatHistory());

    // Listen for a new message from a client
    socket.on('new message', (message) => {
        const history = readChatHistory();
        history.push(message);
        writeChatHistory(history); // Save the updated history

        // Broadcast the new message to all clients
        io.emit('new message', message);
    });

    // --- WebRTC Signaling Logic ---
    socket.on("callUser", (data) => {
        //send the signal to the other user
        io.to(data.userToCall).emit('hey', {signal: data.signalData, from: data.from});
    })

    //a user accepts a call
    socket.on("acceptCall", (data) => {
        //send the signal to the other user
        io.to(data.to).emit('callAccepted', data.signal);
    })
});

app.get('/api/hello', (req, res) => {
  res.send({ express: 'Hello From Express' });
});

server.listen(5000, () => console.log('server is running on port 5000'));
