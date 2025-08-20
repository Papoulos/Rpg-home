document.addEventListener('DOMContentLoaded', () => {
    // Only operate within the PJ tab content
    const pjContent = document.getElementById('pj-content');
    if (!pjContent) return; // Exit if not on a page with the PJ tab

    const sheetDisplayArea = document.getElementById('sheet-display-area');
    const sheetSelect = document.getElementById('sheet-select');
    const addSheetBtn = document.getElementById('add-sheet-btn');

    // Ensure all required elements are present
    if (!sheetDisplayArea || !sheetSelect || !addSheetBtn) {
        console.warn('Sheet components not found. The script will not run.');
        return;
    }

    const storageKey = 'googleSheets';
    let sheets = [];
    const originalMainContent = sheetDisplayArea.innerHTML;

    // --- Data Management ---

    function loadSheets() {
        const storedSheets = localStorage.getItem(storageKey);
        if (storedSheets) {
            sheets = JSON.parse(storedSheets);
            populateDropdown();
        }
    }

    function saveSheets() {
        localStorage.setItem(storageKey, JSON.stringify(sheets));
    }

    function formatSheetUrl(url) {
        // Attempt to convert a standard Google Sheet URL to an embeddable one.
        // This requires the sheet to be "Published to the web".
        // Example: /edit?usp=sharing -> /pubhtml
        // Example: /edit -> /pubhtml
        try {
            const urlObject = new URL(url);
            if (urlObject.hostname.includes('docs.google.com') && urlObject.pathname.includes('/spreadsheets/d/')) {
                return url.replace(/\/edit.*$/, '/pubhtml?widget=true&headers=false');
            }
        } catch (e) {
            // Ignore invalid URLs
        }
        // Return the original URL if it's not a standard Google Sheet link
        return url;
    }

    // --- UI Updates ---

    function populateDropdown() {
        // Clear existing options, keeping the placeholder
        while (sheetSelect.options.length > 1) {
            sheetSelect.remove(1);
        }

        sheets.forEach(sheet => {
            const option = document.createElement('option');
            option.value = sheet.url;
            option.textContent = sheet.name;
            sheetSelect.appendChild(option);
        });
    }

    function displaySheet(url) {
        sheetDisplayArea.innerHTML = ''; // Clear the display area

        if (url) {
            const iframe = document.createElement('iframe');
            iframe.src = url;
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            sheetDisplayArea.appendChild(iframe);
        } else {
            // Restore the original content if no sheet is selected
            sheetDisplayArea.innerHTML = originalMainContent;
        }
    }

    // --- Event Handlers ---

    function handleAddSheetClick() {
        const name = prompt('Entrez le nom de la fiche :');
        if (!name) return;

        const url = prompt('Entrez le lien web de la fiche Google Sheet :');
        if (!url) return;

        const formattedUrl = formatSheetUrl(url);

        sheets.push({ name, url: formattedUrl });
        saveSheets();
        populateDropdown();

        // Automatically select and display the new sheet
        sheetSelect.value = formattedUrl;
        displaySheet(formattedUrl);
    }

    function handleSheetSelectChange() {
        const selectedUrl = sheetSelect.value;
        displaySheet(selectedUrl);
    }

    // --- Initialization ---

    addSheetBtn.addEventListener('click', handleAddSheetClick);
    sheetSelect.addEventListener('change', handleSheetSelectChange);

    loadSheets();
});
