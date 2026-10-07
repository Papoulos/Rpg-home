// api.config.js

/**
 * This file configures the chatbot feature.
 * Each key in this object is a "trigger word" that users can type in the chat.
 * The server will check if a message starts with any of these keywords.
 * API keys should be provided via environment variables (recommended) or apikeys.js
 */

const chatbotConfig = {
    // --- Example for a custom URL API ---
    // To use, a user would type: "#ask <your prompt>"
    '#ask': {
        type: 'url',
        displayName: 'Assistant',
        endpoint: process.env.CUSTOM_API_ENDPOINT || ''
    },

    // --- Example for Google Gemini ---
    // To use, a user would type: "#gemini <your prompt>"
    // Enable by setting APIKEY_GEMINI in your .env file
    '#gemini': {
        type: 'paid',
        service: 'gemini',
        model: 'gemini-1.5-flash',
        apiKey: 'gemini'
    },

    // --- Example for Mistral AI ---
    // To use, a user would type: "#mistral <your prompt>"
    // Enable by setting APIKEY_MISTRAL in your .env file
    '#mistral': {
        type: 'paid',
        service: 'mistral',
        apiKey: 'mistral'
    },

    // --- Example for a custom OpenAI-compatible API ---
    // To use, a user would type: "#custombot <your prompt>"
    // Enable by setting CUSTOMBOT_URL and CUSTOMBOT_KEY in your .env file
    '#custombot': {
        type: 'paid',
        service: 'openai-compatible',
        displayName: 'Custom Bot',
        model: 'chat',
        apiKey: 'custombot',
        endpoint: process.env.CUSTOMBOT_URL || '',
        systemPrompt: 'You are a helpful assistant.'
    }
};

module.exports = chatbotConfig;
