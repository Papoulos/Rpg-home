(() => {
    let canvas = null;
    let activeTool = 'select';
    let currentColor = '#ffffff';
    let remotePointers = {};
    let debounceTimeout = null;
    let isMJ = false;
    let fogBrushSize = 50;
    let fogLayer = null; // This will be a fabric.Group

    // --- UTILITY ---
    const getNextId = (() => {
        let objectIdCounter = 0;
        return () => `obj_${Date.now()}_${objectIdCounter++}`;
    })();

    const sendCanvasStateToServer = () => {
        if (!canvas) return;
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            const propertiesToInclude = ['id', 'isFog', 'isEraserPath', 'selectable', 'evented'];
            const state = JSON.stringify(canvas.toJSON(propertiesToInclude));
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
                canvas.defaultCursor = 'none';
                canvas.hoverCursor = 'none';
            } else if (tool === 'fog-eraser') {
                canvas.selection = false;
                // Custom cursor for the eraser
                const cursorUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${fogBrushSize}" height="${fogBrushSize}" viewBox="0 0 ${fogBrushSize} ${fogBrushSize}"><circle cx="${fogBrushSize/2}" cy="${fogBrushSize/2}" r="${fogBrushSize/2 - 1}" fill="rgba(255,255,255,0.5)" stroke="black" stroke-width="1"/></svg>`;
                canvas.defaultCursor = `url(${cursorUrl}) ${fogBrushSize/2} ${fogBrushSize/2}, crosshair`;
                canvas.hoverCursor = canvas.defaultCursor;
            } else {
                canvas.selection = false;
                canvas.defaultCursor = 'crosshair';
                canvas.hoverCursor = 'crosshair';
            }
        }

        const toolButtons = document.querySelectorAll('#fabric-toolbar .control-btn');
        toolButtons.forEach(btn => {
            btn.classList.remove('active');
        });
        const activeBtn = document.getElementById(`fabric-${tool}-tool`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    };

    // --- FOG OF WAR ---
    const createFogLayer = () => {
        const fogRect = new fabric.Rect({
            left: 0,
            top: 0,
            width: canvas.width,
            height: canvas.height,
            fill: isMJ ? 'rgba(0,0,0,0.5)' : 'black',
            selectable: false,
            evented: false,
            isFog: true,
            id: 'fog-base'
        });

        fogLayer = new fabric.Group([fogRect], {
            selectable: false,
            evented: false,
            isFog: true,
            id: 'fog-layer'
        });

        canvas.add(fogLayer);
        fogLayer.moveTo(999); // Ensure it's on top of everything
    };

    const toggleFog = (forceState) => {
        const fogExists = !!canvas.getObjects().find(o => o.isFog);
        let fogIsOn = fogExists;

        if ((forceState === undefined && fogExists) || forceState === false) {
            canvas.getObjects().forEach(obj => {
                if (obj.isFog) {
                    canvas.remove(obj);
                }
            });
            fogLayer = null;
            fogIsOn = false;
        } else if ((forceState === undefined && !fogExists) || forceState === true) {
            createFogLayer();
            fogIsOn = true;
        }

        canvas.renderAll();

        if (window.socket?.readyState === WebSocket.OPEN) {
            const payload = fogIsOn ? fogLayer.toJSON(['id', 'isFog', 'isEraserPath', 'selectable', 'evented']) : null;
            window.socket.send(JSON.stringify({ type: 'fabric-fog-update', payload: payload }));
        }

        sendCanvasStateToServer();
    };

    const addFogEraserPath = (path) => {
        if (!fogLayer) return;

        path.set({
            globalCompositeOperation: 'destination-out',
            selectable: false,
            evented: false,
            isEraserPath: true
        });

        fogLayer.addWithUpdate(path);
        canvas.renderAll();
        sendCanvasStateToServer();
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
                if (fogLayer) {
                    const fogBase = fogLayer.getObjects('rect')[0];
                    fogBase.set({ width: newWidth, height: newHeight });
                }
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

        // --- MJ and FOG Status ---
        window.addEventListener('mj-status', (event) => {
            isMJ = event.detail.isMJ;
            const fogToolbar = document.getElementById('fabric-fog-toolbar');
            if (isMJ) {
                fogToolbar.classList.remove('hidden');
            }
            // If fog exists, update its color based on MJ status
            if (fogLayer) {
                const fogBase = fogLayer.getObjects('rect')[0];
                fogBase.set('fill', isMJ ? 'rgba(0,0,0,0.5)' : 'black');
                canvas.renderAll();
            }
        });

        // --- Collaboration Logic ---
        canvas.on('path:created', (e) => {
            const path = e.path;
            path.id = getNextId();
            if (window.socket && window.socket.readyState === WebSocket.OPEN) {
                window.socket.send(JSON.stringify({
                    type: 'fabric-path-created',
                    payload: path.toJSON(['id'])
                }));
            }
            sendCanvasStateToServer();
        });

        window.addEventListener('fabric-remote-path-created', (event) => {
            if (canvas) {
                fabric.util.enlivenObjects([event.detail.payload], (objects) => {
                    objects.forEach((obj) => canvas.add(obj));
                    canvas.renderAll();
                });
            }
        });

        const setBackground = (dataUrl) => {
            fabric.Image.fromURL(dataUrl, (img) => {
                canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
                    scaleX: canvas.width / img.width,
                    scaleY: canvas.height / img.height
                });
            });
        };

        document.getElementById('fabric-background-image-input').addEventListener('change', (event) => {
            if (!canvas || !event.target.files || event.target.files.length === 0) return;
            const file = event.target.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target.result;
                if (window.socket && window.socket.readyState === WebSocket.OPEN) {
                    window.socket.send(JSON.stringify({ type: 'fabric-set-background', payload: dataUrl }));
                }
                setBackground(dataUrl);
                sendCanvasStateToServer();
            };
            reader.readAsDataURL(file);
        });

        window.addEventListener('fabric-remote-set-background', (event) => {
            if (canvas) setBackground(event.detail.payload);
        });

        document.getElementById('fabric-image-input').addEventListener('change', (event) => {
            if (!canvas || !event.target.files || event.target.files.length === 0) return;
            const file = event.target.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                fabric.Image.fromURL(e.target.result, (img) => {
                    const scale = Math.min((canvas.width / 2) / img.width, (canvas.height / 2) / img.height);
                    img.set({ scaleX: scale, scaleY: scale, left: (canvas.width - img.width * scale) / 2, top: (canvas.height - img.height * scale) / 2 });
                    img.id = getNextId();
                    canvas.add(img);
                    if (window.socket && window.socket.readyState === WebSocket.OPEN) {
                        window.socket.send(JSON.stringify({ type: 'fabric-add-object', payload: img.toJSON(['id']) }));
                    }
                    sendCanvasStateToServer();
                });
            };
            reader.readAsDataURL(file);
        });

        // --- Drawing Logic ---
        let isDrawing = false;
        let startX, startY, currentShape;
        let isErasingFog = false;
        let currentEraserPathData = [];

        canvas.on('mouse:down', (o) => {
            if (!o.pointer) return;
            isDrawing = true;
            const pointer = canvas.getPointer(o.e);
            startX = pointer.x;
            startY = pointer.y;

            if (activeTool === 'fog-eraser') {
                if (!fogLayer) return;
                isErasingFog = true;
                currentEraserPathData = [[ 'M', startX, startY ]];
                // No temporary shape is added to the canvas, we'll draw it manually for feedback.
                return;
            }

            if (activeTool === 'pencil' || activeTool === 'select' || activeTool === 'pointer') return;

            const id = getNextId();
            switch (activeTool) {
                case 'line':
                    currentShape = new fabric.Line([startX, startY, startX, startY], { stroke: currentColor, strokeWidth: 2, id: id });
                    break;
                case 'rect':
                    currentShape = new fabric.Rect({ left: startX, top: startY, width: 0, height: 0, stroke: currentColor, strokeWidth: 2, fill: 'transparent', id: id });
                    break;
                case 'circle':
                    currentShape = new fabric.Circle({ left: startX, top: startY, radius: 0, stroke: currentColor, strokeWidth: 2, fill: 'transparent', id: id });
                    break;
            }
            if (currentShape) canvas.add(currentShape);
        });

        canvas.on('mouse:move', (o) => {
            if (activeTool === 'pointer' && o.pointer) {
                if (window.socket?.readyState === WebSocket.OPEN) {
                    window.socket.send(JSON.stringify({ type: 'pointer-move', payload: { x: o.pointer.x, y: o.pointer.y } }));
                }
            }

            if (!isDrawing || !o.pointer) return;
            const pointer = canvas.getPointer(o.e);
            const endX = pointer.x;
            const endY = pointer.y;

            if (isErasingFog) {
                currentEraserPathData.push(['L', endX, endY]);
                // Manually render the feedback on the canvas
                canvas.clearContext(canvas.contextTop);
                const ctx = canvas.getContext('2d'); // get the main context
                ctx.save();
                ctx.globalAlpha = 0.5;
                ctx.strokeStyle = 'white';
                ctx.lineWidth = fogBrushSize;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.beginPath();
                currentEraserPathData.forEach(p => {
                    if (p[0] === 'M') ctx.moveTo(p[1], p[2]);
                    else ctx.lineTo(p[1], p[2]);
                });
                ctx.stroke();
                ctx.restore();
                return;
            }

            if (!currentShape) return;

            switch (activeTool) {
                case 'line': currentShape.set({ x2: endX, y2: endY }); break;
                case 'rect': currentShape.set({ width: endX - startX, height: endY - startY }); break;
                case 'circle': currentShape.set({ radius: Math.abs(endX - startX) / 2 }); break;
            }
            canvas.renderAll();
        });

        canvas.on('object:modified', (e) => {
            if (e.target && !e.target.isFog) {
                if (window.socket?.readyState === WebSocket.OPEN) {
                    window.socket.send(JSON.stringify({ type: 'fabric-update-object', payload: e.target.toJSON(['id']) }));
                }
                sendCanvasStateToServer();
            }
        });

        canvas.on('mouse:up', () => {
            canvas.clearContext(canvas.contextTop); // Clear feedback drawing
            if (isErasingFog && currentEraserPathData.length > 1) {
                const path = new fabric.Path(currentEraserPathData, {
                    stroke: 'white',
                    strokeWidth: fogBrushSize,
                    strokeLineCap: 'round',
                    strokeLineJoin: 'round',
                    fill: null,
                });
                path.id = getNextId();
                addFogEraserPath(path);

                if (window.socket?.readyState === WebSocket.OPEN) {
                    // Send the entire updated fog layer
                    const payload = fogLayer.toJSON(['id', 'isFog', 'isEraserPath', 'selectable', 'evented']);
                    window.socket.send(JSON.stringify({ type: 'fabric-fog-update', payload: payload }));
                }

            } else if (isDrawing && currentShape) {
                if (window.socket?.readyState === WebSocket.OPEN) {
                    window.socket.send(JSON.stringify({ type: 'fabric-add-object', payload: currentShape.toJSON(['id']) }));
                }
                sendCanvasStateToServer();
            }

            isDrawing = false;
            isErasingFog = false;
            currentShape = null;
            currentEraserPathData = [];
        });

        // --- Remote Event Handlers ---
        const remoteActionHandler = (handler) => (event) => {
            if (!canvas) return;
            handler(event.detail.payload);
        };

        window.addEventListener('fabric-remote-add-object', remoteActionHandler((payload) => {
            fabric.util.enlivenObjects([payload], (objects) => {
                canvas.add(objects[0]);
                canvas.renderAll();
            });
        }));

        window.addEventListener('fabric-remote-update-object', remoteActionHandler((payload) => {
            const objToUpdate = canvas.getObjects().find(obj => obj.id === payload.id);
            if (objToUpdate) {
                canvas.remove(objToUpdate);
                fabric.util.enlivenObjects([payload], (newObjects) => {
                    canvas.add(newObjects[0]);
                    canvas.renderAll();
                });
            }
        }));

        window.addEventListener('fabric-remote-remove-object', remoteActionHandler((payload) => {
            const objToRemove = canvas.getObjects().find(obj => obj.id === payload.id);
            if (objToRemove) canvas.remove(objToRemove);
            canvas.renderAll();
        }));

        window.addEventListener('fabric-remote-fog-update', remoteActionHandler((payload) => {
            // Remove the old fog layer if it exists
            if (fogLayer) {
                canvas.remove(fogLayer);
            }

            if (payload) {
                // Enliven the new fog layer from the payload
                fabric.util.enlivenObjects([payload], (objects) => {
                    const newFogLayer = objects[0];
                    fogLayer = newFogLayer;
                    canvas.add(fogLayer);

                    // Ensure properties are correct on the remote client
                    fogLayer.set({
                        selectable: false,
                        evented: false,
                    });
                    const fogBase = fogLayer.getObjects('rect')[0];
                    if (fogBase) {
                        fogBase.set('fill', isMJ ? 'rgba(0,0,0,0.5)' : 'black');
                    }
                    fogLayer.moveTo(999);
                    canvas.renderAll();
                });
            } else {
                // If the payload is null, it means the fog was turned off
                fogLayer = null;
                canvas.renderAll();
            }
        }));

        window.addEventListener('fabric-load', remoteActionHandler((payload) => {
            canvas.loadFromJSON(payload, () => {
                fogLayer = canvas.getObjects().find(o => o.isFog && o.type === 'group') || null;
                if (fogLayer) {
                    // Defensively set properties to prevent interaction after reload
                    fogLayer.set({
                        selectable: false,
                        evented: false,
                    });
                    const fogBase = fogLayer.getObjects('rect')[0];
                    fogBase.set('fill', isMJ ? 'rgba(0,0,0,0.5)' : 'black');
                }
                canvas.renderAll();
            });
        }));


        window.addEventListener('pointer-move', (event) => {
            if (!canvas) return;
            const { sender, payload } = event.detail;
            if (!remotePointers[sender]) {
                remotePointers[sender] = new fabric.Circle({ radius: 5, fill: 'red', left: payload.x, top: payload.y, selectable: false, evented: false });
                canvas.add(remotePointers[sender]);
            } else {
                remotePointers[sender].set({ left: payload.x, top: payload.y });
            }
            canvas.renderAll();
        });

        window.addEventListener('pointer-disconnect', (event) => {
            if (canvas?.remotePointers[event.detail.sender]) {
                canvas.remove(remotePointers[event.detail.sender]);
                delete remotePointers[event.detail.sender];
                canvas.renderAll();
            }
        });


        // --- Toolbar Logic ---
        document.getElementById('fabric-select-tool').addEventListener('click', () => setActiveTool('select'));
        document.getElementById('fabric-pencil-tool').addEventListener('click', () => setActiveTool('pencil'));
        document.getElementById('fabric-line-tool').addEventListener('click', () => setActiveTool('line'));
        document.getElementById('fabric-rect-tool').addEventListener('click', () => setActiveTool('rect'));
        document.getElementById('fabric-circle-tool').addEventListener('click', () => setActiveTool('circle'));
        document.getElementById('fabric-pointer-tool').addEventListener('click', () => setActiveTool('pointer'));
        document.getElementById('fabric-fog-tool').addEventListener('click', () => {
            const willBeActive = !canvas.getObjects().find(o => o.isFog);
            toggleFog();
            if (window.socket?.readyState === WebSocket.OPEN) {
                window.socket.send(JSON.stringify({ type: 'fabric-fog-toggle', payload: { active: willBeActive } }));
            }
        });
        document.getElementById('fabric-fog-eraser-tool').addEventListener('click', () => setActiveTool('fog-eraser'));

        const brushSizeSlider = document.getElementById('fabric-fog-brush-size');
        brushSizeSlider.addEventListener('input', (e) => {
            fogBrushSize = parseInt(e.target.value, 10);
            if (activeTool === 'fog-eraser') {
                // Update cursor preview
                setActiveTool('fog-eraser');
            }
        });

        document.getElementById('fabric-delete-tool').addEventListener('click', () => {
            const activeObject = canvas.getActiveObject();
            if (activeObject && !activeObject.isFog) {
                canvas.remove(activeObject);
                if (window.socket?.readyState === WebSocket.OPEN) {
                    window.socket.send(JSON.stringify({ type: 'fabric-remove-object', payload: { id: activeObject.id } }));
                }
                sendCanvasStateToServer();
            }
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                const activeObject = canvas.getActiveObject();
                if (activeObject && !activeObject.isFog) {
                    canvas.remove(activeObject);
                    if (window.socket?.readyState === WebSocket.OPEN) {
                        window.socket.send(JSON.stringify({ type: 'fabric-remove-object', payload: { id: activeObject.id } }));
                    }
                    sendCanvasStateToServer();
                }
            }
        });

        document.getElementById('fabric-color-picker').addEventListener('input', (e) => {
            currentColor = e.target.value;
            if (!canvas) return;
            canvas.freeDrawingBrush.color = currentColor;
            const activeObject = canvas.getActiveObject();
            if (activeObject && !activeObject.isFog) {
                activeObject.set('stroke', currentColor);
                if (activeObject.type !== 'line') activeObject.set('fill', 'transparent');
                canvas.renderAll();
                if (window.socket?.readyState === WebSocket.OPEN) {
                    window.socket.send(JSON.stringify({ type: 'fabric-update-object', payload: activeObject.toJSON(['id']) }));
                }
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
            if (fabricContent.style.display !== 'none') initializeCanvas();
        }

        let resizeTimeout;
        window.addEventListener('resize', () => {
            if (!canvas) return;
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                const controls = document.querySelector('.whiteboard-controls');
                const containerRect = fabricContent.getBoundingClientRect();
                const controlsRect = controls.getBoundingClientRect();
                const newWidth = containerRect.width;
                const newHeight = containerRect.height - controlsRect.height;
                canvas.setDimensions({ width: newWidth, height: newHeight });
                if (fogLayer) {
                    const fogBase = fogLayer.getObjects('rect')[0];
                    fogBase.set({ width: newWidth, height: newHeight });
                }
                canvas.renderAll();
            }, 100);
        });
    });
})();
