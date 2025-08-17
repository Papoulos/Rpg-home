import React from 'react';
import './MenuBar.css';

const MenuBar = ({ onReset, onPageChange, onToggleChat, onToggleVideo }) => {
    return (
        <div className="menu-bar">
            <button onClick={() => onPageChange('carte')} className="menu-button">Carte</button>
            <button onClick={() => onPageChange('pj')} className="menu-button">PJ</button>
            <button onClick={() => onPageChange('prez')} className="menu-button">Prez</button>
            <button onClick={onToggleChat} className="menu-button">Toggle Chat</button>
            <button onClick={onToggleVideo} className="menu-button">Toggle Video</button>
            <button onClick={onReset} className="menu-button reset-button">Reset Profile</button>
        </div>
    );
};

export default MenuBar;
