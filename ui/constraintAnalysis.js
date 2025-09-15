// ui/constraintAnalysis.js

import { fetchResourceNetworkGraph } from './bomViewer.js';

const cardsContainer = document.getElementById('ca-cards-container');
const resultsContainer = document.getElementById('ca-results-container');

function createCaHeader(title, backFunction = null) {
    const header = document.createElement('div');
    header.className = 'flex justify-between items-center mb-4 px-2';
    
    const titleEl = document.createElement('h2');
    titleEl.className = 'text-xl font-bold text-gray-800';
    titleEl.textContent = title;
    
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'flex items-center space-x-2';
    
    header.appendChild(titleEl);
    header.appendChild(buttonGroup);

    if (backFunction) {
        const backButton = document.createElement('button');
        backButton.className = 'flex items-center p-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors';
        backButton.title = 'Back';
        backButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>`;
        backButton.addEventListener('click', backFunction);
        buttonGroup.appendChild(backButton);
    }
    return header;
}


// --- Functions to render drill-down content ---

function renderDemandSearchUI() {
    resultsContainer.innerHTML = ''; 
    
    const searchContainer = document.createElement('div');
    searchContainer.className = 'px-2';
    searchContainer.innerHTML = `
        <div class="bg-white rounded-xl shadow-lg p-4">
            <div class="flex items-center space-x-2">
                <input type="text" id="fg-item-input" placeholder="Enter Item..." class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <input type="text" id="fg-loc-input" placeholder="Enter Location..." class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <button id="fg-search-btn" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex-shrink-0">
                    <i class="fas fa-search"></i>
                    <span class="ml-2">Search</span>
                </button>
            </div>
        </div>
        <div id="fg-health-report-container" class="mt-6"></div>
    `;
    resultsContainer.appendChild(searchContainer);

    const searchBtn = document.getElementById('fg-search-btn');
    const itemInput = document.getElementById('fg-item-input');
    const locInput = document.getElementById('fg-loc-input');
    
    const performSearch = () => {
        const item = itemInput.value.trim();
        const loc = locInput.value.trim();
        if (item && loc) {
            handleFgSearch(item, loc);
        } else {
            alert('Please enter both an Item and a Location.');
        }
    };

    searchBtn.addEventListener('click', performSearch);
    itemInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') performSearch(); });
    locInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') performSearch(); });
}

async function handleFgSearch(item, loc) {
    const reportContainer = document.getElementById('fg-health-report-container');
    const searchBtn = document.getElementById('fg-search-btn');
    reportContainer.innerHTML = `<div class="flex justify-center items-center p-8"><i class="fas fa-spinner fa-spin fa-2x text-gray-400"></i></div>`;
    searchBtn.disabled = true;

    try {
        const response = await fetch('/api/constraints/fg-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item, loc })
        });
        const data = await response.json();
        renderFgHealthReport(data);
    } catch (error) {
        console.error("Error fetching FG health report:", error);
        reportContainer.innerHTML = `<p class="text-red-500">An error occurred while fetching the report.</p>`;
    } finally {
        searchBtn.disabled = false;
    }
}

function getStatusBadge(status) {
    const styles = {
        'Healthy': 'bg-green-100 text-green-800',
        'At Risk': 'bg-yellow-100 text-yellow-800',
        'Constrained': 'bg-red-100 text-red-800'
    };
    const icons = {
        'Healthy': 'fa-check-circle',
        'At Risk': 'fa-exclamation-triangle',
        'Constrained': 'fa-exclamation-circle'
    };
    return `<span class="ml-4 px-3 py-1 text-sm font-medium rounded-full ${styles[status]}"><i class="fas ${icons[status]} mr-1"></i> ${status}</span>`;
}

function renderFgHealthReport(data) {
    const reportContainer = document.getElementById('fg-health-report-container');
    reportContainer.innerHTML = '';

    if (!data.found) {
        reportContainer.innerHTML = `<p class="text-red-500 p-4">SKU '${data.sku}' not found.</p>`;
        return;
    }

    const header = document.createElement('div');
    header.className = 'flex items-center mb-4 px-2';
    header.innerHTML = `
        <h3 class="text-xl font-bold text-gray-800">${data.sku}</h3>
        ${getStatusBadge(data.status)}
    `;
    reportContainer.appendChild(header);
    
    const tableContainer = document.createElement('div');
    tableContainer.className = 'px-2';
    reportContainer.appendChild(tableContainer);

    const tableData = [{
        id: 1,
        sku: data.sku,
        totalDemands: data.all_demands,
        totalDemandsSummary: `${data.total_demand_count} - ${Math.round(data.total_demand_qty).toLocaleString()}`,
        constrainedDemands: data.constrained_demands,
        constrainedDemandsSummary: `${data.constrained_demand_count} - ${Math.round(data.constrained_demand_qty).toLocaleString()}`,
        constraints: data.constraints,
        constraintsSummary: data.constraints.length
    }];
    
    // ## MODIFICATION START ## - Arrow icon is now placed before the summary text
    const expanderFormatter = (cell, formatterParams) => {
        const details = cell.getValue() || [];
        const summaryText = cell.getRow().getData()[formatterParams.summaryField];
        if (details.length === 0) return summaryText; 
        
        return `<span class="expand-handle cursor-pointer text-indigo-600 hover:text-indigo-800" data-target="${formatterParams.targetId}"><i class="fas fa-caret-right fa-fw mr-2"></i>${summaryText}</span>`;
    };
    // ## MODIFICATION END ##

    new Tabulator(tableContainer, {
        data: tableData,
        layout: "fitDataStretch",
        rowFormatter: (row) => {
            const rowElement = row.getElement();
            const detailElement = document.createElement("div"); 
            detailElement.classList.add("hidden", "p-0", "bg-gray-50", "border-t");
            rowElement.appendChild(detailElement);
            
            rowElement.addEventListener('click', (e) => {
                const handle = e.target.closest('.expand-handle');
                if (!handle) return;
                
                e.stopPropagation();
                const targetId = handle.dataset.target;
                const data = row.getData();
                let isOpening = !detailElement.classList.contains("hidden") && detailElement.dataset.activeTarget === targetId;

                rowElement.querySelectorAll('.expand-handle i').forEach(icon => {
                    icon.classList.remove('fa-caret-down');
                    icon.classList.add('fa-caret-right');
                });
                
                if (isOpening) {
                    detailElement.classList.add("hidden");
                    detailElement.innerHTML = '';
                } else {
                    detailElement.classList.remove("hidden");
                    detailElement.dataset.activeTarget = targetId;
                    handle.querySelector("i").classList.remove("fa-caret-right");
                    handle.querySelector("i").classList.add("fa-caret-down");
                    
                    detailElement.innerHTML = ''; 
                    
                    if (targetId === 'total' || targetId === 'constrained') {
                        const demandData = data[targetId === 'total' ? 'totalDemands' : 'constrainedDemands'];
                        
                        let columns = [
                            { title: "Order ID", field: "orderId" }, { title: "Seq Num", field: "seqnum" },
                            { title: "Qty", field: "qty", hozAlign: "right" }, { title: "Date", field: "date" }, { title: "Type", field: "type" }
                        ];

                        if (targetId === 'constrained') {
                            columns.unshift({
                                title: "Constraints",
                                field: "constraints",
                                hozAlign: "center",
                                width: 150,
                                formatter: (cell) => {
                                    const constraints = cell.getValue() || [];
                                    if (constraints.length === 0) return "0";
                                    return `<span class="expand-constraints cursor-pointer text-indigo-600 hover:text-indigo-800"><i class="fas fa-caret-right fa-fw"></i> ${constraints.length}</span>`;
                                }
                            });
                        }
                        
                        const nestedTable = new Tabulator(detailElement, {
                            data: demandData,
                            layout: "fitData",
                            cssClass: "tabulator-creative",
                            rowFormatter: (subRow) => {
                                const subRowData = subRow.getData();
                                const subRowElement = subRow.getElement();
                                if(subRowData.constraints && subRowData.constraints.length > 0) {
                                    const subDetailElement = document.createElement('div');
                                    subDetailElement.classList.add("hidden", "p-4", "bg-gray-100", "border-t", "text-left");
                                    
                                    let html = '<ul class="space-y-2 list-disc list-inside">';
                                    subRowData.constraints.forEach(c => {
                                        const utilPercent = (c.utilization * 100).toFixed(0);
                                        html += `<li class="text-sm text-gray-700">Constraint on <strong>${c.resourceId}</strong> in <strong>Week ${c.week}</strong> at <strong class="text-red-600">${utilPercent}%</strong> utilization.</li>`;
                                    });
                                    html += '</ul>';
                                    subDetailElement.innerHTML = html;
                                    subRowElement.appendChild(subDetailElement);

                                    const subCellEl = subRow.getCell("constraints");
                                    if(subCellEl) {
                                        const subHandle = subCellEl.getElement().querySelector('.expand-constraints');
                                        if (subHandle) {
                                            subHandle.addEventListener('click', (evt) => {
                                                evt.stopPropagation();
                                                subDetailElement.classList.toggle('hidden');
                                                subHandle.querySelector("i").classList.toggle("fa-caret-right");
                                                subHandle.querySelector("i").classList.toggle("fa-caret-down");
                                            });
                                        }
                                    }
                                }
                            },
                            columns: columns
                        });
                    } else if (targetId === 'constraints') {
                        let html = '<ul class="space-y-2 list-disc list-inside p-4 text-left">';
                        data.constraints.forEach(c => {
                            const utilPercent = (c.utilization * 100).toFixed(0);
                            html += `<li class="text-sm text-gray-700">Constraint on <strong>${c.resourceId}</strong> in <strong>Week ${c.week}</strong> at <strong class="text-red-600">${utilPercent}%</strong> utilization.</li>`;
                        });
                        html += '</ul>';
                        detailElement.innerHTML = html;
                    }
                }
            });
        },
        columns: [
            { title: "SKU", field: "sku", width: 250, cssClass: "font-bold", hozAlign: "left" },
            { title: "Total Demand", field: "totalDemands", hozAlign: "left", formatter: expanderFormatter, formatterParams: { summaryField: 'totalDemandsSummary', targetId: 'total' } },
            { title: "Constrained Demand", field: "constrainedDemands", hozAlign: "left", formatter: expanderFormatter, formatterParams: { summaryField: 'constrainedDemandsSummary', targetId: 'constrained' } },
            { title: "Constraints", field: "constraints", hozAlign: "left", formatter: expanderFormatter, formatterParams: { summaryField: 'constraintsSummary', targetId: 'constraints' } }
        ]
    });
}


function renderOrderSearchUI() {
    resultsContainer.innerHTML = ''; 
    resultsContainer.appendChild(createCaHeader("Order Search"));

    const searchContainer = document.createElement('div');
    searchContainer.className = 'px-2';
    searchContainer.innerHTML = `
        <div class="bg-white rounded-xl shadow-lg p-4">
            <div class="flex items-center space-x-2">
                <input type="text" id="ca-order-search-input-internal" placeholder="Enter Order ID or Seqnum..." class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <button id="ca-order-search-btn-internal" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex-shrink-0">
                    <i class="fas fa-search"></i>
                    <span class="ml-2">Analyze</span>
                </button>
            </div>
        </div>
        <div id="ca-order-results-container-internal" class="hidden mt-6 space-y-6">
            <div class="bg-white rounded-xl shadow-lg p-4">
                <h3 class="text-lg font-semibold text-gray-800 mb-2">Order Details</h3>
                <div id="ca-order-details-internal"></div>
            </div>
            <div class="bg-white rounded-xl shadow-lg p-4">
                <h3 class="text-lg font-semibold text-gray-800 mb-2">Linked Constraints</h3>
                <div id="ca-order-constraints-internal"></div>
            </div>
        </div>
    `;
    resultsContainer.appendChild(searchContainer);

    const searchBtn = document.getElementById('ca-order-search-btn-internal');
    const searchInput = document.getElementById('ca-order-search-input-internal');
    searchBtn.addEventListener('click', () => handleOrderSearchInternal());
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleOrderSearchInternal();
    });
}

async function handleOrderSearchInternal() {
    const input = document.getElementById('ca-order-search-input-internal');
    const resultsContainerInternal = document.getElementById('ca-order-results-container-internal');
    const detailsContainer = document.getElementById('ca-order-details-internal');
    const constraintsContainer = document.getElementById('ca-order-constraints-internal');
    const searchBtn = document.getElementById('ca-order-search-btn-internal');
    
    const orderId = input.value.trim();
    if (!orderId) return;

    searchBtn.disabled = true;
    searchBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i><span class="ml-2">Analyzing...</span>`;
    resultsContainerInternal.classList.add('hidden');
    
    try {
        const response = await fetch('/api/constraints/order-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: orderId })
        });
        const data = await response.json();
        renderOrderDetails(data.orderDetails, detailsContainer);
        renderConstraintList(data.constraints, constraintsContainer);
        resultsContainerInternal.classList.remove('hidden');
    } catch (error) {
        console.error("Error fetching order constraints:", error);
        detailsContainer.innerHTML = `<p class="text-red-500">An error occurred while fetching data.</p>`;
    } finally {
        searchBtn.disabled = false;
        searchBtn.innerHTML = `<i class="fas fa-search"></i><span class="ml-2">Analyze</span>`;
    }
}

