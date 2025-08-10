import React from 'react';

const Chat = ({ userProfile }) => {
    return (
        <>
            {userProfile ? (
                <div style={{ marginBottom: '10px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
                    <span style={{ fontSize: '2rem', marginRight: '10px', verticalAlign: 'middle' }}>{userProfile.icon}</span>
                    <strong style={{ verticalAlign: 'middle' }}>{userProfile.name}</strong>
                </div>
            ) : (
                <h2>Chat</h2>
            )}
            {/* Chat messages will go here */}
        </>
    );
};

export default Chat;
