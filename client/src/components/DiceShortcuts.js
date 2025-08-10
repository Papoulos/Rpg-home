import React from 'react';

const DiceShortcuts = ({ userProfile, addMessage }) => {
    const handleDiceRoll = (sides) => {
        if (!userProfile) {
            alert('Please set your character name first.');
            return;
        }

        const result = Math.floor(Math.random() * sides) + 1;
        const message = {
            type: 'dice',
            user: userProfile,
            text: `rolled a d${sides} and got ${result}`,
            timestamp: new Date(),
        };
        addMessage(message);
    };

    const buttonStyle = {
        padding: '8px 12px',
        margin: '4px',
        borderRadius: '8px',
        border: '1px solid #ccc',
        cursor: 'pointer'
    };

    return (
        <>
            <h3>Dice Shortcuts</h3>
            <div>
                <button onClick={() => handleDiceRoll(4)} style={buttonStyle}>d4</button>
                <button onClick={() => handleDiceRoll(6)} style={buttonStyle}>d6</button>
                <button onClick={() => handleDiceRoll(8)} style={buttonStyle}>d8</button>
                <button onClick={() => handleDiceRoll(10)} style={buttonStyle}>d10</button>
                <button onClick={() => handleDiceRoll(12)} style={buttonStyle}>d12</button>
                <button onClick={() => handleDiceRoll(20)} style={buttonStyle}>d20</button>
            </div>
        </>
    );
};

export default DiceShortcuts;
