import React from 'react';
import './MenuBar.css';

const MenuBar = ({ onReset, onPageChange, onToggleChat, onToggleVideo }) => {
    return (
        <div className="menu-bar">
            <button onClick={() => onPageChange('sheets')} className="menu-button">Google Sheet</button>
            <button onClick={() => onPageChange('image')} className="menu-button">Image</button>
            <button onClick={() => onPageChange('markdown')} className="menu-button">Notes</button>
            <button onClick={() => onPageChange('whiteboard')} className="menu-button">Whiteboard</button>
            <button onClick={onToggleChat} className="menu-button">Toggle Chat</button>
            <button onClick={onToggleVideo} className="menu-button">Toggle Video</button>
            <button onClick={onReset} className="menu-button reset-button">Reset Profile</button>
        </div>
    );
};

export default MenuBar;
