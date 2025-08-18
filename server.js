const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000; // Revert to 3000 for the final version
const CHAT_LOG_FILE = path.join(__dirname, 'chat_history.log');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

let chatHistory = [];
let users = {}; // Store users by their WebSocket connection

// --- Chat History Functions ---
function loadChatHistory() {
    if (fs.existsSync(CHAT_LOG_FILE)) {
        const fileContent = fs.readFileSync(CHAT_LOG_FILE, 'utf-8');
        const lines = fileContent.split('\n').filter(line => line.trim() !== '');
        chatHistory = lines.map(line => JSON.parse(line));
        console.log(`Loaded ${chatHistory.length} messages from history.`);
    }
}

function appendToHistory(message) {
    chatHistory.push(message);
    fs.appendFileSync(CHAT_LOG_FILE, JSON.stringify(message) + '\n');
    // Trimming logic can be added here if needed
}

// --- WebSocket Server ---
wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (message) => {
        const data = JSON.parse(message);

        switch (data.type) {
            case 'register':
                console.log(`User registered: ${data.username}`);
                ws.username = data.username;
                users[data.username] = ws;
                // Announce new user to all others
                Object.values(users).forEach(userWs => {
                    if (userWs !== ws) {
                        userWs.send(JSON.stringify({ type: 'new-user', username: data.username }));
                    }
                });
                // Send list of existing users to the new user
                ws.send(JSON.stringify({ type: 'existing-users', usernames: Object.keys(users).filter(u => u !== data.username) }));
                // Send chat history
                ws.send(JSON.stringify({ type: 'history', messages: chatHistory }));
                break;

            case 'chat':
            case 'dice':
                data.timestamp = new Date().toISOString();
                appendToHistory(data);
                // Broadcast chat messages to all
                Object.values(users).forEach(userWs => {
                    userWs.send(JSON.stringify(data));
                });
                break;

            case 'offer':
            case 'answer':
            case 'ice-candidate':
                // Relay signaling messages to the target user
                const targetWs = users[data.target];
                if (targetWs) {
                    console.log(`Relaying ${data.type} from ${data.sender} to ${data.target}`);
                    targetWs.send(JSON.stringify(data));
                }
                break;
        }
    });

    ws.on('close', () => {
        const username = ws.username;
        if (username) {
            console.log(`User disconnected: ${username}`);
            delete users[username];
            // Announce user departure to all others
            Object.values(users).forEach(userWs => {
                userWs.send(JSON.stringify({ type: 'user-left', username }));
            });
        }
    });
});

// --- HTTP Server ---
app.use(express.static(path.join(__dirname, '/')));
loadChatHistory();
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
