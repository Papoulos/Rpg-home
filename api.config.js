// This file configures the chatbot APIs.
// You can define multiple APIs and associate them with specific keywords.

// Each API configuration is an object with the following properties:
// - type: 'paid' or 'url'.
//   - 'paid': For services like OpenAI, Mistral, Gemini, etc.
//             You will need to handle the API calls in server.js using their respective libraries.
//   - 'url': For APIs that can be reached via a simple POST request to a URL.
// - keywords: An array of strings that trigger this API. Keywords must start with '#'.
// - url (only for type: 'url'): The URL to which the request will be forwarded.
// - serviceName (only for type: 'paid'): A descriptive name for the paid service.

const apiConfig = {
    // Default chatbot, triggered by #askme
    askme: {
        type: 'url',
        keywords: ['#askme'],
        url: 'http://localhost:5000/api/chatbot_placeholder', // This is a placeholder URL
    },

    // --- Examples for adding new APIs ---

    // Example for adding Gemini
    // gemini: {
    //     type: 'paid',
    //     keywords: ['#gemini'],
    //     serviceName: 'Gemini', // API URL: https://generativelanguage.googleapis.com
    // },

    // Example for adding OpenAI
    // openai: {
    //     type: 'paid',
    //     keywords: ['#openai'],
    //     serviceName: 'OpenAI', // API URL: https://api.openai.com/v1
    // },

    // Example for adding Mistral
    // mistral: {
    //     type: 'paid',
    //     keywords: ['#mistral'],
    //     serviceName: 'Mistral', // API URL: https://api.mistral.ai/v1
    // },

    // Example for adding a custom URL-based chatbot
    // customBot: {
    //     type: 'url',
    //     keywords: ['#custom'],
    //     url: 'http://your-custom-chatbot-api.com/chat',
    // },
};

module.exports = apiConfig;
