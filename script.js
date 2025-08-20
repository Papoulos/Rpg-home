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

        if (name === getUsername()) {
            video.muted = true; // Local video is always muted to prevent feedback
            video.style.transform = 'scaleX(-1)';
        }
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
    async function createPeerConnection(peerUsername, isInitiator = false) {
        if (peerConnections[peerUsername] || peerUsername === getUsername()) return;
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
        pc.ontrack = event => addVideoStream(event.streams[0], peerUsername);
        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
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
                const isInitiator = myUsername < user;
                await createPeerConnection(user, isInitiator);
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

    // --- WebSocket Event Listeners ---
    socket.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        switch (data.type) {
            case 'history':
                data.messages.forEach(msg => {
                    if (msg.type === 'chat' || msg.type === 'dice') addMessage({ ...msg, prepend: true });
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
        const toggleButtons = [
            { btn: document.getElementById('toggle-chat-btn'), panel: document.querySelector('.left-panel'), class: 'chat-hidden' },
            { btn: document.getElementById('toggle-video-panel-btn'), panel: document.querySelector('.right-panel'), class: 'video-hidden' }
        ];
        toggleButtons.forEach(item => {
            if (item.btn && item.panel) {
                item.btn.addEventListener('click', () => {
                    item.panel.classList.toggle(item.class);
                    const isHidden = item.panel.classList.contains(item.class);
                    if (item.btn.id === 'toggle-chat-btn') item.btn.textContent = isHidden ? '»' : '«';
                    else item.btn.textContent = isHidden ? '«' : '»';
                });
            }
        });
    }

    function setupEventListeners() {
        sendButton.addEventListener('click', handleSendMessage);
        chatInput.addEventListener('keydown', e => e.key === 'Enter' && handleSendMessage());
        diceButtons.forEach(button => button.addEventListener('click', () => rollDice(parseInt(button.dataset.die, 10))));

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

        const muteMicBtn = document.getElementById('mute-mic-btn');
        const toggleVideoBtn = document.getElementById('toggle-video-btn');
        muteMicBtn.addEventListener('click', () => {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                muteMicBtn.classList.toggle('muted', !audioTrack.enabled);
                muteMicBtn.title = audioTrack.enabled ? "Couper le micro" : "Activer le micro";
            }
        });
        toggleVideoBtn.addEventListener('click', () => {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                toggleVideoBtn.classList.toggle('muted', !videoTrack.enabled);
                toggleVideoBtn.title = videoTrack.enabled ? "Désactiver la caméra" : "Activer la caméra";
            }
        });
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

    // --- DOM Elements ---
    let chatMessages, chatInput, sendButton, diceButtons, leftPanel, toggleChatBtn, videoGrid, rightPanel, toggleVideoPanelBtn, mainDisplay;

    // Execute when the DOM is fully loaded
    document.addEventListener('DOMContentLoaded', async () => {
        mainDisplay = document.querySelector('.main-display');
        chatMessages = document.getElementById('chat-messages');
        chatInput = document.getElementById('chat-input');
        sendButton = document.getElementById('send-button');
        diceButtons = document.querySelectorAll('.dice-button');
        leftPanel = document.querySelector('.left-panel');
        toggleChatBtn = document.getElementById('toggle-chat-btn');
        rightPanel = document.querySelector('.right-panel');
        toggleVideoPanelBtn = document.getElementById('toggle-video-panel-btn');
        videoGrid = document.getElementById('video-grid');
        mainDisplay = document.querySelector('.main-display');

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

        // Load the default view on page load
        const defaultViewButton = document.querySelector('#main-nav button.active');
        if (defaultViewButton) {
            defaultViewButton.click();
        }
    });
})();
