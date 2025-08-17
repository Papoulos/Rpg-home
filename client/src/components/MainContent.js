import React from 'react';
import GoogleSheetPage from './GoogleSheetPage';
import ImagePage from './ImagePage';
import WhiteboardPage from './WhiteboardPage';

const MainContent = ({ activePage, socket }) => {
    const renderPage = () => {
        switch (activePage) {
            case 'carte':
                return <WhiteboardPage socket={socket} />;
            case 'pj':
                return <GoogleSheetPage />;
            case 'prez':
                return <ImagePage />;
            default:
                return <WhiteboardPage socket={socket} />;
        }
    };

    return (
        <div style={{ height: '100%', overflowY: 'auto' }}>
            {renderPage()}
        </div>
    );
};

export default MainContent;
