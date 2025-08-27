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
const IMAGE_LIST_FILE = path.join(__dirname, 'images.json');
const WHITEBOARD_STATE_FILE = path.join(__dirname, 'whiteboard.json');


let chatHistory = [];
let imageList = [];
let currentImageUrl = null; // Track the currently displayed image
const clients = new Map();
let whiteboardState = null; // Will store the JSON string of the fabric canvas

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

function broadcastToOthers(ws, message) {
    const data = JSON.stringify(message);
    clients.forEach(client => {
        if (client.ws !== ws && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(data);
        }
    });
}

// --- Chatbot Functions ---
async function handleChatbotRequest(prompt, config, trigger) {
    const chatbotName = config.displayName || config.service || 'Chatbot';
    let responseMessage;

    // Prepend the system prompt/instruction to the user's prompt
    const systemPrompt = "You are an assistant that will answer in a limited format with 900 caracter maximum. You will not respond if you are not 100% sure of the answer.";
    const finalPrompt = `${systemPrompt}\n\nUser question: ${prompt}`;

    try {
        if (config.type === 'url') {
            const response = await fetch(config.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: finalPrompt })
            });
            if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
            const data = await response.json();
            responseMessage = data.response || 'Le chatbot n\'a pas pu répondre.';

        } else if (config.type === 'paid' && config.service === 'gemini') {
            if (!config.apiKey || config.apiKey.includes('PASTE_YOUR')) {
                throw new Error('API key for Gemini is missing or is a placeholder.');
            }

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
            const body = { contents: [{ parts: [{ text: finalPrompt }] }] };
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

    const finalMessage = {
        type: 'chat',
        sender: chatbotName,
        timestamp: new Date().toISOString(),
        message: responseMessage
    };
    broadcast(finalMessage);
    appendToHistory(finalMessage);
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

// --- Image List Functions ---

function loadImageList() {
    if (fs.existsSync(IMAGE_LIST_FILE)) {
        const fileContent = fs.readFileSync(IMAGE_LIST_FILE, 'utf-8');
        try {
            imageList = JSON.parse(fileContent);
            console.log(`[IMAGES] Loaded ${imageList.length} images.`);
        } catch (error) {
            console.error('[IMAGES] Failed to parse images.json:', error);
            imageList = [];
        }
    }
}

function saveImageList() {
    try {
        // Sort alphabetically by name before saving
        imageList.sort((a, b) => a.name.localeCompare(b.name));
        fs.writeFileSync(IMAGE_LIST_FILE, JSON.stringify(imageList, null, 2));
    } catch (error) {
        console.error('[IMAGES] FAILED to save image list:', error);
    }
}

function broadcastImageList() {
    broadcast({ type: 'image-list-update', list: imageList });
}

// --- Whiteboard State Functions ---
function saveWhiteboardState(state) {
    try {
        fs.writeFileSync(WHITEBOARD_STATE_FILE, state);
    } catch (error) {
        console.error('[WHITEBOARD] FAILED to save state:', error);
    }
}

function loadWhiteboardState() {
    if (fs.existsSync(WHITEBOARD_STATE_FILE)) {
        const fileContent = fs.readFileSync(WHITEBOARD_STATE_FILE, 'utf-8');
        if (fileContent) {
            whiteboardState = fileContent;
            console.log('[WHITEBOARD] Loaded saved whiteboard state.');
        }
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
                handleChatbotRequest(prompt, chatbotConfig[trigger], trigger);
                return;
            }
        }

        switch (data.type) {
            case 'register':
                const isMJ = data.username.toLowerCase() === 'mj';
                clients.set(ws, { username: data.username, ws: ws, isMJ });

                ws.send(JSON.stringify({ type: 'history', messages: chatHistory }));
                ws.send(JSON.stringify({ type: 'image-list-update', list: imageList }));
                ws.send(JSON.stringify({ type: 'show-image', url: currentImageUrl })); // Send current image on join
                if (whiteboardState) {
                    ws.send(JSON.stringify({ type: 'fabric-load', payload: whiteboardState }));
                }

                if (isMJ) {
                    ws.send(JSON.stringify({ type: 'mj-status', isMJ: true }));
                }

                broadcastUserList();
                break;

            case 'add-image':
                const client = clients.get(ws);
                if (client && client.isMJ) {
                    imageList.push({ name: data.name, url: data.url });
                    saveImageList();
                    broadcastImageList();
                }
                break;

            case 'delete-image':
                const clientToDelete = clients.get(ws);
                if (clientToDelete && clientToDelete.isMJ) {
                    // If the deleted image is the one being shown, clear the display.
                    if (data.url === currentImageUrl) {
                        currentImageUrl = null;
                        broadcast({ type: 'show-image', url: null });
                    }
                    imageList = imageList.filter(img => img.url !== data.url);
                    saveImageList();
                    broadcastImageList();
                }
                break;

            case 'show-image':
                const clientToShow = clients.get(ws);
                if (clientToShow && clientToShow.isMJ) {
                    currentImageUrl = data.url; // Update current image state
                    broadcast({ type: 'show-image', url: data.url });
                }
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

            // Real-time sync: broadcast drawing events to other clients
            case 'fabric-path-created':
            case 'fabric-add-object':
            case 'fabric-update-object':
            case 'fabric-remove-object':
            case 'fabric-set-background':
            case 'fabric-fog-toggle':
            case 'fabric-fog-erase':
                const clientSync = clients.get(ws);
                if(clientSync && clientSync.isMJ) {
                    broadcastToOthers(ws, data);
                }
                break;

            // Persistence: save the full state received from a client
            case 'fabric-state-update':
                const clientState = clients.get(ws);
                if (clientState && clientState.isMJ) {
                    whiteboardState = data.payload;
                    saveWhiteboardState(whiteboardState);
                }
                break;

            case 'pointer-move':
                const clientInfo = clients.get(ws);
                if (clientInfo) {
                    data.sender = clientInfo.username;
                    broadcastToOthers(ws, data);
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
loadImageList();
loadWhiteboardState();
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
