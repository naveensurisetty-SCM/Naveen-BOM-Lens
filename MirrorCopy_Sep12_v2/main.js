import { initSidebar } from './ui/sidebar.js';
import { initDashboard, fetchDashboardData } from './ui/dashboard.js';
import { initNews } from './ui/news.js';
import { initBomViewer } from './ui/bomViewer.js';
import { initChat, startNewChat } from './ui/chat.js';
// ## MODIFICATION START ##
import { initConstraintAnalysis } from './ui/constraintAnalysis.js';
// ## MODIFICATION END ##

document.addEventListener('DOMContentLoaded', () => {

    // --- View Management ---
    const dashboardSection = document.getElementById('dashboard-section');
    const bomViewerWrapper = document.getElementById('bom-viewer-wrapper');
    const chatSection = document.getElementById('chat-section');
    // ## MODIFICATION START ##
    const constraintAnalysisSection = document.getElementById('constraint-analysis-section');
    // ## MODIFICATION END ##
    
    const contentPanels = [
        document.getElementById('news-matrix-section'), 
        document.getElementById('broken-networks-section'), 
        document.getElementById('bottlenecks-subcards-section'), 
        document.getElementById('results-container'), 
        document.getElementById('affected-orders-section')
    ];

    function showDashboardContent(elementToShow) {
        contentPanels.forEach(panel => { if (panel) panel.classList.add('hidden'); });
        if (elementToShow) { elementToShow.classList.remove('hidden'); }
    }

    // ## MODIFICATION START ##
    function hideAllViews() {
        dashboardSection.classList.add('hidden');
        bomViewerWrapper.classList.add('hidden');
        chatSection.classList.add('hidden');
        constraintAnalysisSection.classList.add('hidden');
    }
    // ## MODIFICATION END ##
    
    function showDashboard() {
        hideAllViews();
        dashboardSection.classList.remove('hidden');
        showDashboardContent(document.getElementById('news-matrix-section'));
    }
    
    function showBomViewer() {
        hideAllViews();
        bomViewerWrapper.classList.remove('hidden');
        document.getElementById('sku-properties-display').classList.add('hidden');
        const oldGraph = document.getElementById('bom-viewer-graph');
        if (oldGraph) oldGraph.remove();
    }
    
    function showChatView() {
        hideAllViews();
        chatSection.classList.remove('hidden');
    }

    // ## MODIFICATION START ##
    function showConstraintAnalysis() {
        hideAllViews();
        constraintAnalysisSection.classList.remove('hidden');
    }
    // ## MODIFICATION END ##

    // --- Initializations from Modules ---
    initSidebar();
    initDashboard(showDashboardContent, fetchDashboardData);
    initNews();
    initBomViewer(showDashboardContent);
    initChat(showChatView, startNewChat, () => renderChatHistory(showChatView));
    // ## MODIFICATION START ##
    initConstraintAnalysis();
    // ## MODIFICATION END ##


    // --- Main Navigation ---
    document.getElementById('dashboard-option').addEventListener('click', showDashboard);
    document.getElementById('bom-viewer-option').addEventListener('click', showBomViewer);
    document.getElementById('new-chat-option').addEventListener('click', () => {
        showChatView();
        startNewChat();
    });
    // ## MODIFICATION START ##
    document.getElementById('constraint-analysis-option').addEventListener('click', showConstraintAnalysis);
    // ## MODIFICATION END ##

    // --- Initial View ---
    showDashboard();
    fetchDashboardData(); // Make the initial call to load card data
});