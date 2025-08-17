# RPG Web Application

This is a web application for playing tabletop role-playing games (RPGs) with friends online. It provides a set of tools to facilitate remote gameplay, including video calling, chat, and more.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

You need to have [Node.js](https://nodejs.org/) and [npm](https://www.npmjs.com/) installed on your machine.

### Installation

1.  **Clone the repository**

    If you haven't already, clone the repository to your local machine.

2.  **Install server dependencies**

    From the root directory of the project, run the following command to install the dependencies for the Express server:
    ```sh
    npm install
    ```

3.  **Install client dependencies**

    Navigate to the `client` directory and install the dependencies for the React application:
    ```sh
    npm install --prefix client
    ```

## Running the application

You will need to run both the server and the client in separate terminal windows.

1.  **Start the server**

    From the root directory, run the following command to start the Express server:
    ```sh
    npm start
    ```
    The server will start on `http://localhost:5000`.

2.  **Start the client**

    In a new terminal, from the root directory, run the following command to start the React development server:
    ```sh
    npm start --prefix client
    ```
    The client application will start on `http://localhost:3000` and should open automatically in your default web browser.

## Features

This application includes a range of features designed to facilitate online RPG sessions.

### User Profiles
- **Character Profile**: On first visit, users are prompted to create a character by setting a name and choosing an icon from a predefined list.
- **Persistent Profiles**: User profiles are saved in browser cookies, so they are remembered across sessions.
- **Profile Reset**: A "Reset Profile" option is available in the menu bar to allow users to change their name and icon.

### Layout
- **Three-Column Design**: The application uses a modern, three-column layout to organize the different tools:
  - **Left Column**: Contains the chat and dice rolling shortcuts.
  - **Center Column**: The main content area, with a menu at the bottom for switching between different views (e.g., character sheets, scenes).
  - **Right Column**: Displays the video conference feeds.

### Main Content Area
The central part of the application is a flexible space that can switch between different views.
- **Page Switching**: A menu bar at the bottom allows users to switch between different pages: Google Sheets, Image display, a notes editor, and a whiteboard.
- **Markdown Notes Editor**: A simple but effective page for taking notes.
  - **Edit/View Modes**: Users can toggle between an edit mode with a plain text area and a view mode that renders the formatted Markdown.
  - **Persistent Notes**: All notes are automatically saved to the browser's local storage, so they are not lost between sessions.

### Video Conferencing
- **Peer-to-Peer Video**: A WebRTC-based video calling feature allows users to see and hear each other.
- **Signaling Server**: A Socket.IO server is used to facilitate the initial connection between peers.

### Interactive Chat
- **Real-time Messaging**: Users can send and receive text messages in the chat panel.
- **User Identification**: Each message is clearly marked with the sender's chosen character name and icon.
- **Clickable Links**: Any web links (URLs) posted in the chat are automatically detected and made clickable.
- **Dice Rolling**: A dedicated "Dice Shortcuts" panel allows users to roll various types of dice (d4, d6, d8, d10, d12, d20). The results are posted directly to the chat for all users to see.
- **Image Sharing**: Users can upload and share images, which are displayed inline within the chat feed.
- **Persistent History**: The chat history is saved to the browser's local storage, preserving messages between sessions. The history is automatically trimmed to stay within a 5MB limit.

#### Configurable Chatbot

The application includes a chatbot feature that can be configured to use different APIs. This allows you to integrate with various AI models and services.

- **Keyword Triggers**: You can trigger the chatbot by starting a message with a specific keyword (e.g., `#askme`).
- **Configuration File**: The chatbot is configured in the `api.config.js` file in the root directory. You can define multiple APIs and associate them with different keywords.
- **API Types**: The configuration supports two types of APIs:
  - `'url'`: For APIs that can be accessed via a simple POST request to a URL.
  - `'paid'`: For services like OpenAI, Mistral, or Gemini. You will need to add your own logic to `server.js` to handle these services.
- **Examples**: The `api.config.js` file includes commented-out examples to help you get started with configuring new APIs.
