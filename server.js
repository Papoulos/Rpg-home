const express = require('express');
const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const util = require('util');
const fetch = require('node-fetch');
const rateLimit = require('express-rate-limit');
const { loadApiKeys, loadChatbotConfig } = require('./config-loader');
let chatbotConfig = require('./api.config.js'); // Load base config
const multer = require('multer');
const axios = require('axios');
const app = express();

let originalConsoleLog = console.log;
let originalConsoleError = console.error;

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(limiter);
app.use(express.json({ limit: '50mb' }));

// --- MP3 Upload and Download Routes ---
const musicDir = path.join(__dirname, 'data/music');
if (!fs.existsSync(musicDir)) {
    fs.mkdirSync(musicDir, { recursive: true });
}
app.use('/music', express.static(musicDir));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, musicDir)
    },
    filename: function (req, file, cb) {
        // Sanitize the filename to prevent path traversal
        let sanitizedOriginalName = path.basename(file.originalname);
        // Ensure no path traversal and keep standard file names
        sanitizedOriginalName = sanitizedOriginalName.replace(/[^a-zA-Z0-9.\-_]/g, '_');

        let filename = sanitizedOriginalName;
        let counter = 1;
        while (fs.existsSync(path.join(musicDir, filename))) {
            const ext = path.extname(sanitizedOriginalName);
            const base = path.basename(sanitizedOriginalName, ext);
            filename = `${base}-${counter}${ext}`;
            counter++;
        }

        cb(null, filename);
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50 MB limit
});

app.post('/upload-music', upload.single('musicFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    res.json({ url: '/music/' + req.file.filename, filename: path.basename(req.file.originalname) });
});

app.post('/download-music-url', async (req, res) => {
    const urlStr = req.body.url;
    if (!urlStr || (!urlStr.startsWith('http://') && !urlStr.startsWith('https://'))) {
        return res.status(400).send('Invalid URL.');
    }

    try {
        const parsedUrl = new URL(urlStr);
        // Prevent SSRF by disallowing localhost, loopback, private IPs
        const hostname = parsedUrl.hostname;
        if (hostname === 'localhost' || hostname.startsWith('127.') || hostname.startsWith('10.') ||
            hostname.startsWith('192.168.') || hostname.startsWith('169.254.') ||
            (hostname.startsWith('172.') && parseInt(hostname.split('.')[1]) >= 16 && parseInt(hostname.split('.')[1]) <= 31)) {
            return res.status(403).send('URL points to a restricted address.');
        }

        const response = await axios({
            method: 'get',
            url: urlStr,
            responseType: 'stream'
        });

        let originalName = path.basename(parsedUrl.pathname);
        if (!originalName || !originalName.toLowerCase().endsWith('.mp3')) {
            originalName = 'downloaded.mp3';
        }
        // Decode URL encoding and sanitize safely
        try {
            originalName = decodeURIComponent(originalName);
        } catch (e) {
            console.error('Failed to decode original name', e);
        }
        let sanitizedName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, '_');

        let filename = sanitizedName;
        let counter = 1;
        while (fs.existsSync(path.join(musicDir, filename))) {
            const ext = path.extname(sanitizedName);
            const base = path.basename(sanitizedName, ext);
            filename = `${base}-${counter}${ext}`;
            counter++;
        }

        const dest = path.join(musicDir, filename);
        const writer = fs.createWriteStream(dest);

        response.data.pipe(writer);
        writer.on('finish', () => res.json({ url: '/music/' + filename, filename: filename }));
        writer.on('error', () => res.status(500).send('Error saving file.'));
    } catch (err) {
        console.error('Error downloading music:', err.message);
        res.status(500).send('Failed to download from URL.');
    }
});


let apiKeys = {};
let server; // To be defined after config is loaded

