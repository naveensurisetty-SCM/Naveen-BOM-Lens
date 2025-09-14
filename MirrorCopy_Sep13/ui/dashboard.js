// ui/dashboard.js

import { planConfig } from '../config.js';
import { renderNetworkGraph } from './bomViewer.js';

let lastTableRenderFunction = null;

// This helper function creates the popup for managing columns
export function createColumnManagerPopup(table, settingsButton) {
    // Close any existing popups first
    document.querySelectorAll('.column-manager-popup').forEach(p => p.remove());

    const popup = document.createElement('div');
    popup.className = 'column-manager-popup';
    
    // Temporarily append to measure its width, then position it
    popup.style.visibility = 'hidden';
    document.body.appendChild(popup);
    const popupWidth = popup.offsetWidth;
    
    const btnRect = settingsButton.getBoundingClientRect();
    let leftPos = btnRect.right + window.scrollX - popupWidth;
    if (leftPos < 10) { // Check if it's going off the left edge
        leftPos = 10;
    }
    popup.style.top = `${btnRect.bottom + window.scrollY + 5}px`;
    popup.style.left = `${leftPos}px`;
    popup.style.visibility = 'visible';

    popup.innerHTML = `<h4>Configure Columns</h4>`;
    const list = document.createElement('ul');

    let draggedItem = null;

    table.getColumns().forEach(column => {
        const item = document.createElement('li');
        item.draggable = true;
        item.dataset.field = column.getField();

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = column.isVisible();
        checkbox.onchange = () => {
            if (checkbox.checked) {
                column.show();
            } else {
                column.hide();
            }
        };

        const label = document.createElement('span');
        label.textContent = column.getDefinition().title;
        
        item.appendChild(checkbox);
        item.appendChild(label);
        list.appendChild(item);

        // Drag and Drop events for reordering
        item.addEventListener('dragstart', () => {
            draggedItem = item;
            setTimeout(() => item.classList.add('dragging'), 0);
        });
        item.addEventListener('dragend', () => {
            setTimeout(() => {
                if (draggedItem) {
                    draggedItem.classList.remove('dragging');
                }
                draggedItem = null;
            }, 0);
        });
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = [...list.querySelectorAll('li:not(.dragging)')].reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = e.clientY - box.top - box.height / 2;
                return (offset < 0 && offset > closest.offset) ? { offset: offset, element: child } : closest;
            }, { offset: Number.NEGATIVE_INFINITY }).element;
            
            if (afterElement == null) {
                list.appendChild(draggedItem);
            } else {
                list.insertBefore(draggedItem, afterElement);
            }
            
            const originalColumnDefs = table.getColumnDefinitions();
            const columnDefMap = originalColumnDefs.reduce((map, col) => {
                map[col.field] = col;
                return map;
            }, {});
            
            const newOrderOfFields = [...list.querySelectorAll('li')].map(li => li.dataset.field);
            const newColumnDefs = newOrderOfFields.map(field => columnDefMap[field]);

            table.setColumns(newColumnDefs);
        });
    });

    popup.appendChild(list);

    // Close popup if clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeHandler(e) {
            if (!popup.contains(e.target) && e.target !== settingsButton) {
                popup.remove();
                document.removeEventListener('click', closeHandler);
            }
        });
    }, 0);
}


