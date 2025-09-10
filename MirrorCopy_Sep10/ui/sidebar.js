// ui/sidebar.js

/**
 * Sets the collapsed or expanded state of the sidebar and main content area.
 * @param {boolean} isExpanded - True to expand the sidebar, false to collapse.
 */
const setSidebarState = (isExpanded) => {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');

    if (isExpanded) {
        sidebar.classList.add('expanded');
        mainContent.classList.add('expanded');
        localStorage.setItem('sidebarState', 'expanded');
    } else {
        sidebar.classList.remove('expanded');
        mainContent.classList.remove('expanded');
        localStorage.setItem('sidebarState', 'collapsed');
    }
};

/**
 * Initializes all sidebar functionality, including event listeners and loading the saved state.
 */
export function initSidebar() {
    const logoFull = document.getElementById('logo-full');
    const logoShort = document.getElementById('logo-short');
    
    logoFull.addEventListener('click', () => setSidebarState(false));
    logoShort.addEventListener('click', () => setSidebarState(true));

    const savedState = localStorage.getItem('sidebarState');
    if (savedState === 'expanded') {
        setSidebarState(true);
    } else {
        setSidebarState(false);
    }
}