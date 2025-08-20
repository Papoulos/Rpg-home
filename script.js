// IIFE to avoid polluting the global scope
(() => {
    // --- App State ---
    let username = '';
    let localStream;
    const peerConnections = {};
    const iceServers = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
        ],
    };

    // --- DOM Elements ---
    let mainDisplay;

    // --- WebSocket Setup ---
    const socket = new WebSocket(`wss://${window.location.host}`);

    // --- Core Functions ---
    function askForUsername() {
        while (!username || username.trim() === '') {
            username = prompt("Veuillez entrer votre nom pour le chat :");
        }
    }

    function getUsername() {
        return username;
    }

    // --- View Loading Logic ---
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
                    // Assumes the loaded script attaches an init function to window
                    if (window.initTableau) {
                        window.initTableau();
                    }
                    // Could add more for other views like `initFiches`, etc.
                };
                document.body.appendChild(newScript);
            }
        } catch (error) {
            console.error('Error loading view:', error);
            mainDisplay.innerHTML = `<p>Error loading content: ${error.message}</p>`;
        }
    }

    // --- Event Listeners ---
    function setupEventListeners() {
        const nav = document.getElementById('main-nav');
        if (nav) {
            nav.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON' && e.target.dataset.view) {
                    // Remove 'active' class from all buttons
                    nav.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
                    // Add 'active' class to the clicked button
                    e.target.classList.add('active');
                    // Load the view
                    loadView(e.target.dataset.view);
                }
            });
        }

        // Add other main page listeners here if needed (e.g., chat, dice)
        // For now, keeping it minimal to ensure the core navigation works.
    }

    // --- Initialization ---
    document.addEventListener('DOMContentLoaded', () => {
        mainDisplay = document.querySelector('.main-display');

        // Initial setup for chat, video, etc. would go here.
        // For now, focusing on the navigation part.

        setupEventListeners();

        // Load the default view on page load
        const defaultViewButton = document.querySelector('#main-nav button.active');
        if (defaultViewButton) {
            defaultViewButton.click();
        }
    });

})();
