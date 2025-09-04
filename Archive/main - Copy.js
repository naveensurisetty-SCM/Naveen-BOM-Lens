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

    // --- Element Selectors ---
    const brokenNetworksCard = document.getElementById('broken-networks-card');
    const bottlenecksCard = document.getElementById('bottlenecks-card');
    const dashboardOption = document.getElementById('dashboard-option');
    const bomViewerOption = document.getElementById('bom-viewer-option');
    const newChatOption = document.getElementById('new-chat-option');
    const dashboardSection = document.getElementById('dashboard-section');
    const bomViewerWrapper = document.getElementById('bom-viewer-wrapper');
    const chatSection = document.getElementById('chat-section');
    const newsFeedSection = document.getElementById('news-feed-section');
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

    // --- State variables ---
    let currentSkuId = null;
    let isDemandSku = false;
    let currentChatId = null;
    let lastTableRenderFunction = null; // State for the "Back" button from a graph to a list

    // --- View Management Functions ---
    function showDashboardContent(elementToShow) {
        const contentPanels = [newsFeedSection, brokenNetworksSection, bottlenecksSubcardsSection, resultsContainer];
        contentPanels.forEach(panel => { if (panel) panel.classList.add('hidden'); });
        if (elementToShow) { elementToShow.classList.remove('hidden'); }
    }
    function showDashboard() {
        dashboardSection.classList.remove('hidden');
        bomViewerWrapper.classList.add('hidden');
        chatSection.classList.add('hidden');
        showDashboardContent(newsFeedSection); 
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
            const newChat = { id: currentChatId, title: userMessage.substring(0, 30) + (userMessage.length > 30 ? '...' : ''), messages: [{ sender: 'user', text: userMessage }] };
            history.unshift(newChat);
            currentChat = newChat;
            renderChatHistory();
        } else {
            currentChat = history.find(c => c.id === currentChatId);
            if (currentChat) currentChat.messages.push({ sender: 'user', text: userMessage });
        }
        saveChatHistory(history);
        fetch('http://127.0.0.1:5000/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: userMessage })})
        .then(response => response.json())
        .then(data => {
            thinkingIndicator.remove();
            const assistantMessageText = data.data || data.response;
            addMessageToLog(assistantMessageText, 'assistant');
            let chatToUpdate = getChatHistory().find(c => c.id === currentChatId);
            if (chatToUpdate) {
                chatToUpdate.messages.push({ sender: 'assistant', text: assistantMessageText, data: data });
                saveChatHistory(getChatHistory());
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
    
    // --- News Feed Logic with Carousel ---
    function createCarousel(carouselEl, articles, categoryTitle, iconSvg) {
        const slidesContainer = carouselEl.querySelector('.carousel-slides-container');
        const dotsContainer = carouselEl.querySelector('.carousel-dots');
        slidesContainer.innerHTML = '';
        dotsContainer.innerHTML = '';

        if (!articles || articles.length === 0) {
            slidesContainer.innerHTML = `
                <div class="p-4">
                    <div class="flex items-center mb-2">${iconSvg}<h4 class="font-bold text-gray-800">${categoryTitle}</h4></div>
                    <p class="text-sm text-gray-500">No recent articles found for this category.</p>
                </div>`;
            return;
        }

        articles.forEach((article, index) => {
            const slide = document.createElement('div');
            slide.classList.add('carousel-slide', 'h-full', 'flex', 'flex-col');
            if (index === 0) slide.classList.add('active');
            slide.innerHTML = `
                <a href="${article.url}" target="_blank" rel="noopener noreferrer" class="block">
                    <img src="${article.imageUrl}" alt="${article.title}" class="w-full h-40 object-cover">
                </a>
                <div class="p-4 flex flex-col flex-grow">
                    <div class="flex items-center mb-2">${iconSvg}<h4 class="font-bold text-gray-800">${categoryTitle}</h4></div>
                    <a href="${article.url}" target="_blank" rel="noopener noreferrer" class="block flex-grow">
                        <p class="text-sm text-gray-600 hover:text-blue-600">${article.title}</p>
                    </a>
                    <p class="text-xs text-gray-400 mt-2">${article.source || 'Unknown Source'}</p>
                </div>`;
            slidesContainer.appendChild(slide);

            const dot = document.createElement('button');
            dot.classList.add('h-2', 'w-2', 'rounded-full', 'bg-gray-300', 'mx-1', 'focus:outline-none');
            if (index === 0) dot.classList.add('bg-gray-800');
            dot.addEventListener('click', () => showSlide(carouselEl, index));
            dotsContainer.appendChild(dot);
        });

        if (articles.length > 1) {
            const prevArrow = document.createElement('button');
            prevArrow.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>';
            prevArrow.classList.add('carousel-arrow', 'absolute', 'top-1/2', 'left-2', 'transform', '-translate-y-1/2', 'bg-white', 'bg-opacity-75', 'rounded-full', 'p-1', 'text-gray-700', 'hover:bg-opacity-100');
            prevArrow.addEventListener('click', () => showSlide(carouselEl, getCurrentIndex(carouselEl) - 1));
            
            const nextArrow = document.createElement('button');
            nextArrow.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>';
            nextArrow.classList.add('carousel-arrow', 'absolute', 'top-1/2', 'right-2', 'transform', '-translate-y-1/2', 'bg-white', 'bg-opacity-75', 'rounded-full', 'p-1', 'text-gray-700', 'hover:bg-opacity-100');
            nextArrow.addEventListener('click', () => showSlide(carouselEl, getCurrentIndex(carouselEl) + 1));
            
            carouselEl.appendChild(prevArrow);
            carouselEl.appendChild(nextArrow);
        }
    }

    function showSlide(carouselEl, index) {
        const slides = carouselEl.querySelectorAll('.carousel-slide');
        const dots = carouselEl.querySelectorAll('.carousel-dots button');
        const numSlides = slides.length;

        if (index >= numSlides) index = 0;
        if (index < 0) index = numSlides - 1;

        slides.forEach(slide => slide.classList.remove('active'));
        dots.forEach(dot => dot.classList.replace('bg-gray-800', 'bg-gray-300'));
        
        slides[index].classList.add('active');
        dots[index].classList.replace('bg-gray-300', 'bg-gray-800');
    }

    function getCurrentIndex(carouselEl) {
        const slides = carouselEl.querySelectorAll('.carousel-slide');
        return Array.from(slides).findIndex(slide => slide.classList.contains('active'));
    }

    function fetchAndDisplayNews() {
        const categoryConfig = {
            supplier: { el: document.getElementById('news-supplier'), title: 'Supplier Disruption', icon: '<svg class="h-6 w-6 text-red-500 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>' },
            logistics: { el: document.getElementById('news-logistics'), title: 'Logistics Delays', icon: '<svg class="h-6 w-6 text-blue-500 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2-2h8a1 1 0 001-1z" /><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a6 6 0 006 0m-6 0h6m6-6.75h6m-6 0a6 6 0 00-6 0m6 0v6m0-6L21.75 12" /></svg>' },
            market: { el: document.getElementById('news-market'), title: 'Demand Market', icon: '<svg class="h-6 w-6 text-green-500 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-3.75-.625m3.75.625l-6.25 3.75" /></svg>' },
            geopolitical: { el: document.getElementById('news-geopolitical'), title: 'Geopolitical', icon: '<svg class="h-6 w-6 text-purple-500 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A11.953 11.953 0 0012 15c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 003 12c0 .778.099 1.533.284 2.253m0 0" /></svg>' },
            compliance: { el: document.getElementById('news-compliance'), title: 'Compliance', icon: '<svg class="h-6 w-6 text-yellow-500 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.036.243c-2.132 0-4.14-.354-6.044-.962l-1.532-2.305m-2.72.125a59.769 59.769 0 01-2.07-3.433m-2.07-3.433a59.769 59.769 0 00-2.07 3.433m2.07-3.433v10.155m-2.07-10.155L6.41 4.972M12 4.5c-2.291 0-4.545.16-6.75.47m6.75-.47L12 3m0 0l-1.591.523M12 3c-1.472 0-2.882.265-4.185.75M12 3c1.472 0 2.882.265 4.185.75M12 20.25c-2.488 0-4.813-.284-7.043-.815M12 20.25c2.488 0 4.813-.284 7.043-.815" /></svg>' },
        };
        
        fetch('http://127.0.0.1:5000/api/supply-chain-news')
            .then(response => response.json())
            .then(newsData => {
                if (newsData.error) throw new Error(newsData.error);
                for (const category in newsData) {
                    if (categoryConfig[category]) {
                        const config = categoryConfig[category];
                        createCarousel(config.el, newsData[category], config.title, config.icon);
                    }
                }
            })
            .catch(error => {
                console.error('Error fetching or displaying news:', error);
                for (const key in categoryConfig) {
                    const config = categoryConfig[key];
                    config.el.innerHTML = `<div class="p-4"><div class="flex items-center mb-2">${config.icon}<h4 class="font-bold text-gray-800">${config.title}</h4></div><p class="text-sm text-red-500">Could not load news feed.</p></div>`;
                }
            });
    }

    function fetchDashboardData() {
        fetch('http://127.0.0.1:5000/api/dashboard')
            .then(response => response.json())
            .then(data => {
                document.getElementById('total-demand-at-risk').textContent = `$${data.totalDemandAtRisk.toLocaleString()}`;
                document.getElementById('affected-orders').textContent = data.affectedOrders.toLocaleString();
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
            backButton.title = 'Back'; // Tooltip for accessibility
            backButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>`;
            backButton.addEventListener('click', backFunction);
            header.appendChild(backButton);
        }
        return header;
    }

    function createResourceTable(title, data, messageIfEmpty, backFunction) {
        const renderFunc = () => {
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
                row.innerHTML = sortedKeys.map(key => {
                    const value = node.properties[key];
                    if (key === 'sku_id') {
                        return `<td class="px-6 py-4 whitespace-nowrap text-gray-500"><div class="flex items-center space-x-2"><span>${value || 'N/A'}</span><button class="network-btn px-2 py-1 bg-blue-500 text-white rounded-lg text-xs hover:bg-blue-600" data-sku-id="${value}">Show Network</button></div></td>`;
                    }
                    return `<td class="px-6 py-4 whitespace-nowrap text-gray-500">${typeof value === 'object' ? JSON.stringify(value) : value}</td>`;
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
        };
        lastTableRenderFunction = renderFunc;
        renderFunc();
    }
    
    // Sub-Card Click Events with Back Button logic
    brokenSkuCard.addEventListener('click', () => {
        fetch('http://127.0.0.1:5000/api/broken-networks').then(r => r.json()).then(d => { 
            createSkuTable('Broken SKUs', d, 'No broken SKUs found.', () => showDashboardContent(brokenNetworksSection)); 
            showDashboardContent(resultsContainer); 
        });
    });
    bottleneckResourcesCard.addEventListener('click', () => {
        fetch('http://127.0.0.1:5000/api/bottleneck-resources').then(r => r.json()).then(d => { 
            createResourceTable('Bottleneck Resources', d, 'No bottlenecked resources found.', () => showDashboardContent(bottlenecksSubcardsSection)); 
            showDashboardContent(resultsContainer); 
        });
    });
    bottleneckSkusCard.addEventListener('click', () => {
        fetch('http://127.0.0.1:5000/api/bottleneck-skus').then(r => r.json()).then(d => { 
            createSkuTable('Bottleneck SKUs', d, 'No bottlenecked SKUs found.', () => showDashboardContent(bottlenecksSubcardsSection)); 
            showDashboardContent(resultsContainer); 
        });
    });
    brokenDemandNetworkCard.addEventListener('click', () => {
        fetch('http://127.0.0.1:5000/api/broken-demand-networks').then(r => r.json()).then(d => { 
            createSkuTable('Broken Finished Goods', d, 'No broken FG networks found.', () => showDashboardContent(brokenNetworksSection)); 
            showDashboardContent(resultsContainer); 
        });
    });
    
    // BOM Viewer Specific Functions
    getSkuDetailsBtn.addEventListener('click', () => {
        const skuId = `${itemInput.value.trim()}@${locInput.value.trim()}`;
        if (itemInput.value.trim() && locInput.value.trim()) fetchAndDisplaySkuDetails(skuId);
        else alert('Please enter both an Item and a Location.');
    });
    getNetworkBtn.addEventListener('click', () => {
        if (currentSkuId) {
            skuPropertiesDisplay.classList.add('hidden');
            const oldGraph = document.getElementById('bom-viewer-graph');
            if (oldGraph) oldGraph.remove();

            const graphContainer = document.createElement('div');
            graphContainer.id = 'bom-viewer-graph';
            graphContainer.classList.add('w-full', 'mt-4'); 
            bomViewerWrapper.appendChild(graphContainer);
            
            if (isDemandSku) fetchNetworkWithShortestPath(currentSkuId, 'Full Network with Shortest Path', graphContainer);
            else fetchNetworkGraph(currentSkuId, 'Full Network', graphContainer);
        }
    });
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

    // --- Graph Rendering Logic ---
    function createSvgIcon(color, pathData, size = 48) {
        // No longer using the SVG filter, shadow is handled by vis.js options
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="white" stroke="${color}" stroke-width="1.5"/><path fill="${color}" stroke-width="0" d="${pathData}"/></svg>`;
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }

    function getNodeStyle(node) {
        const props = node.properties;
        const style = { 
            shape: 'image', 
            size: 25, 
            font: { vadjust: 0 }, 
            label: props.sku_id || props.item || props.res_id || props.bom_num,
            // Add the shadow property to all nodes for the "lifted" effect
            shadow: {
                enabled: true,
                color: 'rgba(0, 0, 0, 0.25)',
                size: 10,
                x: 3,
                y: 3
            }
        };

        // Use the new icon paths
        const ICONS = {
            SKU: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.27 6.96 12 12.01l8.73-5.05 M12 22.08V12',
            BOM: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
            RESOURCE: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z'
        };
        const COLORS = { SKU_DEMAND: '#0077b6', SKU_COMPONENT: '#48cae4', BOM: '#6c757d', RESOURCE: '#2a9d8f', BROKEN: '#e63946', BOTTLENECK: '#fca311' };

        let color = '';
        let pathData = '';

        if (node.labels.includes('SKU')) {
            pathData = ICONS.SKU;
            color = props.demand_sku ? COLORS.SKU_DEMAND : COLORS.SKU_COMPONENT;
            if (props.broken_bom) color = COLORS.BROKEN;
            else if (props.bottleneck) color = COLORS.BOTTLENECK;
        } else if (node.labels.includes('Res')) {
            pathData = ICONS.RESOURCE;
            color = props.bottleneck ? COLORS.BOTTLENECK : COLORS.RESOURCE;
        } else if (node.labels.includes('BOM')) {
            pathData = ICONS.BOM;
            color = COLORS.BOM;
            style.font.vadjust = 25;
            style.size = 20;
        } else {
            style.shape = 'box';
            style.color = { background: '#d1d5db', border: '#9ca3af' };
            delete style.shadow; // No shadow for the fallback shape
            return style;
        }
        style.image = createSvgIcon(color, pathData);
        return style;
    }

    function renderNetworkGraph(id, networkData, graphType, targetContainer, shortestPathData = null) {
        targetContainer.innerHTML = '';
        
        // Use the helper to create a header with a back button
        const header = createHeaderWithBackButton(graphType, lastTableRenderFunction);
        targetContainer.appendChild(header);

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
                    const style = getNodeStyle(node);
                    nodes.add({
                        id: node.id,
                        label: style.label,
                        nodeName: style.label,
                        title: JSON.stringify(node.properties, null, 2),
                        shape: style.shape,
                        size: style.size,
                        font: style.font,
                        image: style.image,
                        color: style.color,
                        shadow: style.shadow
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
            nodes: { font: { size: 12, color: '#4b5563' }, borderWidth: 2 },
            edges: { color: { highlight: '#3b82f6' }, smooth: { enabled: true, type: 'straightCross' } },
            physics: { enabled: false },
            layout: { hierarchical: { direction: 'LR', sortMethod: 'directed', levelSeparation: 250, nodeSpacing: 150 } },
            interaction: { navigationButtons: true, keyboard: true }
        });
        network.on('click', (params) => handleGraphClick(params, nodes, edges));
    }
    
    // API Call wrappers
    function fetchNetworkGraph(skuId, graphType, container) { fetch('http://127.0.0.1:5000/api/network-graph', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sku_id: skuId }) }).then(r => r.json()).then(d => renderNetworkGraph(skuId, d, graphType, container, null)); }
    function fetchNetworkWithShortestPath(skuId, graphType, container) { fetch('http://127.0.0.1:5000/api/network-with-shortest-path', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sku_id: skuId }) }).then(r => r.json()).then(d => renderNetworkGraph(skuId, d.full_network, graphType, container, d.shortest_path)); }
    function fetchResourceNetworkGraph(resId, graphType, container) { fetch('http://127.0.0.1:5000/api/resource-network', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ res_id: resId }) }).then(r => r.json()).then(d => renderNetworkGraph(resId, d, graphType, container)); }
});