document.addEventListener('DOMContentLoaded', () => {
    // Note: The global `socket` is exposed by script.js
    if (typeof socket === 'undefined') {
        console.error('Socket is not available. Make sure script.js is loaded first.');
        return;
    }

    const imageControls = document.querySelector('.image-controls');
    const addImageBtn = document.getElementById('add-image-btn');
    const deleteImageBtn = document.getElementById('delete-image-btn');
    const imageSelect = document.getElementById('image-select');

    if (!imageControls || !addImageBtn || !deleteImageBtn || !imageSelect) {
        // The user is not the MJ or on a page without these controls.
        return;
    }

    // --- Event Handlers ---

    function handleAddImage() {
        const name = prompt('Entrez le nom de l\'image :');
        if (!name) return;

        const url = prompt('Entrez le lien web de l\'image :');
        if (!url) return;

        // Basic URL validation
        try {
            new URL(url);
        } catch (_) {
            alert('Veuillez entrer une URL valide.');
            return;
        }

        socket.send(JSON.stringify({ type: 'add-image', name, url }));
    }

    function handleDeleteImage() {
        const selectedUrl = imageSelect.value;
        if (selectedUrl) {
            const selectedName = imageSelect.options[imageSelect.selectedIndex].text;
            if (confirm(`Êtes-vous sûr de vouloir supprimer l'image "${selectedName}" ?`)) {
                socket.send(JSON.stringify({ type: 'delete-image', url: selectedUrl }));
            }
        } else {
            alert('Veuillez sélectionner une image à supprimer.');
        }
    }

    function handleShowImage() {
        const selectedUrl = imageSelect.value;
        // The 'show-image' event is sent even for the placeholder,
        // which will have an empty value. The server will broadcast this,
        // and the client will clear the image display.
        socket.send(JSON.stringify({ type: 'show-image', url: selectedUrl }));
    }

    // --- WebSocket Event Listeners (via window events) ---

    function showMJControls() {
        imageControls.classList.remove('hidden');
    }

    window.addEventListener('mj-status', (e) => {
        if (e.detail.isMJ) {
            showMJControls();
        }
    });

    window.addEventListener('image-list-update', (e) => {
        const imageList = e.detail.list;
        const selectedValue = imageSelect.value;

        // Clear existing options (keeping the placeholder)
        while (imageSelect.options.length > 1) {
            imageSelect.remove(1);
        }

        // Populate with new list
        imageList.forEach(image => {
            const option = document.createElement('option');
            option.value = image.url;
            option.textContent = image.name;
            imageSelect.appendChild(option);
        });

        // Restore selection if possible
        imageSelect.value = selectedValue;
    });

    // --- Initial Setup ---

    // Check the global flag on load, in case the event was missed
    if (window.isMJ) {
        showMJControls();
    }

    addImageBtn.addEventListener('click', handleAddImage);
    deleteImageBtn.addEventListener('click', handleDeleteImage);
    imageSelect.addEventListener('change', handleShowImage);
});
