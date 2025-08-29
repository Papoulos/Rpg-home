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
    The server will start and be accessible at `https://localhost:3000`.

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

1.  **Create `apikeys.js` (if needed)**

    If you are using a service that requires an API key, create a file named `apikeys.js` and export your keys using `module.exports`.

    *Example `apikeys.js`:*
    ```javascript
    module.exports = {
        gemini: 'YOUR_GEMINI_API_KEY',
        custombot: 'YOUR_CUSTOM_BOT_API_KEY'
    };
    ```

2.  **Edit `api.config.js`**

    Open `api.config.js` and add or uncomment a configuration block for the chatbot you want to use. The key of the object (e.g., `'#ask'`) is the command that triggers the bot.

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
