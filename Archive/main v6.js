document.addEventListener('DOMContentLoaded', () => {

    const dashboardSection = document.getElementById('dashboard-section');
    const brokenNetworksSection = document.getElementById('broken-networks-section');
    const brokenNetworksCard = document.getElementById('broken-networks-card');
    const brokenSkuCard = document.getElementById('broken-sku-card');
    const brokenDemandNetworkCard = document = document.getElementById('broken-demand-network-card');
    const resultsContainer = document.getElementById('results-container');

    // Initial data fetch for the main dashboard
    fetchDashboardData();

    function fetchDashboardData() {
        fetch('http://127.0.0.1:5000/api/dashboard')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                // Update the dashboard cards with the fetched data
                document.getElementById('total-demand-at-risk').textContent = `$${data.totalDemandAtRisk.toLocaleString()}`;
                document.getElementById('affected-orders').textContent = data.affectedOrders.toLocaleString();
                document.getElementById('broken-networks').textContent = data.brokenNetworks.toLocaleString();
                document.getElementById('data-inconsistencies').textContent = data.dataInconsistencies.toLocaleString();
            })
            .catch(error => console.error('Error fetching dashboard data:', error));
    }

    // Function to show BOM detail
    window.showBomDetail = (bomId) => {
        fetch(`http://127.0.0.1:5000/api/bom/${bomId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(bomData => {
                // Update the detail view with the fetched data
                document.getElementById('bom-detail-title').textContent = bomData.name;
                document.getElementById('bom-detail-impact').textContent = `$${bomData.demandFulfillmentImpact.toLocaleString()}`;
                document.getElementById('bom-detail-status').textContent = bomData.status;
                document.getElementById('bom-detail-root-cause').textContent = bomData.rootCause;
                document.getElementById('bom-detail-resolution').textContent = bomData.resolutionSteps;
                
                // Populate affected orders list
                const ordersList = document.getElementById('affected-orders-list');
                ordersList.innerHTML = '';
                bomData.affectedOrders.forEach(order => {
                    const listItem = document.createElement('li');
                    listItem.textContent = `Order ID: ${order.id}, Customer: ${order.customer}, Due: ${order.due}, Value: $${order.value.toLocaleString()}`;
                    ordersList.appendChild(listItem);
                });

                // Populate history list
                const historyList = document.getElementById('bom-history-list');
                historyList.innerHTML = '';
                bomData.history.forEach(history => {
                    const listItem = document.createElement('li');
                    listItem.textContent = `Date: ${history.date}, Description: ${history.description}`;
                    historyList.appendChild(listItem);
                });

                // Show the modal
                document.getElementById('bom-detail-modal').classList.remove('hidden');
            })
            .catch(error => console.error('Error fetching BOM detail:', error));
    };
    
    // Event listener for the "Broken Networks" main card
    brokenNetworksCard.addEventListener('click', () => {
        // Now we only toggle the visibility of the broken networks section, keeping the dashboard visible
        brokenNetworksSection.classList.toggle('hidden');
        resultsContainer.innerHTML = ''; // Clear results when hiding
        resultsContainer.classList.add('hidden');
    });

    // Functionality for Broken SKU sub-card
    brokenSkuCard.addEventListener('click', () => {
        fetch('http://127.0.0.1:5000/api/broken-networks')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                resultsContainer.classList.remove('hidden');
                resultsContainer.innerHTML = ''; // Clear previous results

                if (data.length === 0) {
                    resultsContainer.innerHTML = '<p class="text-gray-500">No broken SKUs found.</p>';
                    return;
                }
                
                // Get all unique property keys to create dynamic columns
                const allKeys = new Set();
                data.forEach(node => {
                    Object.keys(node.properties).forEach(key => allKeys.add(key));
                });

                const sortedKeys = Array.from(allKeys).sort((a, b) => {
                    const order = ['sku_id', 'item', 'loc'];
                    const aIndex = order.indexOf(a);
                    const bIndex = order.indexOf(b);
                    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
                    if (aIndex !== -1) return -1;
                    if (bIndex !== -1) return 1;
                    return a.localeCompare(b);
                });

                // Create a table to display the results
                const table = document.createElement('table');
                table.classList.add('min-w-full', 'divide-y', 'divide-gray-200');
                
                // Create table header
                const tableHeader = document.createElement('thead');
                const headerRow = document.createElement('tr');
                sortedKeys.forEach(key => {
                    const th = document.createElement('th');
                    th.classList.add('px-6', 'py-3', 'text-left', 'text-xs', 'font-medium', 'text-gray-500', 'uppercase', 'tracking-wider');
                    th.textContent = key.replace(/_/g, ' '); // Format header text
                    headerRow.appendChild(th);
                });
                tableHeader.appendChild(headerRow);
                table.appendChild(tableHeader);
                
                // Create table body
                const tableBody = document.createElement('tbody');
                tableBody.classList.add('bg-white', 'divide-y', 'divide-gray-200');
                
                data.forEach(node => {
                    const properties = node.properties;
                    const row = document.createElement('tr');
                    sortedKeys.forEach(key => {
                        const cell = document.createElement('td');
                        cell.classList.add('px-6', 'py-4', 'whitespace-nowrap', 'text-gray-500');
                        
                        // Add a button to the sku_id cell
                        if (key === 'sku_id') {
                            const container = document.createElement('div');
                            container.classList.add('flex', 'items-center', 'space-x-2');

                            const skuText = document.createElement('span');
                            skuText.textContent = properties[key] !== undefined ? properties[key] : 'N/A';
                            container.appendChild(skuText);
                            
                            const networkButton = document.createElement('button');
                            networkButton.textContent = 'Show Network';
                            networkButton.classList.add('network-btn', 'px-2', 'py-1', 'bg-blue-500', 'text-white', 'rounded-lg', 'text-xs', 'hover:bg-blue-600', 'transition-colors');
                            networkButton.setAttribute('data-sku-id', properties[key]);
                            container.appendChild(networkButton);

                            cell.appendChild(container);

                        } else {
                            const value = properties[key] !== undefined ? properties[key] : 'N/A';
                            cell.textContent = typeof value === 'object' ? JSON.stringify(value) : value;
                        }

                        row.appendChild(cell);
                    });
                    tableBody.appendChild(row);
                });
                
                table.appendChild(tableBody);
                resultsContainer.appendChild(table);

                // Add event listener to the newly created buttons
                document.querySelectorAll('.network-btn').forEach(button => {
                    button.addEventListener('click', (event) => {
                        const skuId = event.target.getAttribute('data-sku-id');
                        fetchNetworkGraph(skuId);
                    });
                });

            })
            .catch(error => console.error('Error fetching broken SKUs:', error));
    });

    // New function to fetch and display the network graph
    function fetchNetworkGraph(skuId) {
        // Clear previous results and show a loading message
        resultsContainer.innerHTML = '<p class="text-gray-500">Loading network for ' + skuId + '...</p>';
        resultsContainer.classList.remove('hidden');

        fetch('http://127.0.0.1:5000/api/network-graph', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sku_id: skuId }),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Clear the loading message and prepare for the visualization
            resultsContainer.innerHTML = '<div id="network-container" class="h-96 w-full"></div>';

            // Vis.js requires a specific data format for nodes and edges
            const nodes = new vis.DataSet();
            const edges = new vis.DataSet();

            // Create a set to keep track of unique node IDs to prevent duplicates
            const uniqueNodeIds = new Set();

            data.forEach(path => {
                // Add all nodes from the path to the nodes dataset
                path.nodes.forEach(node => {
                    if (!uniqueNodeIds.has(node.id)) {
                        uniqueNodeIds.add(node.id);
                        // Determine node color based on label (e.g., 'SKU', 'BOM', 'Res')
                        let color = '#9ca3af'; // Default color
                        if (node.labels.includes('SKU')) {
                            color = '#2563eb'; // Blue for SKUs
                        } else if (node.labels.includes('BOM')) {
                            color = '#f59e0b'; // Orange for BOMs
                        } else if (node.labels.includes('Res')) {
                            color = '#10b981'; // Green for Resources
                        }

                        nodes.add({
                            id: node.id,
                            label: node.properties.sku_id || node.properties.item || node.properties.bom_id || node.properties.res_id,
                            title: JSON.stringify(node.properties, null, 2), // Tooltip with all properties
                            color: color,
                            // Change font color to a medium dark grey
                            font: { color: '#6b7280' }
                        });
                    }
                });

                // Add all relationships from the path to the edges dataset
                path.relationships.forEach(rel => {
                    edges.add({
                        from: rel.startNode,
                        to: rel.endNode,
                        label: rel.type,
                        title: JSON.stringify(rel.properties, null, 2),
                        arrows: 'to',
                        color: { color: '#6b7280' },
                        font: { align: 'middle' }
                    });
                });
            });

            // Create the data object for the network
            const networkData = {
                nodes: nodes,
                edges: edges,
            };

            // Set the options for the network visualization
            const options = {
                nodes: {
                    shape: 'dot',
                    size: 20,
                    font: {
                        size: 12,
                        color: '#333'
                    },
                    borderWidth: 2
                },
                edges: {
                    arrows: {
                        to: {
                            enabled: true,
                            scaleFactor: 1
                        }
                    },
                    color: {
                        color: '#9ca3af',
                        highlight: '#3b82f6'
                    },
                    font: {
                        size: 10,
                        color: '#6b7280',
                        strokeWidth: 0
                    },
                    smooth: {
                        enabled: true,
                        type: 'dynamic'
                    }
                },
                // Disable physics and enable hierarchical layout for a left-to-right flow
                physics: {
                    enabled: false
                },
                layout: {
                    hierarchical: {
                        direction: 'LR', // Left to Right
                        sortMethod: 'directed'
                    }
                },
                interaction: {
                    navigationButtons: true,
                    keyboard: true
                }
            };
            
            // Get the container element and initialize the network
            const container = document.getElementById('network-container');
            if (container) {
                const network = new vis.Network(container, networkData, options);
            } else {
                resultsContainer.innerHTML = '<p class="text-red-500">Failed to create network container. Please refresh.</p>';
            }

        })
        .catch(error => {
            console.error('Error fetching network graph:', error);
            resultsContainer.innerHTML = '<p class="text-red-500">Failed to load network data. Please try again.</p>';
        });
    }

    // Functionality for Broken Demand Network sub-card
    brokenDemandNetworkCard.addEventListener('click', () => {
        fetch('http://127.0.0.1:5000/api/broken-demand-networks')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                resultsContainer.classList.remove('hidden');
                resultsContainer.innerHTML = ''; // Clear previous results

                if (data.length === 0) {
                    resultsContainer.innerHTML = '<p class="text-gray-500">No broken demand networks found.</p>';
                    return;
                }
                
                // Create a table to display the results
                const table = document.createElement('table');
                table.classList.add('min-w-full', 'divide-y', 'divide-gray-200');
                
                // Create table header
                const tableHeader = document.createElement('thead');
                tableHeader.innerHTML = `
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU ID</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Demand Qty</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cust Order Qty</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fcst Order Qty</th>
                    </tr>
                `;
                table.appendChild(tableHeader);
                
                // Create table body
                const tableBody = document.createElement('tbody');
                tableBody.classList.add('bg-white', 'divide-y', 'divide-gray-200');
                
                data.forEach(node => {
                    const props = node.properties;
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td class="px-6 py-4 whitespace-nowrap">${props.sku_id || 'N/A'}</td>
                        <td class="px-6 py-4 whitespace-nowrap">${props.total_demand_qty || 0}</td>
                        <td class="px-6 py-4 whitespace-nowrap">${props.custorder_qty || 0}</td>
                        <td class="px-6 py-4 whitespace-nowrap">${props.fcstorder_qty || 0}</td>
                    `;
                    tableBody.appendChild(row);
                });
                
                table.appendChild(tableBody);
                resultsContainer.appendChild(table);
            })
            .catch(error => console.error('Error fetching broken demand networks:', error));
    });

    // Close the BOM detail modal
    document.querySelector('#bom-detail-modal .close-modal').addEventListener('click', () => {
        document.getElementById('bom-detail-modal').classList.add('hidden');
    });
});
