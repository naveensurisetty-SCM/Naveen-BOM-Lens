// ## MODIFICATION START ## - Entire file updated for final UI enhancements

// Helper to create a header with a title for drill-down views
function createCaHeader(title) {
    const titleEl = document.createElement('h2');
    titleEl.className = 'text-xl font-bold text-gray-800 mb-4 px-2';
    titleEl.textContent = title;
    return titleEl;
}


// --- Functions to render drill-down content ---

function renderOrderSearchUI() {
    const resultsContainer = document.getElementById('ca-results-container');
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

    // Wire up the new search button
    const searchBtn = document.getElementById('ca-order-search-btn-internal');
    const searchInput = document.getElementById('ca-order-search-input-internal');
    searchBtn.addEventListener('click', () => handleOrderSearchInternal());
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleOrderSearchInternal();
    });
}

async function handleOrderSearchInternal() {
    const input = document.getElementById('ca-order-search-input-internal');
    const resultsContainer = document.getElementById('ca-order-results-container-internal');
    const detailsContainer = document.getElementById('ca-order-details-internal');
    const constraintsContainer = document.getElementById('ca-order-constraints-internal');
    const searchBtn = document.getElementById('ca-order-search-btn-internal');
    
    const orderId = input.value.trim();
    if (!orderId) return;

    searchBtn.disabled = true;
    searchBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i><span class="ml-2">Analyzing...</span>`;
    resultsContainer.classList.add('hidden');
    
    try {
        const response = await fetch('/api/constraints/order-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: orderId })
        });
        const data = await response.json();
        renderOrderDetails(data.orderDetails, detailsContainer);
        renderConstraintList(data.constraints, constraintsContainer);
        resultsContainer.classList.remove('hidden');
    } catch (error) {
        console.error("Error fetching order constraints:", error);
        detailsContainer.innerHTML = `<p class="text-red-500">An error occurred while fetching data.</p>`;
    } finally {
        searchBtn.disabled = false;
        searchBtn.innerHTML = `<i class="fas fa-search"></i><span class="ml-2">Analyze</span>`;
    }
}

async function renderImpactedDemandsTable() {
    const resultsContainer = document.getElementById('ca-results-container');
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


// --- Functions from previous steps (unchanged but needed for context) ---
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
    const cardsContainer = document.getElementById('ca-cards-container');
    const resultsContainer = document.getElementById('ca-results-container');
    cardsContainer.innerHTML = `<div class="flex justify-center items-center p-8"><i class="fas fa-spinner fa-spin fa-2x text-gray-400"></i></div>`;
    resultsContainer.innerHTML = '';

    try {
        const response = await fetch('/api/constraints/impacted-demands/summary');
        const summary = await response.json();
        
        cardsContainer.innerHTML = `
            <div id="ca-card-bottlenecks" class="bg-white rounded-xl shadow-lg p-4 cursor-pointer hover:shadow-2xl transition-shadow duration-300">
                <p class="text-sm font-medium text-gray-500 uppercase">Bottlenecks</p>
                <p class="text-2xl font-bold text-gray-800">View All</p>
            </div>
            <div id="ca-card-impacted-demands" class="bg-white rounded-xl shadow-lg p-4 cursor-pointer hover:shadow-2xl transition-shadow duration-300">
                <p class="text-sm font-medium text-gray-500 uppercase">Impacted Demands</p>
                <p class="text-2xl font-bold text-orange-500">${summary.orderCount.toLocaleString()}-${(summary.totalQty || 0).toLocaleString()}</p>
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

        // Add event listeners
        document.getElementById('ca-card-impacted-demands').addEventListener('click', renderImpactedDemandsTable);
        document.getElementById('ca-card-order-search').addEventListener('click', renderOrderSearchUI);
        document.getElementById('ca-card-bottlenecks').addEventListener('click', () => {
             alert('The Bottlenecks view will be moved here in the next step.');
        });

    } catch (error) {
        console.error("Error fetching constraints summary:", error);
        cardsContainer.innerHTML = `<p class="text-red-500">Could not load constraint cards.</p>`;
    }
}

export function initConstraintAnalysis() {
    renderConstraintCards();
}