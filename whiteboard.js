// IIFE to encapsulate the whiteboard logic
(() => {
    // Wait for the main script to be loaded and the socket to be available
    document.addEventListener('DOMContentLoaded', () => {
        const whiteboardContainer = document.getElementById('whiteboard-container');
        if (!whiteboardContainer) {
            console.error("Whiteboard container not found!");
            return;
        }

        if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
            console.error("React or ReactDOM is not loaded!");
            return;
        }

        const e = React.createElement;
        let ExcalidrawComponent;

        if (window.ExcalidrawLib && window.ExcalidrawLib.Excalidraw) {
            ExcalidrawComponent = window.ExcalidrawLib.Excalidraw;
        } else if (window.Excalidraw && window.Excalidraw.Excalidraw) {
            ExcalidrawComponent = window.Excalidraw.Excalidraw;
        } else {
            console.error("Excalidraw component not found on window object!");
            whiteboardContainer.innerHTML = '<p>Error: Whiteboard library could not be loaded.</p>';
            return;
        }


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
