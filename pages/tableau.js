window.initTableau = () => {
    // --- State & Setup ---
    const username = window.app.getUsername();
    let isUpdatingFromRemote = false;
    let isPointerMode = false;
    let remotePointers = {};
    let selectedNode = null;

    const stage = new Konva.Stage({ container: 'canvas-container', width: 0, height: 0 });
    const backgroundLayer = new Konva.Layer();
    const mainLayer = new Konva.Layer();
    const pointerLayer = new Konva.Layer();
    const transformer = new Konva.Transformer({ keepRatio: true, ignoreStroke: true });

    stage.add(backgroundLayer, mainLayer, pointerLayer);
    mainLayer.add(transformer);

    // --- Real-time Collaboration ---
    function sendState() {
        if (isUpdatingFromRemote || isPointerMode) return;
        const layerJson = mainLayer.toJSON();
        window.app.sendMessage({ type: 'whiteboard', subType: 'state', payload: layerJson });
    }

    function handleWhiteboardUpdate(data) {
        if (data.sender === username) return;

        switch (data.subType) {
            case 'state':
                isUpdatingFromRemote = true;
                transformer.nodes([]); // Deselect before destroying
                mainLayer.destroyChildren(); // Clear the layer
                Konva.Node.create(JSON.parse(data.payload), 'canvas-container').children.forEach(node => {
                    mainLayer.add(node);
                });
                mainLayer.add(transformer); // Re-add transformer
                attachAllListeners();
                isUpdatingFromRemote = false;
                break;
            case 'pointer':
                handleRemotePointer(data);
                break;
        }
    }
    window.app.registerMessageHandler('whiteboard', handleWhiteboardUpdate);

    // --- Event Handling ---
    function attachAllListeners() {
        mainLayer.find('Rect, Circle, Text, Image').forEach(shape => {
            shape.on('dragend', sendState);
            shape.on('transformend', sendState);
        });
    }

    stage.on('click tap', function (e) {
        if (isPointerMode) return;
        if (e.target === stage) {
            transformer.nodes([]);
            selectedNode = null;
            return;
        }
        if (e.target.draggable()) {
            selectedNode = e.target;
            transformer.nodes([selectedNode]);
        } else {
            transformer.nodes([]);
            selectedNode = null;
        }
    });

    // --- Toolbar Actions ---
    function addNewShape(shape) {
        mainLayer.add(shape);
        attachAllListeners();
        sendState();
    }

    document.getElementById('addRect').addEventListener('click', () => addNewShape(new Konva.Rect({ x: 50, y: 50, width: 100, height: 100, fill: document.getElementById('colorPicker').value, draggable: true })));
    document.getElementById('addCircle').addEventListener('click', () => addNewShape(new Konva.Circle({ x: 150, y: 150, radius: 50, fill: document.getElementById('colorPicker').value, draggable: true })));
    document.getElementById('addText').addEventListener('click', () => addNewShape(new Konva.Text({ x: 250, y: 80, text: 'Nouveau Texte', fontSize: 30, fill: document.getElementById('colorPicker').value, draggable: true })));
    document.getElementById('addPawn').addEventListener('click', () => addNewShape(new Konva.Circle({ x: 100, y: 100, radius: 20, fill: document.getElementById('colorPicker').value, draggable: true, stroke: 'black', strokeWidth: 2 })));

    document.getElementById('changeColor').addEventListener('click', () => {
        if (selectedNode) {
            selectedNode.fill(document.getElementById('colorPicker').value);
            sendState();
        }
    });
    document.getElementById('deleteObject').addEventListener('click', () => {
        if (selectedNode) {
            selectedNode.destroy();
            transformer.nodes([]);
            sendState();
        }
    });
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedNode) {
                selectedNode.destroy();
                transformer.nodes([]);
                sendState();
            }
        }
    });

    const fileInputHandler = (e, callback) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => { const image = new Image(); image.src = reader.result; image.onload = () => callback(image); };
        reader.readAsDataURL(file);
    };

    document.getElementById('addBackground').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = e => fileInputHandler(e, (imageObj) => {
            backgroundLayer.destroyChildren();
            const konvaImage = new Konva.Image({ image: imageObj, width: stage.width(), height: stage.height() });
            backgroundLayer.add(konvaImage);
        });
        input.click();
    });

    document.getElementById('importImage').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = e => fileInputHandler(e, (imageObj) => {
            const konvaImage = new Konva.Image({ image: imageObj, x: 50, y: 50, draggable: true });
            const maxWidth = stage.width() * 0.8;
            if (konvaImage.width() > maxWidth) konvaImage.scaleX(maxWidth / konvaImage.width());
            if (konvaImage.height() > stage.height() * 0.8) konvaImage.scaleY(maxHeight / konvaImage.height());
            addNewShape(konvaImage);
        });
        input.click();
    });

    // --- Pointer Logic ---
    function handleRemotePointer({ sender, payload }) {
        let pointer = remotePointers[sender];
        if (payload.active) {
            if (!pointer) {
                pointer = new Konva.Circle({ radius: 5, fill: 'red', listening: false });
                remotePointers[sender] = pointer;
                pointerLayer.add(pointer);
            }
            pointer.position({ x: payload.x, y: payload.y });
        } else {
            if (pointer) {
                pointer.destroy();
                delete remotePointers[sender];
            }
        }
    }
    const pointerBtn = document.getElementById('pointer-mode-btn');
    pointerBtn.addEventListener('click', () => { isPointerMode = !isPointerMode; pointerBtn.classList.toggle('active', isPointerMode); });

    stage.on('mousedown touchstart', (e) => {
        if (!isPointerMode) return;
        const pos = stage.getPointerPosition();
        window.app.sendMessage({ type: 'whiteboard', subType: 'pointer', payload: { x: pos.x, y: pos.y, active: true } });
        e.evt.preventDefault();
    });
    stage.on('mousemove touchmove', (e) => {
        if (!isPointerMode || !e.evt.buttons) return;
        const pos = stage.getPointerPosition();
        window.app.sendMessage({ type: 'whiteboard', subType: 'pointer', payload: { x: pos.x, y: pos.y, active: true } });
        e.evt.preventDefault();
    });
    stage.on('mouseup touchend', () => {
        if (!isPointerMode) return;
        window.app.sendMessage({ type: 'whiteboard', subType: 'pointer', payload: { active: false } });
    });

    // --- Final Setup ---
    function resizeStage() {
        const container = document.querySelector('#canvas-container');
        if (!container) return;
        stage.width(container.offsetWidth);
        stage.height(container.offsetHeight);
    }
    window.addEventListener('resize', resizeStage);
    resizeStage();
};
