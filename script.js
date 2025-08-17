// IIFE to avoid polluting the global scope
(() => {
    let username = '';

    function askForUsername() {
        // Prompt the user for their name
        // Loop until a valid name is entered
        while (!username || username.trim() === '') {
            username = prompt("Veuillez entrer votre nom pour le chat :");
        }
    }

    // Function to get the current username
    function getUsername() {
        return username;
    }

    // --- DOM Elements ---
    let chatMessages, chatInput, sendButton, diceButtons;

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
                // Load history by APPENDING, so it's in chronological order.
                addMessage(msg.sender, msg.message, { save: false, prepend: false });
            });
        }
    }

    // --- Core Functions ---
    function parseForRichContent(message) {
        // Regex to find URLs
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return message.replace(urlRegex, (url) => {
            // Check if the URL is an image
            if (/\.(jpeg|jpg|gif|png)$/i.test(url)) {
                return `<a href="${url}" target="_blank"><img src="${url}" alt="Image" style="max-width: 100%; max-height: 150px;" /></a>`;
            } else {
                return `<a href="${url}" target="_blank">${url}</a>`;
            }
        });
    }

    function addMessage(sender, message, { save = true, prepend = false } = {}) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message');

        const richMessage = parseForRichContent(message);
        messageElement.innerHTML = `<strong>${sender}:</strong> ${richMessage}`;

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
        const message = `lance un dé ${dieType} et obtient : <strong>${roll}</strong>`;
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

    // Execute when the DOM is fully loaded
    document.addEventListener('DOMContentLoaded', () => {
        // Assign DOM elements
        chatMessages = document.getElementById('chat-messages');
        chatInput = document.getElementById('chat-input');
        sendButton = document.getElementById('send-button');
        diceButtons = document.querySelectorAll('.dice-button');

        loadHistory();
        askForUsername();

        if (chatHistory.length === 0) {
            addMessage('System', `Bienvenue, ${getUsername()}!`, { prepend: true });
        } else {
            // Also prepend the re-join message
            addMessage('System', `${getUsername()} a rejoint la session.`, { prepend: true });
        }

        setupEventListeners();
    });
})();
