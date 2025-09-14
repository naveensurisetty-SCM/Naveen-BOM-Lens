import { createNodeIcon } from '../shape-library.js';

let currentSkuId = null;
let isDemandSku = false;

// This helper function creates the popup for managing columns
function createColumnManagerPopup(table, settingsButton) {
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
                draggedItem.classList.remove('dragging');
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

// Reverted modal to simple HTML table for clarity and performance in the small popup
function handleGraphClick(params, nodes, edges) {
    const nodePropertiesModal = document.getElementById('node-properties-modal');
    const nodePropertiesTitle = document.getElementById('node-properties-title');
    const nodePropertiesContent = document.getElementById('node-properties-content');
    
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
        nodePropertiesContent.innerHTML = ''; // Clear previous
        const table = document.createElement('table');
        const tableBody = document.createElement('tbody');
        tableBody.innerHTML = Object.entries(properties).map(([key, value]) => `<tr><td class="font-semibold text-gray-600 pr-4 align-top">${key.replace(/_/g, ' ')}</td><td class="text-gray-800 break-all">${value}</td></tr>`).join('');
        table.appendChild(tableBody);
        nodePropertiesContent.appendChild(table);
        nodePropertiesModal.classList.remove('hidden');
    }
}

export function renderNetworkGraph(id, networkData, graphType, targetContainer, shortestPathData = null) {
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
                    font: {
                        size: 12,
                        color: '#4b5563',
                        vadjust: icon.vadjust
                    }
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

function fetchNetworkGraph(skuId, graphType, container) { 
    fetch('http://127.0.0.1:5000/api/network-graph', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sku_id: skuId }) })
    .then(r => r.json())
    .then(d => renderNetworkGraph(skuId, d, graphType, container, null)); 
}
function fetchNetworkWithShortestPath(skuId, graphType, container) { 
    fetch('http://127.0.0.1:5000/api/network-with-shortest-path', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sku_id: skuId }) })
    .then(r => r.json())
    .then(d => renderNetworkGraph(skuId, d.full_network, graphType, container, d.shortest_path)); 
}
export function fetchResourceNetworkGraph(resId, graphType, container) { 
    fetch('http://127.0.0.1:5000/api/resource-network', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ res_id: resId }) })
    .then(r => r.json())
    .then(d => renderNetworkGraph(resId, d, graphType, container)); 
}

// ## MODIFICATION START ##
// Rewritten to use the user's preferred default column sequence.
function displaySkuProperties(properties) {
    const skuPropertiesDisplay = document.getElementById('sku-properties-display');
    skuPropertiesDisplay.innerHTML = ''; // Clear previous content

    const header = document.createElement('div');
    header.className = 'flex justify-between items-center mb-4';
    const titleEl = document.createElement('h3');
    titleEl.className = 'text-lg font-semibold';
    titleEl.textContent = "SKU Properties";
    const settingsButton = document.createElement('button');
    settingsButton.className = 'flex items-center p-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors';
    settingsButton.title = 'Configure Columns';
    settingsButton.innerHTML = `<i class="fas fa-cog"></i>`;
    header.appendChild(titleEl);
    header.appendChild(settingsButton);
    skuPropertiesDisplay.appendChild(header);

    const tableContainer = document.createElement('div');
    tableContainer.className = 'tabulator-creative';
    skuPropertiesDisplay.appendChild(tableContainer);

    // Define the preferred column order
    const preferredOrder = ['item', 'loc', 'demand_sku', 'bottleneck', 'broken_bom', 'cust_demand_qty', 'fcst_demand_qty', 'total_demand_qty', 'infinite_supply', 'shortest_lead_time', 'overloaded_res_count'];
    
    const allKeys = Object.keys(properties);
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
        headerSort: false, 
    }));

    const table = new Tabulator(tableContainer, {
        data: [properties],
        columns: columns,
        layout: "fitDataStretch",
        classes: "tabulator-creative",
    });

    settingsButton.onclick = (e) => {
        e.stopPropagation();
        createColumnManagerPopup(table, settingsButton);
    };

    skuPropertiesDisplay.classList.remove('hidden');
}

// New helper function to create a header with a back button for the network view
function createBomViewerHeader(title, backFunction) {
    const header = document.createElement('div');
    header.className = 'flex justify-between items-center mb-4';
    
    const titleEl = document.createElement('h2');
    titleEl.className = 'text-xl font-bold text-gray-800';
    titleEl.textContent = title;
    
    const backButton = document.createElement('button');
    backButton.className = 'flex items-center p-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors';
    backButton.title = 'Back to SKU Properties';
    backButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>`;
    backButton.addEventListener('click', backFunction);
    
    header.appendChild(titleEl);
    header.appendChild(backButton);
    return header;
}
// ## MODIFICATION END ##

function fetchAndDisplaySkuDetails(skuId) {
    const skuPropertiesDisplay = document.getElementById('sku-properties-display');
    const getNetworkBtn = document.getElementById('get-network-btn');
    
    // Clear any existing graph when fetching new details
    const oldGraphContainer = document.getElementById('bom-viewer-graph-container');
    if (oldGraphContainer) oldGraphContainer.remove();
    
    fetch('http://127.0.0.1:5000/api/sku-details', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sku_id: skuId }) })
    .then(response => response.json())
    .then(details => {
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

export function initBomViewer() {
    const getSkuDetailsBtn = document.getElementById('get-sku-details-btn');
    const itemInput = document.getElementById('item-input');
    const locInput = document.getElementById('loc-input');
    const getNetworkBtn = document.getElementById('get-network-btn');
    const bomViewerWrapper = document.getElementById('bom-viewer-wrapper');
    const nodePropertiesModal = document.getElementById('node-properties-modal');
    const closePropertiesModalBtn = nodePropertiesModal.querySelector('.close-properties-modal');

    getSkuDetailsBtn.addEventListener('click', () => {
        const skuId = `${itemInput.value.trim()}@${locInput.value.trim()}`;
        if (itemInput.value.trim() && locInput.value.trim()) {
            fetchAndDisplaySkuDetails(skuId);
        } else {
            alert('Please enter both an Item and a Location.');
        }
    });

    getNetworkBtn.addEventListener('click', () => {
        if (currentSkuId) {
            document.getElementById('sku-properties-display').classList.add('hidden');
            const oldGraphContainer = document.getElementById('bom-viewer-graph-container');
            if (oldGraphContainer) oldGraphContainer.remove();
            
            const graphContainer = document.createElement('div');
            graphContainer.id = 'bom-viewer-graph-container';
            graphContainer.classList.add('w-full', 'mt-4');
            
            const networkTitle = `Network for ${currentSkuId}`;
            const backFunction = () => fetchAndDisplaySkuDetails(currentSkuId);
            
            graphContainer.appendChild(createBomViewerHeader(networkTitle, backFunction));
            bomViewerWrapper.appendChild(graphContainer);
            
            if (isDemandSku) {
                fetchNetworkWithShortestPath(currentSkuId, networkTitle, graphContainer);
            } else {
                fetchNetworkGraph(currentSkuId, networkTitle, graphContainer);
            }
        }
    });
    
    closePropertiesModalBtn.addEventListener('click', () => nodePropertiesModal.classList.add('hidden'));
    nodePropertiesModal.addEventListener('click', (event) => {
        if (event.target === nodePropertiesModal) nodePropertiesModal.classList.add('hidden');
    });
}