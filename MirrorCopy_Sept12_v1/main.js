// main.js
import { initSidebar } from './ui/sidebar.js';
import { initDashboard, fetchDashboardData } from './ui/dashboard.js'; // Import fetchDashboardData
import { initNews } from './ui/news.js';
import { initBomViewer } from './ui/bomViewer.js';
import { initChat, startNewChat } from './ui/chat.js';

document.addEventListener('DOMContentLoaded', () => {

    // --- View Management ---
    const dashboardSection = document.getElementById('dashboard-section');
    const bomViewerWrapper = document.getElementById('bom-viewer-wrapper');
    const chatSection = document.getElementById('chat-section');
    const newsMatrixSection = document.getElementById('news-matrix-section');
    
    const contentPanels = [
        newsMatrixSection, 
        document.getElementById('broken-networks-section'), 
        document.getElementById('bottlenecks-subcards-section'), 
        document.getElementById('results-container'), 
        document.getElementById('affected-orders-section')
    ];

    function showDashboardContent(elementToShow) {
        contentPanels.forEach(panel => { if (panel) panel.classList.add('hidden'); });
        if (elementToShow) { elementToShow.classList.remove('hidden'); }
    }
    
    function showDashboard() {
        dashboardSection.classList.remove('hidden');
        bomViewerWrapper.classList.add('hidden');
        chatSection.classList.add('hidden');
        showDashboardContent(newsMatrixSection);
    }
    
    function showBomViewer() {
        dashboardSection.classList.add('hidden');
        bomViewerWrapper.classList.remove('hidden');
        chatSection.classList.add('hidden');
        document.getElementById('sku-properties-display').classList.add('hidden');
        const oldGraph = document.getElementById('bom-viewer-graph');
        if (oldGraph) oldGraph.remove();
    }
    
    function showChatView() {
        dashboardSection.classList.add('hidden');
        bomViewerWrapper.classList.add('hidden');
        chatSection.classList.remove('hidden');
    }

    // --- Initializations from Modules ---
    initSidebar();
    initDashboard(showDashboardContent, fetchDashboardData);
    initNews();
    initBomViewer(showDashboardContent);
    initChat(showChatView, startNewChat, () => renderChatHistory(showChatView));

    // --- Main Navigation ---
    document.getElementById('dashboard-option').addEventListener('click', showDashboard);
    document.getElementById('bom-viewer-option').addEventListener('click', showBomViewer);
    document.getElementById('new-chat-option').addEventListener('click', () => {
        showChatView();
        startNewChat();
    });

    // --- Initial View ---
    showDashboard();
    fetchDashboardData(); // Make the initial call to load card data
});