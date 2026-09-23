// IIFE to avoid polluting the global scope
(() => {
    window.isMJ = false; // Global flag for MJ status
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

    let reconnectAttempts = 0;
    let reconnectTimeoutId = null;
    let heartbeatInterval = null;
    let socket = null;

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
    function addMessage({ sender, message, type, system, prepend = false }) {
        if (!sender || !message) {
            console.warn('[UI] Ignoring malformed message object:', { sender, message, type, system });
            return;
        }
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message');

        const userColor = stringToHslColor(sender, 70, 75);

        const senderContainer = document.createElement('strong');
        senderContainer.style.color = sender === 'System' ? '#aaa' : userColor;

        if (type === 'game-roll') {
            messageElement.classList.add('game-roll-message');
            senderContainer.textContent = `${sender}: `;
            messageElement.appendChild(senderContainer);
        } else {
            senderContainer.textContent = `${sender}: `;
            messageElement.appendChild(senderContainer);
        }

        const bodyElement = document.createElement('span');
        bodyElement.classList.add('message-body');

        if (sender === 'System' || type === 'game-roll' || type === 'dice') {
            // System and game messages are safe and may contain HTML (like <strong> for dice)
            bodyElement.innerHTML = message;
        } else {
            // Simple markdown-like handling for images and links without innerHTML for user messages
            const parts = message.split(/(https?:\/\/[^\s]+)/g);
            parts.forEach(part => {
                if (part.match(/^https?:\/\/[^\s]+$/)) {
                    // Check if it's an image URL
                    if (part.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
                        const img = document.createElement('img');
                        img.src = part;
                        img.style.maxWidth = '100%';
                        img.style.maxHeight = '150px';
                        img.style.display = 'block';
                        const link = document.createElement('a');
                        link.href = part;
                        link.target = '_blank';
                        link.appendChild(img);
                        bodyElement.appendChild(link);
                    } else {
                        const link = document.createElement('a');
                        link.href = part;
                        link.target = '_blank';
                        link.textContent = part;
                        bodyElement.appendChild(link);
                    }
                } else {
                    // Text with newlines
                    const textParts = part.split('\n');
                    textParts.forEach((textPart, index) => {
                        if (index > 0) {
                            bodyElement.appendChild(document.createElement('br'));
                        }
                        bodyElement.appendChild(document.createTextNode(textPart));
                    });
                }
            });
        }

        messageElement.appendChild(bodyElement);

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
        // Remote streams are NOT muted by default, relying on browser autoplay policy

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

    // --- Messaging ---
    function sendMessage(payload) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ sender: getUsername(), ...payload }));
        } else {
            console.error("WebSocket is not connected. Message not sent:", payload);
        }
    }

    function rollDice(dieType) {
        const roll = Math.floor(Math.random() * dieType) + 1;
        let resultDisplay = `<strong>${roll}</strong>`;
        if (roll === 1) resultDisplay = `<span class="crit-success">${roll}</span>`;
        if (roll === dieType) resultDisplay = `<span class="crit-fail">${roll}</span>`;
        sendMessage({ type: 'dice', message: `lance un dé ${dieType} : ${resultDisplay}` });
    }

    function handleCommand(command, args) {
        if (command === 'help') {
            let helpMessage = '<strong>Commandes disponibles :</strong><br>';
            helpMessage += '/help - Affiche ce message d\'aide.<br>';
            Object.keys(window.gameSystems).forEach(key => {
                helpMessage += `${window.gameSystems[key].help}<br>`;
            });
            addMessage({ sender: 'System', message: helpMessage, prepend: true });
        } else if (window.gameSystems[command]) {
            const result = window.gameSystems[command].roll(args);
            sendMessage({ type: 'game-roll', message: result, system: window.gameSystems[command].name });
        } else {
            addMessage({ sender: 'System', message: `Commande inconnue : /${command}`, prepend: true });
        }
    }

    function handleSendMessage() {
        const message = chatInput.value.trim();
        if (!message) return;

        if (message.startsWith('/')) {
            const [command, ...args] = message.substring(1).split(' ');
            handleCommand(command.toLowerCase(), args);
        } else {
            sendMessage({ type: 'chat', message });
        }
        chatInput.value = '';
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

        pc.ontrack = event => {
            addVideoStream(event.streams[0], peerUsername);
        };

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

        // Create connections for new users and send offers
        for (const user of users) {
            if (user !== myUsername && !peerConnections[user]) {
                // The user with the alphabetically lower name initiates the call
                const isInitiator = myUsername < user;
                await createPeerConnection(user, isInitiator);
            }
        }

        // Remove disconnected users
        Object.keys(peerConnections).forEach(peerName => {
            if (!users.includes(peerName)) {
                peerConnections[peerName].close();
                delete peerConnections[peerName];
                removeVideoStream(peerName);
                window.dispatchEvent(new CustomEvent('pointer-disconnect', { detail: { sender: peerName } }));
            }
        });
    }

    // --- WebSocket Connection Management ---
    function connect() {
        if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
            console.log("WebSocket is already open or connecting.");
            return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        socket = new WebSocket(`${protocol}://${window.location.host}`);
        window.socket = socket;

        socket.onopen = () => {
            console.log("✅ WebSocket connection established.");
            if (reconnectAttempts > 0) {
                addMessage({ sender: 'System', message: 'Reconnected successfully.', prepend: false });
            }

            reconnectAttempts = 0;
            if (reconnectTimeoutId) {
                clearTimeout(reconnectTimeoutId);
                reconnectTimeoutId = null;
            }

            // Enregistre l'utilisateur
            sendMessage({ type: 'register', username: getUsername() });

            if (window._pendingMediaError) {
                sendMessage(window._pendingMediaError);
                window._pendingMediaError = null;
            }

            // Démarre le heartbeat (ping)
            if (heartbeatInterval) {
                clearInterval(heartbeatInterval);
            }

            // Ping every 10 seconds to ensure the server keeps connection alive
            heartbeatInterval = setInterval(() => {
                if (socket.readyState === WebSocket.OPEN) {
                    sendMessage({ type: 'ping' });
                }
            }, 10000);
        };

        socket.onclose = () => {
            console.warn('⚠️ WebSocket closed. Attempting to reconnect...');
            addMessage({ sender: 'System', message: 'Connection lost. Trying to reconnect...', prepend: false });

            if (heartbeatInterval) {
                clearInterval(heartbeatInterval);
                heartbeatInterval = null;
            }

            if (reconnectTimeoutId) {
                clearTimeout(reconnectTimeoutId);
            }

            // Tentative de reconnexion exponentielle (max 15s)
            reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 15000);

            reconnectTimeoutId = setTimeout(connect, delay);
        };

        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                socket.close(); // forcera le onclose et la reconnexion
            }
        };

        socket.onmessage = async (event) => {
            const data = JSON.parse(event.data);

            switch (data.type) {
                case 'pong':
                    // Heartbeat response from server. We can ignore this,
                    // the main thing is that traffic is flowing.
                    break;
                case 'history':
                    data.messages.forEach(msg => {
                        if (msg.type === 'chat' || msg.type === 'dice' || msg.type === 'game-roll') {
                            addMessage({ ...msg, prepend: true });
                        }
                    });
                    break;
                case 'mj-status': { // Use block scope
                    window.isMJ = data.isMJ; // Set the global flag
                    window.dispatchEvent(new CustomEvent('mj-status', { detail: { isMJ: data.isMJ } }));

                    // Directly control image controls visibility and attach listeners
                    const imageControls = document.querySelector('.image-controls');
                    if (imageControls) {
                        const isHidden = imageControls.classList.contains('hidden');
                        if (data.isMJ && isHidden) {
                            // First time showing, attach listeners
                            document.getElementById('add-image-btn')?.addEventListener('click', window.imageHandlers.handleAddImage);
                            document.getElementById('delete-image-btn')?.addEventListener('click', window.imageHandlers.handleDeleteImage);
                            document.getElementById('image-select')?.addEventListener('change', window.imageHandlers.handleShowImage);
                        }
                        imageControls.classList.toggle('hidden', !data.isMJ);
                    }
                    break;
                }
                case 'image-list-update':
                    window.dispatchEvent(new CustomEvent('image-list-update', { detail: { list: data.list } }));
                    break;
                case 'sheets-update':
                    window.dispatchEvent(new CustomEvent('sheets-update', { detail: { list: data.list } }));
                    break;
                case 'show-image':
                    displayImage(data.url);
                    break;
                case 'user-list':
                    await handleUserList(data.users);
                    break;
                case 'chat':
                case 'dice':
                case 'game-roll':
                    addMessage({ ...data, prepend: true });
                    break;
                case 'offer':
                    if (!peerConnections[data.sender]) {
                        await createPeerConnection(data.sender, false);
                    }
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

                case 'fabric-path-created':
                    window.dispatchEvent(new CustomEvent('fabric-remote-path-created', { detail: data }));
                    break;
                case 'fabric-set-background':
                    window.dispatchEvent(new CustomEvent('fabric-remote-set-background', { detail: data }));
                    break;
                case 'fabric-add-object':
                    window.dispatchEvent(new CustomEvent('fabric-remote-add-object', { detail: data }));
                    break;
                case 'fabric-update-object':
                    window.dispatchEvent(new CustomEvent('fabric-remote-update-object', { detail: data }));
                    break;
                case 'fabric-remove-object':
                    window.dispatchEvent(new CustomEvent('fabric-remote-remove-object', { detail: data }));
                    break;
                case 'fabric-fog-toggle':
                    window.dispatchEvent(new CustomEvent('fabric-remote-fog-toggle', { detail: data }));
                    break;
                case 'fabric-fog-erase-raw':
                    window.dispatchEvent(new CustomEvent('fabric-remote-fog-erase-raw', { detail: data }));
                    break;
                case 'fabric-load':
                    window.dispatchEvent(new CustomEvent('fabric-load', { detail: data }));
                    break;
                case 'pointer-move':
                    window.dispatchEvent(new CustomEvent('pointer-move', { detail: data }));
                    break;
                case 'music-control':
                case 'music-sync':
                    window.dispatchEvent(new CustomEvent('music-control', { detail: data }));
                    break;
                case 'wiki-page-list':
                    window.dispatchEvent(new CustomEvent('wiki-update-list', { detail: data }));
                    break;
                case 'wiki-page-content':
                    window.dispatchEvent(new CustomEvent('wiki-update-page', { detail: data }));
                    break;
            }
        };
    }

    // --- Initial Setup ---
    async function setupLocalMedia() {
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            addVideoStream(localStream, getUsername());
        } catch (error) {
            console.error('Error accessing media devices:', error);

            let userMessage = 'Une erreur inconnue s\'est produite lors de l\'accès à votre caméra ou microphone.';

            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                userMessage = 'Permission refusée. Vous devez autoriser l\'accès à la caméra et au microphone dans votre navigateur.';
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                userMessage = 'Aucune caméra ou microphone trouvé. Veuillez vérifier qu\'ils sont bien branchés et reconnus par votre système.';
            } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                userMessage = 'Votre caméra ou microphone est peut-être déjà utilisé par une autre application (ex: Skype, Zoom) ou est bloqué au niveau matériel.';
            } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
                userMessage = 'La résolution ou la configuration demandée n\'est pas supportée par votre matériel.';
            } else if (error.name === 'NotSupportedError') {
                userMessage = 'Votre navigateur ne supporte pas l\'accès à la caméra via WebRTC (ou vous n\'êtes pas en HTTPS).';
            }

            alert(userMessage);

            const errorPayload = {
                type: 'client-error',
                errorContext: 'getUserMedia',
                errorName: error.name,
                errorMessage: error.message,
                userAgent: navigator.userAgent
            };

            // If socket is already open (e.g. user delayed giving permission), send immediately
            if (socket && socket.readyState === WebSocket.OPEN) {
                sendMessage(errorPayload);
            } else {
                // Otherwise store it to send it when websocket connects
                window._pendingMediaError = errorPayload;
            }
        }
    }

    function setupToggle() {
        const toggleButtons = [
            { btn: document.getElementById('toggle-chat-btn'), panel: document.querySelector('.left-panel'), resizer: document.getElementById('resizer-left'), class: 'chat-hidden', side: 'left' },
            { btn: document.getElementById('toggle-video-panel-btn'), panel: document.querySelector('.right-panel'), resizer: document.getElementById('resizer-right'), class: 'video-hidden', side: 'right' }
        ];

        toggleButtons.forEach(item => {
            if (item.btn && item.panel && item.resizer) {
                item.btn.addEventListener('click', () => {
                    item.panel.classList.toggle(item.class);
                    const isNowHidden = item.panel.classList.contains(item.class);

                    item.resizer.style.display = isNowHidden ? 'none' : 'block';
                    item.btn.classList.toggle('collapsed', isNowHidden);

                    if (isNowHidden) {
                        // Remove inline style so the CSS class can position the button at the edge
                        item.btn.style[item.side] = '';
                    } else {
                        // Re-apply the inline style to position the button next to the restored panel
                        const panelWidthVar = getComputedStyle(item.panel).getPropertyValue(`--${item.side}-panel-width`);
                        item.btn.style[item.side] = `calc(${panelWidthVar} - ${item.btn.offsetWidth}px)`;
                    }
                });

                // Initial state check
                const initiallyHidden = item.panel.classList.contains(item.class);
                if (initiallyHidden) {
                    item.resizer.style.display = 'none';
                    item.btn.classList.add('collapsed');
                }
            }
        });
    }

    function setupEventListeners() {
        sendButton.addEventListener('click', handleSendMessage);
        chatInput.addEventListener('keydown', e => e.key === 'Enter' && handleSendMessage());
        diceButtons.forEach(button => button.addEventListener('click', () => rollDice(parseInt(button.dataset.die, 10))));

        // Global media controls
        const muteMicBtn = document.getElementById('mute-mic-btn');
        const toggleVideoBtn = document.getElementById('toggle-video-btn');

        muteMicBtn.addEventListener('click', () => {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                muteMicBtn.classList.toggle('muted', !audioTrack.enabled);
                muteMicBtn.title = audioTrack.enabled ? "Couper le micro" : "Activer le micro";
                const icon = muteMicBtn.querySelector('.material-symbols-outlined');
                if (icon) icon.textContent = audioTrack.enabled ? 'mic' : 'mic_off';
            }
        });

        toggleVideoBtn.addEventListener('click', () => {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                toggleVideoBtn.classList.toggle('muted', !videoTrack.enabled);
                toggleVideoBtn.title = videoTrack.enabled ? "Désactiver la caméra" : "Activer la caméra";
                const icon = toggleVideoBtn.querySelector('.material-symbols-outlined');
                if (icon) icon.textContent = videoTrack.enabled ? 'videocam' : 'videocam_off';
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

    // --- DOM Elements ---
    let chatMessages, chatInput, sendButton, diceButtons, leftPanel, toggleChatBtn, videoGrid, rightPanel, toggleVideoPanelBtn, imageDisplayArea;

    function displayImage(url) {
        if (!imageDisplayArea) return;

        imageDisplayArea.innerHTML = ''; // Clear previous content
        if (url) {
            const img = document.createElement('img');
            img.src = url;
            img.alt = 'Image partagée';
            imageDisplayArea.appendChild(img);
        } else {
            imageDisplayArea.innerHTML = '<p>Aucune image sélectionnée.</p>';
        }
    }

    // Execute when the DOM is fully loaded
    document.addEventListener('DOMContentLoaded', async () => {
        // Define all DOM elements
        chatMessages = document.getElementById('chat-messages');
        chatInput = document.getElementById('chat-input');
        sendButton = document.getElementById('send-button');
        diceButtons = document.querySelectorAll('.dice-button');
        leftPanel = document.querySelector('.left-panel');
        toggleChatBtn = document.getElementById('toggle-chat-btn');
        rightPanel = document.querySelector('.right-panel');
        toggleVideoPanelBtn = document.getElementById('toggle-video-panel-btn');
        videoGrid = document.getElementById('video-grid');
        imageDisplayArea = document.getElementById('image-display-area');


        askForUsername();
        await setupLocalMedia();

        connect(); // Start the WebSocket connection and set up listeners

        setupEventListeners();
        setupToggle();
        setupResizing(); // Add this call
    });

    // --- Panel Resizing Logic ---
    function setupResizing() {
        const resizerLeft = document.getElementById('resizer-left');
        const resizerRight = document.getElementById('resizer-right');
        const leftPanel = document.querySelector('.left-panel');
        const rightPanel = document.querySelector('.right-panel');

        const resize = (resizer, panel, button, panelSide) => {
            let x = 0;
            let panelWidth = 0;

            const mouseDownHandler = (e) => {
                x = e.clientX;
                panelWidth = panel.getBoundingClientRect().width;
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';

                document.addEventListener('mousemove', mouseMoveHandler);
                document.addEventListener('mouseup', mouseUpHandler);
            };

            const mouseMoveHandler = (e) => {
                const dx = e.clientX - x;
                const newPanelWidth = panelSide === 'left' ? panelWidth + dx : panelWidth - dx;

                const minWidthPx = 150;
                const maxWidthPx = window.innerWidth * 0.5;
                const clampedWidthPx = Math.max(minWidthPx, Math.min(newPanelWidth, maxWidthPx));

                const newWidthPercent = (clampedWidthPx / window.innerWidth) * 100;

                panel.style.setProperty(`--${panelSide}-panel-width`, `${newWidthPercent}%`);
                button.style[panelSide] = `calc(${newWidthPercent}% - ${button.offsetWidth}px)`;
            };

            const mouseUpHandler = () => {
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
            };

            resizer.addEventListener('mousedown', mouseDownHandler);
        };

        resize(resizerLeft, leftPanel, document.getElementById('toggle-chat-btn'), 'left');
        resize(resizerRight, rightPanel, document.getElementById('toggle-video-panel-btn'), 'right');
    }
})();