// --- Main Application Start ---
async function startServer() {
    // --- Dynamic Configuration Loading ---
    apiKeys = await loadApiKeys();
    chatbotConfig = await loadChatbotConfig(chatbotConfig);

    // --- Server Initialization ---
    const useSSL = !process.argv.includes('--nossl');

    if (useSSL) {
        console.log('[SERVER] Starting in HTTPS mode.');
        try {
            const options = {
                key: fs.readFileSync(path.join(__dirname, 'certs/key.pem')),
                cert: fs.readFileSync(path.join(__dirname, 'certs/cert.pem'))
            };
            server = https.createServer(options, app);
        } catch (e) {
            console.error('[SERVER] SSL certificate error. Please ensure `certs/key.pem` and `certs/cert.pem` exist.');
            console.error('[SERVER] To run without SSL, use the --nossl flag.');
            process.exit(1);
        }
    } else {
        console.log('[SERVER] Starting in HTTP mode (SSL disabled).');
        server = http.createServer(app);
    }

    const wss = new WebSocket.Server({
        server,
        maxPayload: 5 * 1024 * 1024 // 5MB limit
    });

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
const CHARACTERS_DIR = path.join(__dirname, 'data/characters');
let charactersList = []; // Will store just metadata (name, portrait)

// Ensure character directory exists
if (!fs.existsSync(CHARACTERS_DIR)) {
    fs.mkdirSync(CHARACTERS_DIR, { recursive: true });
}

function loadCharactersList() {
    charactersList = [];
    if (fs.existsSync(CHARACTERS_DIR)) {
        const files = fs.readdirSync(CHARACTERS_DIR);
        files.forEach(file => {
            if (file.endsWith('.json')) {
                try {
                    const filePath = path.join(CHARACTERS_DIR, file);
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const charData = JSON.parse(content);
                    charactersList.push({
                        id: file.replace('.json', ''),
                        name: charData.identity?.name || 'Inconnu',
                        portraitUrl: charData.identity?.portraitUrl || ''
                    });
                } catch (error) {
                    console.error(`[CHARACTERS] Failed to load ${file}:`, error);
                }
            }
        });
    }
}

function broadcastCharactersList() {
    broadcast({ type: 'characters-list-update', list: charactersList });
}

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

    // --- AI Response Validation ---
    let validatedResponse = responseMessage || 'Désolé, l\'IA n\'a pas pu répondre.';
    if (typeof validatedResponse === 'string') {
        // Enforce 900 character limit
        if (validatedResponse.length > 900) {
            validatedResponse = validatedResponse.substring(0, 900) + '... [TRONQUÉ]';
        }
        // Basic server-side XSS strip (remove any HTML tags)
        validatedResponse = validatedResponse.replace(/<[^>]*>?/gm, '');
    }

    const formattedMessage = `Re: ${prompt}\n\n${validatedResponse}`;

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
            // Create a copy to avoid mutating the original message
            const messageToLog = { ...message };
            if (typeof messageToLog.message === 'string' && messageToLog.message.length > 1000) {
                messageToLog.message = messageToLog.message.substring(0, 1000) + '... [TRUNCATED]';
            }

            const serialized = JSON.stringify(messageToLog);
            rotateLogIfNeeded(CHAT_LOG_FILE, 5, originalConsoleLog);
            fs.appendFileSync(CHAT_LOG_FILE, serialized + '\n');
        }
    } catch (error) {
        if (typeof originalConsoleError !== 'undefined') {
            originalConsoleError('[HISTORY] FAILED to append message:', error);
        } else {
            console.error('[HISTORY] FAILED to append message:', error);
        }
    }
}

function rotateLogIfNeeded(filePath, maxSizeMB = 5, originalLogger = null) {
    try {
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            const fileSizeMB = stats.size / (1024 * 1024);
            if (fileSizeMB > maxSizeMB) {
                if (originalLogger) {
                    originalLogger(`[SERVER] Rotating log file: ${filePath}`);
                }
                fs.renameSync(filePath, `${filePath}.old`);
            }
        }
    } catch (error) {
        // Fallback to avoid potential issues if something fails during rotation
    }
}

