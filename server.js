const express = require('express');
const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const chatbotConfig = require('./api.config.js');
const app = express();

// --- Dynamic Configuration Loading ---
// Allows overriding or extending the base config with files from a secrets path,
// which is common in deployment environments like Render.

// Load API keys from secrets, falling back to local file
let apiKeys = {};
try {
    // First, try loading from the conventional secrets path
    apiKeys = require('/etc/secrets/apikeys.js');
    console.log('[CONFIG] Loaded API keys from /etc/secrets/apikeys.js');
} catch (e) {
    // If that fails, try loading the local file for development
    try {
        apiKeys = require('./apikeys.js');
        console.log('[CONFIG] Loaded local API keys from apikeys.js');
    } catch (e) {
        console.warn('[CONFIG] No apikeys.js file found. Paid chatbot features may be disabled.');
    }
}

// Load and merge custom user config from secrets, falling back to base config
try {
    const userConfig = require('/etc/secrets/api.user.js');
    console.log('[CONFIG] Loaded user config from /etc/secrets/api.user.js. Merging...');
    // Merge user config over the base config.
    Object.assign(chatbotConfig, userConfig);
} catch (e) {
    console.log('[CONFIG] No /etc/secrets/api.user.js file found. Using default config.');
}

const useSSL = !process.argv.includes('--nossl');
let server;

if (useSSL) {
    console.log('[SERVER] Starting in HTTPS mode.');
    const options = {
        key: fs.readFileSync(path.join(__dirname, 'certs/key.pem')),
        cert: fs.readFileSync(path.join(__dirname, 'certs/cert.pem'))
    };
    server = https.createServer(options, app);
} else {
    console.log('[SERVER] Starting in HTTP mode (SSL disabled).');
    server = http.createServer(app);
}

const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const CHAT_LOG_FILE = path.join(__dirname, 'chat_history.log');
const IMAGE_LIST_FILE = path.join(__dirname, 'images.json');
const WHITEBOARD_STATE_FILE = path.join(__dirname, 'whiteboard.json');
const WIKI_DIR = path.join(__dirname, 'wiki');


let chatHistory = [];
let imageList = [];
let currentImageUrl = null; // Track the currently displayed image
const clients = new Map();
let whiteboardState = null; // Will store the JSON string of the fabric canvas

const PLAYLIST_FILE = path.join(__dirname, 'playlist.json');

// --- Music State ---
let musicState = {
    playlist: [],
    currentIndex: -1,
    isPlaying: false,
    isLooping: false,
    volume: 100,
    startTime: null,
    pauseTime: null
};

// --- Utility & Music Functions ---

function loadPlaylist() {
    if (fs.existsSync(PLAYLIST_FILE)) {
        try {
            const fileContent = fs.readFileSync(PLAYLIST_FILE, 'utf-8');
            const savedState = JSON.parse(fileContent);
            // Basic validation
            if (savedState && Array.isArray(savedState.playlist)) {
                musicState = { ...musicState, ...savedState };
                console.log(`[PLAYLIST] Loaded ${musicState.playlist.length} songs.`);
            }
        } catch (error) {
            console.error('[PLAYLIST] Failed to load or parse playlist.json:', error);
        }
    }
}