async function renderImpactedDemandsTable() {
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(createCaHeader("Impacted Demands"));
    
    const contentContainer = document.createElement('div');
    contentContainer.className = 'px-2';
    resultsContainer.appendChild(contentContainer);

    contentContainer.innerHTML = `<div class="flex justify-center items-center p-8"><i class="fas fa-spinner fa-spin fa-2x text-gray-400"></i></div>`;

    try {
        const response = await fetch('/api/constraints/impacted-demands');
        const data = await response.json();
        contentContainer.innerHTML = '';
        
        if (!data || data.length === 0) {
            contentContainer.innerHTML = `<p class="text-gray-500">No impacted demands found.</p>`;
            return;
        }

        const tableContainer = document.createElement('div');
        tableContainer.className = 'tabulator-creative';
        contentContainer.appendChild(tableContainer);

        new Tabulator(tableContainer, {
            data: data,
            layout: "fitDataStretch",
            rowFormatter: function(row) {
                const data = row.getData();
                const constraints = data.constraints;
                const rowElement = row.getElement();

                if (constraints && constraints.length > 0) {
                    const detailElement = document.createElement("div");
                    detailElement.classList.add("hidden", "p-4", "bg-gray-50", "border-t");
                    let html = '<ul class="space-y-2 list-disc list-inside">';
                    constraints.forEach(c => {
                        const utilPercent = (c.utilization * 100).toFixed(0);
                        html += `<li class="text-sm text-gray-700">Resource <code class="bg-gray-200 p-1 rounded">${c.resourceId}</code> was <strong>${utilPercent}% utilized</strong> in Week ${c.week}.</li>`;
                    });
                    html += '</ul>';
                    detailElement.innerHTML = html;
                    rowElement.appendChild(detailElement);
                    
                    const cellEl = row.getCell("constraints");
                    if (cellEl) {
                        const handle = cellEl.getElement().querySelector(".expand-handle");
                        if (handle) {
                            handle.addEventListener("click", (e) => {
                                e.stopPropagation();
                                detailElement.classList.toggle("hidden");
                                handle.querySelector("i").classList.toggle("fa-caret-right");
                                handle.querySelector("i").classList.toggle("fa-caret-down");
                            });
                        }
                    }
                }
            },
            columns: [
                {
                    title: "Constraints", field: "constraints", hozAlign: "center", width: 150, headerSort: false,
                    formatter: function(cell) {
                        const constraints = cell.getValue() || [];
                        const count = constraints.length;
                        if (count === 0) return "0";
                        return `<span class="expand-handle cursor-pointer text-indigo-600 hover:text-indigo-800"><i class="fas fa-caret-right fa-fw"></i> ${count}</span>`;
                    },
                    sorter: function(a, b){ return (a?.length || 0) - (b?.length || 0); }
                },
                { title: "Order ID", field: "demand.orderId", width: 200, headerFilter: "input" },
                { title: "Seq Num", field: "demand.seqnum", headerFilter: "input" },
                { title: "SKU", field: "demand.sku_id", width: 250, headerFilter: "input" },
                { title: "Qty", field: "demand.qty", hozAlign: "right" },
                { title: "Date", field: "demand.date" },
                { title: "Type", field: "demand.type", headerFilter: "select", headerFilterParams: {values: true} },
            ],
        });
        
    } catch (error) {
        console.error("Error fetching impacted demands:", error);
        contentContainer.innerHTML = `<p class="text-red-500">An error occurred while fetching data.</p>`;
    }
}

