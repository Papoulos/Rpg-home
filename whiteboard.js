// --- DOM and State Variables ---
const container = document.getElementById('whiteboard-container');
const canvasElement = document.getElementById('whiteboard-canvas');
let isUpdatingFromRemote = false; // Flag to prevent update loops

// Feature-specific state variables
let fogRect = null, fogClipGroup = null, isFogOn = false;
let isPointerMode = false, remotePointers = {};
let isMouseDown = false;

if (!container || !canvasElement) {
    // Early exit if essential elements are not found
    console.error("Whiteboard container or canvas element not found.");
} else {
    const canvas = new fabric.Canvas(canvasElement, {
        isDrawingMode: false,
        // Set object-level controls to be consistent across browsers
        perPixelTargetFind: false,
        targetFindTolerance: 4,
    });

    // --- Core Canvas and WebSocket Logic ---

    // Adjusts canvas size to fit its container
    function resizeCanvas() {
        const toolbar = document.getElementById('toolbar');
        const containerRect = container.getBoundingClientRect();
        const toolbarHeight = toolbar ? toolbar.offsetHeight : 0;

        canvas.setWidth(containerRect.width);
        canvas.setHeight(containerRect.height - toolbarHeight);
        canvas.renderAll();
        // Ensure fog layer also resizes
        if (fogRect) {
            fogRect.set({ width: canvas.width, height: canvas.height });
        }
    }

    // Sends the entire canvas state to the server
    function sendCanvasState() {
        // Prevent sending updates when in pointer mode or when an update is being received
        if (isUpdatingFromRemote || isPointerMode) return;
        // Include custom properties needed for fog of war serialization
        const json = canvas.toJSON(['selectable', 'evented', 'clipPath', 'inverted']);
        window.app.sendMessage({ type: 'whiteboard', subType: 'state', payload: json });
    }

    // Root handler for all incoming whiteboard messages from the server
    function handleRemoteUpdate(data) {
        switch (data.subType) {
            case 'state': // Full canvas update
                isUpdatingFromRemote = true;
                canvas.loadFromJSON(data.payload, () => {
                    canvas.renderAll();
                    isUpdatingFromRemote = false;
                });
                break;
            case 'fog_state': // Full fog state for newly connected users
                if (data.payload.isOn && !isFogOn) {
                    toggleFog(true, true); // Turn on fog locally
                    // Re-create all erased paths
                    data.payload.paths.forEach(pathJSON => {
                        fabric.util.enlivenObjects([pathJSON], (objects) => {
                            fogClipGroup.addWithUpdate(objects[0]);
                            canvas.renderAll();
                        });
                    });
                }
                break;
            case 'fog_toggle': // Another user toggled fog
                toggleFog(data.payload.isOn, true);
                break;
            case 'fog_erase': // Another user erased a path
                 if (isFogOn && fogClipGroup) {
                    fabric.util.enlivenObjects([data.payload], (objects) => {
                        fogClipGroup.addWithUpdate(objects[0]);
                        canvas.renderAll();
                    });
                }
                break;
            case 'pointer': // Another user is using the laser pointer
                handleRemotePointer(data);
                break;
        }
    }

    // Register the handler with the main app script
    if (window.app && window.app.registerMessageHandler) {
        window.app.registerMessageHandler('whiteboard', handleRemoteUpdate);
    }

    // --- Feature Implementations ---

    // Handles showing/hiding pointers from other users
    function handleRemotePointer({ sender, payload }) {
        let pointer = remotePointers[sender];
        if (payload.active) { // Move or create pointer
            if (!pointer) {
                pointer = new fabric.Circle({
                    radius: 5, fill: 'red', originX: 'center', originY: 'center',
                    selectable: false, evented: false,
                });
                remotePointers[sender] = pointer;
                canvas.add(pointer);
            }
            pointer.set({ left: payload.x, top: payload.y });
        } else { // Remove pointer
            if (pointer) {
                canvas.remove(pointer);
                delete remotePointers[sender];
            }
        }
        canvas.renderAll();
    }

    // Turns the fog of war layer on or off
    function toggleFog(newState, isRemote = false) {
        isFogOn = newState;
        if (isFogOn) {
            // The clip group holds the "erased" paths. Inverted means the paths are cutouts.
            fogClipGroup = new fabric.Group([], { inverted: true });
            fogRect = new fabric.Rect({
                width: canvas.width, height: canvas.height,
                fill: 'rgba(0,0,0,0.85)',
                selectable: false, evented: false,
                clipPath: fogClipGroup,
            });
            canvas.add(fogRect);
            fogRect.sendToBack(); // Ensure fog is below all tokens
        } else { // Turn off fog
            if (fogRect) canvas.remove(fogRect);
            fogRect = null; fogClipGroup = null;
            // Deactivate eraser mode if it was on
            if (canvas.isDrawingMode) {
                canvas.isDrawingMode = false;
                document.getElementById('erase-fog-btn').classList.remove('active');
            }
        }
        // Notify server unless this action was caused by a server message
        if (!isRemote) {
            window.app.sendMessage({ type: 'whiteboard', subType: 'fog_toggle', payload: { isOn: isFogOn } });
        }
        canvas.renderAll();
    }

    // --- Canvas Event Listeners ---
    canvas.on({
        'object:modified': sendCanvasState,
        'object:added': (e) => {
            // When adding an object, ensure it's on top of the fog layer
            if (isFogOn && e.target !== fogRect) e.target.bringToFront();
            sendCanvasState();
        },
        'object:removed': sendCanvasState,
        'path:created': (e) => {
            // When user finishes drawing a path in eraser mode
            if (isFogOn && canvas.isDrawingMode) {
                const path = e.path;
                path.set({ selectable: false, evented: false });
                fogClipGroup.addWithUpdate(path); // Add path to the clipping group
                canvas.remove(path); // Remove the visual path from the canvas
                canvas.renderAll();
                // Send the erased path to other clients
                window.app.sendMessage({ type: 'whiteboard', subType: 'fog_erase', payload: path.toJSON() });
            }
        },
        'mouse:down': (o) => {
            isMouseDown = true;
            if (!isPointerMode) return;
            const ptr = canvas.getPointer(o.e);
            window.app.sendMessage({ type: 'whiteboard', subType: 'pointer', payload: { x: ptr.x, y: ptr.y, active: true } });
        },
        'mouse:move': (o) => {
            if (!isPointerMode || !isMouseDown) return;
            const ptr = canvas.getPointer(o.e);
            window.app.sendMessage({ type: 'whiteboard', subType: 'pointer', payload: { x: ptr.x, y: ptr.y, active: true } });
        },
        'mouse:up': () => {
            isMouseDown = false;
            if (!isPointerMode) return;
            window.app.sendMessage({ type: 'whiteboard', subType: 'pointer', payload: { active: false } });
        }
    });

    // --- Toolbar Button Event Listeners ---
    document.getElementById('set-background-btn').addEventListener('click', () => {
        const imageUrl = prompt('Enter URL for background image:');
        if (imageUrl) {
            fabric.Image.fromURL(imageUrl, (img) => {
                canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
                    scaleX: canvas.width / img.width,
                    scaleY: canvas.height / img.height,
                });
                sendCanvasState();
            }, { crossOrigin: 'anonymous' });
        }
    });
    document.getElementById('add-image-btn').addEventListener('click', () => {
        const imageUrl = prompt('Enter URL for image token:');
        if (imageUrl) {
            fabric.Image.fromURL(imageUrl, (img) => {
                img.scaleToWidth(100);
                canvas.add(img);
                canvas.centerObject(img);
                canvas.setActiveObject(img);
            }, { crossOrigin: 'anonymous' });
        }
    });
    document.getElementById('add-text-btn').addEventListener('click', () => {
        const text = prompt('Enter text:');
        if (text) {
            const textbox = new fabric.Textbox(text, {
                left: 50, top: 50, width: 150, fontSize: 20,
                fill: document.getElementById('color-picker').value,
            });
            canvas.add(textbox);
            canvas.centerObject(textbox);
            canvas.setActiveObject(textbox);
        }
    });
    document.getElementById('draw-rect-btn').addEventListener('click', () => {
        const rect = new fabric.Rect({
            left: 100, top: 100,
            fill: document.getElementById('color-picker').value,
            width: 60, height: 70,
        });
        canvas.add(rect);
        canvas.centerObject(rect);
        canvas.setActiveObject(rect);
    });
    document.getElementById('draw-circle-btn').addEventListener('click', () => {
        const circle = new fabric.Circle({
            radius: 30,
            fill: document.getElementById('color-picker').value,
            left: 100, top: 100,
        });
        canvas.add(circle);
        canvas.centerObject(circle);
        canvas.setActiveObject(circle);
    });
    document.getElementById('toggle-fog-btn').addEventListener('click', () => toggleFog(!isFogOn));
    document.getElementById('erase-fog-btn').addEventListener('click', ()_ => {
        if (!isFogOn) return alert("Turn on the Fog of War first!");
        canvas.isDrawingMode = !canvas.isDrawingMode;
        document.getElementById('erase-fog-btn').classList.toggle('active', canvas.isDrawingMode);
    });
    document.getElementById('eraser-size').addEventListener('input', (e) => {
        canvas.freeDrawingBrush.width = parseInt(e.target.value, 10) || 10;
    });
    document.getElementById('pointer-mode-btn').addEventListener('click', () => {
        isPointerMode = !isPointerMode;
        document.getElementById('pointer-mode-btn').classList.toggle('active', isPointerMode);
        canvas.selection = !isPointerMode; // Disable object selection in pointer mode
    });

    // --- Initial Setup ---
    canvas.freeDrawingBrush.width = 20; // Default eraser size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
}