function savePlaylist() {
    try {
        // Only save the persistent parts of the state
        const stateToSave = {
            playlist: musicState.playlist,
            isLooping: musicState.isLooping,
            volume: musicState.volume,
            currentIndex: musicState.currentIndex
        };
        fs.writeFileSync(PLAYLIST_FILE, JSON.stringify(stateToSave, null, 2));
    } catch (error) {
        console.error('[PLAYLIST] FAILED to save playlist:', error);
    }
}


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
async function handleChatbotRequest(prompt, config, trigger, originalMessage, senderUsername) {
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

        } else if (config.type === 'paid' && config.service === 'openai-compatible') {
            if (!config.apiKey || config.apiKey.includes('PASTE_YOUR')) {
                throw new Error(`API key for ${config.service} is missing or is a placeholder.`);
            }
            if (!config.endpoint) {
                throw new Error(`Endpoint URL for ${config.service} is missing.`);
            }

            const body = {
                model: config.model || 'chat',
                messages: [
                    { role: 'system', content: config.systemPrompt || 'You are a helpful assistant.' },
                    { role: 'user', content: prompt }
                ]
            };

            const response = await fetch(config.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': config.apiKey
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenAI-compatible API request failed with status ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            // Standard OpenAI format is response.choices[0].message.content
            if (data.choices && data.choices[0] && data.choices[0].message) {
                responseMessage = data.choices[0].message.content;
            } else {
                responseMessage = 'Le chatbot a répondu dans un format inattendu.';
            }

        } else {
            throw new Error(`The API type '${config.type}' or service '${config.service}' is not implemented.`);
        }
    } catch (error) {
        console.error(`[CHATBOT] Error calling API:`, error);
        responseMessage = `Désolé, une erreur est survenue en contactant l'IA. (${error.message})`;
    }

    const formattedMessage = `> **${prompt}**  \n\n${responseMessage}`;

    const finalMessage = {
        type: 'chat',
        sender: chatbotName,
        timestamp: new Date().toISOString(),
        message: formattedMessage
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
        if (message.type === 'chat' || message.type === 'dice' || message.type === 'game-roll') {
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

// Heartbeat function to detect and close dead connections.
// This prevents idle connections from being dropped by intermediaries
// and cleans up connections that are no longer responsive.
const heartbeatInterval = setInterval(function ping() {
  // Use wss.clients which is the raw Set of sockets from the 'ws' library
  wss.clients.forEach(function each(ws) {
    // Retrieve our associated client metadata from the Map
    const client = clients.get(ws);

    // If the client hasn't responded to the last ping, terminate.
    if (client && client.isAlive === false) {
      console.log(`[HEARTBEAT] Terminating unresponsive connection for user: ${client.username || 'N/A'}`);
      return ws.terminate();
    }

    // Mark as potentially unresponsive and send a new ping.
    // The 'pong' handler will mark it as 'alive' again.
    if (client) {
        client.isAlive = false;
        ws.ping(() => {}); // The callback is optional but good practice
    }
  });
}, 30000); // Run every 30 seconds

// Clean up the interval when the server is shut down
wss.on('close', function close() {
  clearInterval(heartbeatInterval);
});


wss.on('connection', (ws) => {
    // When a pong is received, mark the client as alive. This is part of the heartbeat mechanism.
    ws.on('pong', () => {
        const client = clients.get(ws);
        if (client) client.isAlive = true;
    });

    ws.on('message', async (message) => {
        const data = JSON.parse(message);
        const client = clients.get(ws);

        // Handle chat commands separately
        if (data.type === 'chat' && data.message.startsWith('#')) {
            const trigger = Object.keys(chatbotConfig).find(key => data.message.startsWith(key));
            if (trigger) {
                const prompt = data.message.substring(trigger.length).trim();
                const config = { ...chatbotConfig[trigger] };
                if (typeof config.apiKey === 'string' && apiKeys[config.apiKey]) {
                    config.apiKey = apiKeys[config.apiKey];
                }
                handleChatbotRequest(prompt, config, trigger, data.message, client ? client.username : 'User');
                return;
            }
        }

        switch (data.type) {
            case 'register':
                const isMJ = data.username.toLowerCase() === 'mj';
                clients.set(ws, { username: data.username, ws: ws, isMJ, isAlive: true });

                // Send initial state
                ws.send(JSON.stringify({ type: 'history', messages: chatHistory }));
                ws.send(JSON.stringify({ type: 'image-list-update', list: imageList }));
                ws.send(JSON.stringify({ type: 'show-image', url: currentImageUrl }));
                if (whiteboardState) ws.send(JSON.stringify({ type: 'fabric-load', payload: whiteboardState }));
                ws.send(JSON.stringify({ type: 'wiki-page-list', publicPages: publicWikiPages, mjPages: mjWikiPages }));
                if (isMJ) ws.send(JSON.stringify({ type: 'mj-status', isMJ: true }));

                broadcastUserList();
                break;

            case 'music-control':
                if (!client || !client.isMJ) break; // Only MJ can control music

                const { action, value } = data;
                let updatePayload = { type: 'music-control' };

                switch (action) {
                    case 'play':
                        if (value.index >= 0 && value.index < musicState.playlist.length) {
                            musicState.isPlaying = true;
                            musicState.currentIndex = value.index;
                            musicState.startTime = Date.now();
                            musicState.pauseTime = null;
                            updatePayload.action = 'play';
                            updatePayload.value = { index: musicState.currentIndex };
                            broadcast(updatePayload);
                        }
                        break;

                    case 'pause':
                        musicState.isPlaying = false;
                        musicState.pauseTime = Date.now();
                        updatePayload.action = 'pause';
                        broadcast(updatePayload);
                        break;

                    case 'volume':
                        musicState.volume = value.volume;
                        updatePayload.action = 'volume';
                        updatePayload.value = { volume: musicState.volume };
                        broadcast(updatePayload);
                        break;

                    case 'playlist-add':
                        // The client now provides the title.
                        if (value.videoId && value.title) {
                            musicState.playlist.push({ videoId: value.videoId, title: value.title });
                            // If nothing was playing, set the new song as current, but don't auto-play
                            if (musicState.currentIndex === -1) {
                                musicState.currentIndex = musicState.playlist.length - 1;
                            }
                        }
                        break;

                    case 'playlist-remove':
                        musicState.playlist = musicState.playlist.filter(song => song.videoId !== value.videoId);
                        // Adjust currentIndex if needed
                        if (musicState.currentIndex >= musicState.playlist.length) {
                            musicState.currentIndex = musicState.playlist.length - 1;
                        }
                        break;

                    case 'playlist-reorder':
                        musicState.playlist = value.playlist;
                        break;

                    case 'playlist-toggle-loop':
                        musicState.isLooping = value.isLooping;
                        break;

                    case 'request-sync':
                        // MJ requested a sync, send them the full state
                        let currentTime = 0;
                        if (musicState.currentIndex !== -1) {
                            if (musicState.isPlaying) {
                                currentTime = (Date.now() - musicState.startTime) / 1000;
                            } else if (musicState.pauseTime) {
                                currentTime = (musicState.pauseTime - musicState.startTime) / 1000;
                            }
                        }
                        ws.send(JSON.stringify({
                            type: 'music-control',
                            action: 'sync',
                            value: { ...musicState, currentTime }
                        }));
                        return; // Don't broadcast or save
                }

                // After any change, save and broadcast the full playlist to all clients
                savePlaylist();
                broadcast({ type: 'music-control', action: 'playlist-update', value: { playlist: musicState.playlist, isLooping: musicState.isLooping } });
                break;

            case 'add-image':
                if (client && client.isMJ) {
                    imageList.push({ name: data.name, url: data.url });
                    saveImageList();
                    broadcastImageList();
                }
                break;

            case 'delete-image':
                if (client && client.isMJ) {
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
                if (client && client.isMJ) {
                    currentImageUrl = data.url;
                    broadcast({ type: 'show-image', url: data.url });
                }
                break;

            case 'chat':
            case 'dice':
            case 'game-roll':
                data.timestamp = new Date().toISOString();
                chatHistory.push(data);
                appendToHistory(data);
                broadcast(data);
                break;

            case 'offer':
            case 'answer':
            case 'ice-candidate':
                const targetClient = Array.from(clients.values()).find(c => c.username === data.target);
                if (targetClient) targetClient.ws.send(JSON.stringify(data));
                break;

            case 'fabric-path-created':
            case 'fabric-add-object':
            case 'fabric-update-object':
            case 'fabric-remove-object':
            case 'fabric-set-background':
            case 'fabric-fog-toggle':
            case 'fabric-fog-erase-raw':
                broadcastToOthers(ws, data);
                break;

            case 'fabric-state-update':
                whiteboardState = data.payload;
                saveWhiteboardState(whiteboardState);
                break;

            case 'pointer-move':
                if (client) {
                    data.sender = client.username;
                    broadcastToOthers(ws, data);
                }
                break;

            case 'wiki-get-page':
                try {
                    const { pageName, isMJPage } = data;
                    const safePageName = path.normalize(pageName).replace(/^(\.\.[\/\\])+/, '');
                    if (!safePageName || safePageName.includes('..')) throw new Error('Invalid page name.');

                    const dir = isMJPage ? MJ_WIKI_DIR : WIKI_DIR;
                    const filePath = path.join(dir, `${safePageName}.md`);

                    if (fs.existsSync(filePath)) {
                        const content = fs.readFileSync(filePath, 'utf-8');
                        ws.send(JSON.stringify({ type: 'wiki-page-content', pageName: safePageName, content, isMJPage }));
                    } else {
                        ws.send(JSON.stringify({ type: 'wiki-page-content', pageName: safePageName, content: `# Page Not Found: ${pageName}`, isMJPage }));
                    }
                } catch (error) {
                    console.error('[WIKI] Error getting page:', error);
                }
                break;

            case 'wiki-save-page':
                if (client) {
                    try {
                        const { pageName, content, isMJPage } = data;
                        if (isMJPage && !client.isMJ) return; // MJ-only check

                        const safePageName = path.normalize(pageName).replace(/^(\.\.[\/\\])+/, '').replace(/[^\w\s-]/g, '');
                        if (!safePageName || safePageName.includes('..')) throw new Error('Invalid page name for saving.');

                        const dir = isMJPage ? MJ_WIKI_DIR : WIKI_DIR;
                        const filePath = path.join(dir, `${safePageName}.md`);

                        fs.writeFileSync(filePath, content, 'utf-8');
                        console.log(`[WIKI] Saved page: ${filePath}`);

                        loadWikiPages();
                        broadcastWikiPageList();

                        // Confirm save by sending content back to the saver
                        ws.send(JSON.stringify({ type: 'wiki-page-content', pageName: safePageName, content, isMJPage }));
                    } catch (error) {
                        console.error('[WIKI] Error saving page:', error);
                    }
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

// Ensure wiki directories exist before loading anything
if (!fs.existsSync(WIKI_DIR)) fs.mkdirSync(WIKI_DIR);
const MJ_WIKI_DIR = path.join(WIKI_DIR, 'mj');
if (!fs.existsSync(MJ_WIKI_DIR)) fs.mkdirSync(MJ_WIKI_DIR);

let publicWikiPages = [];
let mjWikiPages = [];

function loadWikiPages() {
    try {
        const publicFiles = fs.readdirSync(WIKI_DIR).filter(file => file.endsWith('.md') && fs.statSync(path.join(WIKI_DIR, file)).isFile());
        publicWikiPages = publicFiles.map(file => path.parse(file).name).sort();

        const mjFiles = fs.readdirSync(MJ_WIKI_DIR).filter(file => file.endsWith('.md'));
        mjWikiPages = mjFiles.map(file => path.parse(file).name).sort();

        console.log(`[WIKI] Loaded ${publicWikiPages.length} public and ${mjWikiPages.length} MJ pages.`);
    } catch (error) {
        console.error('[WIKI] Failed to load wiki pages:', error);
    }
}

function broadcastWikiPageList() {
    broadcast({
        type: 'wiki-page-list',
        publicPages: publicWikiPages,
        mjPages: mjWikiPages
    });
}


loadChatHistory();
loadImageList();
loadWhiteboardState();
loadPlaylist();
loadWikiPages();
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
