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
- **Audio Control**: Remote video streams start muted. Users can click on a video to enable the audio for that specific person.
- **Global Media Controls**: A dedicated control bar on the right side of the screen allows users to toggle their own microphone and camera on or off. The buttons turn red to indicate when a device is muted or disabled.

### 5. AI Chatbot
The chat is integrated with a configurable AI chatbot.
- **Command-based Triggers**: Users can activate the chatbot by starting a message with a configured command (e.g., `#ask` or `#gemini`).
- **Configurable Commands**: You can define multiple commands in the `api.config.js` file. Each command word is a key that maps to a specific API configuration.
- **Custom Naming**: You can set a `displayName` in the configuration for each bot. If not set, the service name (e.g., "gemini") will be used.
- **Response Limiting**: Chatbot responses are automatically truncated to 900 characters to keep the chat tidy.
- **API Support**: The configuration file includes examples for:
  - A custom URL endpoint (triggered by `#ask`).
  - Google Gemini (triggered by `#gemini`, requires a `model` name).
  - A placeholder for Mistral AI.
- **Secure API Keys**: To use paid services, you must create an `apikeys.js` file (from the `apikeys.js.example` template) and add your secret keys. This file is ignored by git to keep your keys safe.
- **Dice Buttons**: Buttons for rolling 4, 6, 10, 20, and 100-sided dice.
- **Public Results**: The dice roll result is posted to the chat for all users to see.
- **Critical Roll Styling**: Dice rolls for the minimum (1) or maximum possible value are highlighted in green and red, respectively, to easily spot critical successes and failures.

### 4. Main Display & Menu
The central area is designed for displaying primary content.
- **macOS-style Menu Bar**: At the bottom of the central panel, a sleek menu bar provides navigation options for "Carte", "PJ", and "Prez" (currently placeholders for future features).
