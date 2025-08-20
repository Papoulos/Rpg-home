// This script will be responsible for managing the image-related UI and interactions for the MJ.
document.addEventListener('DOMContentLoaded', () => {
    const imageControls = document.getElementById('image-controls');
    const addImageBtn = document.getElementById('add-image-btn');
    const deleteImageBtn = document.getElementById('delete-image-btn');
    const showImageBtn = document.getElementById('show-image-btn');
    const imageNameInput = document.getElementById('image-name-input');
    const imageUrlInput = document.getElementById('image-url-input');
    const imageSelect = document.getElementById('image-select');

    // This global socket instance is defined in script.js
    // We need to ensure this script is loaded after script.js, which it is in index.html
    // A more robust solution might use a shared module or a global event bus.
    const socket = window.socket;

    function handleAddImage() {
        const name = imageNameInput.value.trim();
        const url = imageUrlInput.value.trim();

        if (name && url) {
            socket.send(JSON.stringify({ type: 'add-image', name, url }));
            imageNameInput.value = '';
            imageUrlInput.value = '';
        } else {
            alert('Veuillez fournir un nom et une URL pour l\'image.');
        }
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
        if (selectedUrl) {
            socket.send(JSON.stringify({ type: 'show-image', url: selectedUrl }));
        } else {
            alert('Veuillez sélectionner une image à afficher.');
        }
    }

    window.addEventListener('mj-status', (e) => {
        if (e.detail.isMJ) {
            imageControls.classList.remove('hidden');
        }
    });

    window.addEventListener('image-list-update', (e) => {
        const imageList = e.detail.list;

        // Preserve the currently selected value
        const selectedValue = imageSelect.value;

        // Clear existing options
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

    // Add event listeners
    addImageBtn.addEventListener('click', handleAddImage);
    deleteImageBtn.addEventListener('click', handleDeleteImage);
    showImageBtn.addEventListener('click', handleShowImage);
});
