// IIFE to avoid polluting the global scope
(() => {
    // --- App State & Setup ---
    window.app = {}; // Namespace for sharing functions
    window.app.messageHandlers = {}; // Registry for module-specific message handlers

    let username = '';
    let localStream;
    const peerConnections = {};
    const iceServers = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
        ],
    };
    const socket = new WebSocket(`wss://${window.location.host}`);

    // --- DOM Elements ---
    let chatMessages, chatInput, sendButton, diceButtons, leftPanel, toggleChatBtn, videoGrid, rightPanel, toggleVideoPanelBtn, mainDisplay;

    // --- Core Functions ---
    function askForUsername() {
        while (!username || username.trim() === '') {
            username = prompt("Veuillez entrer votre nom pour le chat :");
        }
    }

    function getUsername() {
        return username;
    }
    window.app.getUsername = getUsername; // Expose for modules

    // --- Messaging ---
    function sendMessage(payload) {
        socket.send(JSON.stringify({ sender: getUsername(), ...payload }));
    }
    window.app.sendMessage = sendMessage; // Expose for modules

    window.app.registerMessageHandler = (type, handler) => {
        window.app.messageHandlers[type] = handler;
    };

    // --- View Loading ---
    async function loadView(viewUrl) {
        try {
            const response = await fetch(viewUrl);
            if (!response.ok) throw new Error(`Failed to load view: ${viewUrl}`);
            mainDisplay.innerHTML = await response.text();

            const scriptElement = mainDisplay.querySelector('script');
            if (scriptElement && scriptElement.src) {
                const scriptSrc = new URL(scriptElement.src, window.location.href).href;
                scriptElement.remove();

                const newScript = document.createElement('script');
                newScript.src = scriptSrc;
                newScript.onload = () => {
                    if (window.initTableau) {
                        window.initTableau();
                    }
                };
                document.body.appendChild(newScript);
            }
        } catch (error) {
            console.error('Error loading view:', error);
            mainDisplay.innerHTML = `<p>Error loading content: ${error.message}</p>`;
        }
    }

    // --- DOM Manipulation ---
    function addMessage({ sender, message, prepend = false }) {
        if (!sender || !message) return;
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message');
        const userColor = stringToHslColor(sender, 70, 75);
        const richMessage = parseForRichContent(message);
        const coloredSender = sender === 'System' ? `<strong style="color: #aaa;">${sender}:</strong>` : `<strong style="color: ${userColor};">${sender}:</strong>`;
        messageElement.innerHTML = `${coloredSender} ${richMessage}`;
        if (prepend) chatMessages.prepend(messageElement);
        else chatMessages.appendChild(messageElement);
    }

    function addVideoStream(stream, name) {
        if (document.getElementById(`video-${name}`)) return;
        const videoContainer = document.createElement('div');
        videoContainer.id = `video-${name}`;
        videoContainer.classList.add('video-container');
        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.playsInline = true;
        if (name === getUsername()) video.muted = true;
        const nameTag = document.createElement('div');
        nameTag.classList.add('name-tag');
        nameTag.textContent = name;
        videoContainer.appendChild(video);
        videoContainer.appendChild(nameTag);
        videoGrid.appendChild(videoContainer);
    }

    function removeVideoStream(name) {
        const videoContainer = document.getElementById(`video-${name}`);
        if (videoContainer) videoContainer.remove();
    }

    function parseForRichContent(message) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return message.replace(urlRegex, (url) => /\.(jpeg|jpg|gif|png)$/i.test(url) ? `<a href="${url}" target="_blank"><img src="${url}" alt="Image" style="max-width: 100%;" /></a>` : `<a href="${url}" target="_blank">${url}</a>`);
    }

    // --- WebSocket & WebRTC ---
    socket.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        if (window.app.messageHandlers[data.type]) {
            window.app.messageHandlers[data.type](data);
            return;
        }
        switch (data.type) {
            case 'history':
                data.messages.forEach(msg => { if (msg.type === 'chat' || msg.type === 'dice') addMessage({ ...msg, prepend: true }); });
                break;
            case 'user-list':
                await handleUserList(data.users);
                break;
            case 'chat':
            case 'dice':
                addMessage({ ...data, prepend: true });
                break;
            case 'offer':
                if (!peerConnections[data.sender]) await createPeerConnection(data.sender, false);
                const pc = peerConnections[data.sender];
                if (pc && pc.signalingState === 'stable') {
                    await pc.setRemoteDescription(new RTCSessionDescription(data.message));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    sendMessage({ type: 'answer', target: data.sender, message: pc.localDescription });
                }
                break;
            case 'answer':
                await peerConnections[data.sender]?.setRemoteDescription(new RTCSessionDescription(data.message));
                break;
            case 'ice-candidate':
                await peerConnections[data.sender]?.addIceCandidate(new RTCIceCandidate(data.message));
                break;
        }
    };

    async function createPeerConnection(peerUsername, isInitiator = false) {
        if (peerConnections[peerUsername] || peerUsername === getUsername()) return;
        const pc = new RTCPeerConnection(iceServers);
        peerConnections[peerUsername] = pc;
        if (localStream) localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        pc.onicecandidate = e => { if (e.candidate) sendMessage({ type: 'ice-candidate', target: peerUsername, message: e.candidate }); };
        pc.ontrack = e => addVideoStream(e.streams[0], peerUsername);
        pc.onconnectionstatechange = () => {
            if (['disconnected', 'closed', 'failed'].includes(pc.connectionState)) {
                removeVideoStream(peerUsername);
                delete peerConnections[peerUsername];
            }
        };
        if (isInitiator) {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendMessage({ type: 'offer', target: peerUsername, message: pc.localDescription });
        }
    }

    async function handleUserList(users) {
        const myUsername = getUsername();
        for (const user of users) {
            if (user !== myUsername && !peerConnections[user]) {
                await createPeerConnection(user, myUsername < user);
            }
        }
        Object.keys(peerConnections).forEach(peerName => {
            if (!users.includes(peerName)) {
                peerConnections[peerName].close();
                delete peerConnections[peerName];
                removeVideoStream(peerName);
            }
        });
    }

    // --- Initial Setup ---
    function setupEventListeners() {
        // Chat
        sendButton.addEventListener('click', () => { const msg = chatInput.value.trim(); if (msg) { sendMessage({ type: 'chat', message: msg }); chatInput.value = ''; } });
        chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') { const msg = chatInput.value.trim(); if (msg) { sendMessage({ type: 'chat', message: msg }); chatInput.value = ''; } } });
        // Dice
        diceButtons.forEach(button => button.addEventListener('click', () => { const roll = Math.floor(Math.random() * parseInt(button.dataset.die)) + 1; sendMessage({ type: 'dice', message: `lance un dé ${button.dataset.die} : <strong>${roll}</strong>` }); }));
        // Media Controls
        document.getElementById('mute-mic-btn').addEventListener('click', () => { if(localStream) localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled; });
        document.getElementById('toggle-video-btn').addEventListener('click', () => { if(localStream) localStream.getVideoTracks()[0].enabled = !localStream.getVideoTracks()[0].enabled; });
        // Navigation
        const nav = document.getElementById('main-nav');
        if (nav) {
            nav.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON' && e.target.dataset.view) {
                    nav.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
                    e.target.classList.add('active');
                    loadView(e.target.dataset.view);
                }
            });
        }
    }

    async function initialize() {
        // Define all DOM elements
        chatMessages = document.getElementById('chat-messages');
        chatInput = document.getElementById('chat-input');
        sendButton = document.getElementById('send-button');
        diceButtons = document.querySelectorAll('.dice-button');
        videoGrid = document.getElementById('video-grid');
        mainDisplay = document.querySelector('.main-display');

        askForUsername();
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            addVideoStream(localStream, getUsername());
        } catch (error) {
            console.error('Error accessing media devices.', error);
            alert('Could not access camera or microphone.');
        }

        const registerUser = () => sendMessage({ type: 'register', username: getUsername() });
        if (socket.readyState === WebSocket.OPEN) registerUser();
        else socket.addEventListener('open', registerUser);

        setupEventListeners();

        const defaultViewButton = document.querySelector('#main-nav button.active');
        if (defaultViewButton) defaultViewButton.click();
    }

    function stringToHslColor(str, s, l) {
        if (!str) return '#ffffff';
        let hash = 0;
        for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
        return `hsl(${hash % 360}, ${s}%, ${l}%)`;
    }

    document.addEventListener('DOMContentLoaded', initialize);
})();
