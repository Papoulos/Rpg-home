document.addEventListener('DOMContentLoaded', () => {
    const menuItems = document.querySelectorAll('.main-menu .menu-item');
    const tabContents = document.querySelectorAll('.tab-content');

    function showTab(targetId) {
        // Hide all tab contents
        tabContents.forEach(tab => {
            tab.style.display = 'none';
        });

        // Remove active class from all menu items
        menuItems.forEach(item => {
            item.classList.remove('active');
        });

        // Show the target tab content
        const targetTab = document.getElementById(targetId);
        if (targetTab) {
            targetTab.style.display = 'flex'; // Use flex to match potential inner layout needs
        }

        // Add active class to the clicked menu item
        const activeMenuItem = document.querySelector(`.menu-item[data-target="${targetId}"]`);
        if (activeMenuItem) {
            activeMenuItem.classList.add('active');
        }
    }

    // Add click event listeners to menu items
    menuItems.forEach(item => {
        item.addEventListener('click', (event) => {
            event.preventDefault();
            const targetId = item.getAttribute('data-target');
            // Update URL hash without jumping
            history.pushState(null, null, `#${targetId.replace('-content', '')}`);
            showTab(targetId);
        });
    });

    // Initial tab display logic
    function initialTabDisplay() {
        const hash = window.location.hash.substring(1); // e.g., "pj"
        let initialTargetId = 'carte-content'; // Default tab

        if (hash) {
            const potentialTargetId = `${hash}-content`;
            if (document.getElementById(potentialTargetId)) {
                initialTargetId = potentialTargetId;
            }
        }

        showTab(initialTargetId);
    }

    // Handle back/forward browser navigation
    window.addEventListener('popstate', initialTabDisplay);

    // Show the initial tab
    initialTabDisplay();
});
