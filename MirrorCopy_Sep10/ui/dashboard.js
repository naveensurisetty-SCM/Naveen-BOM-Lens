// ui/dashboard.js
import { planConfig } from '../config.js';
import { renderNetworkGraph, fetchResourceNetworkGraph } from './bomViewer.js';

let lastTableRenderFunction = null;

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

function createResourceTable(title, data, messageIfEmpty, backFunction, showDashboardContent) {
    const resultsContainer = document.getElementById('results-container');
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
    renderFunc();
}

function createSkuTable(title, data, messageIfEmpty, backFunction, showDashboardContent) {
    const resultsContainer = document.getElementById('results-container');
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
                fetch('http://127.0.0.1:5000/api/network-graph', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sku_id: skuId }) })
                    .then(r => r.json())
                    .then(d => renderNetworkGraph(skuId, d, `Network for ${skuId}`, resultsContainer, null));
                showDashboardContent(resultsContainer);
            });
        });
        resultsContainer.querySelectorAll('.show-co-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const skuId = event.target.getAttribute('data-sku-id');
                renderAffectedCustOrdersForSku(skuId, showDashboardContent);
            });
        });
        resultsContainer.querySelectorAll('.show-fo-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const skuId = event.target.getAttribute('data-sku-id');
                renderAffectedFcstOrdersForSku(skuId, showDashboardContent);
            });
        });
    };
    renderFunc();
}

function createOrderTable(title, data, messageIfEmpty, backFunction) {
    const resultsContainer = document.getElementById('results-container');
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
    renderFunc();
}

const renderAffectedCustOrdersForSku = (skuId, showDashboardContent) => {
    fetch('http://127.0.0.1:5000/api/affected-cust-orders-by-sku', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku_id: skuId })
    })
    .then(r => r.json())
    .then(d => { 
        createOrderTable(`Customer Orders for ${skuId}`, d, 'No affected customer orders found.', lastTableRenderFunction); 
        showDashboardContent(document.getElementById('results-container')); 
    });
};

const renderAffectedFcstOrdersForSku = (skuId, showDashboardContent) => {
    fetch('http://127.0.0.1:5000/api/affected-fcst-orders-by-sku', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku_id: skuId })
    })
    .then(r => r.json())
    .then(d => { 
        createOrderTable(`Forecast Orders for ${skuId}`, d, 'No affected forecast orders found.', lastTableRenderFunction); 
        showDashboardContent(document.getElementById('results-container')); 
    });
};