function renderBottleneckView(summaryData) {
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(createCaHeader("Bottleneck Analysis"));

    const subcardsContent = document.createElement('div');
    subcardsContent.className = 'max-w-2xl px-2';
    subcardsContent.innerHTML = `
        <section class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div id="ca-bottleneck-resources-card-drilldown" class="bg-white rounded-xl shadow-lg p-3 cursor-pointer hover:shadow-2xl transition-shadow duration-300">
                <div class="flex items-baseline justify-between">
                    <h4 class="text-base font-bold text-cyan-800">Resources</h4>
                    <span id="ca-bottleneck-resources-count-drilldown" class="text-lg font-bold text-cyan-800">0</span>
                </div>
            </div>
            <div id="ca-bottleneck-skus-card-drilldown" class="bg-white rounded-xl shadow-lg p-3 cursor-pointer hover:shadow-2xl transition-shadow duration-300">
                <div class="flex items-baseline justify-between">
                    <h4 class="text-base font-bold text-indigo-800">SKU</h4>
                    <span id="ca-bottleneck-skus-count-drilldown" class="text-lg font-bold text-indigo-800">0</span>
                </div>
            </div>
        </section>
    `;
    resultsContainer.appendChild(subcardsContent);
    
    document.getElementById('ca-bottleneck-resources-count-drilldown').textContent = (summaryData.constrainedResourceCount || 0).toLocaleString();
    document.getElementById('ca-bottleneck-skus-count-drilldown').textContent = (summaryData.bottleneckSkusCount || 0).toLocaleString();
    
    document.getElementById('ca-bottleneck-resources-card-drilldown').addEventListener('click', () => renderConstrainedResourcesList(summaryData));
    document.getElementById('ca-bottleneck-skus-card-drilldown').addEventListener('click', renderBottleneckSkusTable);
}

