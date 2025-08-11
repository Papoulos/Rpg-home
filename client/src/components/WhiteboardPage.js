import React, { useEffect, useRef } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';

const WhiteboardPage = ({ socket }) => {
    const excalidrawRef = useRef(null);
    const debounceTimeout = useRef(null);

    // Use a debounced function to send changes to the server
    const handleChange = (elements, appState) => {
        if (debounceTimeout.current) {
            clearTimeout(debounceTimeout.current);
        }
        debounceTimeout.current = setTimeout(() => {
            if (socket) {
                // We only need to sync the elements, not the entire app state
                socket.emit('whiteboard change', { elements });
            }
        }, 200); // 200ms debounce for smoother experience
    };

    useEffect(() => {
        if (socket) {
            // Handler for receiving initial data and subsequent updates
            const handleUpdate = (data) => {
                if (excalidrawRef.current) {
                    // Make sure to check if the incoming data is different to avoid loops
                    // This is a simplified check; a deep comparison might be needed for complex scenarios
                    const currentElements = excalidrawRef.current.getSceneElements();
                    if (JSON.stringify(currentElements) !== JSON.stringify(data.elements)) {
                        excalidrawRef.current.updateScene(data);
                    }
                }
            };

            // Listen for initial data load
            socket.on('whiteboard data', handleUpdate);

            // Listen for real-time updates from other clients
            socket.on('whiteboard change', handleUpdate);

            // Cleanup listeners on component unmount
            return () => {
                socket.off('whiteboard data', handleUpdate);
                socket.off('whiteboard change', handleUpdate);
                if (debounceTimeout.current) {
                    clearTimeout(debounceTimeout.current);
                }
            };
        }
    }, [socket]);

    return (
        <div style={{ height: '100%', width: '100%' }}>
            <Excalidraw
                ref={excalidrawRef}
                onChange={handleChange}
                initialData={{
                    appState: {
                        // You can set initial tool, colors, etc. here
                        viewBackgroundColor: "#ffffff",
                        currentItemStrokeColor: "#000000",
                    },
                }}
            />
        </div>
    );
};

export default WhiteboardPage;
