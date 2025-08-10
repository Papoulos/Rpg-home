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