async function renderResourceTimePhase(resourceId = null) {
    resultsContainer.innerHTML = '';
    const headerTitle = resourceId ? `Time-Phase for ${resourceId}` : "Resource Time-Phased Utilization";
    const header = createCaHeader(headerTitle, renderConstrainedResourcesList);
    resultsContainer.appendChild(header);
    
    const contentContainer = document.createElement('div');
    contentContainer.className = 'px-2';
    resultsContainer.appendChild(contentContainer);
    contentContainer.innerHTML = `<div class="flex justify-center items-center p-8"><i class="fas fa-spinner fa-spin fa-2x text-gray-400"></i></div>`;

    try {
        const apiUrl = resourceId 
            ? `/api/constraints/resource-time-phase?resId=${resourceId}`
            : '/api/constraints/resource-time-phase';
        const response = await fetch(apiUrl);

        const data = await response.json();
        contentContainer.innerHTML = '';

        if (!data || data.length === 0 || !data[0].weeklyData) {
            const errorMessage = resourceId ? `No time-phased data found for ${resourceId}.` : "No time-phased data found for constrained resources.";
            contentContainer.innerHTML = `<p class="text-gray-500">${errorMessage}</p>`;
            return;
        }

        const weeklyData = data[0].weeklyData;
        const weeks = [...new Set(weeklyData.map(w => w.week))].sort((a, b) => a - b);
        
        const capacityRow = { measure: 'Total Capacity' };
        const loadRow = { measure: 'Total Load' };
        const utilRow = { measure: 'Utilization %' };

        weeks.forEach(week => {
            const weekData = weeklyData.find(w => w.week === week);
            if (weekData) {
                capacityRow[`WW${week}`] = weekData.total_capacity;
                loadRow[`WW${week}`] = weekData.total_load;
                utilRow[`WW${week}`] = weekData.utilization;
            }
        });

        const tableData = [capacityRow, loadRow, utilRow];

        const weekColumns = weeks.map(week => ({
            title: `WW${week}`,
            field: `WW${week}`,
            hozAlign: "center",
            headerVAlign: "middle",
            formatter: (cell) => {
                const value = cell.getValue();
                const measure = cell.getRow().getData().measure;

                if (value === null || typeof value === 'undefined') return "-";
                
                if (measure === 'Utilization %') {
                    const utilPercent = (value * 100).toFixed(0);
                    if (value > 1) {
                        cell.getElement().style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                        return `<strong class="text-red-600">${utilPercent}%</strong>`;
                    } else if (value > 0.85) {
                        cell.getElement().style.backgroundColor = 'rgba(245, 158, 11, 0.2)';
                        return `<span class="text-amber-600">${utilPercent}%</span>`;
                    }
                    return `${utilPercent}%`;
                }
                
                return Math.round(value).toLocaleString();
            }
        }));

        const tableContainer = document.createElement('div');
        tableContainer.className = 'tabulator-creative time-phase-table';
        contentContainer.appendChild(tableContainer);

        new Tabulator(tableContainer, {
            data: tableData,
            layout: "fitData",
            columns: [
                { title: "", field: "measure", frozen: true, width: 150, headerSort: false, cssClass: "font-bold" },
                ...weekColumns
            ],
            cellClick: (e, cell) => {
                const weekStr = cell.getField();
                if (weekStr && weekStr.startsWith('WW')) {
                    const week = parseInt(weekStr.replace('WW', ''));
                    
                    fetch('/api/constraints/demands-for-resource-week', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ resourceId: resourceId, week: week })
                    })
                    .then(res => res.json())
                    .then(demands => {
                        showDemandsModal(demands, resourceId, week);
                    });
                }
            }
        });

    } catch(error) {
        console.error("Error rendering time-phased view:", error);
        contentContainer.innerHTML = `<p class="text-red-500">Could not load time-phased data.</p>`;
    }
}