// --- Validation Helpers ---
function isValidFileName(name) {
    // Allow slashes for folder structure in wiki, and spaces/accented characters/apostrophes for character names
    return /^[\w\s\-\/À-ÿ']+$/.test(name);
}

function getSafeWikiPath(dir, pageName) {
    if (!isValidFileName(pageName) || pageName.includes('..')) {
        throw new Error('Invalid file name or potential path traversal.');
    }
    const resolvedPath = path.resolve(dir, `${pageName}.md`);
    if (!resolvedPath.startsWith(dir)) {
        throw new Error('Access denied: path outside of directory.');
    }

    // Ensure parent directory exists for nested pages
    const parentDir = path.dirname(resolvedPath);
    if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
    }

    return resolvedPath;
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
      clients.delete(ws);
      return ws.terminate();
    }

    // Mark as potentially unresponsive and send a new ping.
    // The 'pong' handler will mark it as 'alive' again.
    if (client) {
        client.isAlive = false;
        ws.ping(() => {}); // The callback is optional but good practice
    }
  });
}, 15000); // Run every 15 seconds to detect drops faster

// Clean up the interval when the server is shut down
wss.on('close', function close() {
  clearInterval(heartbeatInterval);
});


wss.on('connection', (ws) => {
    let messageCount = 0;
    const rateLimitInterval = setInterval(() => {
        messageCount = 0;
    }, 1000);

    // When a pong is received, mark the client as alive. This is part of the heartbeat mechanism.
    ws.on('pong', () => {
        const client = clients.get(ws);
        if (client) client.isAlive = true;
    });

    ws.on('message', async (message) => {
        messageCount++;
        if (messageCount > 5) {
            console.warn(`[WS] Rate limit exceeded for a client.`);
            return;
        }

        const client = clients.get(ws);

        // Any message from the client is a sign of life.
        if (client) {
            client.isAlive = true;
        }

        let data;
        try {
            data = JSON.parse(message);
        } catch (e) {
            console.error('[WS] Failed to parse message:', e);
            return;
        }


        if (data.type === 'client-error') {
            const CLIENT_ERRORS_FILE = path.join(__dirname, 'client-errors.log');
            const timestamp = new Date().toISOString();
            const logEntry = `[${timestamp}] User: ${client ? client.username : 'Unknown'} | Context: ${data.errorContext} | Error: ${data.errorName} - ${data.errorMessage} | Agent: ${data.userAgent}\n`;

            try {
                rotateLogIfNeeded(CLIENT_ERRORS_FILE, 5, originalConsoleLog);
                fs.appendFileSync(CLIENT_ERRORS_FILE, logEntry);
                console.log(`[CLIENT ERROR] Logged error for ${client ? client.username : 'Unknown'}: ${data.errorName}`);
            } catch (err) {
                console.error('[SERVER] Failed to write to client-errors.log', err);
            }
            return;
        }

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
            case 'ping':
                // Client-side heartbeat check
                ws.send(JSON.stringify({ type: 'pong' }));
                return; // Prevent further processing
            case 'get-characters':
                ws.send(JSON.stringify({ type: 'characters-list-update', list: charactersList }));
                break;
            case 'load-character':
                try {
                    const charId = data.id;
                    if (!isValidFileName(charId)) {
                        throw new Error('Invalid character ID');
                    }
                    const filePath = path.join(CHARACTERS_DIR, `${charId}.json`);
                    if (fs.existsSync(filePath)) {
                        const content = fs.readFileSync(filePath, 'utf-8');
                        ws.send(JSON.stringify({ type: 'character-loaded', id: charId, data: JSON.parse(content) }));
                    } else {
                        ws.send(JSON.stringify({ type: 'character-error', message: 'Personnage introuvable.' }));
                    }
                } catch (error) {
                    console.error('[CHARACTERS] Error loading character:', error);
                    ws.send(JSON.stringify({ type: 'character-error', message: 'Erreur lors du chargement.' }));
                }
                break;
            case 'delete-character':
                if (client && client.isMJ) {
                    try {
                        const charId = data.id;
                        if (!isValidFileName(charId)) {
                            throw new Error('Invalid character ID');
                        }
                        const filePath = path.join(CHARACTERS_DIR, `${charId}.json`);
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                            console.log(`[CHARACTERS] Deleted character: ${charId}`);
                        } else {
                            console.log(`[CHARACTERS] Character file not found for deletion, but acknowledging: ${charId}`);
                        }
                        loadCharactersList();
                        broadcastCharactersList();
                        broadcast({ type: 'character-deleted', id: charId });
                    } catch (error) {
                        console.error('[CHARACTERS] Error deleting character:', error);
                        ws.send(JSON.stringify({ type: 'character-error', message: 'Erreur lors de la suppression.' }));
                    }
                }
                break;

            case 'update-character':
                try {
                    const charData = data.data;
                    const charId = data.id || (charData.identity && charData.identity.name ? charData.identity.name.trim() : 'unknown');

                    if (!charId || charId === 'unknown') {
                        throw new Error('Invalid character data for saving.');
                    }

                    const filePath = path.join(CHARACTERS_DIR, `${charId}.json`);
                    fs.writeFileSync(filePath, JSON.stringify(charData, null, 2));

                    // Broadcast the update to all clients
                    broadcast({ type: 'character-updated', id: charId, data: charData });

                    // Reload metadata and broadcast update if new or changed
                    loadCharactersList();
                    broadcastCharactersList();

                    // Acknowledge save to sender
                    ws.send(JSON.stringify({ type: 'character-saved', id: charId }));

                } catch (error) {
                    console.error('[CHARACTERS] Error saving character:', error);
                    ws.send(JSON.stringify({ type: 'character-error', message: 'Erreur lors de la sauvegarde.' }));
                }
                break;
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
                        if (musicState.isPlaying) {
                            musicState.isPlaying = false;
                            musicState.pauseTime = Date.now();
                            updatePayload.action = 'pause';
                            broadcast(updatePayload);
                        }
                        break;

                    case 'resume':
                        if (!musicState.isPlaying && musicState.currentIndex !== -1) {
                            musicState.isPlaying = true;
                            if (musicState.pauseTime && musicState.startTime) {
                                // Shift startTime forward by the amount of time we were paused
                                musicState.startTime += (Date.now() - musicState.pauseTime);
                            } else if (!musicState.startTime) {
                                musicState.startTime = Date.now();
                            }
                            musicState.pauseTime = null;
                            updatePayload.action = 'resume';
                            broadcast(updatePayload);
                        }
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
                            musicState.playlist.push({
                                videoId: value.videoId,
                                title: value.title,
                                type: value.type || 'youtube',
                                url: value.url
                            });
                            // If nothing was playing, set the new song as current, but don't auto-play
                            if (musicState.currentIndex === -1) {
                                musicState.currentIndex = musicState.playlist.length - 1;
                            }
                        }
                        break;

                    case 'playlist-remove':
                        musicState.playlist = musicState.playlist.filter(song => song.videoId !== value.videoId && song.url !== value.url);
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
                    if (isValidFileName(data.name)) {
                        imageList.push({ name: data.name, url: data.url });
                        saveImageList();
                        broadcastImageList();
                    } else {
                        console.warn(`[IMAGES] Invalid image name: ${data.name}`);
                    }
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

            case 'clear-chat':
                if (client && client.isMJ) {
                    chatHistory = [];
                    // Clear the content of the chat log file if it exists
                    if (fs.existsSync(CHAT_LOG_FILE)) {
                        try {
                            fs.writeFileSync(CHAT_LOG_FILE, '');
                            console.log(`[CHAT] Chat history cleared by MJ (${client.username}).`);
                        } catch (err) {
                            console.error('[CHAT] Error clearing chat log file:', err);
                        }
                    }
                    broadcast({ type: 'chat-cleared' });
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
                if (data.payload && data.payload.length < 5 * 1024 * 1024) {
                    whiteboardState = data.payload;
                    saveWhiteboardState(whiteboardState);
                } else {
                    console.warn('[WHITEBOARD] Payload too large, ignoring update.');
                }
                break;

            case 'pointer-move':
                if (client) {
                    data.sender = client.username;
                    broadcastToOthers(ws, data);
                }
                break;

            case 'wiki-get-list':
                ws.send(JSON.stringify({ type: 'wiki-page-list', publicPages: publicWikiPages, mjPages: mjWikiPages }));
                break;

            case 'wiki-get-page':
                try {
                    const { pageName, isMJPage } = data;
                    const dir = isMJPage ? MJ_WIKI_DIR : WIKI_DIR;
                    const filePath = getSafeWikiPath(dir, pageName);

                    if (fs.existsSync(filePath)) {
                        const content = fs.readFileSync(filePath, 'utf-8');
                        ws.send(JSON.stringify({ type: 'wiki-page-content', pageName: pageName, content, isMJPage }));
                    } else {
                        ws.send(JSON.stringify({ type: 'wiki-page-content', pageName: pageName, content: `# Page Not Found: ${pageName}`, isMJPage }));
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

                        const dir = isMJPage ? MJ_WIKI_DIR : WIKI_DIR;
                        const filePath = getSafeWikiPath(dir, pageName);

                        fs.writeFileSync(filePath, content, 'utf-8');
                        console.log(`[WIKI] Saved page: ${filePath}`);

                        loadWikiPages();
                        broadcastWikiPageList();

                        // Confirm save by sending content back to the saver
                        ws.send(JSON.stringify({ type: 'wiki-page-content', pageName: pageName, content, isMJPage }));
                    } catch (error) {
                        console.error('[WIKI] Error saving page:', error);
                    }
                }
                break;
        }
    });

    ws.on('close', () => {
        clearInterval(rateLimitInterval);
        const clientInfo = clients.get(ws);
        if (clientInfo) {
            clients.delete(ws);
            broadcastUserList();
        }
    });
});

