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

        const handleBackgroundImage = (event) => {
            if (!canvas || !event.target.files || event.target.files.length === 0) {
                return;
            }
            const file = event.target.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target.result;

                // Send to other clients
                if (window.socket && window.socket.readyState === WebSocket.OPEN) {
                    window.socket.send(JSON.stringify({
                        type: 'fabric-set-background',
                        payload: dataUrl
                    }));
                }

                // Apply locally
                setBackground(dataUrl);
            };
            reader.readAsDataURL(file);
        };

        const setBackground = (dataUrl) => {
            fabric.Image.fromURL(dataUrl, (img) => {
                canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
                    scaleX: canvas.width / img.width,
                    scaleY: canvas.height / img.height
                });
            });
        };

        window.addEventListener('fabric-remote-set-background', (event) => {
            if (canvas) {
                const dataUrl = event.detail.payload;
                setBackground(dataUrl);
            }
        });

        const fileInput = document.getElementById('fabric-background-image-input');
        if (fileInput) {
            fileInput.addEventListener('change', handleBackgroundImage);
        }
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