async function renderConstrainedResourcesList(summaryData) {
    resultsContainer.innerHTML = '';
    const header = createCaHeader("Constrained Resources", () => renderBottleneckView(summaryData));
    resultsContainer.appendChild(header);
    
    const contentContainer = document.createElement('div');
    contentContainer.className = 'px-2';
    resultsContainer.appendChild(contentContainer);
    contentContainer.innerHTML = `<div class="flex justify-center items-center p-8"><i class="fas fa-spinner fa-spin fa-2x text-gray-400"></i></div>`;
    
    try {
        const response = await fetch('/api/constraints/constrained-resources');
        const data = await response.json();
        contentContainer.innerHTML = '';

        if (!data || data.length === 0) {
            contentContainer.innerHTML = `<p class="text-gray-500">No constrained resources found.</p>`;
            return;
        }

        const tableContainer = document.createElement('div');
        tableContainer.className = 'tabulator-creative';
        contentContainer.appendChild(tableContainer);
        
        const table = new Tabulator(tableContainer, {
            data: data,
            maxHeight: "70vh", 
            layout: "fitDataStretch",
            rowFormatter: function(row) {
                const data = row.getData();
                const rowElement = row.getElement();

                if (data.constraintDetails && data.constraintDetails.length > 0) {
                    const detailElement = document.createElement("div");
                    detailElement.id = `constraints-detail-${data.properties.res_id}`;
                    detailElement.classList.add("hidden", "p-4", "bg-gray-50", "border-t", "text-left");
                    
                    let html = '<ul class="space-y-2 list-disc list-inside">';
                    data.constraintDetails.forEach(c_detail => {
                        const utilPercent = (c_detail.constraint.utilization * 100).toFixed(0);
                        html += `<li class="text-sm text-gray-700">Constraint in <strong>Week ${c_detail.constraint.week}</strong> at <strong class="text-red-600">${utilPercent}%</strong> utilization.</li>`;
                    });
                    html += '</ul>';
                    detailElement.innerHTML = html;
                    rowElement.appendChild(detailElement);
                }

                const totalDemands = data.constraintDetails.reduce((acc, cv) => acc + cv.demands.length, 0);
                if (totalDemands > 0) {
                    const demandsDetailElement = document.createElement("div");
                    demandsDetailElement.id = `demands-detail-${data.properties.res_id}`;
                    demandsDetailElement.classList.add("hidden", "p-0", "bg-gray-50", "border-t");
                    rowElement.appendChild(demandsDetailElement);
                }

                const constraintsCell = row.getCell("constraints");
                if (constraintsCell) {
                    const handle = constraintsCell.getElement().querySelector(".expand-constraints");
                    if (handle) {
                        handle.addEventListener("click", (e) => {
                            e.stopPropagation();
                            document.getElementById(`constraints-detail-${data.properties.res_id}`).classList.toggle("hidden");
                            handle.querySelector("i").classList.toggle("fa-caret-right");
                            handle.querySelector("i").classList.toggle("fa-caret-down");
                        });
                    }
                }
                
                const demandsCell = row.getCell("demands");
                if (demandsCell) {
                    const handle = demandsCell.getElement().querySelector(".expand-demands");
                    if (handle) {
                        handle.addEventListener("click", (e) => {
                            e.stopPropagation();
                            const demandsContainer = document.getElementById(`demands-detail-${data.properties.res_id}`);
                            demandsContainer.classList.toggle("hidden");
                            handle.querySelector("i").classList.toggle("fa-caret-right");
                            handle.querySelector("i").classList.toggle("fa-caret-down");

                            if (!demandsContainer.classList.contains("hidden") && !demandsContainer.hasChildNodes()) {
                                let allDemands = [];
                                data.constraintDetails.forEach(cd => {
                                    cd.demands.forEach(demand => {
                                        allDemands.push({ ...demand, constraintDate: `Week ${cd.constraint.week}` });
                                    });
                                });
                                
                                new Tabulator(demandsContainer, {
                                    data: allDemands,
                                    layout: "fitData",
                                    columns: [
                                        { title: "Constraint Week", field: "constraintDate" },
                                        { title: "Order ID", field: "orderId" },
                                        { title: "Seq Num", field: "seqnum" },
                                        { title: "SKU", field: "sku_id", widthGrow: 2 },
                                        { title: "Qty", field: "qty", hozAlign: "right" },
                                        { title: "Type", field: "type" }
                                    ]
                                });
                            }
                        });
                    }
                }
            },
            columns: [
                { 
                    title: "Constraints", 
                    field: "constraints",
                    hozAlign: "center", 
                    width: 150,
                    headerSort: false,
                    formatter: (cell) => {
                        const details = cell.getRow().getData().constraintDetails || [];
                        const count = details.length;
                        if (count === 0) return "0";
                        return `<span class="expand-constraints cursor-pointer text-indigo-600 hover:text-indigo-800"><i class="fas fa-caret-right fa-fw"></i> ${count}</span>`;
                    },
                },
                { 
                    title: "Impacted Demands", 
                    field: "demands",
                    hozAlign: "center", 
                    width: 200,
                    headerSort: false,
                    formatter: (cell) => {
                        const details = cell.getRow().getData().constraintDetails || [];
                        const count = details.reduce((acc, cv) => acc + cv.demands.length, 0);
                        const qty = details.reduce((acc, cv) => acc + (cv.totalDemandQty || 0), 0);
                        if (count === 0) return "0 - 0";
                        return `<span class="expand-demands cursor-pointer text-orange-600 hover:text-orange-800"><i class="fas fa-caret-right fa-fw"></i> ${count} - ${Math.round(qty).toLocaleString()}</span>`;
                    },
                },
                { 
                    title: "Resource ID", 
                    field: "properties.res_id",
                    widthGrow: 2.5,
                    formatter: (cell) => {
                        const resId = cell.getValue();
                        const buttons = `
                            <button class="ml-2 px-2 py-1 bg-cyan-500 text-white rounded-lg text-xs hover:bg-cyan-600" title="Show Network" data-res-id="${resId}" data-action="network">
                                <i class="fas fa-project-diagram fa-fw"></i>
                            </button>
                            <button class="ml-1 px-2 py-1 bg-indigo-500 text-white rounded-lg text-xs hover:bg-indigo-600" title="View Time-Phase" data-res-id="${resId}" data-action="timephase">
                                <i class="fas fa-calendar-alt fa-fw"></i>
                            </button>
                        `;
                        return `<span>${resId}</span> ${buttons}`;
                    }
                },
            ],
        });
        
        table.on("cellClick", function(e, cell){
            const target = e.target.closest('button');
            if (target && target.dataset.resId) {
                const resId = target.dataset.resId;
                const action = target.dataset.action;

                if (action === 'network') {
                    resultsContainer.innerHTML = '';
                    resultsContainer.appendChild(createCaHeader(`Network for Resource ${resId}`, renderConstrainedResourcesList));
                    fetchResourceNetworkGraph(resId, `Network for ${resId}`, resultsContainer);
                } else if (action === 'timephase') {
                    renderResourceTimePhase(resId);
                }
            }
        });

    } catch (error) {
        console.error("Error fetching constrained resources:", error);
        contentContainer.innerHTML = `<p class="text-red-500">An error occurred while fetching data.</p>`;
    }
}


