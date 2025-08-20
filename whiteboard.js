document.addEventListener('DOMContentLoaded', () => {
    // --- State Variables ---
    let username = '';
    let isUpdatingFromRemote = false;
    let isMouseDown = false;
    // Feature states
    let fogRect = null, fogClipGroup = null, isFogOn = false;
    let isPointerMode = false, remotePointers = {};

    // --- WebSocket Setup ---
    const socket = new WebSocket(`wss://${window.location.host}`);
    function askForUsername() {
        while (!username || username.trim() === '') {
            username = prompt("Veuillez entrer votre nom pour le tableau blanc :");
        }
    }
    socket.onopen = () => {
        askForUsername();
        // Hide MJ-only controls if not the MJ
        if (username !== 'MJ') {
            document.getElementById('eraseFog').style.display = 'none';
        }
        socket.send(JSON.stringify({ type: 'register', username: username }));
    };

    // --- Canvas Setup ---
    const canvas = new fabric.Canvas('drawingCanvas');
    canvas.isDrawingMode = false;
    canvas.freeDrawingBrush.width = 20;

    // --- Real-time Collaboration Logic ---
    function sendCanvasState() {
        if (isUpdatingFromRemote || isPointerMode) return;
        const json = canvas.toJSON(['selectable', 'evented', 'clipPath', 'inverted']);
        socket.send(JSON.stringify({ type: 'whiteboard', subType: 'state', payload: json, sender: username }));
    }

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.sender === username) return;

        if (data.type === 'whiteboard') {
            handleWhiteboardUpdate(data);
        }
    };

    function handleWhiteboardUpdate(data) {
        switch (data.subType) {
            case 'state':
                isUpdatingFromRemote = true;
                canvas.loadFromJSON(data.payload, () => { canvas.renderAll(); isUpdatingFromRemote = false; });
                break;
            case 'fog_state':
                if (data.payload.isOn && !isFogOn) {
                    toggleFog(true, true); // Turn on fog locally
                    // MJ gets the erased paths, others don't
                    if (username === 'MJ') {
                        data.payload.paths.forEach(pathJSON => {
                            fabric.util.enlivenObjects([pathJSON], (objects) => {
                                fogClipGroup.addWithUpdate(objects[0]);
                                canvas.renderAll();
                            });
                        });
                    }
                }
                break;
            case 'fog_toggle':
                toggleFog(data.payload.isOn, true);
                break;
            case 'fog_erase':
                // Only the MJ needs to process erased paths
                if (username === 'MJ' && isFogOn && fogClipGroup) {
                    fabric.util.enlivenObjects([data.payload], (objects) => {
                        fogClipGroup.addWithUpdate(objects[0]);
                        canvas.renderAll();
                    });
                }
                break;
            case 'pointer':
                handleRemotePointer(data);
                break;
        }
    }

    // --- Feature Implementations ---
    function handleRemotePointer({ sender, payload }) {
        let pointer = remotePointers[sender];
        if (payload.active) {
            if (!pointer) {
                pointer = new fabric.Circle({ radius: 5, fill: 'red', originX: 'center', originY: 'center', selectable: false, evented: false });
                remotePointers[sender] = pointer;
                canvas.add(pointer);
            }
            pointer.set({ left: payload.x, top: payload.y });
        } else {
            if (pointer) {
                canvas.remove(pointer);
                delete remotePointers[sender];
            }
        }
        canvas.renderAll();
    }

    function toggleFog(newState, isRemote = false) {
        isFogOn = newState;

        // If turning fog off, just remove the existing rect
        if (!isFogOn) {
            if (fogRect) canvas.remove(fogRect);
            fogRect = null;
            fogClipGroup = null; // Also clear the clip group
            if (canvas.isDrawingMode) {
                canvas.isDrawingMode = false;
                document.getElementById('eraseFog').classList.remove('active');
            }
        } else {
            // Turning fog on - behavior depends on user role
            if (username === 'MJ') {
                // MJ gets the advanced, erasable fog
                fogClipGroup = new fabric.Group([], { inverted: true });
                fogRect = new fabric.Rect({
                    width: canvas.width, height: canvas.height,
                    fill: 'rgba(0,0,0,0.85)',
                    selectable: false, evented: false,
                    clipPath: fogClipGroup,
                });
            } else {
                // Players get a simple, solid black rectangle
                fogRect = new fabric.Rect({
                    width: canvas.width, height: canvas.height,
                    fill: 'rgba(0,0,0,1)', // Solid black
                    selectable: false, evented: false,
                });
            }
            canvas.add(fogRect);
            fogRect.sendToBack();
        }

        // Only the user who initiated the toggle should send the message
        if (!isRemote) {
            socket.send(JSON.stringify({ type: 'whiteboard', subType: 'fog_toggle', payload: { isOn: isFogOn }, sender: username }));
        }
        canvas.renderAll();
    }

    // --- Canvas Event Listeners ---
    canvas.on({
        'object:added': (e) => {
            if (isFogOn && e.target !== fogRect) e.target.bringToFront();
            sendCanvasState();
        },
        'object:modified': sendCanvasState,
        'object:removed': sendCanvasState,
        'path:created': (e) => {
            if (isFogOn && canvas.isDrawingMode) {
                const path = e.path;
                path.set({ selectable: false, evented: false });
                fogClipGroup.addWithUpdate(path);
                canvas.remove(path);
                canvas.renderAll();
                socket.send(JSON.stringify({ type: 'whiteboard', subType: 'fog_erase', payload: path.toJSON(), sender: username }));
            }
        },
        'mouse:down': (o) => {
            isMouseDown = true;
            if (!isPointerMode) return;
            const ptr = canvas.getPointer(o.e);
            socket.send(JSON.stringify({ type: 'whiteboard', subType: 'pointer', payload: { x: ptr.x, y: ptr.y, active: true }, sender: username }));
        },
        'mouse:move': (o) => {
            if (!isPointerMode || !isMouseDown) return;
            const ptr = canvas.getPointer(o.e);
            socket.send(JSON.stringify({ type: 'whiteboard', subType: 'pointer', payload: { x: ptr.x, y: ptr.y, active: true }, sender: username }));
        },
        'mouse:up': () => {
            isMouseDown = false;
            if (!isPointerMode) return;
            socket.send(JSON.stringify({ type: 'whiteboard', subType: 'pointer', payload: { active: false }, sender: username }));
        }
    });

    // --- Canvas Resizing ---
    function resizeCanvas() {
        const container = document.getElementById('canvas-container');
        const { width, height } = container.getBoundingClientRect();
        canvas.setWidth(width);
        canvas.setHeight(height);
        if (fogRect) fogRect.set({ width: canvas.width, height: canvas.height });
        canvas.renderAll();
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // --- Toolbar Actions ---
    document.getElementById('addRect').addEventListener('click', () => canvas.add(new fabric.Rect({ left: 100, top: 100, fill: document.getElementById('colorPicker').value, width: 100, height: 100 })));
    document.getElementById('addCircle').addEventListener('click', () => canvas.add(new fabric.Circle({ radius: 50, fill: document.getElementById('colorPicker').value, left: 200, top: 200 })));
    document.getElementById('addTriangle').addEventListener('click', () => canvas.add(new fabric.Triangle({ width: 100, height: 100, fill: document.getElementById('colorPicker').value, left: 300, top: 300 })));
    document.getElementById('addText').addEventListener('click', () => canvas.add(new fabric.Textbox('Nouveau Texte', { left: 100, top: 100, width: 200, fontSize: 20, fill: document.getElementById('colorPicker').value })));
    document.getElementById('addPawn').addEventListener('click', () => canvas.add(new fabric.Circle({ radius: 20, fill: document.getElementById('colorPicker').value, left: Math.random() * canvas.width, top: Math.random() * canvas.height })));

    document.getElementById('changeColor').addEventListener('click', () => {
        const color = document.getElementById('colorPicker').value;
        if (canvas.getActiveObject()) {
            canvas.getActiveObject().set('fill', color);
            canvas.renderAll();
            sendCanvasState();
        }
    });

    const fileInputHandler = (e, callback) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = event => callback(event.target.result);
        reader.readAsDataURL(file);
    };

    document.getElementById('importImage').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = e => fileInputHandler(e, (result) => {
            fabric.Image.fromURL(result, (img) => {
                // Check if the image is larger than the canvas
                if (img.width > canvas.width || img.height > canvas.height) {
                    // Calculate the scale factor to fit the image within the canvas
                    const scaleFactor = Math.min(canvas.width / img.width, canvas.height / img.height);
                    img.scale(scaleFactor);
                }
                canvas.add(img);
                canvas.centerObject(img);
                canvas.setActiveObject(img);
            });
        });
        input.click();
    });

    document.getElementById('addBackground').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = e => fileInputHandler(e, (result) => {
            fabric.Image.fromURL(result, (img) => {
                canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
                    scaleX: canvas.width / img.width,
                    scaleY: canvas.height / img.height
                });
                sendCanvasState();
            });
        });
        input.click();
    });

    // --- Toolbar Actions ---
    document.getElementById('deleteObject').addEventListener('click', () => {
        const activeObject = canvas.getActiveObject();
        if (activeObject) {
            canvas.remove(activeObject);
        }
    });

    // --- Keyboard Shortcuts ---
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            const activeObject = canvas.getActiveObject();
            if (activeObject) {
                canvas.remove(activeObject);
            }
        }
    });

    // --- Feature Toggles ---
    document.getElementById('toggleFog').addEventListener('click', () => toggleFog(!isFogOn));
    document.getElementById('eraseFog').addEventListener('click', () => {
        if (!isFogOn) return alert("Activez le brouillard de guerre d'abord !");
        canvas.isDrawingMode = !canvas.isDrawingMode;
        document.getElementById('eraseFog').classList.toggle('active', canvas.isDrawingMode);
    });
    const pointerBtn = document.getElementById('pointer-mode-btn');
    pointerBtn.style.display = ''; // Unhide the button
    pointerBtn.addEventListener('click', () => {
        isPointerMode = !isPointerMode;
        pointerBtn.classList.toggle('active', isPointerMode);
        canvas.selection = !isPointerMode;
        if (isPointerMode) {
            canvas.isDrawingMode = false;
            document.getElementById('eraseFog').classList.remove('active');
        }
    });
});
