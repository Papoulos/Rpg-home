import React, { useState, useRef, useEffect } from 'react';
import Linkify from 'react-linkify';

const Chat = ({ userProfile, messages, addMessage }) => {
    const [newMessage, setNewMessage] = useState('');
    const [keywords, setKeywords] = useState([]);
    const imageInputRef = useRef(null);

    useEffect(() => {
        // Fetch keywords from the backend
        const fetchKeywords = async () => {
            try {
                const response = await fetch('/api/chatbot-keywords');
                const data = await response.json();
                setKeywords(data);
            } catch (error) {
                console.error("Error fetching keywords:", error);
            }
        };
        fetchKeywords();
    }, []);

    const handleSendMessage = async () => {
        if (newMessage.trim() === '' || !userProfile) {
            return;
        }

        const trimmedMessage = newMessage.trim();
        const keyword = keywords.find(kw => trimmedMessage.startsWith(kw));

        if (keyword) {
            const question = trimmedMessage.substring(keyword.length).trim();
            if (question) {
                // Display the user's question immediately
                const userMessage = {
                    type: 'text',
                    user: userProfile,
                    text: newMessage,
                    timestamp: new Date(),
                };
                addMessage(userMessage);
                setNewMessage('');

                try {
                    const response = await fetch('/api/chatbot', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ keyword, question }),
                    });
                    const data = await response.json();

                    const chatbotMessage = {
                        type: 'text',
                        user: { name: 'Chatbot', icon: '🤖' },
                        text: data.answer,
                        timestamp: new Date(),
                    };
                    addMessage(chatbotMessage);
                } catch (error) {
                    console.error("Error fetching chatbot response:", error);
                    const errorMessage = {
                        type: 'text',
                        user: { name: 'Chatbot', icon: '🤖' },
                        text: 'Sorry, I encountered an error.',
                        timestamp: new Date(),
                    };
                    addMessage(errorMessage);
                }
            }
        } else {
            const message = {
                type: 'text',
                user: userProfile,
                text: newMessage,
                timestamp: new Date(),
            };
            addMessage(message);
            setNewMessage('');
        }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file || !userProfile) return;

        const reader = new FileReader();
        reader.onload = () => {
            const message = {
                type: 'image',
                user: userProfile,
                src: reader.result,
                timestamp: new Date(),
            };
            addMessage(message);
        };
        reader.readAsDataURL(file);
        e.target.value = null; // Reset file input
    };

    const componentDecorator = (href, text, key) => (
        <a href={href} key={key} target="_blank" rel="noopener noreferrer">
            {text}
        </a>
    );

    const buttonStyle = {
        padding: '8px 16px',
        marginLeft: '10px',
        borderRadius: '8px',
        border: 'none',
        backgroundColor: '#007bff',
        color: 'white',
        cursor: 'pointer'
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flexGrow: 1, overflowY: 'auto', padding: '10px' }}>
                {userProfile ? (
                    <div style={{ marginBottom: '10px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
                        <span style={{ fontSize: '2rem', marginRight: '10px', verticalAlign: 'middle' }}>{userProfile.icon}</span>
                        <strong style={{ verticalAlign: 'middle' }}>{userProfile.name}</strong>
                    </div>
                ) : (
                    <h2>Chat</h2>
                )}
                <div className="message-list">
                    {messages.map((msg, index) => {
                        if (msg.type === 'dice') {
                            return (
                                <div key={index} style={{ fontStyle: 'italic', color: '#666', marginBottom: '10px', display: 'flex', alignItems: 'center' }}>
                                    <span style={{ fontSize: '1.5rem', marginRight: '8px' }}>{msg.user.icon}</span>
                                    <span><strong>{msg.user.name}</strong> {msg.text}</span>
                                </div>
                            );
                        }
                        if (msg.type === 'image') {
                            return (
                                <div key={index} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '10px' }}>
                                    <span style={{ fontSize: '1.5rem', marginRight: '8px' }}>{msg.user.icon}</span>
                                    <div>
                                        <strong>{msg.user.name}</strong>
                                        <img src={msg.src} alt="uploaded by user" style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '4px' }} />
                                    </div>
                                </div>
                            );
                        }
                        return (
                            <div key={index} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '10px' }}>
                                <span style={{ fontSize: '1.5rem', marginRight: '8px' }}>{msg.user.icon}</span>
                                <div>
                                    <strong>{msg.user.name}</strong>
                                    <p style={{ margin: 0 }}>
                                        <Linkify componentDecorator={componentDecorator}>{msg.text}</Linkify>
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            <div className="message-input" style={{ display: 'flex', alignItems: 'center', padding: '10px' }}>
                <input
                    type="file"
                    ref={imageInputRef}
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                    accept="image/*"
                />
                <button
                    onClick={() => imageInputRef.current.click()}
                    disabled={!userProfile}
                    style={{ ...buttonStyle, backgroundColor: '#6c757d', marginLeft: 0 }}
                    title="Upload Image"
                >
                    📷
                </button>
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    style={{ flexGrow: 1, padding: '8px', borderRadius: '8px', border: '1px solid #ccc', marginLeft: '10px' }}
                    placeholder="Type a message..."
                    disabled={!userProfile}
                />
                <button onClick={handleSendMessage} disabled={!userProfile} style={buttonStyle}>Send</button>
            </div>
        </div>
    );
};

export default Chat;
