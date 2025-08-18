const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const CHAT_LOG_FILE = path.join(__dirname, 'chat_history.log');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// In-memory cache of chat history
let chatHistory = [];

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
    trimHistoryFileIfNeeded();
}

function trimHistoryFileIfNeeded() {
    if (fs.existsSync(CHAT_LOG_FILE)) {
        const stats = fs.statSync(CHAT_LOG_FILE);
        if (stats.size > MAX_FILE_SIZE) {
            console.log('Chat history file size exceeds limit. Trimming...');
            // Keep the most recent half of the messages
            const linesToKeep = chatHistory.slice(Math.floor(chatHistory.length / 2));
            const newContent = linesToKeep.map(line => JSON.stringify(line)).join('\n') + '\n';
            fs.writeFileSync(CHAT_LOG_FILE, newContent);
            chatHistory = linesToKeep;
            console.log('Trimming complete.');
        }
    }
}

// --- WebSocket Server ---
wss.on('connection', (ws) => {
    console.log('Client connected');
    ws.isAlive = true;

    // Send history right away
    ws.send(JSON.stringify({ type: 'history', messages: chatHistory }));

    ws.on('message', (message) => {
        try {
            const parsedMessage = JSON.parse(message);

            if (parsedMessage.type === 'user-join') {
                // Store username on the connection and announce the join
                ws.username = parsedMessage.sender;
                const joinMessage = {
                    type: 'system',
                    sender: 'System',
                    message: `${ws.username} a rejoint la session.`,
                    color: '#aaa',
                    timestamp: new Date().toISOString()
                };
                // Don't save join/leave messages to history, just broadcast
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(joinMessage));
                    }
                });
            } else {
                // Handle regular chat/dice messages
                parsedMessage.timestamp = new Date().toISOString();
                appendToHistory(parsedMessage);
                wss.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(parsedMessage));
                    }
                });
            }
        } catch (error) {
            console.error('Failed to parse message or broadcast:', error);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        if (ws.username) {
            const leaveMessage = {
                type: 'system',
                sender: 'System',
                message: `${ws.username} a quitté la session.`,
                color: '#aaa',
                timestamp: new Date().toISOString()
            };
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(leaveMessage));
                }
            });
        }
    });
});

// --- HTTP Server ---
// Serve static files from the root directory
app.use(express.static(path.join(__dirname, '/')));

// Initial load of history
loadChatHistory();

server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
