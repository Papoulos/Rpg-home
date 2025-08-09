import React from 'react';
import './Layout.css'; // Import the new layout CSS
import Chat from './components/Chat';
import MainContent from './components/MainContent';
import MenuBar from './components/MenuBar';
import DiceShortcuts from './components/DiceShortcuts';
import VideoChat from './VideoChat';

function App() {
  return (
    <div className="app-layout">
      <div className="left-column">
        <div className="chat-area">
          <Chat />
        </div>
        <div className="dice-shortcuts-area">
          <DiceShortcuts />
        </div>
      </div>
      <div className="center-column">
        <div className="main-content-area">
          <MainContent />
        </div>
        <div className="menu-bar-area">
          <MenuBar />
        </div>
      </div>
      <div className="right-column">
        <div className="video-chat-area">
          <VideoChat />
        </div>
      </div>
    </div>
  );
}

export default App;
