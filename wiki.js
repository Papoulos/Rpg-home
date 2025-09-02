document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('wiki-content')) return;

    // --- DOM Elements ---
    const pageList = document.getElementById('wiki-page-list');
    const mjPageList = document.getElementById('wiki-mj-page-list');
    const mjControls = document.getElementById('wiki-mj-controls');
    const viewer = document.getElementById('wiki-viewer');
    const editor = document.getElementById('wiki-editor');
    const wikiTitle = document.getElementById('wiki-title');
    const wikiBody = document.getElementById('wiki-body');
    const editorTitle = document.getElementById('wiki-editor-title');
    const editBtn = document.getElementById('wiki-edit-btn');
    const saveBtn = document.getElementById('wiki-save-btn');
    const cancelBtn = document.getElementById('wiki-cancel-btn');
    const addPageBtn = document.createElement('button');
    addPageBtn.textContent = '+ Nouvelle Page';
    addPageBtn.className = 'new-page-btn';
    pageList.before(addPageBtn);
    const addMJPageBtn = document.createElement('button');
    addMJPageBtn.textContent = '+ Nouvelle Page MJ';
    addMJPageBtn.className = 'new-page-btn';
    mjPageList.before(addMJPageBtn);

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
            updateActiveListItem();
        } else {
            wikiTitle.textContent = 'Bienvenue sur le Wiki';
            wikiBody.innerHTML = '<p>Sélectionnez une page sur la gauche pour commencer. Si aucune page n\'existe, créez-en une!</p>';
        }
        showViewer();
    }

    function updatePageList(publicPages, mjPages) {
        const createListItems = (pages, listElement, isMJPage) => {
            listElement.innerHTML = '';
            pages.forEach(pageName => {
                const li = document.createElement('li');
                li.textContent = pageName.replace(/_/g, ' ');
                li.dataset.pageName = pageName;
                li.dataset.isMjPage = isMJPage;
                li.addEventListener('click', () => requestPage(pageName, isMJPage));
                listElement.appendChild(li);
            });
        };
        createListItems(publicPages, pageList, false);
        if (isMJ) {
            mjControls.classList.remove('hidden');
            createListItems(mjPages, mjPageList, true);
        } else {
            mjControls.classList.add('hidden');
        }
        updateActiveListItem();
    }

    function updateActiveListItem() {
        document.querySelectorAll('#wiki-page-list li, #wiki-mj-page-list li').forEach(li => {
            const isTarget = currentPage && li.dataset.pageName === currentPage.pageName && JSON.parse(li.dataset.isMjPage) === currentPage.isMJPage;
            li.classList.toggle('active', isTarget);
        });
    }

    // --- Data Logic ---
    function requestPage(pageName, isMJPage) {
        sendWikiMessage({ type: 'wiki-get-page', pageName, isMJPage });
    }

    function savePage(isMJPage) {
        const pageName = editorTitle.value.trim().replace(/\s+/g, '_');
        const content = easyMDE.value();
        if (!pageName) {
            alert('Le titre ne peut pas être vide.');
            return;
        }
        sendWikiMessage({ type: 'wiki-save-page', pageName, content, isMJPage });
    }

    // --- Event Listeners ---
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
        const pageData = {
            pageName: newTitle,
            content: newContent,
            isMJPage: isSaveMJ
        };
        renderPage(pageData);

        // Send data to server in the background
        sendWikiMessage({ type: 'wiki-save-page', pageName: newTitle, content: newContent, isMJPage: isSaveMJ });
    });
    addPageBtn.addEventListener('click', () => {
        currentPage = null;
        isNewPageMJ = false;
        updateActiveListItem();
        showEditor(true);
    });
    addMJPageBtn.addEventListener('click', () => {
        currentPage = null;
        isNewPageMJ = true;
        updateActiveListItem();
        showEditor(true);
    });

    window.addEventListener('wiki-update-list', (event) => {
        const { publicPages, mjPages } = event.detail;
        updatePageList(publicPages, mjPages);
        if (!currentPage && publicPages.length > 0) {
            requestPage(publicPages[0], false);
        } else if (!currentPage && isMJ && mjPages.length > 0) {
            requestPage(mjPages[0], true);
        }
    });

    window.addEventListener('wiki-update-page', (event) => {
        renderPage(event.detail);
    });

    window.addEventListener('mj-status', (event) => {
        isMJ = event.detail.isMJ;
        mjControls.classList.toggle('hidden', !isMJ);
        addMJPageBtn.classList.toggle('hidden', !isMJ);
    });

    // --- Initial Load ---
    renderPage(null);
    mjControls.classList.toggle('hidden', !isMJ);
    addMJPageBtn.classList.toggle('hidden', !isMJ);
});
