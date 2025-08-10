import React, { useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import './Layout.css';
import Chat from './components/Chat';
import MainContent from './components/MainContent';
import MenuBar from './components/MenuBar';
import DiceShortcuts from './components/DiceShortcuts';
import VideoChat from './VideoChat';
import UserSetupModal from './components/UserSetupModal';

function App() {
  const [userProfile, setUserProfile] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [messages, setMessages] = useState([]);
  const [activePage, setActivePage] = useState('sheets'); // 'sheets', 'image', 'markdown', 'whiteboard'

  const handlePageChange = (page) => {
    setActivePage(page);
  };

  // Load initial state from storage on mount
  useEffect(() => {
    // Load user profile from cookies
    const savedProfile = Cookies.get('userProfile');
    if (savedProfile) {
      try {
        setUserProfile(JSON.parse(savedProfile));
      } catch (error) {
        console.error("Failed to parse user profile from cookies", error);
        Cookies.remove('userProfile');
      }
    } else {
      setShowModal(true);
    }

    // Load chat history from local storage
    try {
      const savedMessages = localStorage.getItem('chatMessages');
      if (savedMessages) {
        setMessages(JSON.parse(savedMessages));
      }
    } catch (error) {
      console.error("Failed to load messages from local storage", error);
      localStorage.removeItem('chatMessages');
    }
  }, []);

  // Save messages to local storage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('chatMessages', JSON.stringify(messages));
    } catch (error) {
      console.error("Failed to save messages to local storage", error);
    }
  }, [messages]);

  const addMessage = (message) => {
    const updatedMessages = [...messages, message];

    // Trim messages if storage exceeds ~4.5MB
    try {
      let jsonMessages = JSON.stringify(updatedMessages);
      const MAX_SIZE_BYTES = 4.5 * 1024 * 1024;

      while (new Blob([jsonMessages]).size > MAX_SIZE_BYTES && updatedMessages.length > 1) {
        updatedMessages.shift(); // Remove the oldest message
        jsonMessages = JSON.stringify(updatedMessages);
      }
    } catch (error) {
      console.error("Error while trimming messages for storage", error);
    }

    setMessages(updatedMessages);
  };

  const handleSaveProfile = (profile) => {
    Cookies.set('userProfile', JSON.stringify(profile), { expires: 365 });
    setUserProfile(profile);
    setShowModal(false);
  };

  const handleResetProfile = () => {
    Cookies.remove('userProfile');
    setUserProfile(null);
    setShowModal(true);
  };

  return (
    <>
      {showModal && <UserSetupModal onSave={handleSaveProfile} />}
      <div className="app-layout">
        <div className="left-column">
          <div className="chat-area">
            <Chat
              userProfile={userProfile}
              messages={messages}
              addMessage={addMessage}
            />
          </div>
          <div className="dice-shortcuts-area">
            <DiceShortcuts
              userProfile={userProfile}
              addMessage={addMessage}
            />
          </div>
        </div>
        <div className="center-column">
          <div className="main-content-area">
            <MainContent activePage={activePage} />
          </div>
          <div className="menu-bar-area">
            <MenuBar onReset={handleResetProfile} onPageChange={handlePageChange} />
          </div>
        </div>
        <div className="right-column">
          <div className="video-chat-area">
            <VideoChat />
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
