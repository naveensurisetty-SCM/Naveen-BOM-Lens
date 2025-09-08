import { createNodeIcon } from './shape-library.js';
import { planConfig } from './config.js';

document.addEventListener('DOMContentLoaded', () => {

    // --- Sidebar Code ---
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    const logoFull = document.getElementById('logo-full');
    const logoShort = document.getElementById('logo-short');
    
    const setSidebarState = (isExpanded) => {
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

    logoFull.addEventListener('click', () => setSidebarState(false));
    logoShort.addEventListener('click', () => setSidebarState(true));

    const savedState = localStorage.getItem('sidebarState');
    if (savedState === 'expanded') {
        setSidebarState(true);
    } else {
        setSidebarState(false);
    }
    // --- End of Sidebar Code ---

    // --- Main Cards Toggle Code ---
    const toggleCardsBtn = document.getElementById('toggle-cards-btn');
    const mainCardsContainer = document.getElementById('main-cards-container');
    const collapseIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" /></svg>`;
    const expandIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>`;

    const setCardsState = (isExpanded) => {
        if (isExpanded) {
            mainCardsContainer.classList.remove('hidden');
            toggleCardsBtn.innerHTML = collapseIcon;
            localStorage.setItem('cardsState', 'expanded');
        } else {
            mainCardsContainer.classList.add('hidden');
            toggleCardsBtn.innerHTML = expandIcon;
            localStorage.setItem('cardsState', 'collapsed');
        }
    };

    toggleCardsBtn.addEventListener('click', () => {
        const isCurrentlyExpanded = !mainCardsContainer.classList.contains('hidden');
        setCardsState(!isCurrentlyExpanded);
    });

    const savedCardsState = localStorage.getItem('cardsState');
    if (savedCardsState === 'collapsed') {
        setCardsState(false);
    } else {
        setCardsState(true); // Default to expanded
    }
    // --- End of Main Cards Toggle Code ---

    // --- Quarter Filter Logic ---
    const quarterFilterBar = document.getElementById('quarter-filter-bar');
    const quarterFilterContainer = document.getElementById('quarter-filter-container');
    let isQuarterFilterExpanded = false;

    function generateQuarters(startDateString, count) {
        const quarters = [];
        const startDate = new Date(startDateString + 'T00:00:00Z');
        
        const startMonth = startDate.getUTCMonth();
        const startQuarterMonth = Math.floor(startMonth / 3) * 3;
        const currentDate = new Date(Date.UTC(startDate.getUTCFullYear(), startQuarterMonth, 1));

        for (let i = 0; i < count; i++) {
            const year = currentDate.getUTCFullYear();
            const quarterNum = Math.floor(currentDate.getUTCMonth() / 3) + 1;
            
            const qStartDate = new Date(Date.UTC(year, (quarterNum - 1) * 3, 1));
            const qEndDate = new Date(Date.UTC(year, quarterNum * 3, 0));

            quarters.push({
                name: `Q${quarterNum}`,
                year: year,
                startDate: qStartDate.toISOString().split('T')[0],
                endDate: qEndDate.toISOString().split('T')[0]
            });
            
            currentDate.setUTCMonth(currentDate.getUTCMonth() + 3);
        }
        return quarters;
    }

    function renderActiveQuarterDisplay() {
        const activeBtn = quarterFilterContainer.querySelector('.active');
        const activeDisplay = document.createElement('div');
        activeDisplay.className = 'active-display';

        if (activeBtn.dataset.filterType === 'all') {
            activeDisplay.innerHTML = `<button class="quarter-filter-btn active font-semibold py-1 px-3 rounded-md text-sm w-full text-left">ALL</button>`;
        } else {
            const year = new Date(activeBtn.dataset.startDate + 'T00:00:00Z').getUTCFullYear();
            activeDisplay.innerHTML = `
                <span class="year-label font-bold text-gray-500 text-sm mr-1">'${year.toString().substring(2)}</span>
                <button class="quarter-filter-btn active font-semibold py-1 px-3 rounded-md text-sm">${activeBtn.textContent}</button>
            `;
        }
        
        const existingDisplay = quarterFilterContainer.querySelector('.active-display');
        if (existingDisplay) {
            existingDisplay.remove();
        }
        quarterFilterContainer.prepend(activeDisplay);
    }

    function renderQuarterFilterBar() {
        quarterFilterContainer.innerHTML = '';
        let currentYear = null;

        const allButton = document.createElement('button');
        allButton.textContent = 'ALL';
        allButton.className = 'quarter-filter-btn active font-semibold py-1 px-3 rounded-md text-sm';
        allButton.dataset.filterType = 'all';
        quarterFilterContainer.appendChild(allButton);

        const quarters = generateQuarters(planConfig.planStartDate, planConfig.numberOfQuarters);
        quarters.forEach(q => {
            if (q.year !== currentYear) {
                currentYear = q.year;
                const yearLabel = document.createElement('span');
                yearLabel.className = 'font-bold text-gray-500 text-sm ml-2 mr-1 w-full md:w-auto'; // Flexbox friendly
                yearLabel.textContent = `'${currentYear.toString().substring(2)}`;
                quarterFilterContainer.appendChild(yearLabel);
            }

            const qButton = document.createElement('button');
            qButton.textContent = q.name;
            qButton.className = 'quarter-filter-btn font-semibold py-1 px-3 rounded-md text-sm';
            qButton.dataset.startDate = q.startDate;
            qButton.dataset.endDate = q.endDate;
            qButton.dataset.filterType = 'quarter';
            quarterFilterContainer.appendChild(qButton);
        });
        renderActiveQuarterDisplay(); // Initial render for collapsed view
    }

    function toggleQuarterFilter(expand) {
        isQuarterFilterExpanded = expand;
        if (isQuarterFilterExpanded) {
            quarterFilterBar.classList.add('expanded');
            quarterFilterBar.classList.remove('collapsed');
        } else {
            quarterFilterBar.classList.remove('expanded');
            quarterFilterBar.classList.add('collapsed');
            renderActiveQuarterDisplay();
        }
    }

    quarterFilterBar.addEventListener('click', (event) => {
        if (!isQuarterFilterExpanded) {
            toggleQuarterFilter(true);
            return;
        }

        const clickedButton = event.target.closest('button');
        if (clickedButton && !clickedButton.classList.contains('active')) {
            quarterFilterContainer.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
            clickedButton.classList.add('active');

            const { filterType, startDate, endDate } = clickedButton.dataset;
            fetchDashboardData(filterType === 'all' ? null : startDate, filterType === 'all' ? null : endDate);
            
            setTimeout(() => toggleQuarterFilter(false), 100);
        }
    });

    // Close when clicking outside
    document.addEventListener('click', (event) => {
        if (isQuarterFilterExpanded && !quarterFilterBar.contains(event.target)) {
            toggleQuarterFilter(false);
        }
    });
    // --- End of Quarter Filter Logic ---

    // --- Element Selectors ---
    const brokenNetworksCard = document.getElementById('broken-networks-card');
    const bottlenecksCard = document.getElementById('bottlenecks-card');
    const dashboardOption = document.getElementById('dashboard-option');
    const bomViewerOption = document.getElementById('bom-viewer-option');
    const newChatOption = document.getElementById('new-chat-option');
    const dashboardSection = document.getElementById('dashboard-section');
    const bomViewerWrapper = document.getElementById('bom-viewer-wrapper');
    const chatSection = document.getElementById('chat-section');
    const newsMatrixSection = document.getElementById('news-matrix-section');
    const brokenNetworksSection = document.getElementById('broken-networks-section');
    const bottlenecksSubcardsSection = document.getElementById('bottlenecks-subcards-section');
    const resultsContainer = document.getElementById('results-container');
    const skuPropertiesDisplay = document.getElementById('sku-properties-display');
    const chatWelcome = document.getElementById('chat-welcome');
    const chatLog = document.getElementById('chat-log');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatHistoryList = document.getElementById('chat-history-list');
    const nodePropertiesModal = document.getElementById('node-properties-modal');
    const nodePropertiesTitle = document.getElementById('node-properties-title');
    const nodePropertiesContent = document.getElementById('node-properties-content');
    const closePropertiesModalBtn = nodePropertiesModal.querySelector('.close-properties-modal');
    const brokenSkuCard = document.getElementById('broken-sku-card');
    const brokenDemandNetworkCard = document.getElementById('broken-demand-network-card');
    const bottleneckResourcesCard = document.getElementById('bottleneck-resources-card');
    const bottleneckSkusCard = document.getElementById('bottleneck-skus-card');
    const itemInput = document.getElementById('item-input');
    const locInput = document.getElementById('loc-input');
    const getSkuDetailsBtn = document.getElementById('get-sku-details-btn');
    const getNetworkBtn = document.getElementById('get-network-btn');
    const affectedOrdersCard = document.getElementById('affected-orders-card');
    const affectedOrdersSection = document.getElementById('affected-orders-section');
    const custOrdersCard = document.getElementById('cust-orders-card');
    const fcstOrdersCard = document.getElementById('fcst-orders-card');

    // --- State variables ---
    let currentSkuId = null;
    let isDemandSku = false;
    let currentChatId = null;
    let lastTableRenderFunction = null; 

    // --- View Management Functions ---
    function showDashboardContent(elementToShow) {
        const contentPanels = [newsMatrixSection, brokenNetworksSection, bottlenecksSubcardsSection, resultsContainer, affectedOrdersSection];
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
        skuPropertiesDisplay.classList.add('hidden');
        const oldGraph = document.getElementById('bom-viewer-graph');
        if (oldGraph) oldGraph.remove();
        resultsContainer.innerHTML = ''; 
    }
    function showChatView() {
        dashboardSection.classList.add('hidden');
        bomViewerWrapper.classList.add('hidden');
        chatSection.classList.remove('hidden');
    }
    
    // --- Chat History Management ---
    function getChatHistory() { return JSON.parse(localStorage.getItem('chatHistory') || '[]'); }
    function saveChatHistory(history) { localStorage.setItem('chatHistory', JSON.stringify(history)); }
    function renderChatHistory() {
        const history = getChatHistory();
        chatHistoryList.innerHTML = '';
        history.forEach(chat => {
            const historyItem = document.createElement('div');
            historyItem.classList.add('group', 'flex', 'items-center', 'justify-between', 'p-2', 'text-sm', 'hover:bg-gray-300', 'rounded', 'cursor-pointer');
            historyItem.setAttribute('data-chat-id', chat.id);
            historyItem.addEventListener('click', () => loadChat(chat.id));
            const title = document.createElement('span');
            title.classList.add('truncate');
            title.textContent = chat.title;
            const deleteBtn = document.createElement('button');
            deleteBtn.classList.add('opacity-0', 'group-hover:opacity-100', 'p-1', 'rounded-md', 'hover:bg-gray-400', 'z-10');
            deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>`;
            deleteBtn.addEventListener('click', (event) => { event.stopPropagation(); deleteChat(chat.id); });
            historyItem.appendChild(title);
            historyItem.appendChild(deleteBtn);
            chatHistoryList.appendChild(historyItem);
        });
    }
    function deleteChat(chatId) {
        let history = getChatHistory();
        saveChatHistory(history.filter(chat => chat.id !== chatId));
        renderChatHistory();
        if (currentChatId === chatId) startNewChat();
    }
    function loadChat(chatId) {
        const chat = getChatHistory().find(c => c.id === chatId);
        if (chat) {
            currentChatId = chatId;
            chatLog.innerHTML = '';
            chat.messages.forEach(msg => addMessageToLog(msg.text, msg.sender, msg.data));
            chatWelcome.classList.add('hidden');
            chatLog.classList.remove('hidden');
            chatSection.classList.remove('is-new-chat');
            showChatView();
        }
    }
    function startNewChat() {
        currentChatId = null;
        chatLog.innerHTML = '';
        chatLog.classList.add('hidden');
        chatWelcome.classList.remove('hidden');
        chatSection.classList.add('is-new-chat');
        showChatView();
    }

    // --- Initial Setup ---
    showDashboard();
    renderQuarterFilterBar();
    fetchDashboardData();
    fetchAndDisplayNews();
    renderChatHistory();

    // --- Event Listeners ---
    dashboardOption.addEventListener('click', showDashboard);
    bomViewerOption.addEventListener('click', showBomViewer);
    newChatOption.addEventListener('click', startNewChat);
    closePropertiesModalBtn.addEventListener('click', () => nodePropertiesModal.classList.add('hidden'));
    nodePropertiesModal.addEventListener('click', (event) => { if (event.target === nodePropertiesModal) nodePropertiesModal.classList.add('hidden'); });
    brokenNetworksCard.addEventListener('click', () => showDashboardContent(brokenNetworksSection));
    bottlenecksCard.addEventListener('click', () => showDashboardContent(bottlenecksSubcardsSection));
    affectedOrdersCard.addEventListener('click', () => showDashboardContent(affectedOrdersSection));

    // --- Chat Functionality ---
    function showThinkingIndicator() {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('self-start');
        const loader = document.createElement('div');
        loader.className = 'eleva-loader';
        const svgRing = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgRing.setAttribute('class', 'eleva-ring');
        svgRing.setAttribute('viewBox', '0 0 50 50');
        svgRing.innerHTML = `<defs><linearGradient id="elevaGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#0096C7"/><stop offset="40%" stop-color="#48CAE4"/><stop offset="70%" stop-color="#90E0EF"/><stop offset="100%" stop-color="#CAF0F8"/></linearGradient></defs><circle class="path" cx="25" cy="25" r="20" fill="none" stroke="url(#elevaGradient)" stroke-width="4"/>`;
        const icon = document.createElement('img');
        icon.className = 'eleva-icon';
        icon.src = 'images/ElevaAI_short_logo.svg';
        icon.alt = 'Eleva AI';
        loader.appendChild(svgRing);
        loader.appendChild(icon);
        messageDiv.appendChild(loader);
        chatLog.appendChild(messageDiv);
        chatLog.scrollTop = chatLog.scrollHeight;
        return messageDiv;
    }
    function addMessageToLog(message, sender) {
        const messageContainer = document.createElement('div');
        messageContainer.classList.add('p-3', 'rounded-lg', 'max-w-xs', 'lg:max-w-4xl', 'break-words');
        messageContainer.classList.add(sender === 'user' ? 'user-message' : 'assistant-message');
        messageContainer.textContent = message;
        chatLog.appendChild(messageContainer);
        chatLog.scrollTop = chatLog.scrollHeight;
    }
    function handleChatSubmit() {
        const userMessage = chatInput.value.trim();
        if (!userMessage) return;
        
        chatWelcome.classList.add('hidden');
        chatLog.classList.remove('hidden');
        chatSection.classList.remove('is-new-chat');
        addMessageToLog(userMessage, 'user');
        chatInput.value = '';
        const thinkingIndicator = showThinkingIndicator();
        
        let history = getChatHistory();
        let currentChat;

        if (currentChatId === null) {
            currentChatId = `chat-${new Date().getTime()}`;
            const newChat = { 
                id: currentChatId, 
                title: userMessage.substring(0, 30) + (userMessage.length > 30 ? '...' : ''), 
                messages: [{ sender: 'user', text: userMessage }] 
            };
            history.unshift(newChat);
            currentChat = newChat;
            renderChatHistory();
        } else {
            currentChat = history.find(c => c.id === currentChatId);
            if (currentChat) {
                currentChat.messages.push({ sender: 'user', text: userMessage });
            }
        }
        saveChatHistory(history); 

        fetch('http://127.0.0.1:5000/api/chat', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ message: userMessage })
        })
        .then(response => response.json())
        .then(data => {
            thinkingIndicator.remove();
            const assistantMessageText = data.data || data.response;
            addMessageToLog(assistantMessageText, 'assistant');

            if (currentChat) {
                currentChat.messages.push({ sender: 'assistant', text: assistantMessageText, data: data });
                saveChatHistory(history); 
            }
        })
        .catch(error => {
            thinkingIndicator.remove();
            console.error('Error with chat API:', error);
            addMessageToLog('Sorry, I had trouble connecting.', 'assistant');
        });
    }
    chatSendBtn.addEventListener('click', handleChatSubmit);
    chatInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') handleChatSubmit(); });
    
    // --- Asynchronous News Loading and Rendering ---
    const kpiHeaders = ["Supply Availability", "Raw Material Cost", "Logistics & Freight Cost", "Market Demand", "OTIF"];

    const KPI_BG_COLORS = {
        Positive: 'bg-green-50',
        Negative: 'bg-red-50',
        Neutral: 'bg-white'
    };
    
    function createKpiCellHtml(impact) {
        const safeImpact = (impact === 'Positive' || impact === 'Negative') ? impact : 'Neutral';
        const indicatorClass = `indicator-${safeImpact.toLowerCase()}`;
        
        if (safeImpact === 'Neutral') {
            return `<span class="indicator-neutral">-</span>`;
        }
        
        const path = safeImpact === 'Positive' ? 'M12 4l8 8H4l8-8z' : 'M12 20l-8-8h16l-8 8z';
        return `<svg class="h-4 w-4 inline-block ${indicatorClass}" fill="currentColor" viewBox="0 0 24 24">
                    <path d="${path}"></path>
                </svg>`;
    }

    function renderNewsMatrix(allArticles) {
        newsMatrixSection.innerHTML = '';
        if (!allArticles || allArticles.length === 0) {
            newsMatrixSection.innerHTML = `<p class="text-gray-500 p-4">No news articles found.</p>`;
            return;
        }

        const table = document.createElement('table');
        table.id = 'news-matrix-table';
        table.className = 'min-w-full';
        
        const thead = document.createElement('thead');
        thead.innerHTML = `<tr>
            <th class="article-column">Article</th>
            <th class="category-column">Category</th>
            ${kpiHeaders.map(name => `<th class="kpi-column">${name}</th>`).join('')}
        </tr>`;
        
        const tbody = document.createElement('tbody');
        allArticles.forEach((article, index) => {
            const row = document.createElement('tr');
            row.id = `article-row-${index}`;
            
            const articleCell = document.createElement('td');
            articleCell.className = 'article-column article-title-cell';
            articleCell.innerHTML = `<a href="${article.url}" target="_blank" rel="noopener noreferrer">${article.title}</a>`;
            row.appendChild(articleCell);

            const categoryCell = document.createElement('td');
            categoryCell.className = 'category-column';
            categoryCell.textContent = article.category.charAt(0).toUpperCase() + article.category.slice(1);
            row.appendChild(categoryCell);

            kpiHeaders.forEach(header => {
                const kpiCell = document.createElement('td');
                kpiCell.className = 'kpi-cell kpi-column';
                kpiCell.id = `kpi-placeholder-matrix-${index}-${header.replace(/\s+/g, '')}`;
                kpiCell.innerHTML = `<div class="kpi-loader-small"></div>`;
                row.appendChild(kpiCell);
            });

            tbody.appendChild(row);
        });

        table.appendChild(thead);
        table.appendChild(tbody);
        newsMatrixSection.appendChild(table);
    }
    
    function updateMatrixCells(matrixIndex, kpiData) {
        kpiHeaders.forEach(header => {
            const matrixCell = document.getElementById(`kpi-placeholder-matrix-${matrixIndex}-${header.replace(/\s+/g, '')}`);
             if (matrixCell) {
                 const impact = kpiData[header] || 'Neutral';
                 matrixCell.className = `kpi-cell kpi-column ${KPI_BG_COLORS[impact]}`;
                 matrixCell.innerHTML = createKpiCellHtml(impact);
             }
        });
    }

    async function fetchAndDisplayNews() {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/supply-chain-news');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const newsData = await response.json();
            
            const allArticles = [];
            let matrixIndexCounter = 0;
            for (const category in newsData) {
                newsData[category].forEach(article => {
                    allArticles.push({
                        ...article,
                        category: category,
                        matrixIndex: matrixIndexCounter
                    });
                    matrixIndexCounter++;
                });
            }

            renderNewsMatrix(allArticles);

            allArticles.forEach(article => {
                fetch('http://127.0.0.1:5000/api/analyze-article', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ article: article })
                })
                .then(res => res.json())
                .then(kpiData => {
                    const allNeutral = Object.values(kpiData).every(val => val === 'Neutral');

                    if (allNeutral) {
                        const row = document.getElementById(`article-row-${article.matrixIndex}`);
                        if (row) row.style.display = 'none';
                    } else {
                        updateMatrixCells(article.matrixIndex, kpiData);
                    }
                })
                .catch(err => console.error("Error analyzing article:", article.title, err));
            });

        } catch (error) {
            console.error('Error fetching or displaying news:', error);
            newsMatrixSection.innerHTML = `<div class="p-4"><h4 class="font-bold text-gray-800">News Feed</h4><p class="text-sm text-red-500">Could not load news feed. Please ensure the backend server is running.</p></div>`;
        }
    }

    // --- Other Functions ---
    function fetchDashboardData(startDate = null, endDate = null) {
        if (startDate && endDate) {
            console.log(`Fetching dashboard data for quarter: ${startDate} to ${endDate}`);
        } else {
            console.log("Fetching all dashboard data (no quarter filter).");
        }

        fetch('http://127.0.0.1:5000/api/dashboard')
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    console.error("Error from dashboard API:", data.error);
                    return; 
                }

                document.getElementById('total-demand-at-risk').textContent = `$${(data.totalDemandAtRisk || 0).toLocaleString()}`;
                const formattedQty = (data.affectedOrdersQty || 0).toLocaleString();
                document.getElementById('affected-orders').textContent = `${(data.affectedOrdersCount || 0).toLocaleString()} - ${formattedQty}`;
                const formattedCustQty = (data.affectedCustOrdersQty || 0).toLocaleString();
                document.getElementById('cust-orders-count').textContent = `${(data.affectedCustOrdersCount || 0).toLocaleString()} - ${formattedCustQty}`;
                const formattedFcstQty = (data.affectedFcstOrdersQty || 0).toLocaleString();
                document.getElementById('fcst-orders-count').textContent = `${(data.affectedFcstOrdersCount || 0).toLocaleString()} - ${formattedFcstQty}`;
                document.getElementById('broken-networks').textContent = (data.brokenSkusCount || 0).toLocaleString();
                document.getElementById('broken-skus-count').textContent = (data.brokenSkusCount || 0).toLocaleString();
                document.getElementById('broken-fg-networks-count').textContent = (data.brokenFgNetworksCount || 0).toLocaleString();
                const totalBottlenecks = (data.bottleneckResourcesCount || 0) + (data.bottleneckSkusCount || 0);
                document.getElementById('bottlenecks-count').textContent = totalBottlenecks.toLocaleString();
                document.getElementById('bottleneck-resources-count').textContent = (data.bottleneckResourcesCount || 0).toLocaleString();
                document.getElementById('bottleneck-skus-count').textContent = (data.bottleneckSkusCount || 0).toLocaleString();
            })
            .catch(error => console.error('Error fetching dashboard data:', error));
    }

    function createHeaderWithBackButton(title, backFunction) {
        const header = document.createElement('div');
        header.className = 'flex justify-between items-center mb-4';
        const titleEl = document.createElement('h2');
        titleEl.className = 'text-xl font-bold text-gray-800';
        titleEl.textContent = title;
        header.appendChild(titleEl);
        if (backFunction) {
            const backButton = document.createElement('button');
            backButton.className = 'flex items-center p-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors';
            backButton.title = 'Back';
            backButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>`;
            backButton.addEventListener('click', backFunction);
            header.appendChild(backButton);
        }
        return header;
    }

    function createResourceTable(title, data, messageIfEmpty, backFunction) {
        const renderFunc = () => {
            lastTableRenderFunction = renderFunc;
            resultsContainer.innerHTML = ''; 
            resultsContainer.appendChild(createHeaderWithBackButton(title, backFunction));
            if (!data || data.length === 0) {
                resultsContainer.innerHTML += `<p class="text-gray-500">${messageIfEmpty}</p>`;
                return;
            }
            const allKeys = new Set(data.flatMap(node => Object.keys(node.properties)));
            const sortedKeys = ['res_id', ...Array.from(allKeys).filter(key => key !== 'res_id').sort()];
            const table = document.createElement('table');
            table.className = 'min-w-full divide-y divide-gray-200';
            table.innerHTML = `<thead><tr>${sortedKeys.map(key => `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${key.replace(/_/g, ' ')}</th>`).join('')}</tr></thead>`;
            const tableBody = document.createElement('tbody');
            tableBody.className = 'bg-white divide-y divide-gray-200';
            data.forEach(node => {
                const row = document.createElement('tr');
                row.innerHTML = sortedKeys.map(key => {
                    const value = node.properties[key];
                    if (key === 'res_id') {
                        return `<td class="px-6 py-4 whitespace-nowrap text-gray-500"><div class="flex items-center space-x-2"><span>${value || 'N/A'}</span><button class="resource-network-btn px-2 py-1 bg-cyan-500 text-white rounded-lg text-xs hover:bg-cyan-600" data-res-id="${value}">Show Network</button></div></td>`;
                    }
                    return `<td class="px-6 py-4 whitespace-nowrap text-gray-500">${typeof value === 'object' ? JSON.stringify(value) : value}</td>`;
                }).join('');
                tableBody.appendChild(row);
            });
            table.appendChild(tableBody);
            resultsContainer.appendChild(table);
            resultsContainer.querySelectorAll('.resource-network-btn').forEach(button => {
                button.addEventListener('click', (event) => {
                    const resId = event.target.getAttribute('data-res-id');
                    fetchResourceNetworkGraph(resId, `Network for Resource ${resId}`, resultsContainer);
                    showDashboardContent(resultsContainer);
                });
            });
        };
        lastTableRenderFunction = renderFunc;
        renderFunc();
    }

    function createSkuTable(title, data, messageIfEmpty, backFunction) {
        const renderFunc = () => {
            lastTableRenderFunction = renderFunc;
            resultsContainer.innerHTML = '';
            resultsContainer.appendChild(createHeaderWithBackButton(title, backFunction));
            if (!data || data.length === 0) {
                resultsContainer.innerHTML += `<p class="text-gray-500">${messageIfEmpty}</p>`;
                return;
            }
            const allKeys = new Set(data.flatMap(node => Object.keys(node.properties)));
            const keysToDisplay = Array.from(allKeys).filter(key => key !== 'shortest_lead_time');
            const sortedKeys = keysToDisplay.sort((a, b) => {
                const order = ['sku_id', 'item', 'loc'];
                const aIndex = order.indexOf(a);
                const bIndex = order.indexOf(b);
                if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
                if (aIndex !== -1) return -1;
                if (bIndex !== -1) return 1;
                return a.localeCompare(b);
            });
            const table = document.createElement('table');
            table.className = 'min-w-full divide-y divide-gray-200';
            table.innerHTML = `<thead><tr>${sortedKeys.map(key => `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${key.replace(/_/g, ' ')}</th>`).join('')}</tr></thead>`;
            const tableBody = document.createElement('tbody');
            tableBody.className = 'bg-white divide-y divide-gray-200';
            data.forEach(node => {
                const row = document.createElement('tr');
                const skuId = node.properties.sku_id;
                row.innerHTML = sortedKeys.map(key => {
                    const value = node.properties[key];
                    let cellHtml = `<td class="px-6 py-4 whitespace-nowrap text-gray-500">${typeof value === 'object' ? JSON.stringify(value) : (value || '')}</td>`;
                    if (key === 'sku_id') {
                        cellHtml = `<td class="px-6 py-4 whitespace-nowrap text-gray-500"><div class="flex items-center space-x-2"><span>${value || 'N/A'}</span><button class="network-btn px-2 py-1 bg-blue-500 text-white rounded-lg text-xs hover:bg-blue-600" data-sku-id="${value}">Show Network</button></div></td>`;
                    } else if (key === 'cust_demand_qty' && value > 0) {
                        cellHtml = `<td class="px-6 py-4 whitespace-nowrap text-gray-500"><div class="flex items-center space-x-2"><span>${value}</span><button class="show-co-btn px-2 py-1 bg-red-500 text-white rounded-lg text-xs hover:bg-red-600" data-sku-id="${skuId}">Show CO</button></div></td>`;
                    } else if (key === 'fcst_demand_qty' && value > 0) {
                        cellHtml = `<td class="px-6 py-4 whitespace-nowrap text-gray-500"><div class="flex items-center space-x-2"><span>${value}</span><button class="show-fo-btn px-2 py-1 bg-orange-500 text-white rounded-lg text-xs hover:bg-orange-600" data-sku-id="${skuId}">Show FO</button></div></td>`;
                    }
                    return cellHtml;
                }).join('');
                tableBody.appendChild(row);
            });
            table.appendChild(tableBody);
            resultsContainer.appendChild(table);
            resultsContainer.querySelectorAll('.network-btn').forEach(button => {
                button.addEventListener('click', (event) => {
                    const skuId = event.target.getAttribute('data-sku-id');
                    fetchNetworkGraph(skuId, `Network for ${skuId}`, resultsContainer);
                    showDashboardContent(resultsContainer);
                });
            });
            resultsContainer.querySelectorAll('.show-co-btn').forEach(button => {
                button.addEventListener('click', (event) => {
                    const skuId = event.target.getAttribute('data-sku-id');
                    renderAffectedCustOrdersForSku(skuId);
                });
            });
            resultsContainer.querySelectorAll('.show-fo-btn').forEach(button => {
                button.addEventListener('click', (event) => {
                    const skuId = event.target.getAttribute('data-sku-id');
                    renderAffectedFcstOrdersForSku(skuId);
                });
            });
        };
        lastTableRenderFunction = renderFunc;
        renderFunc();
    }

    function createOrderTable(title, data, messageIfEmpty, backFunction) {
        const renderFunc = () => {
            lastTableRenderFunction = renderFunc;
            resultsContainer.innerHTML = '';
            resultsContainer.appendChild(createHeaderWithBackButton(title, backFunction));
            if (!data || data.length === 0) {
                resultsContainer.innerHTML += `<p class="text-gray-500">${messageIfEmpty}</p>`;
                return;
            }
            const desiredOrder = ['item', 'loc', 'rgid', 'cgid', 'qty'];
            const originalKeys = Object.keys(data[0].properties.full_record);
            originalKeys.sort((a, b) => {
                const aLower = a.toLowerCase();
                const bLower = b.toLowerCase();
                const aIndex = desiredOrder.indexOf(aLower);
                const bIndex = desiredOrder.indexOf(bLower);
                if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
                if (aIndex !== -1) return -1;
                if (bIndex !== -1) return 1;
                return aLower.localeCompare(bLower);
            });
            const sortedKeys = originalKeys;
            const tableWrapper = document.createElement('div');
            tableWrapper.className = 'overflow-x-auto'; 
            const table = document.createElement('table');
            table.className = 'min-w-full divide-y divide-gray-200';
            table.innerHTML = `<thead><tr>${sortedKeys.map(key => `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${key.replace(/_/g, ' ')}</th>`).join('')}</tr></thead>`;
            const tableBody = document.createElement('tbody');
            tableBody.className = 'bg-white divide-y divide-gray-200';
            data.forEach(record => {
                const rowData = record.properties.full_record;
                const row = document.createElement('tr');
                row.innerHTML = sortedKeys.map(key => {
                    const value = rowData[key];
                    return `<td class="px-6 py-4 whitespace-nowrap text-gray-500">${value !== null ? value : ''}</td>`;
                }).join('');
                tableBody.appendChild(row);
            });
            table.appendChild(tableBody);
            tableWrapper.appendChild(table);
            resultsContainer.appendChild(tableWrapper);
        };
        lastTableRenderFunction = renderFunc;
        renderFunc();
    }
    
    const renderAffectedCustOrdersForSku = (skuId) => {
        fetch(`http://127.0.0.1:5000/api/affected-cust-orders-by-sku`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sku_id: skuId })
        })
        .then(r => r.json())
        .then(d => { 
            createOrderTable(`Customer Orders for ${skuId}`, d, 'No affected customer orders found.', lastTableRenderFunction); 
            showDashboardContent(resultsContainer); 
        });
    };

    const renderAffectedFcstOrdersForSku = (skuId) => {
        fetch(`http://127.0.0.1:5000/api/affected-fcst-orders-by-sku`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sku_id: skuId })
        })
        .then(r => r.json())
        .then(d => { 
            createOrderTable(`Forecast Orders for ${skuId}`, d, 'No affected forecast orders found.', lastTableRenderFunction); 
            showDashboardContent(resultsContainer); 
        });
    };

    const renderBrokenSkus = () => fetch('http://127.0.0.1:5000/api/broken-networks').then(r => r.json()).then(d => { createSkuTable('Broken SKUs', d, 'No broken SKUs found.', () => showDashboardContent(brokenNetworksSection)); showDashboardContent(resultsContainer); });
    const renderBottleneckResources = () => fetch('http://127.0.0.1:5000/api/bottleneck-resources').then(r => r.json()).then(d => { createResourceTable('Bottleneck Resources', d, 'No bottlenecked resources found.', () => showDashboardContent(bottlenecksSubcardsSection)); showDashboardContent(resultsContainer); });
    const renderBottleneckSkus = () => fetch('http://127.0.0.1:5000/api/bottleneck-skus').then(r => r.json()).then(d => { createSkuTable('Bottleneck SKUs', d, 'No bottlenecked SKUs found.', () => showDashboardContent(bottlenecksSubcardsSection)); showDashboardContent(resultsContainer); });
    const renderBrokenDemand = () => fetch('http://127.0.0.1:5000/api/broken-demand-networks').then(r => r.json()).then(d => { createSkuTable('Broken Finished Goods', d, 'No broken FG networks found.', () => showDashboardContent(brokenNetworksSection)); showDashboardContent(resultsContainer); });
    const renderAffectedCustOrders = () => fetch('http://127.0.0.1:5000/api/affected-cust-orders').then(r => r.json()).then(d => { createOrderTable('Affected Customer Orders', d, 'No affected customer orders found.', () => showDashboardContent(affectedOrdersSection)); showDashboardContent(resultsContainer); });
    const renderAffectedFcstOrders = () => fetch('http://127.0.0.1:5000/api/affected-fcst-orders').then(r => r.json()).then(d => { createOrderTable('Affected Forecast Orders', d, 'No affected forecast orders found.', () => showDashboardContent(affectedOrdersSection)); showDashboardContent(resultsContainer); });
    
    brokenSkuCard.addEventListener('click', renderBrokenSkus);
    bottleneckResourcesCard.addEventListener('click', renderBottleneckResources);
    bottleneckSkusCard.addEventListener('click', renderBottleneckSkus);
    brokenDemandNetworkCard.addEventListener('click', renderBrokenDemand);
    custOrdersCard.addEventListener('click', renderAffectedCustOrders);
    fcstOrdersCard.addEventListener('click', renderAffectedFcstOrders);

    function fetchAndDisplaySkuDetails(skuId) {
        fetch('http://127.0.0.1:5000/api/sku-details', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sku_id: skuId }) })
        .then(response => response.json())
        .then(details => {
            const oldGraph = document.getElementById('bom-viewer-graph');
            if (oldGraph) oldGraph.remove();
            skuPropertiesDisplay.innerHTML = '';
            currentSkuId = null;
            isDemandSku = false;
            getNetworkBtn.disabled = true;
            getNetworkBtn.className = 'px-4 py-1 bg-gray-300 text-gray-800 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 flex-shrink-0 whitespace-nowrap';
            if (details.found) {
                currentSkuId = skuId;
                isDemandSku = details.properties.demand_sku === true;
                displaySkuProperties(details.properties);
                getNetworkBtn.disabled = false;
                getNetworkBtn.className = 'px-4 py-1 bg-green-600 text-white hover:bg-green-700 text-sm font-semibold rounded-lg transition-colors flex-shrink-0 whitespace-nowrap';
            } else {
                skuPropertiesDisplay.innerHTML = `<p class="text-red-500 p-4">SKU ID '${skuId}' not found.</p>`;
                skuPropertiesDisplay.classList.remove('hidden');
            }
        })
        .catch(error => console.error('Error fetching SKU details:', error));
    }
    function displaySkuProperties(properties) {
        skuPropertiesDisplay.innerHTML = '';
        const table = document.createElement('table');
        table.className = 'min-w-full divide-y divide-gray-200 text-sm';
        table.innerHTML = `<thead class="bg-gray-50"><tr>${Object.keys(properties).map(key => `<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${key.replace(/_/g, ' ')}</th>`).join('')}</tr></thead>`;
        const tableBody = document.createElement('tbody');
        tableBody.className = 'bg-white divide-y divide-gray-200';
        const row = document.createElement('tr');
        row.innerHTML = Object.values(properties).map(value => `<td class="px-4 py-2 whitespace-nowrap text-gray-800">${value}</td>`).join('');
        tableBody.appendChild(row);
        table.appendChild(tableBody);
        skuPropertiesDisplay.appendChild(table);
        skuPropertiesDisplay.classList.remove('hidden');
    }

    function handleGraphClick(params, nodes, edges) {
        let clickedItem = null;
        let itemType = '';
        if (params.nodes.length > 0) {
            clickedItem = nodes.get(params.nodes[0]);
            itemType = clickedItem.nodeName || 'Node';
        } else if (params.edges.length > 0) {
            clickedItem = edges.get(params.edges[0]);
            itemType = 'Relationship';
        }
        if (clickedItem) {
            const properties = JSON.parse(clickedItem.title);
            nodePropertiesTitle.textContent = `Properties for ${itemType}`;
            nodePropertiesContent.innerHTML = '';
            const table = document.createElement('table');
            const tableBody = document.createElement('tbody');
            tableBody.innerHTML = Object.entries(properties).map(([key, value]) => `<tr><td class="font-semibold text-gray-600 pr-4 align-top">${key.replace(/_/g, ' ')}</td><td class="text-gray-800 break-all">${value}</td></tr>`).join('');
            table.appendChild(tableBody);
            nodePropertiesContent.appendChild(table);
            nodePropertiesModal.classList.remove('hidden');
        }
    }

    function renderNetworkGraph(id, networkData, graphType, targetContainer, shortestPathData = null) {
        targetContainer.innerHTML = '';
        targetContainer.appendChild(createHeaderWithBackButton(graphType, lastTableRenderFunction));
        if (!networkData || networkData.length === 0) {
            targetContainer.innerHTML += '<p class="text-gray-500">No network data found.</p>';
            return;
        }
        const container = document.createElement('div');
        container.id = 'network-container';
        targetContainer.appendChild(container);
        const nodes = new vis.DataSet();
        const edges = new vis.DataSet();
        const uniqueNodeIds = new Set();
        const shortestPathEdgeIds = new Set(shortestPathData ? shortestPathData.flatMap(p => p.relationships).map(r => r.id) : []);
        networkData.forEach(path => {
            path.nodes.forEach(node => {
                if (!uniqueNodeIds.has(node.id)) {
                    uniqueNodeIds.add(node.id);
                    const icon = createNodeIcon(node);
                    nodes.add({
                        id: node.id,
                        label: node.properties.sku_id || node.properties.item || node.properties.res_id || node.properties.bom_num,
                        nodeName: node.properties.sku_id || node.properties.item || node.properties.res_id || node.properties.bom_num,
                        title: JSON.stringify(node.properties, null, 2),
                        shape: 'image',
                        image: icon.image,
                        size: icon.size,
                        font: { size: 12, color: '#4b5563', vadjust: icon.vadjust }
                    });
                }
            });
            path.relationships.forEach(rel => {
                let edgeOptions = { from: rel.startNode, to: rel.endNode, title: JSON.stringify(rel.properties, null, 2), arrows: 'to', color: { color: '#6b7280' } };
                if (shortestPathEdgeIds.has(rel.id)) { edgeOptions.color = 'gold'; edgeOptions.width = 3; }
                if (rel.type === 'SOURCING') { edgeOptions.arrows = { to: { enabled: true }, middle: { enabled: true, type: 'image', imageWidth: 20, imageHeight: 20, src: 'images/sourcing_relation.png' } }; }
                else if (rel.type !== 'CONSUMED_BY' && rel.type !== 'PRODUCES') { edgeOptions.label = rel.type; edgeOptions.font = { size: 10, color: '#6b7280', align: 'middle', strokeWidth: 5, strokeColor: '#ffffff' }; }
                edges.add(edgeOptions);
            });
        });
        const network = new vis.Network(container, { nodes, edges }, {
            nodes: { 
                font: { size: 12, color: '#4b5563' },
                borderWidth: 0, 
                shapeProperties: { useImageSize: true } 
            },
            edges: { color: { highlight: '#3b82f6' }, smooth: { enabled: true, type: 'straightCross' } },
            physics: { enabled: false },
            layout: { hierarchical: { direction: 'LR', sortMethod: 'directed', levelSeparation: 300, nodeSpacing: 150 } },
            interaction: { navigationButtons: true, keyboard: true }
        });
        network.on('click', (params) => handleGraphClick(params, nodes, edges));
    }
    
    function fetchNetworkGraph(skuId, graphType, container) { fetch('http://127.0.0.1:5000/api/network-graph', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sku_id: skuId }) }).then(r => r.json()).then(d => renderNetworkGraph(skuId, d, graphType, container, null)); }
    function fetchNetworkWithShortestPath(skuId, graphType, container) { fetch('http://127.0.0.1:5000/api/network-with-shortest-path', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sku_id: skuId }) }).then(r => r.json()).then(d => renderNetworkGraph(skuId, d.full_network, graphType, container, d.shortest_path)); }
    function fetchResourceNetworkGraph(resId, graphType, container) { fetch('http://127.0.0.1:5000/api/resource-network', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ res_id: resId }) }).then(r => r.json()).then(d => renderNetworkGraph(resId, d, graphType, container)); }
});