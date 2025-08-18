// api.config.js

/**
 * This file configures the chatbot feature.
 * Each key in this object is a "trigger word" that users can type in the chat.
 * The server will check if a message starts with any of these keywords.
 */

let apiKeys = {};
try {
    apiKeys = require('./apikeys');
} catch (error) {
    console.warn("[CONFIG] 'apikeys.js' not found. Paid chatbot features will be disabled.");
}

const chatbotConfig = {
    // --- Example for a custom URL API ---
    // To use, a user would type: "#ask <your prompt>"
    '#ask': {
        type: 'url',
        endpoint: 'YOUR_CUSTOM_API_ENDPOINT_HERE' // e.g., 'https://api.your-service.com/chat'
    },

    // --- Example for Google Gemini ---
    // To use, a user would type: "#gemini <your prompt>"
    // To enable, uncomment this section and provide your API key in 'apikeys.js'.
    /*
    '#gemini': {
        type: 'paid',
        service: 'gemini',
        model: 'gemini-1.5-flash',
        apiKey: apiKeys.gemini
    },
    */

    // --- Example for Mistral AI ---
    // To use, a user would type: "#mistral <your prompt>"
    // To enable, uncomment this section and provide your API key in 'apikeys.js'.
    /*
    '#mistral': {
        type: 'paid',
        service: 'mistral',
        apiKey: apiKeys.mistral
    },
    */
};

module.exports = chatbotConfig;
