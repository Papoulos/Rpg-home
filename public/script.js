// IIFE to avoid polluting the global scope
(() => {
    window.isMJ = false; // Global flag for MJ status
    let username = '';
    let isLoggedIn = false;
    let pendingUserList = null;
    let localStream;
    const peerConnections = {};
    const iceCandidateQueues = {};
    const remoteStreams = {};
    const peerMediaStates = {};
    const disconnectTimers = {};
    const restartCounts = {};
    const restartTimers = {};
    const activeAudioMonitors = {};
    const pausedAudioMonitors = new Set();
    let signalingChain = Promise.resolve();

    function isAudioMonitoringPaused() {
        const rp = document.querySelector('.right-panel');
        return document.hidden || Boolean(rp && rp.classList.contains('video-hidden'));
    }

    function resumePausedAudioMonitors() {
        if (isAudioMonitoringPaused()) return;
        const callbacks = [...pausedAudioMonitors];
        pausedAudioMonitors.clear();
        callbacks.forEach(fn => fn());
    }

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            resumePausedAudioMonitors();
        }
    });

    // --- Native <dialog> & Invoker Commands Helpers ---
    window.openModal = function(dialog) {
        if (!dialog) return;
        if (typeof dialog.showModal === 'function') {
            if (!dialog.open) {
                dialog.showModal();
            }
        } else {
            dialog.setAttribute('open', '');
            dialog.style.display = 'flex';
        }
    };

    window.closeModal = function(dialog) {
        if (!dialog) return;
        if (typeof dialog.close === 'function') {
            if (dialog.open) {
                dialog.close();
            }
        } else {
            dialog.removeAttribute('open');
            dialog.style.display = 'none';
        }
    };

    function setupDialogsAndInvokers() {
        // Feature detect declarative Invoker Commands on HTMLButtonElement.prototype
        if (!('commandForElement' in HTMLButtonElement.prototype)) {
            import('https://cdn.jsdelivr.net/npm/invokers-polyfill@0.5.2/invoker.min.js').catch(() => {});
        }

        // Fallback for closedby="any" light-dismiss using pointerdown + pointerup coordinates
        if (!('closedBy' in HTMLDialogElement.prototype)) {
            document.querySelectorAll('dialog[closedby="any"]').forEach(dialog => {
                let downOutside = false;
                const isOutside = (e) => {
                    const rect = dialog.getBoundingClientRect();
                    return (
                        e.clientX < rect.left ||
                        e.clientX > rect.right ||
                        e.clientY < rect.top ||
                        e.clientY > rect.bottom
                    );
                };
                dialog.addEventListener('pointerdown', (e) => {
                    downOutside = isOutside(e);
                });
                dialog.addEventListener('pointerup', (e) => {
                    if (downOutside && isOutside(e)) {
                        dialog.close();
                    }
                    downOutside = false;
                });
            });
        }
    }

    function enqueueSignaling(task) {
        signalingChain = signalingChain.then(task).catch(err => {
            console.error('[WebRTC] Signaling task error:', err);
        });
        return signalingChain;
    }

    const iceServers = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun.cloudflare.com:3478' },
            {
                urls: 'turn:openrelay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:443',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turns:openrelay.metered.ca:443?transport=tcp',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            }
        ],
        iceCandidatePoolSize: 4
    };

    let reconnectAttempts = 0;
    let reconnectTimeoutId = null;
    let heartbeatInterval = null;
    let socket = null;

    // --- User and Chat Management ---
    // The username is now set by the login process
    function setUsername(name) {
        username = name;
    }

    function getUsername() {
        return username;
    }
    window.getUsername = getUsername;

    function initLogin() {
        const loginOverlay = document.getElementById('login-overlay');
        const loginMjBtn = document.getElementById('login-mj-btn');
        const mjConfirmModal = document.getElementById('mj-confirm-modal');
        const mjConfirmAccept = document.getElementById('mj-confirm-accept');
        const mjConfirmCancel = document.getElementById('mj-confirm-cancel');
        const charactersList = document.getElementById('login-characters-list');

        if (loginOverlay) {
            window.openModal(loginOverlay);
            // Prevent Escape from closing the mandatory login modal in browsers without closedby="none"
            loginOverlay.addEventListener('cancel', (e) => {
                if (!isLoggedIn) {
                    e.preventDefault();
                }
            });
        }

        // Show MJ confirm modal
        loginMjBtn.addEventListener('click', () => {
            window.openModal(mjConfirmModal);
        });

        // Cancel MJ confirm
        mjConfirmCancel.addEventListener('click', () => {
            window.closeModal(mjConfirmModal);
        });

        // Accept MJ confirm
        mjConfirmAccept.addEventListener('click', async () => {
            window.closeModal(mjConfirmModal);
            setUsername('MJ');
            window.userPortraitUrl = 'mj_icon';
            await finishLogin();
        });

        // Function to render character cards safely without innerHTML
        window.renderLoginCharacters = function(characters) {
            charactersList.replaceChildren();
            const defaultAvatar = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23444"/><text x="50" y="50" font-family="Arial" font-size="40" fill="white" dominant-baseline="middle" text-anchor="middle">?</text></svg>';
            characters.forEach(char => {
                const card = document.createElement('button');
                card.type = 'button';
                card.className = 'character-card';

                const img = document.createElement('img');
                img.src = char.portraitUrl || defaultAvatar;
                img.className = 'character-portrait';
                img.alt = char.name || 'Personnage';

                const nameDiv = document.createElement('div');
                nameDiv.className = 'character-name';
                nameDiv.textContent = char.name || '';

                card.append(img, nameDiv);
                card.addEventListener('click', async () => {
                    setUsername(char.name);
                    window.userPortraitUrl = char.portraitUrl || defaultAvatar;

                    // Request to load this character
                    if (socket && socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify({ type: 'load-character', id: char.id }));
                    } else {
                        window.pendingCharacterLoad = char.id;
                    }

                    await finishLogin();
                });
                charactersList.appendChild(card);
            });
        };
    }

    function getLocalMediaState() {
        const videoTrack = localStream ? localStream.getVideoTracks()[0] : null;
        const audioTrack = localStream ? localStream.getAudioTracks()[0] : null;
        return {
            hasVideo: Boolean(videoTrack && videoTrack.readyState !== 'ended'),
            hasAudio: Boolean(audioTrack && audioTrack.readyState !== 'ended'),
            videoEnabled: Boolean(videoTrack && videoTrack.enabled && videoTrack.readyState !== 'ended'),
            audioEnabled: Boolean(audioTrack && audioTrack.enabled && audioTrack.readyState !== 'ended')
        };
    }

    function sendMediaState() {
        if (isLoggedIn && getUsername() && socket && socket.readyState === WebSocket.OPEN) {
            sendMessage({
                type: 'media-state',
                ...getLocalMediaState()
            });
        }
    }

    async function finishLogin() {
        window.closeModal(document.getElementById('login-overlay'));

        await setupLocalMedia();
        isLoggedIn = true;

        // Now register with the server
        if (socket && socket.readyState === WebSocket.OPEN) {
            sendMessage({
                type: 'register',
                username: getUsername(),
                mediaState: getLocalMediaState()
            });
            sendMediaState();
            checkAndSendConnectionMessage();
        }

        if (pendingUserList) {
            const listToProcess = pendingUserList;
            pendingUserList = null;
            enqueueSignaling(() => handleUserList(listToProcess.users, listToProcess.mediaStates));
        }

        // Re-render character sheet UI to show tabs if applicable
        if (window.renderCharacterTabs) {
            window.renderCharacterTabs();
        }
    }

    function checkAndSendConnectionMessage() {
        if (!sessionStorage.getItem('hasSentWelcome') && getUsername()) {
            sessionStorage.setItem('hasSentWelcome', 'true');

            let messageContent = '';
            if (getUsername() === 'MJ') {
                messageContent = `<span class="material-symbols-outlined" style="vertical-align: middle; font-size: 20px; margin-right: 5px;">shield_person</span> MJ s'est connecté - Bienvenue`;
            } else {
                const imgStyle = 'width: 24px; height: 24px; border-radius: 50%; vertical-align: middle; margin-right: 8px; object-fit: cover;';
                const defaultAvatar = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23444"/><text x="50" y="50" font-family="Arial" font-size="40" fill="white" dominant-baseline="middle" text-anchor="middle">?</text></svg>';
                messageContent = `<img src="${window.userPortraitUrl || defaultAvatar}" style="${imgStyle}" alt="Portrait"> ${getUsername()} s'est connecté - Bienvenue`;
            }

            sendMessage({
                type: 'chat',
                sender: 'System',
                message: messageContent,
                isSystemEvent: true
            });
        }
    }

    // --- DOM Manipulation ---
    function addMessage({ sender, message, type, system, isSystemEvent, prepend = false }) {
        if (!sender || !message) {
            console.warn('[UI] Ignoring malformed message object:', { sender, message, type, system });
            return;
        }
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message');

        const userColor = stringToHslColor(sender, 70, 75);

        const senderContainer = document.createElement('strong');
        senderContainer.style.color = sender === 'System' ? '#aaa' : userColor;

        if (!isSystemEvent) {
            if (type === 'game-roll') {
                messageElement.classList.add('game-roll-message');
                senderContainer.textContent = `${sender}: `;
                messageElement.appendChild(senderContainer);
            } else {
                senderContainer.textContent = `${sender}: `;
                messageElement.appendChild(senderContainer);
            }
        } else {
             messageElement.classList.add('system-event-message');
        }

        const bodyElement = document.createElement('span');
        bodyElement.classList.add('message-body');

        if (sender === 'System' || type === 'game-roll' || type === 'dice' || isSystemEvent) {
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

    const DEFAULT_AVATAR = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23444"/><text x="50" y="50" font-family="Arial" font-size="40" fill="white" dominant-baseline="middle" text-anchor="middle">?</text></svg>';

    function getAvatarUrlForUser(name) {
        if (name === getUsername()) {
            return window.userPortraitUrl && window.userPortraitUrl !== 'mj_icon' ? window.userPortraitUrl : DEFAULT_AVATAR;
        }
        const character = window.availableCharacters && window.availableCharacters.find(c => c.name === name);
        return character && character.portraitUrl ? character.portraitUrl : DEFAULT_AVATAR;
    }

    function updateAllAvatars() {
        document.querySelectorAll('.video-container').forEach(container => {
            const name = container.dataset.username;
            const avatarImg = container.querySelector('.fallback-avatar');
            if (name && avatarImg) {
                avatarImg.src = getAvatarUrlForUser(name);
            }
        });
    }

    function getPoolGaugeColor(pool, max) {
        if (pool <= 0 || max <= 0) return '#555555';
        const pct = Math.max(0, Math.min(100, (pool / max) * 100));
        const hue = Math.round((pct / 100) * 120);
        return `hsl(${hue}, 70%, 42%)`;
    }

    function updateVideoPoolsForContainer(container) {
        if (!container) return;
        const poolsBar = container.querySelector('.video-pools-bar');
        if (!poolsBar) return;

        const name = container.dataset.username;
        if (!name || name.toLowerCase() === 'mj') {
            poolsBar.style.display = 'none';
            return;
        }

        const character = window.availableCharacters && window.availableCharacters.find(
            c => c.name === name || c.id === name
        );
        if (!character || !character.stats) {
            poolsBar.style.display = 'none';
            return;
        }

        poolsBar.style.display = 'flex';
        const statConfigs = [
            { key: 'might', label: 'Might' },
            { key: 'speed', label: 'Speed' },
            { key: 'intel', label: 'Intel' }
        ];

        statConfigs.forEach(({ key, label }) => {
            const gauge = poolsBar.querySelector(`.video-pool-gauge[data-stat="${key}"]`);
            if (!gauge) return;

            const statObj = character.stats[key] || {};
            const pool = Number(statObj.pool !== undefined ? statObj.pool : 0);
            const max = Number(statObj.poolMax !== undefined ? statObj.poolMax : 0);
            const pct = max > 0 ? Math.max(0, Math.min(100, (pool / max) * 100)) : 0;

            const fill = gauge.querySelector('.video-pool-fill');
            const valEl = gauge.querySelector('.pool-val');

            if (fill) {
                fill.style.width = `${pct}%`;
                fill.style.backgroundColor = getPoolGaugeColor(pool, max);
            }
            if (valEl) {
                valEl.textContent = pool;
            }
            gauge.title = `${label}: ${pool} / ${max}`;
        });
    }

    function updateAllVideoPools() {
        document.querySelectorAll('.video-container').forEach(container => {
            updateVideoPoolsForContainer(container);
        });
    }

    let audioUnlockRegistered = false;
    function ensureAudioUnlocked() {
        if (audioUnlockRegistered) return;
        audioUnlockRegistered = true;
        const unlock = () => {
            if (sharedAudioContext && sharedAudioContext.state === 'suspended') {
                sharedAudioContext.resume().catch(() => {});
            }
            document.querySelectorAll('.video-container audio, .video-container video').forEach(mediaEl => {
                if (mediaEl.paused && mediaEl.srcObject) {
                    mediaEl.play().catch(() => {});
                }
            });
        };
        document.addEventListener('click', unlock, { passive: true });
        document.addEventListener('keydown', unlock, { passive: true });
        document.addEventListener('touchstart', unlock, { passive: true });
    }

    function updateVideoVisibility(name) {
        const videoContainer = document.getElementById(`video-${name}`);
        if (!videoContainer) return;

        const video = videoContainer.querySelector('video.peer-video');
        const avatarImg = videoContainer.querySelector('img.fallback-avatar');
        if (!video || !avatarImg) return;

        let showVideo = false;
        if (name === getUsername()) {
            const videoTrack = localStream ? localStream.getVideoTracks()[0] : null;
            showVideo = Boolean(videoTrack && videoTrack.enabled && videoTrack.readyState !== 'ended');
        } else {
            const rStream = remoteStreams[name];
            const videoTrack = rStream ? rStream.getVideoTracks().find(t => t.readyState !== 'ended') : null;
            const mState = peerMediaStates[name];
            if (videoTrack) {
                if (mState !== undefined && mState !== null) {
                    showVideo = Boolean(mState.hasVideo !== false && mState.videoEnabled !== false);
                } else {
                    showVideo = !videoTrack.muted;
                }
            }
        }

        video.style.display = showVideo ? 'block' : 'none';
        avatarImg.style.display = showVideo ? 'none' : 'block';

        if (showVideo && video.paused && video.srcObject) {
            video.play().catch(() => {});
        }
    }

    function addVideoStream(stream, name) {
        if (!name || !videoGrid) return;
        ensureAudioUnlocked();

        let videoContainer = document.getElementById(`video-${name}`);
        let video;
        let avatarImg;
        let audio;

        if (!videoContainer) {
            videoContainer = document.createElement('div');
            videoContainer.id = `video-${name}`;
            videoContainer.dataset.username = name;
            videoContainer.classList.add('video-container');

            const mediaWrapper = document.createElement('div');
            mediaWrapper.classList.add('video-media-wrapper');

            video = document.createElement('video');
            video.classList.add('peer-video');
            video.autoplay = true;
            video.playsInline = true;
            video.defaultMuted = true;
            video.muted = true; // Always mute <video> so browsers never block video autoplay; remote audio uses <audio>
            video.setAttribute('autoplay', '');
            video.setAttribute('playsinline', '');
            video.setAttribute('muted', '');
            if (name === getUsername()) {
                video.style.transform = 'scaleX(-1)';
            }
            mediaWrapper.appendChild(video);

            avatarImg = document.createElement('img');
            avatarImg.classList.add('fallback-avatar');
            avatarImg.style.width = '100%';
            avatarImg.style.height = '100%';
            avatarImg.style.objectFit = 'contain';
            avatarImg.style.display = 'block';
            avatarImg.style.backgroundColor = '#111';
            avatarImg.style.aspectRatio = '4/3';
            avatarImg.src = getAvatarUrlForUser(name);
            mediaWrapper.appendChild(avatarImg);

            if (name !== getUsername()) {
                audio = document.createElement('audio');
                audio.classList.add('peer-audio');
                audio.autoplay = true;
                audio.setAttribute('autoplay', '');
                mediaWrapper.appendChild(audio);
            }

            const nameTag = document.createElement('div');
            nameTag.classList.add('name-tag');
            nameTag.textContent = name;
            mediaWrapper.appendChild(nameTag);

            videoContainer.appendChild(mediaWrapper);

            const poolsBar = document.createElement('div');
            poolsBar.classList.add('video-pools-bar');
            poolsBar.style.display = 'none';
            [
                { key: 'might', letter: 'M' },
                { key: 'speed', letter: 'S' },
                { key: 'intel', letter: 'I' }
            ].forEach(stat => {
                const gauge = document.createElement('div');
                gauge.classList.add('video-pool-gauge');
                gauge.dataset.stat = stat.key;

                const fill = document.createElement('div');
                fill.classList.add('video-pool-fill');

                const label = document.createElement('div');
                label.classList.add('video-pool-label');
                label.innerHTML = `<span class="pool-letter">${stat.letter}</span><span class="pool-sep">-</span><span class="pool-val">0</span>`;

                gauge.appendChild(fill);
                gauge.appendChild(label);
                poolsBar.appendChild(gauge);
            });
            videoContainer.appendChild(poolsBar);
            videoGrid.appendChild(videoContainer);
        } else {
            video = videoContainer.querySelector('video.peer-video');
            avatarImg = videoContainer.querySelector('img.fallback-avatar');
            audio = videoContainer.querySelector('audio.peer-audio');
            if (avatarImg) {
                avatarImg.src = getAvatarUrlForUser(name);
            }
        }

        if (stream) {
            const videoTracks = stream.getVideoTracks();
            if (video && videoTracks.length > 0) {
                if (video.srcObject !== stream) {
                    video.srcObject = stream;
                }
                video.muted = true;
                video.play().catch(e => console.warn(`[WebRTC] Video play deferred for ${name}:`, e));
            }

            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length > 0) {
                if (name !== getUsername() && audio) {
                    if (audio.srcObject !== stream) {
                        audio.srcObject = stream;
                    }
                    audio.play().catch(e => console.warn(`[WebRTC] Audio play deferred for ${name}:`, e));
                }
                monitorAudioVolume(stream, videoContainer, name);
            }
        }

        updateVideoVisibility(name);
        updateVideoPoolsForContainer(videoContainer);
    }

    function removeVideoStream(name) {
        delete activeAudioMonitors[name];
        const videoContainer = document.getElementById(`video-${name}`);
        if (videoContainer) videoContainer.remove();
    }

    let sharedAudioContext = null;

    function monitorAudioVolume(stream, videoContainer, name) {
        const audioTrack = stream ? stream.getAudioTracks()[0] : null;
        if (!audioTrack) return;

        const monitorKey = name || videoContainer.id;
        if (activeAudioMonitors[monitorKey] === audioTrack.id) return;
        activeAudioMonitors[monitorKey] = audioTrack.id;

        try {
            if (!sharedAudioContext) {
                sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (sharedAudioContext.state === 'suspended') {
                sharedAudioContext.resume().catch(e => console.warn('Could not resume AudioContext', e));
            }

            const analyser = sharedAudioContext.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.5;

            const source = sharedAudioContext.createMediaStreamSource(stream);
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            function updateVolume() {
                if (!document.body.contains(videoContainer) || activeAudioMonitors[monitorKey] !== audioTrack.id) {
                    pausedAudioMonitors.delete(updateVolume);
                    return;
                }

                if (isAudioMonitoringPaused()) {
                    videoContainer.classList.remove('speaking');
                    pausedAudioMonitors.add(updateVolume);
                    return;
                }

                const track = stream.getAudioTracks()[0];
                if (!track || !track.enabled || track.readyState === 'ended') {
                    videoContainer.classList.remove('speaking');
                    requestAnimationFrame(updateVolume);
                    return;
                }

                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const average = sum / dataArray.length;

                if (average > 10) {
                    videoContainer.classList.add('speaking');
                } else {
                    videoContainer.classList.remove('speaking');
                }

                requestAnimationFrame(updateVolume);
            }

            updateVolume();
        } catch (err) {
            console.error("Error setting up audio monitoring", err);
        }
    }

    // --- Messaging ---
    function sendMessage(payload) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ sender: getUsername(), ...payload }));
        } else {
            console.error("WebSocket is not connected. Message not sent:", payload);
        }
    }
    window.sendMessage = sendMessage;

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
    function closePeerConnection(peerUsername, removeUi = false) {
        if (disconnectTimers[peerUsername]) {
            clearTimeout(disconnectTimers[peerUsername]);
            delete disconnectTimers[peerUsername];
        }
        if (restartTimers[peerUsername]) {
            clearTimeout(restartTimers[peerUsername]);
            delete restartTimers[peerUsername];
        }
        const pc = peerConnections[peerUsername];
        if (pc) {
            pc.onicecandidate = null;
            pc.ontrack = null;
            pc.onconnectionstatechange = null;
            pc.oniceconnectionstatechange = null;
            try {
                pc.close();
            } catch (e) {
                // Ignore close errors
            }
            delete peerConnections[peerUsername];
        }
        delete iceCandidateQueues[peerUsername];
        delete remoteStreams[peerUsername];
        delete activeAudioMonitors[peerUsername];
        if (removeUi) {
            delete peerMediaStates[peerUsername];
            delete restartCounts[peerUsername];
            removeVideoStream(peerUsername);
        }
    }

    async function flushIceCandidates(peerUsername, pc) {
        const queue = iceCandidateQueues[peerUsername];
        if (!queue || !queue.length || !pc || !pc.remoteDescription) return;
        const candidates = queue.splice(0, queue.length);
        delete iceCandidateQueues[peerUsername];
        for (const candidate of candidates) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
                console.warn(`[WebRTC] Failed to add queued ICE candidate for ${peerUsername}:`, err);
            }
        }
    }

    function schedulePeerRestart(peerUsername) {
        if (!isLoggedIn || !getUsername() || peerUsername === getUsername()) return;
        if (restartTimers[peerUsername]) return;

        const count = restartCounts[peerUsername] || 0;
        if (count >= 4) {
            console.warn(`[WebRTC] Max reconnect attempts reached for ${peerUsername}`);
            return;
        }
        restartCounts[peerUsername] = count + 1;
        const delay = Math.min(1500 * Math.pow(1.8, count), 10000);

        restartTimers[peerUsername] = setTimeout(() => {
            delete restartTimers[peerUsername];
            enqueueSignaling(async () => {
                if (!document.getElementById(`video-${peerUsername}`)) return;
                const currentPc = peerConnections[peerUsername];
                if (currentPc && (currentPc.connectionState === 'connected' || currentPc.iceConnectionState === 'connected' || currentPc.iceConnectionState === 'completed')) {
                    restartCounts[peerUsername] = 0;
                    return;
                }
                console.log(`[WebRTC] Attempting automatic reconnection with ${peerUsername} (attempt ${restartCounts[peerUsername]})`);
                closePeerConnection(peerUsername, false);
                if (getUsername() < peerUsername) {
                    await createPeerConnection(peerUsername, true);
                } else {
                    sendMessage({ type: 'webrtc-restart', target: peerUsername });
                }
            });
        }, delay);
    }

    async function createPeerConnection(peerUsername, isInitiator = false) {
        if (!isLoggedIn || !getUsername() || peerConnections[peerUsername] || peerUsername === getUsername()) {
            return peerConnections[peerUsername];
        }

        const pc = new RTCPeerConnection(iceServers);
        peerConnections[peerUsername] = pc;

        // Immediately ensure the peer's card/avatar is visible in the video grid
        if (!remoteStreams[peerUsername]) {
            remoteStreams[peerUsername] = new MediaStream();
        }
        addVideoStream(remoteStreams[peerUsername], peerUsername);

        const audioTracks = localStream ? localStream.getAudioTracks() : [];
        const videoTracks = localStream ? localStream.getVideoTracks() : [];

        audioTracks.forEach(track => pc.addTrack(track, localStream));
        videoTracks.forEach(track => pc.addTrack(track, localStream));

        pc.onicecandidate = event => {
            if (event.candidate) {
                sendMessage({ type: 'ice-candidate', target: peerUsername, message: event.candidate });
            }
        };

        pc.ontrack = event => {
            let remoteStream = remoteStreams[peerUsername];
            if (!remoteStream) {
                remoteStream = new MediaStream();
                remoteStreams[peerUsername] = remoteStream;
            }

            const track = event.track;
            if (track) {
                remoteStream.getTracks().forEach(existing => {
                    if (existing.kind === track.kind && existing.id !== track.id) {
                        remoteStream.removeTrack(existing);
                    }
                });
                if (!remoteStream.getTracks().some(existing => existing.id === track.id)) {
                    remoteStream.addTrack(track);
                }

                track.onunmute = () => {
                    addVideoStream(remoteStream, peerUsername);
                };
                track.onmute = () => {
                    updateVideoVisibility(peerUsername);
                };
                track.onended = () => {
                    updateVideoVisibility(peerUsername);
                };
            } else if (event.streams && event.streams[0]) {
                event.streams[0].getTracks().forEach(t => {
                    if (!remoteStream.getTracks().some(existing => existing.id === t.id)) {
                        remoteStream.addTrack(t);
                    }
                });
            }

            addVideoStream(remoteStream, peerUsername);
        };

        const handleStateChange = () => {
            if ( peerConnections[peerUsername] !== pc ) return;
            const state = pc.connectionState || pc.iceConnectionState;

            if (state === 'connected' || state === 'completed') {
                restartCounts[peerUsername] = 0;
                if (disconnectTimers[peerUsername]) {
                    clearTimeout(disconnectTimers[peerUsername]);
                    delete disconnectTimers[peerUsername];
                }
                updateVideoVisibility(peerUsername);
            } else if (state === 'disconnected') {
                if (!disconnectTimers[peerUsername]) {
                    disconnectTimers[peerUsername] = setTimeout(() => {
                        delete disconnectTimers[peerUsername];
                        if (peerConnections[peerUsername] === pc &&
                            (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' ||
                             pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed')) {
                            schedulePeerRestart(peerUsername);
                        }
                    }, 5000);
                }
            } else if (state === 'failed') {
                schedulePeerRestart(peerUsername);
            } else if (state === 'closed') {
                closePeerConnection(peerUsername, false);
            }
        };

        pc.onconnectionstatechange = handleStateChange;
        pc.oniceconnectionstatechange = handleStateChange;

        if (isInitiator) {
            // Ensure both audio and video m= sections exist in the Offer even if the initiator lacks a camera or mic
            if (typeof pc.addTransceiver === 'function') {
                if (audioTracks.length === 0) {
                    pc.addTransceiver('audio', { direction: 'recvonly' });
                }
                if (videoTracks.length === 0) {
                    pc.addTransceiver('video', { direction: 'recvonly' });
                }
            }

            const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            await pc.setLocalDescription(offer);
            sendMessage({ type: 'offer', target: peerUsername, message: pc.localDescription });
        }

        return pc;
    }

    async function handleUserList(users, mediaStates) {
        if (mediaStates && typeof mediaStates === 'object') {
            Object.entries(mediaStates).forEach(([u, st]) => {
                if (st) peerMediaStates[u] = st;
            });
        }

        if (!isLoggedIn || !getUsername()) {
            pendingUserList = { users, mediaStates };
            return;
        }

        const myUsername = getUsername();
        const uniqueUsers = [...new Set(users)];

        // Remove disconnected users first
        const existingPeers = Object.keys(peerConnections);
        existingPeers.forEach(peerName => {
            if (!uniqueUsers.includes(peerName)) {
                closePeerConnection(peerName, true);
                window.dispatchEvent(new CustomEvent('pointer-disconnect', { detail: { sender: peerName } }));
            }
        });

        // Also remove any lingering video containers for users no longer in the list
        document.querySelectorAll('.video-container').forEach(container => {
            const name = container.dataset.username;
            if (name && name !== myUsername && !uniqueUsers.includes(name)) {
                removeVideoStream(name);
            }
        });

        // Create connections for new users and send offers
        for (const user of uniqueUsers) {
            if (user && user !== myUsername) {
                if (!peerConnections[user]) {
                    const isInitiator = myUsername < user;
                    await createPeerConnection(user, isInitiator);
                } else {
                    updateVideoVisibility(user);
                }
            }
        }
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

            // Request character list for login screen
            socket.send(JSON.stringify({ type: 'get-characters' }));

            // If we have a pending character load, send it now
            if (window.pendingCharacterLoad) {
                socket.send(JSON.stringify({ type: 'load-character', id: window.pendingCharacterLoad }));
                window.pendingCharacterLoad = null;
            }

            // Enregistre l'utilisateur SEULEMENT si l'utilisateur a fini de se connecter
            if (isLoggedIn && getUsername()) {
                sendMessage({
                    type: 'register',
                    username: getUsername(),
                    mediaState: getLocalMediaState()
                });
                sendMediaState();
                checkAndSendConnectionMessage();
            }

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
                case 'chat-cleared':
                    if (chatMessages) chatMessages.innerHTML = '';
                    break;
                case 'mj-status': { // Use block scope
                    window.isMJ = data.isMJ; // Set the global flag
                    window.dispatchEvent(new CustomEvent('mj-status', { detail: { isMJ: data.isMJ } }));

                    // Show MJ specific chat controls
                    const mjChatControls = document.getElementById('mj-chat-controls');
                    if (mjChatControls) {
                        mjChatControls.style.display = data.isMJ ? 'block' : 'none';
                    }

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
                case 'tokens-list-update':
                    window.dispatchEvent(new CustomEvent('tokens-list-update', { detail: { list: data.list } }));
                    break;
                case 'characters-list-update': {
                    window.availableCharacters = data.list;
                    window.dispatchEvent(new CustomEvent('characters-list-update', { detail: { list: data.list } }));
                    const loginOverlayEl = document.getElementById('login-overlay');
                    if (loginOverlayEl && (loginOverlayEl.open || loginOverlayEl.style.display !== 'none') && window.renderLoginCharacters) {
                        window.renderLoginCharacters(data.list);
                    }
                    if (window.renderCharacterTabs) {
                        window.renderCharacterTabs();
                    }
                    updateAllAvatars();
                    updateAllVideoPools();
                    break;
                }
                case 'character-loaded':
                    if (window.availableCharacters && data.data && data.data.stats) {
                        const loadedChar = window.availableCharacters.find(
                            c => c.id === data.id || c.name === (data.data.identity && data.data.identity.name)
                        );
                        if (loadedChar) loadedChar.stats = data.data.stats;
                        updateAllVideoPools();
                    }
                    window.dispatchEvent(new CustomEvent('character-loaded', { detail: { id: data.id, data: data.data } }));
                    break;
                case 'character-updated':
                    if (window.availableCharacters && data.data && data.data.stats) {
                        const updatedChar = window.availableCharacters.find(
                            c => c.id === data.id || c.name === (data.data.identity && data.data.identity.name)
                        );
                        if (updatedChar) updatedChar.stats = data.data.stats;
                        updateAllVideoPools();
                    }
                    window.dispatchEvent(new CustomEvent('character-updated', { detail: { id: data.id, data: data.data } }));
                    break;
                case 'character-deleted':
                    window.dispatchEvent(new CustomEvent('character-deleted', { detail: { id: data.id } }));
                    break;
                case 'show-image':
                    displayImage(data.url);
                    break;
                case 'user-list':
                    enqueueSignaling(() => handleUserList(data.users, data.mediaStates));
                    break;
                case 'peer-reconnected':
                    if (data.username && data.username !== getUsername()) {
                        if (data.mediaState) {
                            peerMediaStates[data.username] = data.mediaState;
                        }
                        enqueueSignaling(async () => {
                            if (!isLoggedIn || !getUsername()) return;
                            closePeerConnection(data.username, false);
                            const isInitiator = getUsername() < data.username;
                            await createPeerConnection(data.username, isInitiator);
                        });
                    }
                    break;
                case 'media-state':
                    if (data.sender && data.state) {
                        peerMediaStates[data.sender] = data.state;
                        updateVideoVisibility(data.sender);
                    }
                    break;
                case 'webrtc-restart':
                    if (data.sender && data.sender !== getUsername()) {
                        enqueueSignaling(async () => {
                            if (!isLoggedIn || !getUsername()) return;
                            closePeerConnection(data.sender, false);
                            await createPeerConnection(data.sender, true);
                        });
                    }
                    break;
                case 'chat':
                case 'dice':
                case 'game-roll':
                    addMessage({ ...data, prepend: true });
                    break;
                case 'offer':
                    enqueueSignaling(async () => {
                        if (!isLoggedIn || !getUsername() || !data.sender) return;

                        let pc = peerConnections[data.sender];
                        if (pc) {
                            const isPolite = getUsername() > data.sender;
                            if (pc.signalingState !== 'stable') {
                                // Offer collision (glare)
                                if (!isPolite) {
                                    console.log(`[WebRTC] Ignoring colliding offer from ${data.sender} (impolite peer)`);
                                    return;
                                }
                                closePeerConnection(data.sender, false);
                                pc = null;
                            } else if (pc.remoteDescription || pc.connectionState === 'connected' || pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                                // Remote peer recreated their connection; reset ours to match
                                closePeerConnection(data.sender, false);
                                pc = null;
                            }
                        }

                        if (!pc) {
                            pc = await createPeerConnection(data.sender, false);
                        }
                        if (!pc) return;

                        await pc.setRemoteDescription(new RTCSessionDescription(data.message));

                        // Ensure local tracks attached via addTrack are active in the Answer
                        if (typeof pc.getTransceivers === 'function') {
                            pc.getTransceivers().forEach(t => {
                                if (t.sender && t.sender.track && (t.direction === 'recvonly' || t.direction === 'inactive')) {
                                    try {
                                        t.direction = 'sendrecv';
                                    } catch (e) {
                                        // Ignore if browser disallows changing direction
                                    }
                                }
                            });
                        }

                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        sendMessage({ type: 'answer', target: data.sender, message: pc.localDescription });

                        await flushIceCandidates(data.sender, pc);
                    });
                    break;
                case 'answer':
                    enqueueSignaling(async () => {
                        if (!isLoggedIn || !getUsername() || !data.sender) return;
                        const answerPc = peerConnections[data.sender];
                        if (answerPc && answerPc.signalingState === 'have-local-offer') {
                            await answerPc.setRemoteDescription(new RTCSessionDescription(data.message));
                            await flushIceCandidates(data.sender, answerPc);
                        }
                    });
                    break;
                case 'ice-candidate':
                    enqueueSignaling(async () => {
                        if (!data.sender || !data.message) return;
                        const rtcPc = peerConnections[data.sender];
                        if (rtcPc && rtcPc.remoteDescription && rtcPc.remoteDescription.type) {
                            try {
                                await rtcPc.addIceCandidate(new RTCIceCandidate(data.message));
                            } catch (err) {
                                console.warn(`[WebRTC] Error adding ICE candidate from ${data.sender}:`, err);
                            }
                        } else {
                            if (!iceCandidateQueues[data.sender]) {
                                iceCandidateQueues[data.sender] = [];
                            }
                            iceCandidateQueues[data.sender].push(data.message);
                        }
                    });
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

            case 'backup-data':
                const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const date = new Date().toISOString().slice(0, 10);
                a.download = `rpg-backup-${date}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                break;
            case 'backup-error':
                alert(data.message);
                break;
            case 'force-reload':
                window.location.reload();
                break;

            case 'wiki-save-confirm':
                    window.dispatchEvent(new CustomEvent('wiki-save-confirm', { detail: data }));
                    break;
                case 'wiki-delete-confirm':
                    window.dispatchEvent(new CustomEvent('wiki-delete-confirm', { detail: data }));
                    break;
            }
        };
    }

    // --- Initial Setup ---
    async function setupLocalMedia() {
        const toggleVideoBtn = document.getElementById('toggle-video-btn');
        const muteMicBtn = document.getElementById('mute-mic-btn');
        const preferredVideoConstraints = {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 24 }
        };

        try {
            try {
                localStream = await navigator.mediaDevices.getUserMedia({
                    video: preferredVideoConstraints,
                    audio: true
                });
            } catch (firstErr) {
                console.warn('Could not get preferred video+audio constraints, trying basic video+audio...', firstErr);
                try {
                    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                } catch (err) {
                    console.warn('Could not get both video and audio, trying audio only...', err);
                    try {
                        localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                        if (toggleVideoBtn) toggleVideoBtn.style.display = 'none';
                    } catch (audioErr) {
                        console.warn('Could not get audio only, trying video only...', audioErr);
                        try {
                            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                            if (muteMicBtn) muteMicBtn.style.display = 'none';
                        } catch (videoErr) {
                            throw err; // Re-throw original error to trigger main catch block
                        }
                    }
                }
            }

            // Disable video and audio tracks by default upon connection
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) audioTrack.enabled = false;

            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) videoTrack.enabled = false;

            addVideoStream(localStream, getUsername());
        } catch (error) {
            console.error('Error accessing media devices:', error);

            // Create an empty MediaStream so the user still has an avatar and can receive audio/video from all peers
            localStream = new MediaStream();
            if (toggleVideoBtn) toggleVideoBtn.style.display = 'none';
            if (muteMicBtn) muteMicBtn.style.display = 'none';
            addVideoStream(localStream, getUsername());

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
                        if (item.side === 'right') {
                            resumePausedAudioMonitors();
                        }
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
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.isComposing || e.keyCode === 229) return;
                handleSendMessage();
            }
        });
        diceButtons.forEach(button => button.addEventListener('click', () => rollDice(parseInt(button.dataset.die, 10))));

        // Global media controls
        const muteMicBtn = document.getElementById('mute-mic-btn');
        const toggleVideoBtn = document.getElementById('toggle-video-btn');

        // Clear Chat controls
        const clearChatBtn = document.getElementById('clear-chat-btn');
        const chatClearConfirmModal = document.getElementById('chat-clear-confirm-modal');
        const chatClearConfirmAccept = document.getElementById('chat-clear-confirm-accept');
        const chatClearConfirmCancel = document.getElementById('chat-clear-confirm-cancel');

        if (clearChatBtn) {
            clearChatBtn.addEventListener('click', () => {
                window.openModal(chatClearConfirmModal);
            });
        }

        if (chatClearConfirmCancel) {
            chatClearConfirmCancel.addEventListener('click', () => {
                window.closeModal(chatClearConfirmModal);
            });
        }

        if (chatClearConfirmAccept) {
            chatClearConfirmAccept.addEventListener('click', () => {
                window.closeModal(chatClearConfirmModal);
                sendMessage({ type: 'clear-chat' });
            });
        }

        muteMicBtn.addEventListener('click', () => {
            if (!localStream) return;
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                muteMicBtn.classList.toggle('muted', !audioTrack.enabled);
                muteMicBtn.title = audioTrack.enabled ? "Couper le micro" : "Activer le micro";
                const icon = muteMicBtn.querySelector('.material-symbols-outlined');
                if (icon) icon.textContent = audioTrack.enabled ? 'mic' : 'mic_off';
                sendMediaState();
            }
        });

        toggleVideoBtn.addEventListener('click', () => {
            if (!localStream) return;
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                toggleVideoBtn.classList.toggle('muted', !videoTrack.enabled);
                toggleVideoBtn.title = videoTrack.enabled ? "Désactiver la caméra" : "Activer la caméra";
                const icon = toggleVideoBtn.querySelector('.material-symbols-outlined');
                if (icon) icon.textContent = videoTrack.enabled ? 'videocam' : 'videocam_off';
                updateVideoVisibility(getUsername());
                sendMediaState();
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
    document.addEventListener('DOMContentLoaded', () => {
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


        setupDialogsAndInvokers();
        initLogin();
        // Do not askForUsername() anymore, login handles it

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

// === Service Worker Registration ===
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('[SW] Registered:', registration.scope);
            })
            .catch(err => {
                console.error('[SW] Registration failed:', err);
            });
    });
}


// --- Backup & Restore Logic ---
const mjBackupBtn = document.getElementById('mj-backup-btn');
const backupModal = document.getElementById('backup-modal');
const backupDownloadBtn = document.getElementById('backup-download-btn');
const backupUploadInput = document.getElementById('backup-upload-input');
const backupRestoreBtn = document.getElementById('backup-restore-btn');
const backupModalClose = document.getElementById('backup-modal-close');

if(mjBackupBtn) {
    window.addEventListener('mj-status', (event) => {
        if (event.detail.isMJ) {
            mjBackupBtn.style.display = 'flex';
            mjBackupBtn.classList.remove('hidden');
        }
    });

    mjBackupBtn.addEventListener('click', () => {
        window.openModal(backupModal);
    });

    backupModalClose.addEventListener('click', () => {
        window.closeModal(backupModal);
    });

    backupModal.addEventListener('close', () => {
        backupUploadInput.value = '';
        backupRestoreBtn.disabled = true;
    });

    backupDownloadBtn.addEventListener('click', () => {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'request-backup' }));
        } else {
            alert("Déconnecté du serveur.");
        }
    });

    backupUploadInput.addEventListener('change', () => {
        if (backupUploadInput.files.length > 0) {
            backupRestoreBtn.disabled = false;
        } else {
            backupRestoreBtn.disabled = true;
        }
    });

    backupRestoreBtn.addEventListener('click', () => {
        if (backupUploadInput.files.length > 0) {
            const file = backupUploadInput.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (confirm("Attention: La restauration va écraser TOUTES les données actuelles (Fiches, Chat, Carte...). Êtes-vous sûr ?")) {
                        if (socket.readyState === WebSocket.OPEN) {
                            socket.send(JSON.stringify({ type: 'restore-backup', data: data }));
                        } else {
                            alert("Déconnecté du serveur.");
                        }
                        window.closeModal(backupModal);
                    }
                } catch (err) {
                    alert("Fichier de sauvegarde invalide (JSON mal formé).");
                    console.error("Restore error", err);
                }
            };
            reader.readAsText(file);
        }
    });
}

})();
