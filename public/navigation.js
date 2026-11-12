document.addEventListener('DOMContentLoaded', () => {
    const tablist = document.querySelector('.main-menu');
    const menuItems = document.querySelectorAll('.main-menu .menu-item');
    const tabContents = document.querySelectorAll('.tab-content');

    function showTab(targetId) {
        const isMJ = Boolean(window.isMJ);

        // Hide all inactive tab contents using hidden="until-found" (or boolean hidden for MJ-only music tab when not MJ)
        tabContents.forEach(tab => {
            if (tab.id === targetId) {
                tab.hidden = false;
                tab.removeAttribute('hidden');
            } else if (tab.id === 'music-content' && !isMJ) {
                tab.hidden = true;
            } else {
                tab.setAttribute('hidden', 'until-found');
            }
        });

        // Update ARIA selection and focusgroup entry point on tab items
        menuItems.forEach(item => {
            const isSelected = item.getAttribute('data-target') === targetId;
            item.classList.toggle('active', isSelected);
            item.setAttribute('aria-selected', String(isSelected));
            item.toggleAttribute('focusgroupstart', isSelected);
            if (!('focusGroup' in HTMLElement.prototype)) {
                item.tabIndex = isSelected ? 0 : -1;
            }
        });
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

    // Roving tabindex + arrow key fallback for browsers without native focusgroup
    if (tablist && !('focusGroup' in HTMLElement.prototype)) {
        tablist.addEventListener('keydown', (event) => {
            const visibleTabs = [...menuItems].filter(item => !item.classList.contains('hidden'));
            const currentIndex = visibleTabs.indexOf(document.activeElement);
            if (currentIndex === -1) return;

            let nextIndex = currentIndex;
            if (event.key === 'ArrowRight') {
                nextIndex = Math.min(currentIndex + 1, visibleTabs.length - 1);
            } else if (event.key === 'ArrowLeft') {
                nextIndex = Math.max(currentIndex - 1, 0);
            } else if (event.key === 'Home') {
                nextIndex = 0;
            } else if (event.key === 'End') {
                nextIndex = visibleTabs.length - 1;
            } else {
                return;
            }

            event.preventDefault();
            const nextTab = visibleTabs[nextIndex];
            if (nextTab) {
                nextTab.focus();
                nextTab.click();
            }
        });
    }

    // Sync tab state when browser Find-in-Page reveals a hidden="until-found" panel
    tabContents.forEach(panel => {
        panel.addEventListener('beforematch', () => {
            const targetId = panel.id;
            history.replaceState(null, null, `#${targetId.replace('-content', '')}`);
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

    // Listen for MJ status to show/hide the music tab
    window.addEventListener('mj-status', (event) => {
        const musicNavItem = document.getElementById('music-nav-item');
        const musicContent = document.getElementById('music-content');
        if (musicNavItem) {
            if (event.detail.isMJ) {
                musicNavItem.classList.remove('hidden');
                if (musicContent && musicContent.hidden && window.location.hash !== '#music') {
                    musicContent.setAttribute('hidden', 'until-found');
                }
            } else {
                musicNavItem.classList.add('hidden');
                if (musicContent) {
                    musicContent.hidden = true;
                }
                // If the current tab is music, switch to default
                if (window.location.hash === '#music') {
                    showTab('carte-content');
                }
            }
        }
    });
});
