// IIFE to avoid polluting the global scope
(() => {
    let username = '';
    let userColor = '#ffffff'; // Default color

    // --- Utility Functions ---
    /**
     * Generates a consistent, visually appealing color from a string.
     * @param {string} str - The input string (e.g., username).
     * @param {number} s - Saturation (0-100).
     * @param {number} l - Lightness (0-100).
     * @returns {string} HSL color string.
     */
    function stringToHslColor(str, s, l) {
        if (!str) return '#ffffff'; // Return default for empty strings
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
        userColor = stringToHslColor(username, 70, 75); // Lighter color for better readability
    }

    function getUsername() {
        return username;
    }

    // --- Chat History ---
    let chatHistory = [];

    function saveHistory() {
        localStorage.setItem('rpg-chat-history', JSON.stringify(chatHistory));
    }

    function loadHistory() {
        const savedHistory = localStorage.getItem('rpg-chat-history');
        if (savedHistory) {
            chatHistory = JSON.parse(savedHistory);
            chatHistory.forEach(msg => {
                const color = stringToHslColor(msg.sender, 70, 75);
                addMessage(msg.sender, msg.message, { save: false, prepend: false, color: color });
            });
        }
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

    function addMessage(sender, message, { save = true, prepend = false, color = null } = {}) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message');

        const senderColor = color || userColor;
        const richMessage = parseForRichContent(message);

        const coloredSender = sender === 'System'
            ? `<strong style="color: #aaa;">${sender}:</strong>`
            : `<strong style="color: ${senderColor};">${sender}:</strong>`;

        messageElement.innerHTML = `${coloredSender} ${richMessage}`;

        if (prepend) {
            chatMessages.prepend(messageElement);
        } else {
            chatMessages.appendChild(messageElement);
        }

        if (save) {
            chatHistory.push({ sender, message });
            saveHistory();
        }
    }

    function rollDice(dieType) {
        const roll = Math.floor(Math.random() * dieType) + 1;
        let resultDisplay;

        // User wants GREEN for 1 (crit success in some systems) and RED for max (crit fail in some systems)
        if (roll === 1) {
            resultDisplay = `<span class="crit-success">${roll}</span>`;
        } else if (roll === dieType) {
            resultDisplay = `<span class="crit-fail">${roll}</span>`;
        } else {
            resultDisplay = `<strong>${roll}</strong>`;
        }

        const message = `lance un dé ${dieType} : ${resultDisplay}`;
        addMessage(getUsername(), message, { prepend: true });
    }

    function handleSendMessage() {
        const message = chatInput.value.trim();
        if (message) {
            addMessage(getUsername(), message, { prepend: true });
            chatInput.value = '';
        }
    }

    // --- Event Listeners ---
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
    let chatMessages, chatInput, sendButton, diceButtons;

    // Execute when the DOM is fully loaded
    document.addEventListener('DOMContentLoaded', () => {
        chatMessages = document.getElementById('chat-messages');
        chatInput = document.getElementById('chat-input');
        sendButton = document.getElementById('send-button');
        diceButtons = document.querySelectorAll('.dice-button');

        loadHistory();
        askForUsername();

        addMessage('System', `${getUsername()} a rejoint la session.`, { prepend: true });

        setupEventListeners();
    });
})();