function createHeaderWithBackButton(title, backFunction, tableInstance = null) {
    const header = document.createElement('div');
    header.className = 'flex justify-between items-center mb-4';
    
    const titleEl = document.createElement('h2');
    titleEl.className = 'text-xl font-bold text-gray-800';
    titleEl.textContent = title;
    
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'flex items-center space-x-2';

    // Add settings button if a table instance is provided
    if (tableInstance) {
        const settingsButton = document.createElement('button');
        settingsButton.className = 'flex items-center p-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors';
        settingsButton.title = 'Configure Columns';
        settingsButton.innerHTML = `<i class="fas fa-cog"></i>`;
        settingsButton.onclick = (e) => {
            e.stopPropagation();
            createColumnManagerPopup(tableInstance, settingsButton);
        };
        buttonGroup.appendChild(settingsButton);
    }

    if (backFunction) {
        const backButton = document.createElement('button');
        backButton.className = 'flex items-center p-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors';
        backButton.title = 'Back';
        backButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>`;
        backButton.addEventListener('click', backFunction);
        buttonGroup.appendChild(backButton);
    }
    
    header.appendChild(titleEl);
    header.appendChild(buttonGroup);
    return header;
}

function createSkuTable(title, data, messageIfEmpty, backFunction, showDashboardContent) {
    const resultsContainer = document.getElementById('results-container');
    const renderFunc = () => {
        lastTableRenderFunction = renderFunc;
        resultsContainer.innerHTML = '';

        if (!data || data.length === 0) {
            resultsContainer.appendChild(createHeaderWithBackButton(title, backFunction));
            resultsContainer.innerHTML += `<p class="text-gray-500">${messageIfEmpty}</p>`;
            return;
        }

        const tableContainer = document.createElement('div');
        tableContainer.className = 'tabulator-creative';

        const tableData = data.map(node => node.properties);
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

        const columns = sortedKeys.map(key => {
            const columnDef = {
                title: key.replace(/_/g, ' '),
                field: key,
                headerHozAlign: "center",
                hozAlign: "center",
                resizable: true,
                headerSort: true,
            };

            const buttonFormatter = (cell, text, style, action) => {
                const value = cell.getValue();
                if (!value || value <= 0) return `<span>${value || 0}</span>`;

                const skuId = cell.getRow().getData().sku_id;
                const container = document.createElement("div");
                container.classList.add("flex", "items-center", "justify-center", "space-x-2");
                container.innerHTML = `<span>${value}</span>`;
                
                const button = document.createElement("button");
                button.className = `px-2 py-1 text-white rounded-lg text-xs ${style}`;
                button.dataset.skuId = skuId;
                button.textContent = text;
                button.onclick = (e) => {
                    e.stopPropagation();
                    action(skuId, showDashboardContent);
                };
                container.appendChild(button);
                return container;
            };

            if (key === 'sku_id') {
                columnDef.formatter = function(cell) {
                    const skuId = cell.getValue();
                    const container = document.createElement("div");
                    container.classList.add("flex", "items-center", "justify-center", "space-x-2");
                    container.innerHTML = `<span>${skuId}</span>`;
                    
                    const button = document.createElement("button");
                    button.className = "px-2 py-1 bg-blue-500 text-white rounded-lg text-xs hover:bg-blue-600";
                    button.dataset.skuId = skuId;
                    button.textContent = "Show Network";
                    button.onclick = (e) => {
                        e.stopPropagation();
                        fetch('http://127.0.0.1:5000/api/network-graph', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sku_id: skuId }) })
                            .then(r => r.json())
                            .then(d => {
                                const networkTitle = `Network for ${skuId}`;
                                resultsContainer.innerHTML = '';
                                resultsContainer.appendChild(createHeaderWithBackButton(networkTitle, renderFunc));
                                renderNetworkGraph(skuId, d, networkTitle, resultsContainer, null);
                            });
                        showDashboardContent(resultsContainer);
                    };
                    container.appendChild(button);
                    return container;
                };
            } 
            else if (key === 'cust_demand_qty') {
                columnDef.formatter = cell => buttonFormatter(cell, "Show CO", "bg-red-500 hover:bg-red-600", renderAffectedCustOrdersForSku);
            } else if (key === 'fcst_demand_qty') {
                columnDef.formatter = cell => buttonFormatter(cell, "Show FO", "bg-orange-500 hover:bg-orange-600", renderAffectedFcstOrdersForSku);
            }
            return columnDef;
        });

        resultsContainer.appendChild(tableContainer);
        const table = new Tabulator(tableContainer, {
            data: tableData,
            columns: columns,
            layout: "fitDataStretch",
            movableColumns: true,
            classes: "tabulator-creative",
            persistence: {
                sort: true,
                columns: true,
            },
            persistenceID: `dashboard-table-${title.replace(/\s+/g, '-')}`,
        });
        
        resultsContainer.prepend(createHeaderWithBackButton(title, backFunction, table));
    };
    renderFunc();
}

function createOrderTable(title, data, messageIfEmpty, backFunction) {
    const resultsContainer = document.getElementById('results-container');
    const renderFunc = () => {
        lastTableRenderFunction = renderFunc;
        resultsContainer.innerHTML = '';
        
        if (!data || data.length === 0) {
            resultsContainer.appendChild(createHeaderWithBackButton(title, backFunction));
            resultsContainer.innerHTML += `<p class="text-gray-500">${messageIfEmpty}</p>`;
            return;
        }
        
        const tableContainer = document.createElement('div');
        tableContainer.className = 'tabulator-creative';

        const tableData = data.map(record => record.properties.full_record);
        
        const customerOrderSequence = ['OrderID', 'Item', 'Loc', 'RGID', 'CGID', 'Delivery Date', 'Ship date WW', 'Ship Date'];
        const forecastOrderSequence = ['Seqnum', 'Item', 'ItemClass', 'U CAPACITY CORRIDOR', 'Loc', 'Dmd Group', 'Cust Tier', 'Priority', 'Intel WW', 'Qty', 'Descr'];

        let preferredOrder = [];
        if (title.toLowerCase().includes('customer')) {
            preferredOrder = customerOrderSequence;
        } else if (title.toLowerCase().includes('forecast')) {
            preferredOrder = forecastOrderSequence;
        }

        const allKeys = Object.keys(tableData[0]);
        const preferredKeysInOrder = preferredOrder.filter(key => allKeys.includes(key));
        const remainingKeys = allKeys
            .filter(key => !preferredOrder.includes(key))
            .sort((a, b) => a.localeCompare(b));
        
        const finalKeyOrder = [...preferredKeysInOrder, ...remainingKeys];
        
        const columns = finalKeyOrder.map(key => ({
            title: key.replace(/_/g, ' '),
            field: key,
            headerHozAlign: "center",
            hozAlign: "center",
            resizable: true,
            headerSort: true,
        }));
        
        resultsContainer.appendChild(tableContainer);
        const table = new Tabulator(tableContainer, {
            data: tableData,
            columns: columns,
            layout: "fitDataStretch",
            movableColumns: true,
            classes: "tabulator-creative",
            persistence: {
                sort: true,
                columns: true,
            },
            persistenceID: `dashboard-table-${title.replace(/\s+/g, '-')}`,
        });
        
        resultsContainer.prepend(createHeaderWithBackButton(title, backFunction, table));
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
    const affectedOrdersCard = document.getElementById('affected-orders-card');
    const brokenSkuCard = document.getElementById('broken-sku-card');
    const brokenDemandNetworkCard = document.getElementById('broken-demand-network-card');
    const custOrdersCard = document.getElementById('cust-orders-card');
    const fcstOrdersCard = document.getElementById('fcst-orders-card');
    
    const resultsContainer = document.getElementById('results-container');
    const brokenNetworksSection = document.getElementById('broken-networks-section');
    const affectedOrdersSection = document.getElementById('affected-orders-section');
    
    brokenNetworksCard.addEventListener('click', () => showDashboardContent(brokenNetworksSection));
    affectedOrdersCard.addEventListener('click', () => showDashboardContent(affectedOrdersSection));
    
    const renderBrokenSkus = () => fetch('http://127.0.0.1:5000/api/broken-networks').then(r => r.json()).then(d => { createSkuTable('Broken SKUs', d, 'No broken SKUs found.', () => showDashboardContent(brokenNetworksSection), showDashboardContent); showDashboardContent(resultsContainer); });
    const renderBrokenDemand = () => fetch('http://127.0.0.1:5000/api/broken-demand-networks').then(r => r.json()).then(d => { createSkuTable('Broken Finished Goods', d, 'No broken FG networks found.', () => showDashboardContent(brokenNetworksSection), showDashboardContent); showDashboardContent(resultsContainer); });
    const renderAffectedCustOrders = () => fetch('http://127.0.0.1:5000/api/affected-cust-orders').then(r => r.json()).then(d => { createOrderTable('Affected Customer Orders', d, 'No affected customer orders found.', () => showDashboardContent(affectedOrdersSection)); showDashboardContent(resultsContainer); });
    const renderAffectedFcstOrders = () => fetch('http://127.0.0.1:5000/api/affected-fcst-orders').then(r => r.json()).then(d => { createOrderTable('Affected Forecast Orders', d, 'No affected forecast orders found.', () => showDashboardContent(affectedOrdersSection)); showDashboardContent(resultsContainer); });
    
    brokenSkuCard.addEventListener('click', renderBrokenSkus);
    brokenDemandNetworkCard.addEventListener('click', renderBrokenDemand);
    custOrdersCard.addEventListener('click', renderAffectedCustOrders);
    fcstOrdersCard.addEventListener('click', renderAffectedFcstOrders);
}