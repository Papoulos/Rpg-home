// This script now only defines the handler functions and exposes them globally.
// The attachment of event listeners is now handled by script.js to ensure correct timing.

window.imageHandlers = {
    // Handler to add a new image
    handleAddImage: () => {
        if (!window.socket) return;
        const name = prompt('Entrez le nom de l\'image :');
        if (!name) return;

        const url = prompt('Entrez le lien web de l\'image :');
        if (!url) return;

        try {
            new URL(url);
        } catch (_) {
            alert('Veuillez entrer une URL valide.');
            return;
        }

        window.socket.send(JSON.stringify({ type: 'add-image', name, url }));
    },

    // Handler to delete the selected image
    handleDeleteImage: () => {
        if (!window.socket) return;
        const imageSelect = document.getElementById('image-select');
        const selectedUrl = imageSelect.value;

        if (selectedUrl) {
            const selectedName = imageSelect.options[imageSelect.selectedIndex].text;
            if (confirm(`Êtes-vous sûr de vouloir supprimer l'image "${selectedName}" ?`)) {
                window.socket.send(JSON.stringify({ type: 'delete-image', url: selectedUrl }));
            }
        } else {
            alert('Veuillez sélectionner une image à supprimer.');
        }
    },

    // Handler to show the selected image to all users
    handleShowImage: () => {
        if (!window.socket) return;
        const imageSelect = document.getElementById('image-select');
        const selectedUrl = imageSelect.value;
        window.socket.send(JSON.stringify({ type: 'show-image', url: selectedUrl }));
    },

    // Handler to update the image dropdown list
    handleImageListUpdate: (event) => {
        const imageSelect = document.getElementById('image-select');
        if (!imageSelect) return;

        const imageList = event.detail.list;
        const selectedValue = imageSelect.value;

        while (imageSelect.options.length > 1) {
            imageSelect.remove(1);
        }

        imageList.forEach(image => {
            const option = document.createElement('option');
            option.value = image.url;
            option.textContent = image.name;
            imageSelect.appendChild(option);
        });

        imageSelect.value = selectedValue;
    }
};

// The 'image-list-update' event is still handled here as it's not MJ-specific
// and needs to be active for all users at all times.
window.addEventListener('image-list-update', window.imageHandlers.handleImageListUpdate);
