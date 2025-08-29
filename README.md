# RPG Web Application

This is a web application for playing tabletop role-playing games (RPGs) with friends online. It provides a set of tools to facilitate remote gameplay, built with a Node.js backend and a vanilla JavaScript frontend.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine.

### Prerequisites

You need to have [Node.js](https://nodejs.org/) and [npm](https://www.npmjs.com/) installed on your machine.

### How to Launch

1.  **Install Dependencies**

    From the root directory of the project, run the following command to install the server dependencies:
    ```sh
    npm install
    ```

2.  **Start the Server**

    Also from the root directory, run this command to start the server:
    ```sh
    node server.js
    ```

    The server will start in HTTPS mode by default.

    #### Running without SSL (for Gitpod, Codespaces, etc.)
    If you are running this application behind a reverse proxy that already provides SSL (like GitHub Codespaces or Gitpod), you may get a "502 Bad Gateway" error. To solve this, run the server with the `--nossl` flag to disable the built-in HTTPS:
    ```sh
    node server.js --nossl
    ```
    The server will start in HTTP mode and should be accessible through your proxy's secure URL.

3.  **Open the Application**

    Open your web browser and navigate to `https://localhost:3000`.

    **Note:** Since this uses a self-signed SSL certificate, your browser will show a security warning. You must click "Advanced" and "Proceed to localhost" (or similar) to continue. This is expected and safe in this local development context.

## Features

The application is built around a three-column layout designed for a typical RPG session.

### 1. Layout
- **Three-Column Design**: The application uses a modern, three-column layout to organize the different tools:
  - **Left Column (1/5 screen)**: Contains the interactive chat and dice roller.
  - **Center Column (3/5 screen)**: The main content area for displaying maps, character sheets, or presentations.
  - **Right Column (1/5 screen)**: Contains the video conference streams.
- **Collapsible Panels**: Both the left (Chat) and right (Video) panels can be collapsed and expanded using toggle buttons located in the top-left and top-right corners of the screen, allowing users to maximize the central viewing area.

### 2. Interactive Chat
The chat is the core feature of the application, powered by a WebSocket backend for real-time communication between all connected users.
- **Real-time Messaging**: All messages are broadcast to every user instantly.
- **User-Specific Colors**: Each user is automatically assigned a unique color for their username, making it easy to follow the conversation.
- **Clickable Links & Images**: URLs posted in the chat are automatically converted into clickable links. Image URLs are rendered as inline images.
- **Persistent History**: The entire chat history is saved to a `chat_history.log` file on the server. When a new user joins, the existing history is loaded.
- **History Management**: The chat history file is automatically trimmed if it grows larger than 10 MB to manage disk space.

### 3. Dice Roller
Integrated directly into the chat panel for convenience.
- **Dice Buttons**: Buttons for rolling 4, 6, 10, 20, and 100-sided dice.
- **Public Results**: The dice roll result is posted to the chat for all users to see.
- **Critical Roll Styling**: Dice rolls for the minimum (1) or maximum possible value are highlighted in green and red, respectively, to easily spot critical successes and failures.

### 4. Video Conferencing
The right-hand panel contains a multi-user video conference feature powered by WebRTC.
- **Peer-to-Peer Connections**: Establishes direct video and audio connections between all participants for low latency.
- **NAT Traversal**: Uses STUN and TURN servers to ensure connections can be made even across restrictive firewalls.
- **Audio**: Audio from all participants should be enabled by default.
- **Global Media Controls**: A set of buttons in the header of the video panel allows users to toggle their own microphone and camera on or off. The buttons turn red to indicate when a device is muted or disabled.

### 5. AI Chatbot
The chat is integrated with a configurable AI chatbot, allowing you to connect to various AI services.

- **Command-based Triggers**: Users activate a chatbot by starting a message with a configured command (e.g., `#ask`, `#gemini`, `#custombot`).
- **Configuration**: All chatbot behaviors are defined in `api.config.js`. You can add, remove, or modify chatbot configurations in this file.
- **Secure API Keys**: For services that require an API key, you must create an `apikeys.js` file in the root directory. This file is not tracked by git, keeping your keys secure.

#### How to Configure a Chatbot

There are two ways to configure chatbots:
1.  Editing the local `api.config.js` file directly.
2.  Using an external JSON file for deployment environments like Render or Docker.

**Method 1: Local Configuration (`api.config.js`)**

For local development, you can directly edit `api.config.js`. If your bot requires an API key, you should create an `apikeys.js` file (this is kept out of git).

*Example `apikeys.js`:*
```javascript
module.exports = {
    gemini: 'YOUR_GEMINI_API_KEY',
    custombot: 'YOUR_CUSTOM_BOT_API_KEY'
};
```

Then, in `api.config.js`, you can reference these keys:
```javascript
'#custombot': {
    type: 'paid',
    service: 'openai-compatible',
    apiKey: apiKeys.custombot, // References the key from apikeys.js
    //...
},
```

**Method 2: External Configuration (for Deployment)**

For deployment environments like Render, it's better to use an external configuration file. This allows you to manage your production configuration without changing the code.

1.  **Set the `CHATBOT_CONFIG_PATH` Environment Variable**

    In your deployment service (e.g., Render), set an environment variable named `CHATBOT_CONFIG_PATH` to the path of your custom configuration file. For Render's "Secret Files", this path might be `/etc/secrets/your-config-filename`.

2.  **Create a Custom Configuration File**

    Create a JSON file with your custom chatbot configurations. This file will be **merged** over the base `api.config.js`, meaning you can add new bots or override existing ones. See `custom-chatbot-config.json.example` for a template.

    *Example Custom `my-render-config.json`:*
    ```json
    {
      "#ubot": {
        "type": "paid",
        "service": "openai-compatible",
        "displayName": "U-Bot (Production)",
        "apiKey": "ENV:UBOT_API_KEY",
        "endpoint": "https://my-chatbot-url.com/v1/chat/completions"
      }
    }
    ```

3.  **Provide API Keys via Environment Variables**

    In your custom JSON file, for any `apiKey`, use the format `"ENV:YOUR_ENV_VARIABLE_NAME"`. The server will replace this placeholder with the actual value of the environment variable at runtime.

    In the example above, you would need to set an environment variable named `UBOT_API_KEY` in your deployment service with the actual secret key. This is the most secure way to handle API keys in production.

    The application supports several service types:

    **A) `url` type (Simple Custom API)**
    This type sends a POST request to a custom endpoint with a simple JSON payload: `{ "prompt": "user's message" }`.

    *Example Configuration:*
    ```javascript
    '#ask': {
        type: 'url',
        displayName: 'Assistant',
        endpoint: 'https://api.your-service.com/chat'
    },
    ```

    **B) `openai-compatible` type (Advanced Custom API)**
    This type is for services that are compatible with the OpenAI `v1/chat/completions` API format. It sends a more complex JSON payload and requires an API key.

    *Example Configuration:*
    ```javascript
    '#custombot': {
        type: 'paid',
        service: 'openai-compatible',
        displayName: 'Custom Bot',
        model: 'chat-model-name',
        apiKey: apiKeys.custombot, // This must match a key in apikeys.js
        endpoint: 'http://YOUR_BOT_URL/v1/chat/completions',
        systemPrompt: 'You are a helpful assistant.'
    },
    ```

    **C) `gemini` type (Google Gemini)**
    This type is specifically for Google's Gemini models.

    *Example Configuration:*
    ```javascript
    '#gemini': {
        type: 'paid',
        service: 'gemini',
        model: 'gemini-1.5-flash',
        apiKey: apiKeys.gemini // This must match a key in apikeys.js
    },
    ```

    **Important**: When adding a new configuration block, ensure it is separated from the previous block by a **comma (`,`)**, as shown in the examples.

### 6. Main Display & Menu
The central area is designed for displaying primary content.
- **macOS-style Menu Bar**: At the bottom of the central panel, a sleek menu bar provides navigation options for "Carte", "PJ", and "Prez" (currently placeholders for future features).
