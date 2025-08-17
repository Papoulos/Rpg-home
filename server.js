const express = require("express");
const http = require("http");
const fs = require("fs");
const axios = require("axios");
const apiConfig = require("./api.config.js");
const path = require("path");

const app = express();
app.use(express.json()); // Middleware to parse JSON bodies

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, 'client/build')));
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

// --- Whiteboard Data Management ---

const whiteboardDataPath = 'whiteboard_data.json';

// Ensure whiteboard data file exists on startup
if (!fs.existsSync(whiteboardDataPath)) {
    fs.writeFileSync(whiteboardDataPath, JSON.stringify({ elements: [] }));
}

const readWhiteboardData = () => {
    try {
        const data = fs.readFileSync(whiteboardDataPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading whiteboard data:", error);
        return { elements: [] };
    }
};

const writeWhiteboardData = (data) => {
    try {
        const jsonData = JSON.stringify(data, null, 2);
        fs.writeFileSync(whiteboardDataPath, jsonData);
    } catch (error) {
        console.error("Error writing whiteboard data:", error);
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

    // --- Whiteboard Logic ---
    // Send the current whiteboard data to the connecting client
    socket.emit('whiteboard data', readWhiteboardData());

    // Listen for changes from a client
    socket.on('whiteboard change', (data) => {
        writeWhiteboardData(data);
        // Broadcast the changes to other clients
        socket.broadcast.emit('whiteboard change', data);
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

// --- New Chatbot Logic ---

// Endpoint to provide the list of keywords to the client
app.get('/api/chatbot-keywords', (req, res) => {
    const keywords = Object.values(apiConfig).flatMap(api => api.keywords);
    res.json(keywords);
});

// Placeholder endpoint for the default chatbot
app.post('/api/chatbot_placeholder', (req, res) => {
    const { question } = req.body;
    const placeholderAnswer = `This is a placeholder response to your question: "${question}". A real AI model will be integrated here in the future.`;
    res.json({ answer: placeholderAnswer });
});

app.post('/api/chatbot', async (req, res) => {
    const { keyword, question } = req.body;
    console.log(`Received question for ${keyword}: ${question}`);

    const api = Object.values(apiConfig).find(api => api.keywords.includes(keyword));

    if (!api) {
        return res.status(400).json({ error: `No API configuration found for keyword: ${keyword}` });
    }

    try {
        if (api.type === 'paid') {
            // For paid services, you would integrate with the respective Node.js library.
            // This is a placeholder response.
            // Example:
            // if (api.serviceName === 'Gemini') {
            //   // Call Gemini API using process.env.GEMINI_API_KEY
            // }
            const answer = `This is a placeholder response from the "${api.serviceName}" API for your question: "${question}".`;
            res.json({ answer });
        } else if (api.type === 'url') {
            const response = await axios.post(api.url, { question });
            res.json(response.data);
        } else {
            res.status(400).json({ error: `Invalid API type: ${api.type}` });
        }
    } catch (error) {
        console.error(`Error with ${keyword} API:`, error.message);
        res.status(500).json({ error: `An error occurred while processing your request.` });
    }
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

server.listen(5000, () => console.log('server is running on port 5000'));
