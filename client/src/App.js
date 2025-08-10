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

  const addMessage = (message) => {
    setMessages(prevMessages => [...prevMessages, message]);
  };

  useEffect(() => {
    const savedProfile = Cookies.get('userProfile');
    if (savedProfile) {
      setUserProfile(JSON.parse(savedProfile));
    } else {
      setShowModal(true);
    }
  }, []);

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
            <MainContent />
          </div>
          <div className="menu-bar-area">
            <MenuBar onReset={handleResetProfile} />
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