const setCardsState = (isExpanded) => {
    const mainCardsContainer = document.getElementById('main-cards-container');
    const toggleCardsBtn = document.getElementById('toggle-cards-btn');
    const collapseIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" /></svg>`;
    const expandIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>`;

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

export function fetchDashboardData(startDate = null, endDate = null) {
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
    const quarterFilterContainer = document.getElementById('quarter-filter-container');
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
    const quarterFilterContainer = document.getElementById('quarter-filter-container');
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
            yearLabel.className = 'font-bold text-gray-500 text-sm ml-2 mr-1 w-full md:w-auto';
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
    renderActiveQuarterDisplay();
}

function toggleQuarterFilter(expand) {
    const quarterFilterBar = document.getElementById('quarter-filter-bar');
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

export function initDashboard(showDashboardContent) {
    const toggleCardsBtn = document.getElementById('toggle-cards-btn');
    const mainCardsContainer = document.getElementById('main-cards-container');
    const quarterFilterBar = document.getElementById('quarter-filter-bar');
    const quarterFilterContainer = document.getElementById('quarter-filter-container');

    // --- Main Cards Toggle Initialization ---
    toggleCardsBtn.addEventListener('click', () => {
        const isCurrentlyExpanded = !mainCardsContainer.classList.contains('hidden');
        setCardsState(!isCurrentlyExpanded);
    });
    const savedCardsState = localStorage.getItem('cardsState');
    setCardsState(savedCardsState !== 'collapsed');

    // --- Quarter Filter Initialization ---
    renderQuarterFilterBar();
    
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

    document.addEventListener('click', (event) => {
        if (isQuarterFilterExpanded && !quarterFilterBar.contains(event.target)) {
            toggleQuarterFilter(false);
        }
    });

    // --- Drill-down Card Event Listeners ---
    const brokenNetworksCard = document.getElementById('broken-networks-card');
    const bottlenecksCard = document.getElementById('bottlenecks-card');
    const affectedOrdersCard = document.getElementById('affected-orders-card');
    const brokenSkuCard = document.getElementById('broken-sku-card');
    const brokenDemandNetworkCard = document.getElementById('broken-demand-network-card');
    const bottleneckResourcesCard = document.getElementById('bottleneck-resources-card');
    const bottleneckSkusCard = document.getElementById('bottleneck-skus-card');
    const custOrdersCard = document.getElementById('cust-orders-card');
    const fcstOrdersCard = document.getElementById('fcst-orders-card');
    
    const resultsContainer = document.getElementById('results-container');
    const brokenNetworksSection = document.getElementById('broken-networks-section');
    const bottlenecksSubcardsSection = document.getElementById('bottlenecks-subcards-section');
    const affectedOrdersSection = document.getElementById('affected-orders-section');
    
    brokenNetworksCard.addEventListener('click', () => showDashboardContent(brokenNetworksSection));
    bottlenecksCard.addEventListener('click', () => showDashboardContent(bottlenecksSubcardsSection));
    affectedOrdersCard.addEventListener('click', () => showDashboardContent(affectedOrdersSection));
    
    const renderBrokenSkus = () => fetch('http://127.0.0.1:5000/api/broken-networks').then(r => r.json()).then(d => { createSkuTable('Broken SKUs', d, 'No broken SKUs found.', () => showDashboardContent(brokenNetworksSection), showDashboardContent); showDashboardContent(resultsContainer); });
    const renderBottleneckResources = () => fetch('http://127.0.0.1:5000/api/bottleneck-resources').then(r => r.json()).then(d => { createResourceTable('Bottleneck Resources', d, 'No bottlenecked resources found.', () => showDashboardContent(bottlenecksSubcardsSection), showDashboardContent); showDashboardContent(resultsContainer); });
    const renderBottleneckSkus = () => fetch('http://127.0.0.1:5000/api/bottleneck-skus').then(r => r.json()).then(d => { createSkuTable('Bottleneck SKUs', d, 'No bottlenecked SKUs found.', () => showDashboardContent(bottlenecksSubcardsSection), showDashboardContent); showDashboardContent(resultsContainer); });
    const renderBrokenDemand = () => fetch('http://127.0.0.1:5000/api/broken-demand-networks').then(r => r.json()).then(d => { createSkuTable('Broken Finished Goods', d, 'No broken FG networks found.', () => showDashboardContent(brokenNetworksSection), showDashboardContent); showDashboardContent(resultsContainer); });
    const renderAffectedCustOrders = () => fetch('http://127.0.0.1:5000/api/affected-cust-orders').then(r => r.json()).then(d => { createOrderTable('Affected Customer Orders', d, 'No affected customer orders found.', () => showDashboardContent(affectedOrdersSection)); showDashboardContent(resultsContainer); });
    const renderAffectedFcstOrders = () => fetch('http://127.0.0.1:5000/api/affected-fcst-orders').then(r => r.json()).then(d => { createOrderTable('Affected Forecast Orders', d, 'No affected forecast orders found.', () => showDashboardContent(affectedOrdersSection)); showDashboardContent(resultsContainer); });
    
    brokenSkuCard.addEventListener('click', renderBrokenSkus);
    bottleneckResourcesCard.addEventListener('click', renderBottleneckResources);
    bottleneckSkusCard.addEventListener('click', renderBottleneckSkus);
    brokenDemandNetworkCard.addEventListener('click', renderBrokenDemand);
    custOrdersCard.addEventListener('click', renderAffectedCustOrders);
    fcstOrdersCard.addEventListener('click', renderAffectedFcstOrders);
}