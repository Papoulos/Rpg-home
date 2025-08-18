// IIFE to avoid polluting the global scope
(() => {
    let username = '';
    let userColor = '#ffffff'; // Default color

    const socket = new WebSocket(`ws://${window.location.host}`);

    // --- Utility Functions ---
    function stringToHslColor(str, s, l) {
        if (!str) return '#ffffff';
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const h = hash % 360;
        return `hsl(${h}, ${s}%, ${l}%)`;
    }

    // --- User and Chat Management ---
    function askForUsername() {
        while (!username || username.trim() === '') {
            username = prompt("Veuillez entrer votre nom pour le chat :");
        }
        userColor = stringToHslColor(username, 70, 75);
    }

    function getUsername() {
        return username;
    }

    // --- Core Functions ---
    function parseForRichContent(message) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return message.replace(urlRegex, (url) => {
            if (/\.(jpeg|jpg|gif|png)$/i.test(url)) {
                return `<a href="${url}" target="_blank"><img src="${url}" alt="Image" style="max-width: 100%; max-height: 150px;" /></a>`;
            } else {
                return `<a href="${url}" target="_blank">${url}</a>`;
            }
        });
    }

    function addMessage({ sender, message, color, type }) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message');

        const senderColor = color || userColor;
        const richMessage = parseForRichContent(message);

        const coloredSender = sender === 'System'
            ? `<strong style="color: #aaa;">${sender}:</strong>`
            : `<strong style="color: ${senderColor};">${sender}:</strong>`;

        messageElement.innerHTML = `${coloredSender} ${richMessage}`;

        // New messages are always prepended now
        chatMessages.prepend(messageElement);
    }

    function sendMessage(type, messageContent) {
        const message = {
            type: type,
            sender: getUsername(),
            color: userColor,
            message: messageContent,
        };
        socket.send(JSON.stringify(message));
    }

    function rollDice(dieType) {
        const roll = Math.floor(Math.random() * dieType) + 1;
        let resultDisplay;

        if (roll === 1) {
            resultDisplay = `<span class="crit-success">${roll}</span>`;
        } else if (roll === dieType) {
            resultDisplay = `<span class="crit-fail">${roll}</span>`;
        } else {
            resultDisplay = `<strong>${roll}</strong>`;
        }

        const message = `lance un dé ${dieType} : ${resultDisplay}`;
        sendMessage('dice', message);
    }

    function handleSendMessage() {
        const message = chatInput.value.trim();
        if (message) {
            sendMessage('chat', message);
            chatInput.value = '';
        }
    }

    // --- WebSocket Event Listeners ---
    socket.onopen = () => {
        console.log('WebSocket connection established');
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);

            if (data.type === 'history') {
                // Handle the initial history dump
                data.messages.forEach(msg => {
                    // Append historical messages
                    addMessage({ ...msg, prepend: false });
                });
            } else {
                // Handle a single, live message
                addMessage({ ...data, prepend: true });
            }
        } catch (error) {
            // Handle non-JSON messages if any (e.g. simple welcome strings)
            console.log('Received non-JSON message:', event.data);
        }
    };

    socket.onclose = () => {
        console.log('WebSocket connection closed');
        addMessage({ sender: 'System', message: 'Connection lost. Please refresh the page.' });
    };

    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    // --- DOM Event Listeners ---
    function setupEventListeners() {
        sendButton.addEventListener('click', handleSendMessage);
        chatInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                handleSendMessage();
            }
        });

        diceButtons.forEach(button => {
            button.addEventListener('click', () => {
                const dieType = button.dataset.die;
                rollDice(parseInt(dieType, 10));
            });
        });
    }

    // --- DOM Elements ---
    let chatMessages, chatInput, sendButton, diceButtons, leftPanel, toggleChatBtn;

    function setupToggle() {
        toggleChatBtn.addEventListener('click', () => {
            leftPanel.classList.toggle('chat-hidden');
            if (leftPanel.classList.contains('chat-hidden')) {
                toggleChatBtn.textContent = '»';
                toggleChatBtn.title = "Afficher le panneau de chat";
            } else {
                toggleChatBtn.textContent = '«';
                toggleChatBtn.title = "Cacher le panneau de chat";
            }
        });
    }

    // Execute when the DOM is fully loaded
    document.addEventListener('DOMContentLoaded', () => {
        chatMessages = document.getElementById('chat-messages');
        chatInput = document.getElementById('chat-input');
        sendButton = document.getElementById('send-button');
        diceButtons = document.querySelectorAll('.dice-button');
        leftPanel = document.querySelector('.left-panel');
        toggleChatBtn = document.getElementById('toggle-chat-btn');

        askForUsername();

        // Announce that the user has joined once the connection is open
        socket.addEventListener('open', () => {
             sendMessage('user-join', `${getUsername()} a rejoint la session.`);
        });

        setupEventListeners();
        setupToggle();
    });
})();
