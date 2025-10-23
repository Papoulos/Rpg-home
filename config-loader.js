const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const fs = require('fs');

const GCS_SECRET_NAME_API_KEYS = process.env.GCS_SECRET_NAME_API_KEYS;
const GCS_SECRET_NAME_CHAT_CONFIG = process.env.GCS_SECRET_NAME_CHAT_CONFIG;

async function accessSecretVersion(name) {
    try {
        const client = new SecretManagerServiceClient();
        const [version] = await client.accessSecretVersion({ name });
        const payload = version.payload.data.toString('utf8');
        console.log(`[CONFIG] Successfully accessed secret: ${name}`);
        return payload;
    } catch (error) {
        console.error(`[CONFIG] Failed to access secret ${name}. Error: ${error.message}`);
        // In a real production scenario, you might want to handle this more gracefully.
        // For now, we'll let it fail loudly to indicate a misconfiguration.
        throw error;
    }
}

async function loadApiKeys() {
    // 1. Try Google Cloud Secret Manager
    if (GCS_SECRET_NAME_API_KEYS) {
        console.log('[CONFIG] Attempting to load API keys from Google Cloud Secret Manager...');
        const secretPayload = await accessSecretVersion(GCS_SECRET_NAME_API_KEYS);
        try {
            return JSON.parse(secretPayload);
        } catch (e) {
            console.error('[CONFIG] Failed to parse API keys from Secret Manager. Ensure it is valid JSON.');
            throw e;
        }
    }

    // 2. Try Environment Variables
    const apiKeysFromEnv = {};
    const apiKeyPrefix = 'APIKEY_';
    for (const envVar in process.env) {
        if (envVar.startsWith(apiKeyPrefix)) {
            const keyName = envVar.substring(apiKeyPrefix.length).toLowerCase();
            apiKeysFromEnv[keyName] = process.env[envVar];
        }
    }
    if (Object.keys(apiKeysFromEnv).length > 0) {
        console.log('[CONFIG] Loaded API keys from environment variables.');
        return apiKeysFromEnv;
    }

    // 3. Fallback to local file
    try {
        const localKeys = require('./apikeys.js');
        console.log('[CONFIG] Loaded local API keys from apikeys.js');
        return localKeys;
    } catch (e) {
        console.warn('[CONFIG] No apikeys.js file or APIKEY_ variables found. Paid features may be disabled.');
        return {};
    }
}

async function loadChatbotConfig(baseConfig) {
    // This function will merge configs over the base config.
    let finalConfig = { ...baseConfig };

    // 1. Try Google Cloud Secret Manager for user config
    if (GCS_SECRET_NAME_CHAT_CONFIG) {
        console.log('[CONFIG] Attempting to load user chatbot config from Google Cloud Secret Manager...');
        const secretPayload = await accessSecretVersion(GCS_SECRET_NAME_CHAT_CONFIG);
        try {
            const userConfig = JSON.parse(secretPayload);
            Object.assign(finalConfig, userConfig);
            console.log('[CONFIG] Merged user chatbot config from Secret Manager.');
        } catch (e) {
            console.error('[CONFIG] Failed to parse user chatbot config from Secret Manager. Ensure it is valid JSON.');
            throw e;
        }
    }

    // 2. Check for dedicated environment variables for a custom bot (can override GCS config if needed)
    const customBotUrl = process.env.CUSTOMBOT_URL;
    const customBotKey = process.env.CUSTOMBOT_KEY;

    if (customBotUrl && customBotKey) {
        finalConfig['#ubot'] = {
            type: 'paid',
            service: 'openai-compatible',
            displayName: 'Custom Bot',
            model: 'chat',
            apiKey: customBotKey,
            endpoint: customBotUrl,
            systemPrompt: 'You are a helpful assistant.'
        };
        console.log('[CONFIG] Dynamically configured custom chatbot from CUSTOMBOT_URL and CUSTOMBOT_KEY.');
    }

    return finalConfig;
}

module.exports = {
    loadApiKeys,
    loadChatbotConfig
};