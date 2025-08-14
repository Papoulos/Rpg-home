import React from 'react';

const MenuBar = ({ onReset, onPageChange, onToggleChat, onToggleVideo }) => {
    const buttonStyle = {
        padding: '10px 20px',
        margin: '0 5px',
        borderRadius: '8px',
        border: '1px solid #ccc',
        cursor: 'pointer',
        backgroundColor: 'white'
    };

    return (
        <div style={{ display: 'flex', width: '100%' }}>
            <button onClick={() => onPageChange('sheets')} style={buttonStyle}>Google Sheet</button>
            <button onClick={() => onPageChange('image')} style={buttonStyle}>Image</button>
            <button onClick={() => onPageChange('markdown')} style={buttonStyle}>Notes</button>
            <button onClick={() => onPageChange('whiteboard')} style={buttonStyle}>Whiteboard</button>
            <button onClick={onToggleChat} style={buttonStyle}>Toggle Chat</button>
            <button onClick={onToggleVideo} style={buttonStyle}>Toggle Video</button>
            <button onClick={onReset} style={{ ...buttonStyle, marginLeft: 'auto' }}>Reset Profile</button>
        </div>
    );
};

export default MenuBar;
