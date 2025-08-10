import React from 'react';

const MenuBar = ({ onReset }) => {
    return (
        <>
            {/* Menu items will go here */}
            <button>Character Sheets</button>
            <button>Scene</button>
            <button>Whiteboard</button>
            <button onClick={onReset} style={{ marginLeft: 'auto' }}>Reset Profile</button>
        </>
    );
};

export default MenuBar;
