(() => {
    let canvas = null;
    let activeTool = 'select';
    let currentColor = '#ffffff';
    let remotePointers = {};
    let debounceTimeout = null;

    const sendCanvasStateToServer = () => {
        if (!canvas) return;
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            const state = JSON.stringify(canvas.toJSON(['id']));
            if (window.socket && window.socket.readyState === WebSocket.OPEN) {
                window.socket.send(JSON.stringify({
                    type: 'fabric-state-update',
                    payload: state
                }));
            }
        }, 500); // Debounce for 500ms
    };

    const setActiveTool = (tool) => {
        activeTool = tool;
        if (canvas) {
            canvas.isDrawingMode = tool === 'pencil';
            if (tool === 'select') {
                canvas.selection = true;
                canvas.defaultCursor = 'default';
                canvas.hoverCursor = 'move';
            } else if (tool === 'pointer') {
                canvas.selection = false;
                canvas.defaultCursor = 'none'; // Hide local cursor
                canvas.hoverCursor = 'none';
            } else {
                canvas.selection = false;
                canvas.defaultCursor = 'crosshair';
                canvas.hoverCursor = 'crosshair';
            }
        }

        const toolButtons = document.querySelectorAll('#fabric-toolbar .control-btn');
        toolButtons.forEach(btn => {
            if (btn.id === `fabric-${tool}-tool`) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    };

    const initializeCanvas = () => {
        if (canvas) return;

        const fabricContent = document.getElementById('fabric-content');
        const canvasElement = document.getElementById('fabric-canvas');

        if (!fabricContent || !canvasElement) return;

        const setCanvasSize = () => {
            const controls = document.querySelector('.whiteboard-controls');
            const containerRect = fabricContent.getBoundingClientRect();
            const controlsRect = controls.getBoundingClientRect();

            const newWidth = containerRect.width;
            const newHeight = containerRect.height - controlsRect.height;

            canvasElement.width = newWidth;
            canvasElement.height = newHeight;

            if (canvas) {
                canvas.setDimensions({ width: newWidth, height: newHeight });
                canvas.renderAll();
            }
        };

        setCanvasSize();
        canvas = new fabric.Canvas('fabric-canvas', {
            isDrawingMode: false,
        });

        setActiveTool('select');

        canvas.freeDrawingBrush.width = 5;
        canvas.freeDrawingBrush.color = '#ffffff';

        // --- Collaboration Logic ---
        canvas.on('path:created', (e) => {
            const path = e.path;
            path.id = getNextId();
            const pathJson = path.toJSON(['id']);
            if (window.socket && window.socket.readyState === WebSocket.OPEN) {
                window.socket.send(JSON.stringify({
                    type: 'fabric-path-created',
                    payload: pathJson
                }));
            }
            sendCanvasStateToServer();
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
                sendCanvasStateToServer();
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
                    const scale = Math.min(
                        (canvas.width / 2) / img.width,
                        (canvas.height / 2) / img.height
                    );
                    img.set({
                        scaleX: scale,
                        scaleY: scale,
                        left: (canvas.width - img.width * scale) / 2,
                        top: (canvas.height - img.height * scale) / 2
                    });
                    canvas.add(img);
                    if (window.socket && window.socket.readyState === WebSocket.OPEN) {
                        window.socket.send(JSON.stringify({
                            type: 'fabric-add-object',
                            payload: img.toJSON(['id'])
                        }));
                    }
                    sendCanvasStateToServer();
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
        let objectIdCounter = 0;

        const getNextId = () => `obj_${Date.now()}_${objectIdCounter++}`;

        canvas.on('mouse:down', (o) => {
            if (activeTool === 'pencil' || activeTool === 'select' || !o.pointer) return;
            isDrawing = true;
            startX = o.pointer.x;
            startY = o.pointer.y;

            const id = getNextId();
            switch (activeTool) {
                case 'line':
                    currentShape = new fabric.Line([startX, startY, startX, startY], {
                        stroke: currentColor,
                        strokeWidth: 2,
                        selectable: true,
                        id: id
                    });
                    break;
                case 'rect':
                    currentShape = new fabric.Rect({
                        left: startX,
                        top: startY,
                        width: 0,
                        height: 0,
                        stroke: currentColor,
                        strokeWidth: 2,
                        fill: 'transparent',
                        selectable: true,
                        id: id
                    });
                    break;
                case 'circle':
                    currentShape = new fabric.Circle({
                        left: startX,
                        top: startY,
                        radius: 0,
                        stroke: currentColor,
                        strokeWidth: 2,
                        fill: 'transparent',
                        selectable: true,
                        id: id
                    });
                    break;
            }
            if (currentShape) {
                canvas.add(currentShape);
            }
        });

        canvas.on('mouse:move', (o) => {
            if (activeTool === 'pointer' && o.pointer) {
                if (window.socket && window.socket.readyState === WebSocket.OPEN) {
                    window.socket.send(JSON.stringify({
                        type: 'pointer-move',
                        payload: { x: o.pointer.x, y: o.pointer.y }
                    }));
                }
            }

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

        canvas.on('object:modified', (e) => {
            if (e.target) {
                const modifiedObject = e.target;
                if (window.socket && window.socket.readyState === WebSocket.OPEN) {
                    window.socket.send(JSON.stringify({
                        type: 'fabric-update-object',
                        payload: modifiedObject.toJSON(['id'])
                    }));
                }
                sendCanvasStateToServer();
            }
        });

        canvas.on('mouse:up', () => {
            if (isDrawing && currentShape) {
                const shapeJson = currentShape.toJSON(['id']);
                if (window.socket && window.socket.readyState === WebSocket.OPEN) {
                    window.socket.send(JSON.stringify({
                        type: 'fabric-add-object',
                        payload: shapeJson
                    }));
                }
                sendCanvasStateToServer();
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

        window.addEventListener('fabric-remote-update-object', (event) => {
            if (canvas) {
                const objJson = event.detail.payload;
                const objToUpdate = canvas.getObjects().find(obj => obj.id === objJson.id);
                if (objToUpdate) {
                    canvas.remove(objToUpdate);
                    fabric.util.enlivenObjects([objJson], (newObjects) => {
                        canvas.add(newObjects[0]);
                        canvas.renderAll();
                    });
                }
            }
        });

        window.addEventListener('fabric-remote-remove-object', (event) => {
            if (canvas) {
                const { id } = event.detail.payload;
                const objToRemove = canvas.getObjects().find(obj => obj.id === id);
                if (objToRemove) {
                    canvas.remove(objToRemove);
                    canvas.renderAll();
                }
            }
        });

        window.addEventListener('fabric-load', (event) => {
            if (canvas) {
                const state = JSON.parse(event.detail.payload);
                canvas.loadFromJSON(state, () => {
                    canvas.renderAll();
                });
            }
        });

        window.addEventListener('pointer-move', (event) => {
            if (canvas) {
                const { sender, payload } = event.detail;
                if (!remotePointers[sender]) {
                    remotePointers[sender] = new fabric.Circle({
                        radius: 5,
                        fill: 'red',
                        left: payload.x,
                        top: payload.y,
                        selectable: false,
                        evented: false,
                    });
                    canvas.add(remotePointers[sender]);
                } else {
                    remotePointers[sender].set({ left: payload.x, top: payload.y });
                }
                canvas.renderAll();
            }
        });

        window.addEventListener('pointer-disconnect', (event) => {
            if (canvas) {
                const { sender } = event.detail;
                if (remotePointers[sender]) {
                    canvas.remove(remotePointers[sender]);
                    delete remotePointers[sender];
                    canvas.renderAll();
                }
            }
        });


        // --- Toolbar Logic ---
        const selectTool = document.getElementById('fabric-select-tool');
        selectTool.addEventListener('click', () => setActiveTool('select'));

        const deleteTool = document.getElementById('fabric-delete-tool');
        deleteTool.addEventListener('click', () => {
            const activeObject = canvas.getActiveObject();
            if (activeObject) {
                canvas.remove(activeObject);
                if (window.socket && window.socket.readyState === WebSocket.OPEN) {
                    window.socket.send(JSON.stringify({
                        type: 'fabric-remove-object',
                        payload: { id: activeObject.id }
                    }));
                }
                sendCanvasStateToServer();
            }
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                const activeObject = canvas.getActiveObject();
                if (activeObject) {
                    canvas.remove(activeObject);
                    if (window.socket && window.socket.readyState === WebSocket.OPEN) {
                        window.socket.send(JSON.stringify({
                            type: 'fabric-remove-object',
                            payload: { id: activeObject.id }
                        }));
                    }
                    sendCanvasStateToServer();
                }
            }
        });

        const colorPicker = document.getElementById('fabric-color-picker');
        colorPicker.addEventListener('input', (e) => {
            const color = e.target.value;
            currentColor = color;
            if (canvas) {
                canvas.freeDrawingBrush.color = color;
                const activeObject = canvas.getActiveObject();
                if (activeObject) {
                    activeObject.set('stroke', color);
                    if (activeObject.type !== 'line') {
                        activeObject.set('fill', 'transparent'); // Keep shapes transparent
                    }
                    canvas.renderAll();

                    if (window.socket && window.socket.readyState === WebSocket.OPEN) {
                        window.socket.send(JSON.stringify({
                            type: 'fabric-update-object',
                            payload: activeObject.toJSON(['id'])
                        }));
                    }
                }
            }
        });

        const pencilTool = document.getElementById('fabric-pencil-tool');
        const lineTool = document.getElementById('fabric-line-tool');
        const rectTool = document.getElementById('fabric-rect-tool');
        const circleTool = document.getElementById('fabric-circle-tool');
        const pointerTool = document.getElementById('fabric-pointer-tool');

        pencilTool.addEventListener('click', () => setActiveTool('pencil'));
        lineTool.addEventListener('click', () => setActiveTool('line'));
        rectTool.addEventListener('click', () => setActiveTool('rect'));
        circleTool.addEventListener('click', () => setActiveTool('circle'));
        pointerTool.addEventListener('click', () => setActiveTool('pointer'));
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

        let resizeTimeout;
        window.addEventListener('resize', () => {
            if (canvas) {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    const controls = document.querySelector('.whiteboard-controls');
                    const containerRect = fabricContent.getBoundingClientRect();
                    const controlsRect = controls.getBoundingClientRect();
                    const newWidth = containerRect.width;
                    const newHeight = containerRect.height - controlsRect.height;
                    canvas.setDimensions({ width: newWidth, height: newHeight });
                    canvas.renderAll();
                }, 100);
            }
        });
    });
})();
