import React, { useState, useEffect, useRef } from 'react';
import Cookies from 'js-cookie';
import io from 'socket.io-client';
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
  const [activePage, setActivePage] = useState('sheets');
  const socket = useRef(null);

  // Setup socket connection and listeners
  useEffect(() => {
    // Connect to the server
    socket.current = io.connect("http://localhost:5000");

    // Listen for initial chat history
    socket.current.on('chat history', (history) => {
      setMessages(history);
    });

    // Listen for new messages
    socket.current.on('new message', (message) => {
      setMessages(prevMessages => [...prevMessages, message]);
    });

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

    // Cleanup on unmount
    return () => {
      socket.current.disconnect();
    };
  }, []);

  const addMessage = (message) => {
    if (socket.current) {
      socket.current.emit('new message', message);
    }
  };

  const handlePageChange = (page) => {
    setActivePage(page);
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
            <VideoChat socket={socket.current} />
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
