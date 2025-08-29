// api.config.js

/**
 * This file configures the chatbot feature.
 * Each key in this object is a "trigger word" that users can type in the chat.
 * The server will check if a message starts with any of these keywords.
 */

const chatbotConfig = {
    // --- Example for a custom URL API ---
    // This type of API does not require a key in this configuration.
    // To use, a user would type: "#ask <your prompt>"
    '#ask': {
        type: 'url',
        displayName: 'Assistant', // Custom name for this bot
        endpoint: 'YOUR_CUSTOM_API_ENDPOINT_HERE' // e.g., 'https://api.your-service.com/chat'
    },

    // --- Example for Google Gemini ---
    // To use, a user would type: "#gemini <your prompt>"
    // To enable, uncomment this section and set your GEMINI_API_KEY in the .env file.
    /*
    '#gemini': {
        type: 'paid',
        service: 'gemini',
        model: 'gemini-1.5-flash',
        apiKey: 'GEMINI_API_KEY' // This string must match the variable name in .env
    },
    */

    // --- Example for Mistral AI ---
    // This service is not yet implemented in server.js, but this is how you would configure it.
    // To use, a user would type: "#mistral <your prompt>"
    // To enable, uncomment this section and set your MISTRAL_API_KEY in the .env file.
    /*
    '#mistral': {
        type: 'paid',
        service: 'mistral',
        apiKey: 'MISTRAL_API_KEY' // This string must match the variable name in .env
    },
    */

    // --- Example for a custom OpenAI-compatible API ---
    // To use, a user would type: "#custombot <your prompt>"
    // To enable, uncomment this section and set your CUSTOM_BOT_API_KEY in the .env file.
    /*
    '#custombot': {
        type: 'paid',
        service: 'openai-compatible',
        displayName: 'Custom Bot', // Optional: The name displayed in chat
        model: 'chat', // The model name your API expects
        apiKey: 'CUSTOM_BOT_API_KEY', // This string must match the variable name in .env
        endpoint: 'http://YOUR_BOT_URL/v1/chat/completions',
        systemPrompt: 'You are a helpful assistant.' // The system message
    },
    */
};

module.exports = chatbotConfig;