async function renderBottleneckSkusTable() {
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(createCaHeader("Bottleneck SKUs", renderBottleneckView));

    const contentContainer = document.createElement('div');
    contentContainer.className = 'px-2';
    resultsContainer.appendChild(contentContainer);
    contentContainer.innerHTML = `<div class="flex justify-center items-center p-8"><i class="fas fa-spinner fa-spin fa-2x text-gray-400"></i></div>`;
    
    try {
        const response = await fetch('/api/constraints/bottleneck-skus');
        const data = await response.json();
        contentContainer.innerHTML = '';

        if (!data || data.length === 0) {
            contentContainer.innerHTML = `<p class="text-gray-500">No bottleneck SKUs found.</p>`;
            return;
        }

        const tableContainer = document.createElement('div');
        tableContainer.className = 'tabulator-creative';
        contentContainer.appendChild(tableContainer);
        
        new Tabulator(tableContainer, {
            data: data.map(n => n.properties),
            layout: "fitDataStretch",
            columns: [
                { title: "SKU ID", field: "sku_id" },
                { title: "Item", field: "item" },
                { title: "Location", field: "loc" },
                { title: "Total Demand", field: "total_demand_qty", hozAlign: "right" },
            ],
        });

    } catch (error) {
        console.error("Error fetching bottleneck SKUs:", error);
        contentContainer.innerHTML = `<p class="text-red-500">An error occurred while fetching data.</p>`;
    }
}


