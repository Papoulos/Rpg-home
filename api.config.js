// api.config.js

/**
 * This file configures the chatbot feature.
 * You can define multiple keywords to trigger different AI services.
 */

// Import API keys from the untracked 'apikeys.js' file.
// This file is ignored by git to keep your secrets safe.
// You need to create this file yourself from the 'apikeys.js.example' template.
let apiKeys = {};
try {
    apiKeys = require('./apikeys');
} catch (error) {
    console.warn("[CONFIG] 'apikeys.js' not found. Paid chatbot features will be disabled.");
    console.warn("[CONFIG] To enable them, copy 'apikeys.js.example' to 'apikeys.js' and add your keys.");
}

const chatbotConfig = {
    // The keyword that users will type to activate the chatbot.
    // The chatbot will be triggered if a message starts with this keyword.
    triggerKeyword: '#askme',

    // Define the APIs you want to use.
    // The 'default' API is used when the keyword is used alone (e.g., "#askme what is the weather?").
    // You can define other APIs and trigger them with a sub-keyword (e.g., "#askme:gemini what is a quark?").
    apis: {
        // --- Example of a custom URL API ---
        // This is the default API that will be used.
        // It should point to a POST endpoint that accepts a JSON body
        // with a "prompt" field and returns a JSON body with a "response" field.
        'default': {
            type: 'url',
            endpoint: 'YOUR_CUSTOM_API_ENDPOINT_HERE' // e.g., 'https://api.your-service.com/chat'
        },

        // --- Example for Google Gemini ---
        // To enable this, you would uncomment it and provide your API key in 'apikeys.js'.
        // The server now has the logic to handle the 'gemini' type.
        /*
        'gemini': {
            type: 'paid',
            service: 'gemini',
            // The model to use. 'gemini-1.5-flash' is a fast, multimodal model.
            model: 'gemini-1.5-flash',
            apiKey: apiKeys.gemini
        },
        */

        // --- Example for Mistral AI ---
        // To enable this, you would uncomment it and provide your API key in 'apikeys.js'.
        // You would also need to add the logic to handle the 'mistral' type in server.js.
        /*
        'mistral': {
            type: 'paid',
            service: 'mistral',
            apiKey: apiKeys.mistral
        },
        */
    }
};

module.exports = chatbotConfig;
