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
  const [activePage, setActivePage] = useState('carte');
  const socket = useRef(null);
  const [showChat, setShowChat] = useState(true);
  const [showVideo, setShowVideo] = useState(true);

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

  const toggleChat = () => setShowChat(!showChat);
  const toggleVideo = () => setShowVideo(!showVideo);

  const getGridLayout = () => {
    if (showChat && showVideo) {
      return '1fr 3fr 1fr';
    } else if (showChat) {
      return '1fr 3fr 0';
    } else if (showVideo) {
      return '0 3fr 1fr';
    } else {
      return '0 1fr 0';
    }
  };

  return (
    <>
      {showModal && <UserSetupModal onSave={handleSaveProfile} />}
      <div className="app-layout" style={{ gridTemplateColumns: getGridLayout() }}>
        {showChat && (
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
        )}
        <div className="center-column">
          <div className="main-content-area">
            <MainContent activePage={activePage} socket={socket.current} />
          </div>
          <div className="menu-bar-area">
            <MenuBar
              onReset={handleResetProfile}
              onPageChange={handlePageChange}
              onToggleChat={toggleChat}
              onToggleVideo={toggleVideo}
            />
          </div>
        </div>
        {showVideo && (
          <div className="right-column">
            <div className="video-chat-area">
              <VideoChat socket={socket.current} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default App;
