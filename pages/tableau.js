window.initTableau = () => {
    // --- State & Setup ---
    const username = window.app.getUsername();
    let isUpdatingFromRemote = false;
    let isPointerMode = false;
    let remotePointers = {};
    let selectedNode = null;

    const stage = new Konva.Stage({
        container: 'canvas-container',
        width: window.innerWidth,
        height: window.innerHeight,
    });

    const backgroundLayer = new Konva.Layer();
    stage.add(backgroundLayer);

    let mainLayer = new Konva.Layer();
    stage.add(mainLayer);

    const pointerLayer = new Konva.Layer();
    stage.add(pointerLayer);

    const transformer = new Konva.Transformer();
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
                const oldNodes = mainLayer.find('Transformer');
                mainLayer.destroy();
                mainLayer = Konva.Node.create(data.payload, 'canvas-container');
                stage.add(mainLayer);
                mainLayer.add(oldNodes[0] ? oldNodes[0] : new Konva.Transformer()); // Restore transformer
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
        mainLayer.find('Shape, Text, Image').forEach(shape => {
            shape.on('dragend', sendState);
            shape.on('transformend', sendState);
        });
    }

    stage.on('click tap', function (e) {
        // if click on empty area - remove all transformers
        if (e.target === stage) {
            transformer.nodes([]);
            selectedNode = null;
            return;
        }
        // do nothing if clicked NOT on our rectangles
        if (!e.target.hasName('draggable')) {
            transformer.nodes([]);
            selectedNode = null;
            return;
        }
        // do we pressed transformer or a rect?
        const isTransformer = e.target.getParent().className === 'Transformer';
        if (isTransformer) return;

        // find a node by its id
        selectedNode = e.target;
        transformer.nodes([selectedNode]);
    });

    // --- Toolbar Actions ---
    function addNewShape(shape) {
        shape.name('draggable'); // Mark as draggable/selectable
        mainLayer.add(shape);
        shape.on('dragend', sendState);
        shape.on('transformend', sendState);
        sendState();
    }

    document.getElementById('addRect').addEventListener('click', () => addNewShape(new Konva.Rect({ x: 50, y: 50, width: 100, height: 100, fill: document.getElementById('colorPicker').value, draggable: true })));
    document.getElementById('addCircle').addEventListener('click', () => addNewShape(new Konva.Circle({ x: 150, y: 150, radius: 50, fill: document.getElementById('colorPicker').value, draggable: true })));
    document.getElementById('addText').addEventListener('click', () => addNewShape(new Konva.Text({ x: 250, y: 80, text: 'Nouveau Texte', fontSize: 30, fill: document.getElementById('colorPicker').value, draggable: true })));
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

    // --- Image Handling & Pointer ---
    const fileInputHandler = (e, callback) => { /* ... same as before ... */ };
    document.getElementById('addBackground').addEventListener('click', () => { /* ... same as before ... */ });
    document.getElementById('importImage').addEventListener('click', () => { /* ... same as before ... */ });

    const pointerBtn = document.getElementById('pointer-mode-btn');
    pointerBtn.addEventListener('click', () => {
        isPointerMode = !isPointerMode;
        pointerBtn.classList.toggle('active', isPointerMode);
    });

    stage.on('mousedown touchstart', () => {
        if (!isPointerMode) return;
        const pos = stage.getPointerPosition();
        window.app.sendMessage({ type: 'whiteboard', subType: 'pointer', payload: { x: pos.x, y: pos.y, active: true }});
    });
    stage.on('mousemove touchmove', () => {
        if (!isPointerMode || !stage.isDragging()) return;
        const pos = stage.getPointerPosition();
        window.app.sendMessage({ type: 'whiteboard', subType: 'pointer', payload: { x: pos.x, y: pos.y, active: true }});
    });
    stage.on('mouseup touchend', () => {
        if (!isPointerMode) return;
        window.app.sendMessage({ type: 'whiteboard', subType: 'pointer', payload: { active: false }});
        pointerLayer.destroyChildren();
    });

    function handleRemotePointer({ sender, payload }) {
        let pointer = remotePointers[sender];
        if (payload.active) {
            if (!pointer) {
                pointer = new Konva.Circle({ radius: 5, fill: 'red', perfectDrawEnabled: false });
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

    // --- Final Setup ---
    function resizeStage() { /* ... same as before ... */ }
    window.addEventListener('resize', resizeStage);
    resizeStage();
};
