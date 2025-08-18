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
    console.log('[DEBUG] Broadcast user list:', userList);
}

// --- Chat History Functions ---
function loadChatHistory() {
    if (fs.existsSync(CHAT_LOG_FILE)) {
        const fileContent = fs.readFileSync(CHAT_LOG_FILE, 'utf-8');
        const lines = fileContent.split('\n').filter(line => line.trim() !== '');
        chatHistory = lines.map(line => {
            try {
                return JSON.parse(line);
            } catch {
                console.warn('[HISTORY] Ignoring malformed line in chat history:', line);
                return null;
            }
        }).filter(Boolean); // Filter out nulls from failed parsing
        console.log(`[HISTORY] Loaded ${chatHistory.length} valid messages.`);
    }
}

function appendToHistory(message) {
    console.log('[HISTORY] Attempting to append message:', message);
    try {
        // Only save message types that should be persisted
        if (message.type === 'chat' || message.type === 'dice') {
            fs.appendFileSync(CHAT_LOG_FILE, JSON.stringify(message) + '\n');
            console.log('[HISTORY] Append successful.');
        }
    } catch (error) {
        console.error('[HISTORY] FAILED to append message:', error);
    }
}

// --- WebSocket Server ---
wss.on('connection', (ws) => {
    console.log('[DEBUG] Client connected');

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        console.log(`[DEBUG] Received message type: ${data.type} from ${data.sender}`);

        switch (data.type) {
            case 'register':
                clients.set(ws, { username: data.username, ws: ws });
                ws.send(JSON.stringify({ type: 'history', messages: chatHistory }));
                broadcastUserList();
                break;

            case 'chat':
            case 'dice':
                data.timestamp = new Date().toISOString();
                chatHistory.push(data); // Add to in-memory history for the session
                appendToHistory(data); // Attempt to persist to file
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
                    console.log(`[DEBUG] Relaying ${data.type} from ${data.sender} to ${data.target}`);
                    targetClient.ws.send(JSON.stringify(data));
                } else {
                    console.warn(`[DEBUG] Could not find target for signaling message: ${data.target}`);
                }
                break;
        }
    });

    ws.on('close', () => {
        const clientInfo = clients.get(ws);
        if (clientInfo) {
            console.log(`[DEBUG] User disconnected: ${clientInfo.username}`);
            clients.delete(ws);
            broadcastUserList();
        } else {
            console.log('[DEBUG] An unregistered client disconnected.');
        }
    });
});

// --- HTTP Server ---
app.use(express.static(path.join(__dirname, '/')));
loadChatHistory();
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
