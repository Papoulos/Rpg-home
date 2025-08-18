const express = require('express');
const https = require('https');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const chatbotConfig = require('./api.config.js');

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
const clients = new Map();

// --- Utility Functions ---
function broadcast(message) {
    const data = JSON.stringify(message);
    clients.forEach(client => {
        if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(data);
        }
    });
}

function broadcastUserList() {
    const userList = Array.from(clients.values()).map(c => c.username).filter(Boolean);
    broadcast({ type: 'user-list', users: userList });
}

// --- Chatbot Functions ---
async function handleChatbotRequest(prompt, config) {
    const chatbotName = config.displayName || config.service || 'Chatbot';
    let responseMessage;

    try {
        if (config.type === 'url') {
            const response = await fetch(config.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });
            if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
            const data = await response.json();
            responseMessage = data.response || 'Le chatbot n\'a pas pu répondre.';

        } else if (config.type === 'paid' && config.service === 'gemini') {
            if (!config.apiKey || config.apiKey.includes('PASTE_YOUR')) {
                throw new Error('API key for Gemini is missing or is a placeholder.');
            }

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
            const body = { contents: [{ parts: [{ text: prompt }] }] };
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Gemini API request failed with status ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            responseMessage = data.candidates[0].content.parts[0].text || 'Gemini n\'a pas pu répondre.';

        } else {
            throw new Error(`The API type '${config.type}' or service '${config.service}' is not implemented.`);
        }
    } catch (error) {
        console.error(`[CHATBOT] Error calling API:`, error);
        responseMessage = `Désolé, une erreur est survenue en contactant l'IA. (${error.message})`;
    }

    // Truncate the response if it's too long
    if (responseMessage.length > 900) {
        responseMessage = responseMessage.substring(0, 900) + '...';
    }

    const finalMessage = {
        type: 'chat',
        sender: chatbotName,
        timestamp: new Date().toISOString(),
        message: responseMessage
    };
    broadcast(finalMessage);
    appendToHistory(finalMessage); // Also save chatbot responses
}


// --- Chat History Functions ---
function loadChatHistory() {
    if (fs.existsSync(CHAT_LOG_FILE)) {
        const fileContent = fs.readFileSync(CHAT_LOG_FILE, 'utf-8');
        const lines = fileContent.split('\n').filter(Boolean);
        chatHistory = lines.map(line => {
            try { return JSON.parse(line); } catch { return null; }
        }).filter(Boolean);
        console.log(`[HISTORY] Loaded ${chatHistory.length} valid messages.`);
    }
}

function appendToHistory(message) {
    try {
        if (message.type === 'chat' || message.type === 'dice') {
            fs.appendFileSync(CHAT_LOG_FILE, JSON.stringify(message) + '\n');
        }
    } catch (error) {
        console.error('[HISTORY] FAILED to append message:', error);
    }
}

// --- WebSocket Server ---
wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === 'chat') {
            const trigger = Object.keys(chatbotConfig).find(key => data.message.startsWith(key));
            if (trigger) {
                const prompt = data.message.substring(trigger.length).trim();
                handleChatbotRequest(prompt, chatbotConfig[trigger]);
                return;
            }
        }

        switch (data.type) {
            case 'register':
                clients.set(ws, { username: data.username, ws: ws });
                ws.send(JSON.stringify({ type: 'history', messages: chatHistory }));
                broadcastUserList();
                break;
            case 'chat':
            case 'dice':
                data.timestamp = new Date().toISOString();
                chatHistory.push(data);
                appendToHistory(data);
                broadcast(data);
                break;
            case 'offer':
            case 'answer':
            case 'ice-candidate':
                const targetClient = Array.from(clients.values()).find(c => c.username === data.target);
                if (targetClient) {
                    targetClient.ws.send(JSON.stringify(data));
                }
                break;
        }
    });

    ws.on('close', () => {
        const clientInfo = clients.get(ws);
        if (clientInfo) {
            clients.delete(ws);
            broadcastUserList();
        }
    });
});

// --- HTTP Server ---
app.use(express.static(path.join(__dirname, '/')));
loadChatHistory();
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
