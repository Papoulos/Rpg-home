const express = require('express');
const https = require('https');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();

const options = {
    key: fs.readFileSync(path.join(__dirname, 'certs/key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'certs/cert.pem'))
};

const server = https.createServer(options, app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const CHAT_LOG_FILE = path.join(__dirname, 'chat_history.log');

let chatHistory = [];
const clients = new Map(); // Use a map to store clients with metadata

// --- Utility Functions ---
function broadcastUserList() {
    const userList = Array.from(clients.values()).map(c => c.username).filter(Boolean);
    const message = JSON.stringify({ type: 'user-list', users: userList });
    clients.forEach(client => {
        if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(message);
        }
    });
    console.log('[BROADCAST] Sent user list:', userList);
}

// --- Chat History Functions ---
function loadChatHistory() {
    if (fs.existsSync(CHAT_LOG_FILE)) {
        const fileContent = fs.readFileSync(CHAT_LOG_FILE, 'utf-8');
        const lines = fileContent.split('\n').filter(line => line.trim() !== '');
        chatHistory = lines.map(line => JSON.parse(line));
        console.log(`[HISTORY] Loaded ${chatHistory.length} messages.`);
    }
}

function appendToHistory(message) {
    console.log('[HISTORY] Appending message...');
    try {
        chatHistory.push(message);
        fs.appendFileSync(CHAT_LOG_FILE, JSON.stringify(message) + '\n');
        console.log('[HISTORY] Append successful.');
    } catch (error) {
        console.error('[HISTORY] FAILED to append message:', error);
    }
}

// --- WebSocket Server ---
wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (message) => {
        const data = JSON.parse(message);

        switch (data.type) {
            case 'register':
                console.log(`User registered: ${data.username}`);
                clients.set(ws, { username: data.username, ws: ws });
                ws.send(JSON.stringify({ type: 'history', messages: chatHistory }));
                broadcastUserList();
                break;

            case 'chat':
            case 'dice':
                data.timestamp = new Date().toISOString();
                appendToHistory(data);
                clients.forEach(client => {
                    if (client.ws.readyState === WebSocket.OPEN) {
                        client.ws.send(JSON.stringify(data));
                    }
                });
                break;

            case 'offer':
            case 'answer':
            case 'ice-candidate':
                const targetClient = Array.from(clients.values()).find(c => c.username === data.target);
                if (targetClient) {
                    console.log(`[SIGNAL] Relaying ${data.type} from ${data.sender} to ${data.target}`);
                    targetClient.ws.send(JSON.stringify(data));
                }
                break;
        }
    });

    ws.on('close', () => {
        const clientInfo = clients.get(ws);
        if (clientInfo) {
            console.log(`User disconnected: ${clientInfo.username}`);
            clients.delete(ws);
            broadcastUserList();
        } else {
            console.log('An unregistered client disconnected.');
        }
    });
});

// --- HTTP Server ---
app.use(express.static(path.join(__dirname, '/')));
loadChatHistory();
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