function renderOrderDetails(details, container) {
    container.innerHTML = '';
    if (!details) {
        container.innerHTML = `<p class="text-gray-500">Order not found.</p>`;
        return;
    }
    const tableContainer = document.createElement('div');
    tableContainer.className = 'tabulator-creative';
    container.appendChild(tableContainer);
    const columns = Object.keys(details).map(key => ({
        title: key.replace(/_/g, ' '), field: key, headerHozAlign: "center", hozAlign: "center", resizable: true, headerSort: false,
    }));
    new Tabulator(tableContainer, { data: [details], columns: columns, layout: "fitDataStretch" });
}

function renderConstraintList(constraints, container) {
    if (!constraints || constraints.length === 0) {
        container.innerHTML = `<p class="text-gray-500">No Constraints linked to the order.</p>`;
        return;
    }
    let html = '<ul class="space-y-3">';
    constraints.forEach(constraint => {
        const utilPercent = (constraint.utilization * 100).toFixed(0);
        html += `<li class="p-3 bg-red-50 border border-red-200 rounded-lg"><p class="text-red-700">Resource <code class="text-sm bg-red-200 p-1 rounded">${constraint.resourceId}</code> was <strong class="font-bold">${utilPercent}% utilized</strong> in Week ${constraint.week}.</p></li>`;
    });
    html += '</ul>';
    container.innerHTML = html;
}

