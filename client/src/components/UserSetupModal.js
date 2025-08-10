import React, { useState } from 'react';

const icons = ['🧙', '🧝', '🧛', '🧟', '🧞', '🧑‍🚀'];

const modalStyles = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    zIndex: 1000,
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
};

const backdropStyles = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999
};

const UserSetupModal = ({ onSave }) => {
    const [name, setName] = useState('');
    const [selectedIcon, setSelectedIcon] = useState(icons[0]);

    const handleSave = () => {
        if (name.trim() === '') {
            alert('Please enter a name.');
            return;
        }
        onSave({ name, icon: selectedIcon });
    };

    return (
        <>
            <div style={backdropStyles}></div>
            <div style={modalStyles}>
                <h2>Create Your Character</h2>
                <div>
                    <label>
                        Name:
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            style={{ marginLeft: '10px', padding: '5px' }}
                        />
                    </label>
                </div>
                <div style={{ marginTop: '10px' }}>
                    <label>
                        Icon:
                        <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                            {icons.map(icon => (
                                <span
                                    key={icon}
                                    onClick={() => setSelectedIcon(icon)}
                                    style={{
                                        cursor: 'pointer',
                                        fontSize: '2rem',
                                        border: selectedIcon === icon ? '2px solid blue' : '2px solid transparent',
                                        borderRadius: '50%',
                                        padding: '5px'
                                    }}
                                >
                                    {icon}
                                </span>
                            ))}
                        </div>
                    </label>
                </div>
                <button
                    onClick={handleSave}
                    style={{ marginTop: '20px', padding: '10px 20px', cursor: 'pointer' }}
                >
                    Save
                </button>
            </div>
        </>
    );
};

export default UserSetupModal;
