(() => {
    let canvas = null;
    let activeTool = 'pencil';

    const setActiveTool = (tool) => {
        activeTool = tool;
        if (canvas) {
            canvas.isDrawingMode = tool === 'pencil';
        }
    };

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

        const handleImageInput = (event) => {
            if (!canvas || !event.target.files || event.target.files.length === 0) {
                return;
            }
            const file = event.target.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target.result;
                fabric.Image.fromURL(dataUrl, (img) => {
                    canvas.add(img);
                    if (window.socket && window.socket.readyState === WebSocket.OPEN) {
                        window.socket.send(JSON.stringify({
                            type: 'fabric-add-object',
                            payload: img.toJSON()
                        }));
                    }
                });
            };
            reader.readAsDataURL(file);
        };

        const imageInput = document.getElementById('fabric-image-input');
        if (imageInput) {
            imageInput.addEventListener('change', handleImageInput);
        }

        // --- Drawing Logic ---
        let isDrawing = false;
        let startX, startY, currentShape;

        canvas.on('mouse:down', (o) => {
            if (activeTool === 'pencil' || !o.pointer) return;
            isDrawing = true;
            startX = o.pointer.x;
            startY = o.pointer.y;

            switch (activeTool) {
                case 'line':
                    currentShape = new fabric.Line([startX, startY, startX, startY], {
                        stroke: '#ffffff',
                        strokeWidth: 2
                    });
                    break;
                case 'rect':
                    currentShape = new fabric.Rect({
                        left: startX,
                        top: startY,
                        width: 0,
                        height: 0,
                        stroke: '#ffffff',
                        strokeWidth: 2,
                        fill: 'transparent'
                    });
                    break;
                case 'circle':
                    currentShape = new fabric.Circle({
                        left: startX,
                        top: startY,
                        radius: 0,
                        stroke: '#ffffff',
                        strokeWidth: 2,
                        fill: 'transparent'
                    });
                    break;
            }
            if (currentShape) {
                canvas.add(currentShape);
            }
        });

        canvas.on('mouse:move', (o) => {
            if (!isDrawing || !currentShape || !o.pointer) return;
            const endX = o.pointer.x;
            const endY = o.pointer.y;

            switch (activeTool) {
                case 'line':
                    currentShape.set({ x2: endX, y2: endY });
                    break;
                case 'rect':
                    currentShape.set({
                        width: endX - startX,
                        height: endY - startY
                    });
                    break;
                case 'circle':
                    currentShape.set({ radius: Math.abs(endX - startX) / 2 });
                    break;
            }
            canvas.renderAll();
        });

        canvas.on('mouse:up', () => {
            if (isDrawing && currentShape) {
                const shapeJson = currentShape.toJSON();
                if (window.socket && window.socket.readyState === WebSocket.OPEN) {
                    window.socket.send(JSON.stringify({
                        type: 'fabric-add-object',
                        payload: shapeJson
                    }));
                }
                isDrawing = false;
                currentShape = null;
            }
        });

        const addObjectToCanvas = (objJson) => {
            fabric.util.enlivenObjects([objJson], function (objects) {
                objects.forEach(function (obj) {
                    canvas.add(obj);
                });
                canvas.renderAll();
            });
        };

        window.addEventListener('fabric-remote-add-object', (event) => {
            if (canvas) {
                const objJson = event.detail.payload;
                addObjectToCanvas(objJson);
            }
        });

        // --- Toolbar Logic ---
        const pencilTool = document.getElementById('fabric-pencil-tool');
        const lineTool = document.getElementById('fabric-line-tool');
        const rectTool = document.getElementById('fabric-rect-tool');
        const circleTool = document.getElementById('fabric-circle-tool');

        pencilTool.addEventListener('click', () => setActiveTool('pencil'));
        lineTool.addEventListener('click', () => setActiveTool('line'));
        rectTool.addEventListener('click', () => setActiveTool('rect'));
        circleTool.addEventListener('click', () => setActiveTool('circle'));
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