// --- Main initialization function ---
export async function initConstraintAnalysis() {
    cardsContainer.innerHTML = `<div class="flex justify-center items-center p-8"><i class="fas fa-spinner fa-spin fa-2x text-gray-400"></i></div>`;
    resultsContainer.innerHTML = ''; 

    try {
        const response = await fetch('/api/constraints/summary');
        const summaryData = await response.json();
        
        renderConstraintCards(summaryData);
        renderImpactedDemandsTable(); 
    } catch (error) {
        console.error("Error fetching constraints summary:", error);
        cardsContainer.innerHTML = `<p class="text-red-500">Could not load constraint cards.</p>`;
    }
}

function renderConstraintCards(summaryData) {
    const totalBottlenecks = (summaryData.constrainedResourceCount || 0) + (summaryData.bottleneckSkusCount || 0);
    
    cardsContainer.innerHTML = `
        <div id="ca-card-bottlenecks" class="bg-white rounded-xl shadow-lg p-4 cursor-pointer hover:shadow-2xl transition-shadow duration-300">
            <p class="text-sm font-medium text-gray-500 uppercase">Bottlenecks</p>
            <p class="text-2xl font-bold text-yellow-500">${totalBottlenecks}</p>
        </div>
        <div id="ca-card-impacted-demands" class="bg-white rounded-xl shadow-lg p-4 cursor-pointer hover:shadow-2xl transition-shadow duration-300">
            <p class="text-sm font-medium text-gray-500 uppercase">Impacted Demands</p>
            <p class="text-2xl font-bold text-orange-500">${summaryData.impactedDemandsCount.toLocaleString()}-${(summaryData.impactedDemandsQty || 0).toLocaleString()}</p>
        </div>
        <div id="ca-card-order-search" class="bg-white rounded-xl shadow-lg p-4 cursor-pointer hover:shadow-2xl transition-shadow duration-300">
            <p class="text-sm font-medium text-gray-500 uppercase">Order Search</p>
            <p class="text-2xl font-bold text-gray-800">Analyze</p>
        </div>
        <div id="ca-card-demand-search" class="bg-white rounded-xl shadow-lg p-4 cursor-pointer hover:shadow-2xl transition-shadow duration-300">
            <p class="text-sm font-medium text-gray-500 uppercase">Demand Search</p>
            <p class="text-2xl font-bold text-gray-800">Analyze</p>
        </div>
    `;

    document.getElementById('ca-card-impacted-demands').addEventListener('click', renderImpactedDemandsTable);
    document.getElementById('ca-card-order-search').addEventListener('click', renderOrderSearchUI);
    document.getElementById('ca-card-bottlenecks').addEventListener('click', () => renderBottleneckView(summaryData));
    document.getElementById('ca-card-demand-search').addEventListener('click', renderDemandSearchUI);
}