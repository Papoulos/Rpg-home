// IIFE to encapsulate the whiteboard logic
(() => {
    // Wait for the main script to be loaded and the socket to be available
    document.addEventListener('DOMContentLoaded', () => {
        const whiteboardContainer = document.getElementById('whiteboard-container');
        if (!whiteboardContainer) return;

        const e = React.createElement;
        const Excalidraw = window.Excalidraw.Excalidraw;

        const Whiteboard = () => {
            const [excalidrawAPI, setExcalidrawAPI] = React.useState(null);

            const onChange = (elements, appState, files) => {
                if (window.socket && window.socket.readyState === WebSocket.OPEN) {
                    // Avoid broadcasting initial empty state or excessive updates
                    if (elements.length > 0 || appState.collaborators.size > 0) {
                        window.socket.send(JSON.stringify({
                            type: 'whiteboard-update',
                            payload: { elements, appState }
                        }));
                    }
                }
            };

            React.useEffect(() => {
                const handleRemoteUpdate = (event) => {
                    if (excalidrawAPI) {
                        const { elements, appState } = event.detail.payload;
                        // To prevent feedback loops, we check if the incoming data is different
                        // This is a simplistic check; a more robust solution might involve versioning
                        if (JSON.stringify(elements) !== JSON.stringify(excalidrawAPI.getSceneElements())) {
                            excalidrawAPI.updateScene({ elements, appState, commitToHistory: false });
                        }
                    }
                };

                window.addEventListener('whiteboard-remote-update', handleRemoteUpdate);

                // Clean up the event listener when the component unmounts
                return () => {
                    window.removeEventListener('whiteboard-remote-update', handleRemoteUpdate);
                };
            }, [excalidrawAPI]);


            return e(
                React.Fragment,
                null,
                e(Excalidraw, {
                    excalidrawAPI: setExcalidrawAPI,
                    onChange: onChange,
                    initialData: {
                        appState: { viewBackgroundColor: "#ffffff" }
                    }
                })
            );
        };

        ReactDOM.render(e(Whiteboard), whiteboardContainer);
    });
})();
