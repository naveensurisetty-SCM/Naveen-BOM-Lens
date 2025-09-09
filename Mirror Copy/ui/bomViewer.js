// ui/bomViewer.js
import { createNodeIcon } from '../shape-library.js';

let currentSkuId = null;
let isDemandSku = false;

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
        nodePropertiesContent.innerHTML = '';
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

function displaySkuProperties(properties) {
    const skuPropertiesDisplay = document.getElementById('sku-properties-display');
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

function fetchAndDisplaySkuDetails(skuId) {
    const skuPropertiesDisplay = document.getElementById('sku-properties-display');
    const getNetworkBtn = document.getElementById('get-network-btn');
    
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
            const oldGraph = document.getElementById('bom-viewer-graph');
            if (oldGraph) oldGraph.remove();
            
            const graphContainer = document.createElement('div');
            graphContainer.id = 'bom-viewer-graph';
            graphContainer.classList.add('w-full', 'mt-4'); 
            bomViewerWrapper.appendChild(graphContainer);
            
            if (isDemandSku) {
                fetchNetworkWithShortestPath(currentSkuId, 'Full Network with Shortest Path', graphContainer);
            } else {
                fetchNetworkGraph(currentSkuId, 'Full Network', graphContainer);
            }
        }
    });
    
    closePropertiesModalBtn.addEventListener('click', () => nodePropertiesModal.classList.add('hidden'));
    nodePropertiesModal.addEventListener('click', (event) => {
        if (event.target === nodePropertiesModal) nodePropertiesModal.classList.add('hidden');
    });
}