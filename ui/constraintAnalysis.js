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


// --- Functions to render drill-down content ---

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

function renderBottleneckView() {
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

    // Fetch counts and add event listeners
    fetch('/api/constraints/summary').then(res => res.json()).then(summary => {
        document.getElementById('ca-bottleneck-resources-count-drilldown').textContent = (summary.constrainedResourceCount || 0).toLocaleString();
        document.getElementById('ca-bottleneck-skus-count-drilldown').textContent = (summary.bottleneckSkusCount || 0).toLocaleString();
    });

    document.getElementById('ca-bottleneck-resources-card-drilldown').addEventListener('click', renderConstrainedResourcesTable);
    document.getElementById('ca-bottleneck-skus-card-drilldown').addEventListener('click', renderBottleneckSkusTable);
}

// ## MODIFICATION START ## - This function is now refactored to use the manual rowFormatter method
async function renderConstrainedResourcesTable() {
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(createCaHeader("Constrained Resources", renderBottleneckView));
    
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
                const constraints = data.constraints;
                const rowElement = row.getElement();

                if (constraints && constraints.length > 0) {
                    const detailElement = document.createElement("div");
                    detailElement.classList.add("hidden", "p-4", "bg-gray-50", "border-t", "text-left");
                    let html = '<ul class="space-y-2 list-disc list-inside">';
                    constraints.forEach(c => {
                        const utilPercent = (c.utilization * 100).toFixed(0);
                        html += `<li class="text-sm text-gray-700">Constraint in <strong>Week ${c.week}</strong> at <strong class="text-red-600">${utilPercent}%</strong> utilization.</li>`;
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
                    title: "Constraints", 
                    field: "constraints",
                    hozAlign: "center", 
                    width: 150,
                    headerSort: false,
                    formatter: (cell) => {
                        const constraints = cell.getValue() || [];
                        const count = constraints.length;
                        if (count === 0) return "0";
                        return `<span class="expand-handle cursor-pointer text-indigo-600 hover:text-indigo-800"><i class="fas fa-caret-right fa-fw"></i> ${count}</span>`;
                    },
                    sorter: (a,b) => (a?.length || 0) - (b?.length || 0)
                },
                { 
                    title: "Resource ID", 
                    field: "properties.res_id",
                    formatter: (cell) => {
                        const resId = cell.getValue();
                        return `<span>${resId}</span> <button class="ml-2 px-2 py-1 bg-cyan-500 text-white rounded-lg text-xs hover:bg-cyan-600" data-res-id="${resId}">Show Network</button>`;
                    }
                },
                { 
                    title: "Description",
                    field: "properties.res_descr",
                    widthGrow: 2.5,
                },
            ],
        });

        table.on("cellClick", function(e, cell){
            const target = e.target;
            if (target && target.tagName === 'BUTTON' && target.dataset.resId) {
                const resId = target.dataset.resId;
                resultsContainer.innerHTML = '';
                resultsContainer.appendChild(createCaHeader(`Network for Resource ${resId}`, renderConstrainedResourcesTable));
                fetchResourceNetworkGraph(resId, `Network for ${resId}`, resultsContainer);
            }
        });

    } catch (error) {
        console.error("Error fetching constrained resources:", error);
        contentContainer.innerHTML = `<p class="text-red-500">An error occurred while fetching data.</p>`;
    }
}
// ## MODIFICATION END ##

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
export async function renderConstraintCards() {
    cardsContainer.innerHTML = `<div class="flex justify-center items-center p-8"><i class="fas fa-spinner fa-spin fa-2x text-gray-400"></i></div>`;
    
    try {
        const [demandsSummaryRes, constraintsSummaryRes] = await Promise.all([
            fetch('/api/constraints/impacted-demands/summary'),
            fetch('/api/constraints/summary')
        ]);
        const demandsSummary = await demandsSummaryRes.json();
        const constraintsSummary = await constraintsSummaryRes.json();
        
        const totalBottlenecks = (constraintsSummary.constrainedResourceCount || 0) + (constraintsSummary.bottleneckSkusCount || 0);
        
        cardsContainer.innerHTML = `
            <div id="ca-card-bottlenecks" class="bg-white rounded-xl shadow-lg p-4 cursor-pointer hover:shadow-2xl transition-shadow duration-300">
                <p class="text-sm font-medium text-gray-500 uppercase">Bottlenecks</p>
                <p class="text-2xl font-bold text-yellow-500">${totalBottlenecks}</p>
            </div>
            <div id="ca-card-impacted-demands" class="bg-white rounded-xl shadow-lg p-4 cursor-pointer hover:shadow-2xl transition-shadow duration-300">
                <p class="text-sm font-medium text-gray-500 uppercase">Impacted Demands</p>
                <p class="text-2xl font-bold text-orange-500">${demandsSummary.orderCount.toLocaleString()}-${(demandsSummary.totalQty || 0).toLocaleString()}</p>
            </div>
            <div id="ca-card-order-search" class="bg-white rounded-xl shadow-lg p-4 cursor-pointer hover:shadow-2xl transition-shadow duration-300">
                <div class="flex items-center">
                    <div class="p-3 rounded-full bg-indigo-500 text-white mr-4"><i class="fas fa-search fa-lg"></i></div>
                    <div>
                        <p class="text-sm font-medium text-gray-500 uppercase">Order</p>
                        <p class="text-2xl font-bold text-gray-800">Search</p>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('ca-card-impacted-demands').addEventListener('click', renderImpactedDemandsTable);
        document.getElementById('ca-card-order-search').addEventListener('click', renderOrderSearchUI);
        document.getElementById('ca-card-bottlenecks').addEventListener('click', renderBottleneckView);

    } catch (error) {
        console.error("Error fetching constraints summary:", error);
        cardsContainer.innerHTML = `<p class="text-red-500">Could not load constraint cards.</p>`;
    }
}

export function initConstraintAnalysis() {
    renderConstraintCards();
    renderImpactedDemandsTable();
}