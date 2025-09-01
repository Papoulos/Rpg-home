(() => {
    let canvas = null;
    let activeTool = 'select';
    let currentColor = '#ffffff';
    let remotePointers = {};
    let localPointer = null;
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
        // Cleanup previous tool's artifacts
        if (activeTool === 'pointer' && localPointer) {
            canvas.remove(localPointer);
            localPointer = null;
        }

        activeTool = tool;
        if (!canvas) return;

        // Setup for the new tool
        if (tool === 'pointer' && !localPointer) {
            localPointer = new fabric.Circle({
                radius: 5,
                fill: 'rgba(255, 0, 0, 0.5)',
                left: -100,
                top: -100,
                selectable: false,
                evented: false,
                originX: 'center',
                originY: 'center'
            });
            canvas.add(localPointer);
        }

        canvas.isDrawingMode = tool === 'pencil' || tool === 'fog-eraser';

        if (canvas.isDrawingMode) {
            canvas.selection = false;
            if (tool === 'pencil') {
                canvas.freeDrawingBrush.color = currentColor;
                canvas.freeDrawingBrush.width = 5;
            } else if (tool === 'fog-eraser') {
                canvas.freeDrawingBrush.color = 'white'; // Color doesn't matter, but must be opaque
                canvas.freeDrawingBrush.width = fogBrushSize;
            }
        } else if (tool === 'select') {
            canvas.selection = true;
            canvas.defaultCursor = 'default';
            canvas.hoverCursor = 'move';
        } else if (tool === 'pointer') {
            canvas.selection = false;
            canvas.defaultCursor = 'crosshair';
            canvas.hoverCursor = 'crosshair';
        } else {
            canvas.selection = false;
            canvas.defaultCursor = 'crosshair';
            canvas.hoverCursor = 'crosshair';
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
        sendCanvasStateToServer();
        // Return the final state for the toolbar logic to use
        return fogIsOn;
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
        const fogToolbar = document.getElementById('fabric-fog-toolbar');

        function handleMJStatus(isNowMJ) {
            isMJ = isNowMJ;
            if (isMJ) {
                fogToolbar.classList.remove('hidden');
            }
            // If fog exists, update its color based on MJ status
            if (fogLayer) {
                const fogBase = fogLayer.getObjects('rect')[0];
                fogBase.set('fill', isMJ ? 'rgba(0,0,0,0.5)' : 'black');
                canvas.renderAll();
            }
        }

        // Check the global flag immediately on initialization
        if (window.isMJ) {
            handleMJStatus(true);
        }

        window.addEventListener('mj-status', (event) => {
            handleMJStatus(event.detail.isMJ);
        });

        // --- Collaboration Logic ---
        canvas.on('path:created', (e) => {
            if (activeTool === 'fog-eraser') {
                if (!fogLayer) {
                    canvas.remove(e.path); // Don't allow erasing if fog doesn't exist
                    return;
                }
                const path = e.path;
                path.id = getNextId();
                // Prevent the path from being added to the main canvas
                canvas.remove(path);
                // Add it to the fog layer instead
                addFogEraserPath(path);

                // Broadcast the raw path data for other clients
                if (window.socket?.readyState === WebSocket.OPEN) {
                    const payload = {
                        pathData: path.path,
                        id: path.id
                    };
                    window.socket.send(JSON.stringify({ type: 'fabric-fog-erase-raw', payload: payload }));
                }

            } else { // It's the regular pencil tool
                const path = e.path;
                path.id = getNextId();
                if (window.socket && window.socket.readyState === WebSocket.OPEN) {
                    window.socket.send(JSON.stringify({
                        type: 'fabric-path-created',
                        payload: path.toJSON(['id'])
                    }));
                }
                sendCanvasStateToServer();
            }
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

        canvas.on('mouse:down', (o) => {
            if (canvas.isDrawingMode || !o.pointer) return;
            isDrawing = true;
            const pointer = canvas.getPointer(o.e);
            startX = pointer.x;
            startY = pointer.y;

            if (activeTool === 'select' || activeTool === 'pointer') return;

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
                if (localPointer) {
                    localPointer.set({ left: o.pointer.x, top: o.pointer.y });
                    localPointer.setCoords();
                    canvas.renderAll();
                }
                if (window.socket?.readyState === WebSocket.OPEN) {
                    window.socket.send(JSON.stringify({ type: 'pointer-move', payload: { x: o.pointer.x, y: o.pointer.y } }));
                }
            }

            if (!isDrawing || !o.pointer || !currentShape) return;
            const pointer = canvas.getPointer(o.e);
            const endX = pointer.x;
            const endY = pointer.y;

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
            if (isDrawing && currentShape) {
                if (window.socket?.readyState === WebSocket.OPEN) {
                    window.socket.send(JSON.stringify({ type: 'fabric-add-object', payload: currentShape.toJSON(['id']) }));
                }
                sendCanvasStateToServer();
            }
            isDrawing = false;
            currentShape = null;
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

        window.addEventListener('fabric-remote-fog-toggle', remoteActionHandler((payload) => {
            toggleFog(payload.active);
        }));

        window.addEventListener('fabric-remote-fog-erase-raw', remoteActionHandler((payload) => {
            if (!fogLayer) return;
            const path = new fabric.Path(payload.pathData, {
                stroke: 'white',
                strokeWidth: fogBrushSize,
                strokeLineCap: 'round',
                strokeLineJoin: 'round',
                fill: null,
                id: payload.id
            });
            addFogEraserPath(path);
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
            const isNowActive = toggleFog();
            if (window.socket?.readyState === WebSocket.OPEN) {
                window.socket.send(JSON.stringify({ type: 'fabric-fog-toggle', payload: { active: isNowActive } }));
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
