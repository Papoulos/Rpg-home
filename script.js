// IIFE to avoid polluting the global scope
(() => {
    let username = '';
    let localStream;
    const peerConnections = {};
    const iceServers = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            {
                urls: 'turn:openrelay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:443',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            }
        ],
    };

    const socket = new WebSocket(`wss://${window.location.host}`);

    // --- User and Chat Management ---
    function askForUsername() {
        while (!username || username.trim() === '') {
            username = prompt("Veuillez entrer votre nom pour le chat :");
        }
    }

    function getUsername() {
        return username;
    }

    // --- DOM Manipulation ---
    function addMessage({ sender, message, prepend = false }) {
        // Defensive check for malformed messages from history
        if (!sender || !message) {
            console.warn('[UI] Ignoring malformed message object:', { sender, message });
            return;
        }
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message');
        const userColor = stringToHslColor(sender, 70, 75);
        const richMessage = parseForRichContent(message);
        const coloredSender = sender === 'System' ? `<strong style="color: #aaa;">${sender}:</strong>` : `<strong style="color: ${userColor};">${sender}:</strong>`;
        messageElement.innerHTML = `${coloredSender} ${richMessage}`;
        if (prepend) {
            chatMessages.prepend(messageElement);
        } else {
            chatMessages.appendChild(messageElement);
        }
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

        const nameTag = document.createElement('div');
        nameTag.classList.add('name-tag');
        nameTag.textContent = name;

        videoContainer.appendChild(video);
        videoContainer.appendChild(nameTag);

        if (name === getUsername()) {
            video.muted = true;
            video.style.transform = 'scaleX(-1)';

            const controlsContainer = document.createElement('div');
            controlsContainer.classList.add('video-controls');

            const toggleVideoButton = document.createElement('button');
            toggleVideoButton.innerHTML = '&#128249;'; // Camera emoji
            toggleVideoButton.title = "Désactiver la caméra";
            toggleVideoButton.onclick = () => {
                const videoTrack = localStream.getVideoTracks()[0];
                videoTrack.enabled = !videoTrack.enabled;
                toggleVideoButton.innerHTML = videoTrack.enabled ? '&#128249;' : '&#128249;&#xFE0E;&#x20E0;'; // Camera with slash
                toggleVideoButton.title = videoTrack.enabled ? "Désactiver la caméra" : "Activer la caméra";
            };
            controlsContainer.appendChild(toggleVideoButton);
            videoContainer.appendChild(controlsContainer);

        } else {
            video.muted = true; // Remote videos start muted
            const unmuteOverlay = document.createElement('div');
            unmuteOverlay.classList.add('unmute-overlay');
            unmuteOverlay.innerHTML = '&#128264; Cliquez pour activer le son'; // Speaker emoji
            unmuteOverlay.onclick = () => {
                video.muted = false;
                unmuteOverlay.style.display = 'none';
            };
            videoContainer.appendChild(unmuteOverlay);
        }

        videoGrid.appendChild(videoContainer);
    }

    function removeVideoStream(name) {
        const videoContainer = document.getElementById(`video-${name}`);
        if (videoContainer) videoContainer.remove();
    }

    function parseForRichContent(message) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return message.replace(urlRegex, (url) => /\.(jpeg|jpg|gif|png)$/i.test(url) ? `<a href="${url}" target="_blank"><img src="${url}" alt="Image" style="max-width: 100%; max-height: 150px;" /></a>` : `<a href="${url}" target="_blank">${url}</a>`);
    }

    // --- Messaging ---
    function sendMessage(payload) {
        socket.send(JSON.stringify({ sender: getUsername(), ...payload }));
    }

    function rollDice(dieType) {
        const roll = Math.floor(Math.random() * dieType) + 1;
        let resultDisplay = `<strong>${roll}</strong>`;
        if (roll === 1) resultDisplay = `<span class="crit-success">${roll}</span>`;
        if (roll === dieType) resultDisplay = `<span class="crit-fail">${roll}</span>`;
        sendMessage({ type: 'dice', message: `lance un dé ${dieType} : ${resultDisplay}` });
    }

    function handleSendMessage() {
        const message = chatInput.value.trim();
        if (message) {
            sendMessage({ type: 'chat', message });
            chatInput.value = '';
        }
    }

    // --- WebRTC Logic ---
    async function createPeerConnection(peerUsername) {
        if (peerConnections[peerUsername] || peerUsername === getUsername()) return;

        console.log(`[DEBUG] Creating peer connection for: ${peerUsername}`);
        const pc = new RTCPeerConnection(iceServers);
        peerConnections[peerUsername] = pc;

        if (localStream) {
            localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        }

        pc.onicecandidate = event => {
            if (event.candidate) {
                sendMessage({ type: 'ice-candidate', target: peerUsername, message: event.candidate });
            }
        };

        pc.ontrack = event => {
            console.log(`[DEBUG] Received remote track from ${peerUsername}`);
            addVideoStream(event.streams[0], peerUsername);
        };

        pc.onconnectionstatechange = () => {
            console.log(`[DEBUG] Connection state change for ${peerUsername}: ${pc.connectionState}`);
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
                removeVideoStream(peerUsername);
                delete peerConnections[peerUsername];
            }
        };
    }

    async function handleUserList(users) {
        console.log('[DEBUG] Received user list:', users);
        const myUsername = getUsername();

        // Create connections for new users and send offers
        for (const user of users) {
            if (user !== myUsername && !peerConnections[user]) {
                await createPeerConnection(user);
                const pc = peerConnections[user];
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                sendMessage({ type: 'offer', target: user, message: pc.localDescription });
                console.log(`[DEBUG] Sent offer to new user: ${user}`);
            }
        }

        // Remove disconnected users
        Object.keys(peerConnections).forEach(peerName => {
            if (!users.includes(peerName)) {
                peerConnections[peerName].close();
                delete peerConnections[peerName];
                removeVideoStream(peerName);
            }
        });
    }

    // --- WebSocket Event Listeners ---
    socket.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log('[DEBUG] Received message from server:', data.type);

        switch (data.type) {
            case 'history':
                // Iterate and prepend each message to maintain order but show newest first
                data.messages.forEach(msg => {
                    if (msg.type === 'chat' || msg.type === 'dice') {
                        addMessage({ ...msg, prepend: true });
                    }
                });
                break;
            case 'user-list':
                await handleUserList(data.users);
                break;
            case 'chat':
            case 'dice':
                addMessage({ ...data, prepend: true });
                break;
            case 'offer':
                await createPeerConnection(data.sender);
                const pc = peerConnections[data.sender];
                if (pc) {
                    await pc.setRemoteDescription(new RTCSessionDescription(data.message));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    sendMessage({ type: 'answer', target: data.sender, message: pc.localDescription });
                    console.log(`[DEBUG] Sent answer to ${data.sender}`);
                }
                break;
            case 'answer':
                await peerConnections[data.sender]?.setRemoteDescription(new RTCSessionDescription(data.message));
                console.log(`[DEBUG] Processed answer from ${data.sender}`);
                break;
            case 'ice-candidate':
                await peerConnections[data.sender]?.addIceCandidate(new RTCIceCandidate(data.message));
                break;
        }
    };

    socket.onclose = () => addMessage({ sender: 'System', message: 'Connection lost. Please refresh.', prepend: true });
    socket.onerror = (error) => console.error('WebSocket error:', error);

    // --- Initial Setup ---
    async function setupLocalMedia() {
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            addVideoStream(localStream, getUsername());
        } catch (error) {
            console.error('Error accessing media devices.', error);
            alert('Could not access your camera or microphone. Please check permissions and try again.');
        }
    }

    function setupToggle() {
        toggleChatBtn.addEventListener('click', () => {
            leftPanel.classList.toggle('chat-hidden');
            toggleChatBtn.textContent = leftPanel.classList.contains('chat-hidden') ? '»' : '«';
            toggleChatBtn.title = leftPanel.classList.contains('chat-hidden') ? "Afficher le panneau de chat" : "Cacher le panneau de chat";
        });
    }

    function setupEventListeners() {
        sendButton.addEventListener('click', handleSendMessage);
        chatInput.addEventListener('keydown', e => e.key === 'Enter' && handleSendMessage());
        diceButtons.forEach(button => button.addEventListener('click', () => rollDice(parseInt(button.dataset.die, 10))));
    }

    function stringToHslColor(str, s, l) {
        if (!str) return '#ffffff';
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const h = hash % 360;
        return `hsl(${h}, ${s}%, ${l}%)`;
    }

    // --- DOM Elements ---
    let chatMessages, chatInput, sendButton, diceButtons, leftPanel, toggleChatBtn, videoGrid;

    // Execute when the DOM is fully loaded
    document.addEventListener('DOMContentLoaded', async () => {
        chatMessages = document.getElementById('chat-messages');
        chatInput = document.getElementById('chat-input');
        sendButton = document.getElementById('send-button');
        diceButtons = document.querySelectorAll('.dice-button');
        leftPanel = document.querySelector('.left-panel');
        toggleChatBtn = document.getElementById('toggle-chat-btn');
        videoGrid = document.getElementById('video-grid');

        askForUsername();
        await setupLocalMedia();

        const registerUser = () => sendMessage({ type: 'register', username: getUsername() });
        if (socket.readyState === WebSocket.OPEN) {
            registerUser();
        } else {
            socket.addEventListener('open', registerUser);
        }

        setupEventListeners();
        setupToggle();
    });
})();
