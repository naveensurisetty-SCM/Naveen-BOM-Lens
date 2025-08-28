document.addEventListener('DOMContentLoaded', () => {

    // --- New Sidebar Code ---
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
    // --- End of New Sidebar Code ---


    const resultsContainer = document.getElementById('results-container');
    
    // Main Cards
    const brokenNetworksCard = document.getElementById('broken-networks-card');
    const bottlenecksCard = document.getElementById('bottlenecks-card');

    // Sidebar Options
    const dashboardOption = document.getElementById('dashboard-option');
    const bomViewerOption = document.getElementById('bom-viewer-option');

    // Page Sections
    const dashboardSection = document.getElementById('dashboard-section');
    const bomViewerWrapper = document.getElementById('bom-viewer-wrapper');
    const brokenNetworksSection = document.getElementById('broken-networks-section');
    const bottlenecksSubcardsSection = document.getElementById('bottlenecks-subcards-section');
    const skuInputSection = document.getElementById('sku-input-section');
    const skuPropertiesDisplay = document.getElementById('sku-properties-display');
    
    // Sub-Cards
    const brokenSkuCard = document.getElementById('broken-sku-card');
    const brokenDemandNetworkCard = document.getElementById('broken-demand-network-card');
    const bottleneckResourcesCard = document.getElementById('bottleneck-resources-card');
    const bottleneckSkusCard = document.getElementById('bottleneck-skus-card');

    // SKU Input Elements
    const itemInput = document.getElementById('item-input');
    const locInput = document.getElementById('loc-input');
    const getSkuDetailsBtn = document.getElementById('get-sku-details-btn');
    const getNetworkBtn = document.getElementById('get-network-btn');

    // State variables
    let currentSkuId = null;
    let isDemandSku = false;

    // --- View Management Functions ---

    function showDashboard() {
        dashboardSection.classList.remove('hidden');
        bomViewerWrapper.classList.add('hidden');
        brokenNetworksSection.classList.add('hidden');
        bottlenecksSubcardsSection.classList.add('hidden');
        resultsContainer.classList.add('hidden');
    }

    function showBomViewer() {
        dashboardSection.classList.add('hidden');
        bomViewerWrapper.classList.remove('hidden');
        brokenNetworksSection.classList.add('hidden');
        bottlenecksSubcardsSection.classList.add('hidden');
        // Clear previous results when switching to this view
        skuPropertiesDisplay.classList.add('hidden');
        resultsContainer.classList.add('hidden');
        resultsContainer.innerHTML = '';
    }

    // --- Initial Setup ---
    showDashboard(); // Set the initial view to the dashboard
    fetchDashboardData();

    // --- Event Listeners ---

    dashboardOption.addEventListener('click', showDashboard);
    bomViewerOption.addEventListener('click', showBomViewer);

    brokenNetworksCard.addEventListener('click', () => {
        brokenNetworksSection.classList.toggle('hidden');
        bomViewerWrapper.classList.add('hidden');
        bottlenecksSubcardsSection.classList.add('hidden');
        resultsContainer.classList.add('hidden');
    });

    bottlenecksCard.addEventListener('click', () => {
        bottlenecksSubcardsSection.classList.toggle('hidden');
        bomViewerWrapper.classList.add('hidden');
        brokenNetworksSection.classList.add('hidden');
        resultsContainer.classList.add('hidden');
    });


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

    function createResourceTable(data, messageIfEmpty) {
        resultsContainer.innerHTML = '';
        resultsContainer.classList.remove('hidden');

        if (!data || data.length === 0) {
            resultsContainer.innerHTML = `<p class="text-gray-500">${messageIfEmpty}</p>`;
            return;
        }

        const allKeys = new Set();
        data.forEach(node => Object.keys(node.properties).forEach(key => allKeys.add(key)));

        const sortedKeys = ['res_id', ...Array.from(allKeys).filter(key => key !== 'res_id').sort()];

        const table = document.createElement('table');
        table.classList.add('min-w-full', 'divide-y', 'divide-gray-200');
        
        const tableHeader = document.createElement('thead');
        const headerRow = document.createElement('tr');
        sortedKeys.forEach(key => {
            const th = document.createElement('th');
            th.classList.add('px-6', 'py-3', 'text-left', 'text-xs', 'font-medium', 'text-gray-500', 'uppercase', 'tracking-wider');
            th.textContent = key.replace(/_/g, ' ');
            headerRow.appendChild(th);
        });
        tableHeader.appendChild(headerRow);
        table.appendChild(tableHeader);
        
        const tableBody = document.createElement('tbody');
        tableBody.classList.add('bg-white', 'divide-y', 'divide-gray-200');
        data.forEach(node => {
            const properties = node.properties;
            const row = document.createElement('tr');
            sortedKeys.forEach(key => {
                const cell = document.createElement('td');
                cell.classList.add('px-6', 'py-4', 'whitespace-nowrap', 'text-gray-500');

                if (key === 'res_id') {
                    const container = document.createElement('div');
                    container.classList.add('flex', 'items-center', 'space-x-2');
                    const resText = document.createElement('span');
                    resText.textContent = properties[key] || 'N/A';
                    container.appendChild(resText);
                    
                    const networkButton = document.createElement('button');
                    networkButton.textContent = 'Show Network';
                    networkButton.classList.add('resource-network-btn', 'px-2', 'py-1', 'bg-cyan-500', 'text-white', 'rounded-lg', 'text-xs', 'hover:bg-cyan-600', 'transition-colors');
                    networkButton.setAttribute('data-res-id', properties[key]);
                    container.appendChild(networkButton);
                    cell.appendChild(container);
                } else {
                    const value = properties[key];
                    cell.textContent = typeof value === 'object' ? JSON.stringify(value) : value;
                }
                row.appendChild(cell);
            });
            tableBody.appendChild(row);
        });
        table.appendChild(tableBody);
        resultsContainer.appendChild(table);

        document.querySelectorAll('.resource-network-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const resId = event.target.getAttribute('data-res-id');
                fetchResourceNetworkGraph(resId, 'Network for Resource');
            });
        });
    }

    function createSkuTable(data, messageIfEmpty) {
        resultsContainer.innerHTML = '';
        resultsContainer.classList.remove('hidden');

        if (!data || data.length === 0) {
            resultsContainer.innerHTML = `<p class="text-gray-500">${messageIfEmpty}</p>`;
            return;
        }
        
        const allKeys = new Set();
        data.forEach(node => {
            Object.keys(node.properties).forEach(key => allKeys.add(key));
        });
        
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
        table.classList.add('min-w-full', 'divide-y', 'divide-gray-200');
        const tableHeader = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        sortedKeys.forEach(key => {
            const th = document.createElement('th');
            th.classList.add('px-6', 'py-3', 'text-left', 'text-xs', 'font-medium', 'text-gray-500', 'uppercase', 'tracking-wider');
            th.textContent = key.replace(/_/g, ' ');
            headerRow.appendChild(th);
        });
        
        tableHeader.appendChild(headerRow);
        table.appendChild(tableHeader);
        const tableBody = document.createElement('tbody');
        tableBody.classList.add('bg-white', 'divide-y', 'divide-gray-200');
        
        data.forEach(node => {
            const properties = node.properties;
            const row = document.createElement('tr');
            
            sortedKeys.forEach(key => {
                const cell = document.createElement('td');
                cell.classList.add('px-6', 'py-4', 'whitespace-nowrap', 'text-gray-500');
                
                if (key === 'sku_id') {
                    const container = document.createElement('div');
                    container.classList.add('flex', 'items-center', 'space-x-2');
                    const skuText = document.createElement('span');
                    skuText.textContent = properties[key] || 'N/A';
                    container.appendChild(skuText);
                    
                    const networkButton = document.createElement('button');
                    networkButton.textContent = 'Show Network';
                    networkButton.classList.add('network-btn', 'px-2', 'py-1', 'bg-blue-500', 'text-white', 'rounded-lg', 'text-xs', 'hover:bg-blue-600', 'transition-colors');
                    networkButton.setAttribute('data-sku-id', properties[key]);
                    container.appendChild(networkButton);
                    cell.appendChild(container);
                } else {
                    const value = properties[key];
                    cell.textContent = typeof value === 'object' ? JSON.stringify(value) : value;
                }
                row.appendChild(cell);
            });
            
            tableBody.appendChild(row);
        });
        
        table.appendChild(tableBody);
        resultsContainer.appendChild(table);

        document.querySelectorAll('.network-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const skuId = event.target.getAttribute('data-sku-id');
                fetchNetworkGraph(skuId, 'Full Network');
            });
        });
    }

    getSkuDetailsBtn.addEventListener('click', () => {
        const item = itemInput.value.trim();
        const loc = locInput.value.trim();

        if (item && loc) {
            const skuId = `${item}@${loc}`;
            fetchAndDisplaySkuDetails(skuId);
        } else {
            alert('Please enter both an Item and a Location.');
        }
    });

    getNetworkBtn.addEventListener('click', () => {
        if (currentSkuId) {
            if (isDemandSku) {
                fetchNetworkWithShortestPath(currentSkuId, 'Full Network with Shortest Path');
            } else {
                fetchNetworkGraph(currentSkuId, 'Full Network');
            }
        }
    });

    brokenSkuCard.addEventListener('click', () => {
        fetch('http://127.0.0.1:5000/api/broken-networks').then(response => response.json())
            .then(data => createSkuTable(data, 'No broken SKUs found.'))
            .catch(error => console.error('Error fetching broken SKUs:', error));
    });

    bottleneckResourcesCard.addEventListener('click', () => {
        fetch('http://127.0.0.1:5000/api/bottleneck-resources').then(response => response.json())
            .then(data => createResourceTable(data, 'No bottlenecked resources found.'))
            .catch(error => console.error('Error fetching bottleneck resources:', error));
    });

    bottleneckSkusCard.addEventListener('click', () => {
        fetch('http://127.0.0.1:5000/api/bottleneck-skus').then(response => response.json())
            .then(data => createSkuTable(data, 'No bottlenecked SKUs found.'))
            .catch(error => console.error('Error fetching bottleneck SKUs:', error));
    });
    
    brokenDemandNetworkCard.addEventListener('click', () => {
        fetch('http://127.0.0.1:5000/api/broken-demand-networks').then(response => response.json())
            .then(data => createSkuTable(data, 'No broken FG networks found.'))
            .catch(error => console.error('Error fetching broken demand networks:', error));
    });
    
    function fetchAndDisplaySkuDetails(skuId) {
        fetch('http://127.0.0.1:5000/api/sku-details', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sku_id: skuId })
        })
        .then(response => response.json())
        .then(details => {
            skuPropertiesDisplay.innerHTML = '';
            resultsContainer.innerHTML = '';
            resultsContainer.classList.add('hidden');
            currentSkuId = null;
            isDemandSku = false;

            const greyButtonClasses = ['bg-gray-300', 'text-gray-800', 'hover:bg-gray-400'];
            const greenButtonClasses = ['bg-green-600', 'text-white', 'hover:bg-green-700'];

            getNetworkBtn.disabled = true;
            getNetworkBtn.classList.remove(...greenButtonClasses);
            getNetworkBtn.classList.add(...greyButtonClasses.slice(0, 2));

            if (details.found) {
                currentSkuId = skuId;
                isDemandSku = details.properties.demand_sku === true;
                displaySkuProperties(details.properties);
                
                getNetworkBtn.disabled = false;
                getNetworkBtn.classList.remove(...greyButtonClasses.slice(0, 2));
                getNetworkBtn.classList.add(...greenButtonClasses);
            } else {
                skuPropertiesDisplay.classList.add('hidden');
                resultsContainer.innerHTML = `<p class="text-red-500">SKU ID '${skuId}' not found.</p>`;
                resultsContainer.classList.remove('hidden');
            }
        })
        .catch(error => console.error('Error fetching SKU details:', error));
    }

    function displaySkuProperties(properties) {
        skuPropertiesDisplay.innerHTML = '';
        const table = document.createElement('table');
        table.classList.add('min-w-full', 'divide-y', 'divide-gray-200', 'text-sm');
        const tableHeader = document.createElement('thead');
        tableHeader.classList.add('bg-gray-50');
        const headerRow = document.createElement('tr');
        const keys = Object.keys(properties);
        keys.forEach(key => {
            const th = document.createElement('th');
            th.classList.add('px-4', 'py-2', 'text-left', 'text-xs', 'font-medium', 'text-gray-500', 'uppercase', 'tracking-wider');
            th.textContent = key.replace(/_/g, ' ');
            headerRow.appendChild(th);
        });
        tableHeader.appendChild(headerRow);
        table.appendChild(tableHeader);
        const tableBody = document.createElement('tbody');
        tableBody.classList.add('bg-white', 'divide-y', 'divide-gray-200');
        const bodyRow = document.createElement('tr');
        keys.forEach(key => {
            const value = properties[key];
            const cell = document.createElement('td');
            cell.classList.add('px-4', 'py-2', 'whitespace-nowrap', 'text-gray-800');
            cell.textContent = value;
            bodyRow.appendChild(cell);
        });
        tableBody.appendChild(bodyRow);
        table.appendChild(tableBody);
        skuPropertiesDisplay.appendChild(table);
        skuPropertiesDisplay.classList.remove('hidden');
    }

    function renderNetworkGraph(id, networkData, graphType, shortestPathData = null) {
        resultsContainer.innerHTML = '';
        resultsContainer.classList.remove('hidden');
        
        const heading = document.createElement('h2');
        heading.classList.add('text-xl', 'font-bold', 'text-gray-800', 'mb-4');
        heading.textContent = `${graphType}: ${id}`;
        resultsContainer.appendChild(heading);

        if (!networkData || networkData.length === 0) {
            const message = document.createElement('p');
            message.classList.add('text-gray-500');
            message.textContent = 'No network data found.';
            resultsContainer.appendChild(message);
            return;
        }

        const container = document.createElement('div');
        container.id = 'network-container';
        container.classList.add('h-96', 'w-full');
        resultsContainer.appendChild(container);
        
        const nodes = new vis.DataSet();
        const edges = new vis.DataSet();
        const uniqueNodeIds = new Set();
        
        const shortestPathEdgeIds = new Set();
        if (shortestPathData) {
            shortestPathData.forEach(path => {
                path.relationships.forEach(rel => shortestPathEdgeIds.add(rel.id));
            });
        }

        networkData.forEach(path => {
            path.nodes.forEach(node => {
                if (!uniqueNodeIds.has(node.id)) {
                    uniqueNodeIds.add(node.id);
                    const props = node.properties;
                    let visualLabel, modalName;
                    if (node.labels.includes('BOM')) {
                        visualLabel = props.bom_num;
                        modalName = props.production_method;
                    } else {
                        visualLabel = props.sku_id || props.item || props.res_id;
                        modalName = visualLabel;
                    }
                    let nodeOptions = {
                        id: node.id,
                        label: visualLabel,
                        nodeName: modalName,
                        title: JSON.stringify(props, null, 2),
                    };
                    if (node.labels.includes('SKU')) {
                        nodeOptions.shape = 'image';
                        nodeOptions.size = 25;
                        if (props.broken_bom === true) nodeOptions.image = props.demand_sku === true ? 'images/sku_broken_bom_true_demand_sku_true.png' : 'images/sku_broken_bom_true.png';
                        else if (props.bottleneck === true) nodeOptions.image = props.demand_sku === true ? 'images/sku_bottleneck_true_demand_sku_true.png' : 'images/sku_bottleneck_true.png';
                        else nodeOptions.image = props.demand_sku === true ? 'images/sku_demand_sku_true.png' : 'images/sku_demand_sku_false.png';
                    } else if (node.labels.includes('Res')) {
                        nodeOptions.shape = 'image';
                        nodeOptions.size = 25;
                        nodeOptions.image = props.bottleneck === true ? 'images/res_bottleneck_true.png' : 'images/res_bottleneck_false.png';
                    } else if (node.labels.includes('BOM')) {
                        nodeOptions.shape = 'image';
                        nodeOptions.image = 'images/production_method_node.png';
                        nodeOptions.size = 20;
                        nodeOptions.font = { vadjust: 20 };
                    } else {
                        nodeOptions.shape = 'box';
                        nodeOptions.color = { background: '#d1d5db', border: '#9ca3af' };
                        nodeOptions.size = 20;
                    }
                    nodes.add(nodeOptions);
                }
            });

            path.relationships.forEach(rel => {
                let edgeOptions = {
                    from: rel.startNode,
                    to: rel.endNode,
                    title: JSON.stringify(rel.properties, null, 2),
                    arrows: 'to',
                    color: { color: '#6b7280' },
                };

                if (shortestPathEdgeIds.has(rel.id)) {
                    edgeOptions.color = 'gold';
                    edgeOptions.width = 3;
                }

                if (rel.type === 'SOURCING') {
                    edgeOptions.label = '';
                    edgeOptions.arrows = { to: { enabled: true, scaleFactor: 1 }, middle: { enabled: true, type: 'image', imageWidth: 20, imageHeight: 20, src: 'images/sourcing_relation.png' } };
                } else if (rel.type === 'CONSUMED_BY' || rel.type === 'PRODUCES') {
                    edgeOptions.label = '';
                } else {
                    edgeOptions.label = rel.type;
                    edgeOptions.font = { size: 10, color: '#6b7280', align: 'middle', strokeWidth: 5, strokeColor: '#ffffff' };
                }
                edges.add(edgeOptions);
            });
        });

        const visData = { nodes: nodes, edges: edges };
        const options = {
            nodes: { font: { size: 12, color: '#4b5563' }, borderWidth: 2 },
            edges: { color: { highlight: '#3b82f6' }, smooth: { enabled: true, type: 'straightCross' } },
            physics: { enabled: false },
            layout: { hierarchical: { direction: 'LR', sortMethod: 'directed', levelSeparation: 250, nodeSpacing: 150 } },
            interaction: { navigationButtons: true, keyboard: true }
        };
        
        const networkContainer = document.getElementById('network-container');
        if (networkContainer) {
            const network = new vis.Network(networkContainer, visData, options);
            network.on("stabilizationIterationsDone", function () {
                const canvasHeight = network.getBoundingBox().height + 50;
                networkContainer.style.height = `${canvasHeight}px`;
                network.fit();
            });

            network.on('click', function(params) {
                if (params.nodes.length > 0) {
                    const nodeId = params.nodes[0];
                    const clickedNode = nodes.get(nodeId);
                    const properties = JSON.parse(clickedNode.title);
                    const propertiesContent = document.getElementById('node-properties-content');
                    propertiesContent.innerHTML = '';
                    const table = document.createElement('table');
                    table.classList.add('min-w-full', 'divide-y', 'divide-gray-200');
                    const tableBody = document.createElement('tbody');
                    for (const [key, value] of Object.entries(properties)) {
                        const row = document.createElement('tr');
                        const keyCell = document.createElement('td');
                        keyCell.classList.add('px-4', 'py-3', 'text-sm', 'font-semibold', 'text-gray-600', 'w-1/3');
                        keyCell.textContent = key.replace(/_/g, ' ');
                        const valueCell = document.createElement('td');
                        valueCell.classList.add('px-4', 'py-3', 'text-sm', 'text-gray-800');
                        valueCell.textContent = value;
                        row.appendChild(keyCell);
                        row.appendChild(valueCell);
                        tableBody.appendChild(row);
                    }
                    table.appendChild(tableBody);
                    propertiesContent.appendChild(table);
                    document.getElementById('node-properties-title').textContent = `Properties for ${clickedNode.nodeName}`;
                    document.getElementById('node-properties-modal').classList.remove('hidden');
                }
            });
        }
    }

    function fetchNetworkGraph(skuId, graphType) {
        fetch('http://127.0.0.1:5000/api/network-graph', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sku_id: skuId }) })
        .then(response => response.json()).then(data => renderNetworkGraph(skuId, data, graphType, null)).catch(error => console.error('Error fetching network graph:', error));
    }

    function fetchNetworkWithShortestPath(skuId, graphType) {
        fetch('http://127.0.0.1:5000/api/network-with-shortest-path', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sku_id: skuId }) })
        .then(response => response.json()).then(data => renderNetworkGraph(skuId, data.full_network, graphType, data.shortest_path)).catch(error => console.error('Error fetching combined network:', error));
    }

    function fetchResourceNetworkGraph(resId, graphType) {
        fetch('http://127.0.0.1:5000/api/resource-network', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ res_id: resId }) })
        .then(response => response.json()).then(data => renderNetworkGraph(resId, data, graphType)).catch(error => console.error('Error fetching resource network:', error));
    }
    
    // ... (rest of the file is unchanged)
});