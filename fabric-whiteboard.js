(() => {
    let canvas = null;

    const initializeCanvas = () => {
        if (canvas) return;

        const fabricContent = document.getElementById('fabric-content');
        const canvasElement = document.getElementById('fabric-canvas');

        if (!fabricContent || !canvasElement) return;

        // Set canvas dimensions to match its container
        const containerRect = fabricContent.getBoundingClientRect();
        canvasElement.width = containerRect.width;
        canvasElement.height = containerRect.height;

        canvas = new fabric.Canvas('fabric-canvas', {
            isDrawingMode: true,
        });

        canvas.freeDrawingBrush.width = 5;
        canvas.freeDrawingBrush.color = '#ffffff';

        // --- Collaboration Logic ---
        canvas.on('path:created', (e) => {
            const path = e.path;
            const pathJson = path.toJSON();
            if (window.socket && window.socket.readyState === WebSocket.OPEN) {
                window.socket.send(JSON.stringify({
                    type: 'fabric-path-created',
                    payload: pathJson
                }));
            }
        });

        window.addEventListener('fabric-remote-path-created', (event) => {
            if (canvas) {
                const pathJson = event.detail.payload;
                fabric.util.enlivenObjects([pathJson], function (objects) {
                    objects.forEach(function (obj) {
                        canvas.add(obj);
                    });
                    canvas.renderAll();
                });
            }
        });
    };

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const target = mutation.target;
                if (target.id === 'fabric-content' && target.style.display !== 'none') {
                    initializeCanvas();
                }
            }
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        const fabricContent = document.getElementById('fabric-content');
        if (fabricContent) {
            observer.observe(fabricContent, { attributes: true });
            // Initial check in case the tab is already visible on load
            if (fabricContent.style.display !== 'none') {
                initializeCanvas();
            }
        }
    });
})();