// --- HTTP Server ---
app.use(express.static(path.join(__dirname, 'public')));

const MJ_WIKI_DIR = path.join(WIKI_DIR, 'mj');

let publicWikiPages = [];
let mjWikiPages = [];

function loadWikiPages() {
    try {
        function getWikiFiles(dir, baseDir = dir) {
            let results = [];
            if (!fs.existsSync(dir)) return results;
            const list = fs.readdirSync(dir);
            list.forEach(file => {
                const fullPath = path.join(dir, file);
                const stat = fs.statSync(fullPath);
                if (stat && stat.isDirectory()) {
                    // Skip the mj directory when scanning the root public wiki dir
                    if (fullPath !== MJ_WIKI_DIR) {
                        results = results.concat(getWikiFiles(fullPath, baseDir));
                    }
                } else if (file.endsWith('.md')) {
                    // Store the relative path from baseDir, removing .md
                    const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/').slice(0, -3);
                    results.push(relativePath);
                }
            });
            return results;
        }

        publicWikiPages = getWikiFiles(WIKI_DIR).sort();
        mjWikiPages = getWikiFiles(MJ_WIKI_DIR).sort();

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
    loadCharactersList();
    const SERVER_LOG_FILE = path.join(__dirname, 'server.log');

    const logToFile = (message, ...args) => {
        const timestamp = new Date().toISOString();
        let formattedMessage = `[${timestamp}] ${util.format(message, ...args)}\n`;
        if (formattedMessage.length > 1000) {
            formattedMessage = formattedMessage.substring(0, 1000) + '... [TRUNCATED]\n';
        }
        try {
            rotateLogIfNeeded(SERVER_LOG_FILE, 5, originalConsoleLog);
            fs.appendFileSync(SERVER_LOG_FILE, formattedMessage);
        } catch (e) {
            originalConsoleError('Failed to write to server.log', e);
        }
    };

    console.log = (message, ...args) => {
        originalConsoleLog(message, ...args);
        logToFile(message, ...args);
    };

    console.error = (message, ...args) => {
        originalConsoleError(message, ...args);
        logToFile(`ERROR: ${message}`, ...args);
    };

    server.listen(PORT, () => {
        console.log(`Server is listening on port ${PORT}`);
    });
}

// --- Start the application ---
startServer().catch(error => {
    console.error('[FATAL] Failed to start server:', error);
    process.exit(1);
});
