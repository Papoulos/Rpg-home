import React, { useState } from 'react';
import Linkify from 'react-linkify';

const Chat = ({ userProfile, messages, addMessage }) => {
    const [newMessage, setNewMessage] = useState('');

    const handleSendMessage = () => {
        if (newMessage.trim() === '' || !userProfile) {
            return;
        }

        const message = {
            type: 'text',
            user: userProfile,
            text: newMessage,
            timestamp: new Date(),
        };

        addMessage(message);
        setNewMessage('');
    };

    const componentDecorator = (href, text, key) => (
        <a href={href} key={key} target="_blank" rel="noopener noreferrer">
            {text}
        </a>
    );

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
            <div className="message-input" style={{ display: 'flex', padding: '10px' }}>
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    style={{ flexGrow: 1, padding: '8px', borderRadius: '8px', border: '1px solid #ccc' }}
                    placeholder="Type a message..."
                    disabled={!userProfile}
                />
                <button onClick={handleSendMessage} disabled={!userProfile} style={{ padding: '8px 16px', marginLeft: '10px', borderRadius: '8px', border: 'none', backgroundColor: '#007bff', color: 'white', cursor: 'pointer' }}>Send</button>
            </div>
        </div>
    );
};

export default Chat;
