import React from 'react';
import GoogleSheetPage from './GoogleSheetPage';
import ImagePage from './ImagePage';
import MarkdownPage from './MarkdownPage';
import WhiteboardPage from './WhiteboardPage';

const MainContent = ({ activePage }) => {
    const renderPage = () => {
        switch (activePage) {
            case 'sheets':
                return <GoogleSheetPage />;
            case 'image':
                return <ImagePage />;
            case 'markdown':
                return <MarkdownPage />;
            case 'whiteboard':
                return <WhiteboardPage />;
            default:
                return <GoogleSheetPage />;
        }
    };

    return (
        <div style={{ height: '100%', overflowY: 'auto' }}>
            {renderPage()}
        </div>
    );
};

export default MainContent;
