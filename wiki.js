document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('wiki-content')) return;

    // --- DOM Elements ---
    const pageSelect = document.getElementById('wiki-page-select');
    const addPageBtn = document.getElementById('wiki-add-page-btn');
    const addMJPageBtn = document.getElementById('wiki-add-mj-page-btn');

    const viewer = document.getElementById('wiki-viewer');
    const editor = document.getElementById('wiki-editor');
    const wikiTitle = document.getElementById('wiki-title');
    const wikiBody = document.getElementById('wiki-body');
    const editorTitle = document.getElementById('wiki-editor-title');
    const editBtn = document.getElementById('wiki-edit-btn');
    const saveBtn = document.getElementById('wiki-save-btn');
    const cancelBtn = document.getElementById('wiki-cancel-btn');

    let easyMDE;
    let currentPage = null;
    let isMJ = window.isMJ || false;
    const markdownConverter = new showdown.Converter();
    let isNewPageMJ = false;

    // --- WebSocket Communication ---
    function sendWikiMessage(payload) {
        if (window.socket && window.socket.readyState === WebSocket.OPEN) {
            window.socket.send(JSON.stringify(payload));
        } else {
            console.error("Wiki: WebSocket is not connected.");
        }
    }

    // --- Editor Setup ---
    function initializeEditor() {
        if (!easyMDE) {
            easyMDE = new EasyMDE({
                element: document.getElementById('wiki-textarea'),
                spellChecker: false, status: false,
                toolbar: ["bold", "italic", "heading", "|", "quote", "unordered-list", "ordered-list", "|", "link", "image", "|", "preview", "side-by-side", "fullscreen", "|", "guide"]
            });
        }
    }

    // --- UI State & Rendering ---
    function showViewer() {
        viewer.style.display = 'block';
        editor.style.display = 'none';
        editBtn.style.display = currentPage ? 'block' : 'none';
    }

    function showEditor(isNew = false) {
        viewer.style.display = 'none';
        editor.style.display = 'flex';
        editBtn.style.display = 'none';
        initializeEditor();
        if (isNew) {
            editorTitle.value = '';
            easyMDE.value('');
        } else if (currentPage) {
            editorTitle.value = currentPage.pageName;
            easyMDE.value(currentPage.content);
        }
    }

    function renderPage(pageData) {
        currentPage = pageData;
        if (currentPage) {
            wikiTitle.textContent = currentPage.pageName.replace(/_/g, ' ');
            wikiBody.innerHTML = markdownConverter.makeHtml(currentPage.content);
            // Update select dropdown to show the current page
            pageSelect.value = `${currentPage.pageName}|${currentPage.isMJPage}`;
        } else {
            wikiTitle.textContent = 'Bienvenue sur le Wiki';
            wikiBody.innerHTML = '<p>Sélectionnez une page dans le menu déroulant pour commencer, ou créez-en une nouvelle avec les boutons \'+\'.</p>';
            pageSelect.value = "";
        }
        showViewer();
    }

    function updatePageList(publicPages, mjPages) {
        const selectedValue = pageSelect.value;

        // Clear existing options
        pageSelect.innerHTML = '<option value="">Choisir une page</option>';

        // Create and append public pages
        const publicOptgroup = document.createElement('optgroup');
        publicOptgroup.label = 'Pages Publiques';
        publicPages.forEach(pageName => {
            const option = document.createElement('option');
            option.value = `${pageName}|false`;
            option.textContent = pageName.replace(/_/g, ' ');
            publicOptgroup.appendChild(option);
        });
        pageSelect.appendChild(publicOptgroup);

        // Create and append MJ pages if user is MJ
        if (isMJ && mjPages.length > 0) {
            const mjOptgroup = document.createElement('optgroup');
            mjOptgroup.label = 'Pages MJ';
            mjPages.forEach(pageName => {
                const option = document.createElement('option');
                option.value = `${pageName}|true`;
                option.textContent = pageName.replace(/_/g, ' ');
                mjOptgroup.appendChild(option);
            });
            pageSelect.appendChild(mjOptgroup);
        }

        // Restore selection if possible
        pageSelect.value = selectedValue;
    }

    // --- Data Logic ---
    function requestPage(pageName, isMJPage) {
        sendWikiMessage({ type: 'wiki-get-page', pageName, isMJPage });
    }

    // --- Event Listeners ---
    pageSelect.addEventListener('change', () => {
        const selected = pageSelect.value;
        if (selected) {
            const [pageName, isMJPageStr] = selected.split('|');
            requestPage(pageName, isMJPageStr === 'true');
        }
    });

    editBtn.addEventListener('click', () => showEditor(false));
    cancelBtn.addEventListener('click', showViewer);

    saveBtn.addEventListener('click', () => {
        let isSaveMJ = isNewPageMJ;
        if (currentPage) {
            isSaveMJ = currentPage.isMJPage;
        }

        const newTitle = editorTitle.value.trim().replace(/\s+/g, '_');
        const newContent = easyMDE.value();

        if (!newTitle) {
            alert('Le titre ne peut pas être vide.');
            return;
        }

        // Optimistic UI Update
        const pageData = { pageName: newTitle, content: newContent, isMJPage: isSaveMJ };
        renderPage(pageData);

        // Send data to server
        sendWikiMessage({ type: 'wiki-save-page', pageName: newTitle, content: newContent, isMJPage: isSaveMJ });
    });

    addPageBtn.addEventListener('click', () => {
        currentPage = null;
        isNewPageMJ = false;
        pageSelect.value = "";
        showEditor(true);
    });

    addMJPageBtn.addEventListener('click', () => {
        currentPage = null;
        isNewPageMJ = true;
        pageSelect.value = "";
        showEditor(true);
    });

    window.addEventListener('wiki-update-list', (event) => {
        const { publicPages, mjPages } = event.detail;
        updatePageList(publicPages, mjPages);
        // If no page is selected, and we have pages, request the first public one
        if (!currentPage && publicPages.length > 0) {
            requestPage(publicPages[0], false);
        }
    });

    window.addEventListener('wiki-update-page', (event) => {
        renderPage(event.detail);
    });

    window.addEventListener('mj-status', (event) => {
        isMJ = event.detail.isMJ;
        // Show/hide the MJ-only add button
        addMJPageBtn.classList.toggle('hidden', !isMJ);
        // We might need to re-render the list if the user just became MJ
        // and there are MJ pages to show. A simple request for the list will do.
        if (isMJ) {
            sendWikiMessage({ type: 'wiki-get-list' }); // We'll need to implement this simple endpoint
        }
    });

    // --- Initial Load ---
    renderPage(null);
    addMJPageBtn.classList.toggle('hidden', !isMJ);
});
