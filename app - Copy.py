# app.py
from flask import Flask, jsonify, request
from neo4j import GraphDatabase
from flask_cors import CORS
import random

# Initialize the Flask application
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes, allowing the frontend to access the API

# Neo4j connection details (Replace with your actual credentials)
NEO4J_URI = "bolt://localhost:7687"
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = "Lalli@4F4"
NEO4J_DATABASE = "neo4j"

# A function to connect to the Neo4j database
def get_db():
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    return driver

# A function to serialize Neo4j paths into a JSON-friendly format
def serialize_path(path):
    # A helper function to serialize nodes
    def serialize_node(node):
        return {
            'id': node.element_id,
            'labels': list(node.labels),
            'properties': dict(node)
        }

    # A helper function to serialize relationships
    def serialize_rel(rel):
        return {
            'id': rel.element_id,
            'type': rel.type,
            'properties': dict(rel),
            'startNode': rel.start_node.element_id,
            'endNode': rel.end_node.element_id
        }

    # A path is a list of nodes and relationships
    nodes = [serialize_node(node) for node in path.nodes]
    relationships = [serialize_rel(rel) for rel in path.relationships]
    return {
        'nodes': nodes,
        'relationships': relationships
    }

# Endpoint for the main dashboard metrics
@app.route('/api/dashboard', methods=['GET'])
def get_dashboard_data():
    """
    Returns high-level dashboard metrics.
    """
    try:
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            # Query for bottleneck counts
            res_count_result = session.run("MATCH (r:Res {bottleneck: true}) RETURN count(r) AS count").single()
            sku_count_result = session.run("MATCH (s:SKU {bottleneck: true}) RETURN count(s) AS count").single()
            bottleneck_res_count = res_count_result['count'] if res_count_result else 0
            bottleneck_sku_count = sku_count_result['count'] if sku_count_result else 0
            
            # Query for broken network counts
            broken_total_result = session.run("MATCH (s:SKU {broken_bom: true}) RETURN count(s) AS count").single()
            broken_fg_result = session.run("MATCH (s:SKU {broken_bom: true, demand_sku: true}) RETURN count(s) AS count").single()
            broken_skus_count = broken_total_result['count'] if broken_total_result else 0
            broken_fg_count = broken_fg_result['count'] if broken_fg_result else 0

        data = {
            'totalDemandAtRisk': random.randint(100000, 999999),
            'affectedOrders': random.randint(50, 500),
            'brokenSkusCount': broken_skus_count,
            'brokenFgNetworksCount': broken_fg_count,
            'bottleneckResourcesCount': bottleneck_res_count,
            'bottleneckSkusCount': bottleneck_sku_count
        }
        return jsonify(data)
    except Exception as e:
        print(f"Error fetching dashboard data: {e}")
        return jsonify({'error': 'Internal server error'}), 500

# Endpoint to get broken SKUs
@app.route('/api/broken-networks', methods=['GET'])
def get_broken_networks():
    """
    Returns a list of SKUs with a broken network.
    """
    try:
        driver = get_db()
        cypher_query = """
        MATCH (s:SKU)
        WHERE s.broken_bom = true
        RETURN s
        LIMIT 10
        """
        with driver.session(database=NEO4J_DATABASE) as session:
            result = session.run(cypher_query)
            broken_skus = [
                {'id': record['s'].element_id, 'properties': dict(record['s'])}
                for record in result
            ]
            return jsonify(broken_skus)
    except Exception as e:
        print(f"Error fetching broken networks: {e}")
        return jsonify({'error': 'Internal server error'}), 500

# Endpoint for SFG SKUs
@app.route('/api/sfg-skus', methods=['GET'])
def get_sfg_skus():
    """
    Returns a list of SKUs that are not demand SKUs (SFG).
    """
    try:
        driver = get_db()
        cypher_query = """
        MATCH (s:SKU)
        WHERE s.demand_sku = false
        RETURN s
        LIMIT 10
        """
        with driver.session(database=NEO4J_DATABASE) as session:
            result = session.run(cypher_query)
            sfg_skus = [
                {'id': record['s'].element_id, 'properties': dict(record['s'])}
                for record in result
            ]
            return jsonify(sfg_skus)
    except Exception as e:
        print(f"Error fetching SFG SKUs: {e}")
        return jsonify({'error': 'Internal server error'}), 500

# Endpoint for FG SKUs
@app.route('/api/fg-skus', methods=['GET'])
def get_fg_skus():
    """
    Returns a list of SKUs that are demand SKUs (FG).
    """
    try:
        driver = get_db()
        cypher_query = """
        MATCH (s:SKU)
        WHERE s.demand_sku = true
        RETURN s
        LIMIT 10
        """
        with driver.session(database=NEO4J_DATABASE) as session:
            result = session.run(cypher_query)
            fg_skus = [
                {'id': record['s'].element_id, 'properties': dict(record['s'])}
                for record in result
            ]
            return jsonify(fg_skus)
    except Exception as e:
        print(f"Error fetching FG SKUs: {e}")
        return jsonify({'error': 'Internal server error'}), 500

# Endpoint for Bottleneck Resources
@app.route('/api/bottleneck-resources', methods=['GET'])
def get_bottleneck_resources():
    """
    Returns a list of Resources with bottleneck = true.
    """
    try:
        driver = get_db()
        cypher_query = """
        MATCH (r:Res)
        WHERE r.bottleneck = true
        RETURN r
        LIMIT 10
        """
        with driver.session(database=NEO4J_DATABASE) as session:
            result = session.run(cypher_query)
            resources = [
                {'id': record['r'].element_id, 'properties': dict(record['r'])}
                for record in result
            ]
            return jsonify(resources)
    except Exception as e:
        print(f"Error fetching bottleneck resources: {e}")
        return jsonify({'error': 'Internal server error'}), 500

# Endpoint for Bottleneck SKUs
@app.route('/api/bottleneck-skus', methods=['GET'])
def get_bottleneck_skus():
    """
    Returns a list of SKUs with bottleneck = true.
    """
    try:
        driver = get_db()
        cypher_query = """
        MATCH (s:SKU)
        WHERE s.bottleneck = true
        RETURN s
        LIMIT 10
        """
        with driver.session(database=NEO4J_DATABASE) as session:
            result = session.run(cypher_query)
            skus = [
                {'id': record['s'].element_id, 'properties': dict(record['s'])}
                for record in result
            ]
            return jsonify(skus)
    except Exception as e:
        print(f"Error fetching bottleneck SKUs: {e}")
        return jsonify({'error': 'Internal server error'}), 500

# Endpoint to get broken demand networks (Broken FG Networks)
@app.route('/api/broken-demand-networks', methods=['GET'])
def get_broken_demand_networks():
    """
    Returns a list of SKUs with broken demand networks.
    """
    try:
        driver = get_db()
        cypher_query = """
        MATCH (s:SKU)
        WHERE s.broken_demand_network = true
        RETURN s
        LIMIT 10
        """
        with driver.session(database=NEO4J_DATABASE) as session:
            result = session.run(cypher_query)
            broken_demand_skus = [
                {'id': record['s'].element_id, 'properties': dict(record['s'])}
                for record in result
            ]
            return jsonify(broken_demand_skus)
    except Exception as e:
        print(f"Error fetching broken demand networks: {e}")
        return jsonify({'error': 'Internal server error'}), 500

# Endpoint to get the full network graph for a single SKU
@app.route('/api/network-graph', methods=['POST'])
def get_network_graph():
    """
    Fetches the full supply chain network for a given SKU.
    Expects a JSON payload with 'sku_id'.
    """
    try:
        data = request.json
        sku_id = data.get('sku_id')
        print(f"Received SKU ID for FULL graph search: '{sku_id}'")
        if not sku_id:
            return jsonify({'error': 'SKU ID is required.'}), 400
        cypher_query = """
        MATCH (s:SKU {sku_id: $sku_id})
        CALL(s) {
          WITH s
          OPTIONAL MATCH up = (u)-[:SOURCING|PRODUCES|CONSUMED_BY|PURCH_FROM*0..]->(s)
          RETURN collect(DISTINCT up) AS ups
        }
        CALL(s) {
          WITH s
          OPTIONAL MATCH down = (s)-[:SOURCING|PRODUCES|CONSUMED_BY|PURCH_FROM*0..]->(d)
          RETURN collect(DISTINCT down) AS downs
        }
        WITH s, [p IN ups WHERE p IS NOT NULL] + [p IN downs WHERE p IS NOT NULL] AS netPaths
        UNWIND netPaths AS p
        UNWIND nodes(p) AS n
        WITH s, collect(DISTINCT p) AS allPaths, collect(DISTINCT n) AS nodesInNet
        WITH allPaths, [n IN nodesInNet WHERE n:BOM] AS bomNodes
        UNWIND bomNodes AS bn
        OPTIONAL MATCH rp = (res:Res)-[:USES_RESOURCE]->(bn)
        WITH allPaths, collect(DISTINCT rp) AS resPaths
        WITH [p IN resPaths WHERE p IS NOT NULL] AS resPathsClean, allPaths
        WITH allPaths + resPathsClean AS combinedPaths
        UNWIND combinedPaths AS path
        RETURN path;
        """
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            result = session.run(cypher_query, sku_id=sku_id)
            paths = [row['path'] for row in result]
            serialized_paths = [serialize_path(path) for path in paths]
            return jsonify(serialized_paths)
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': 'Internal server error.'}), 500

# Endpoint for Shortest Path
@app.route('/api/shortest-path', methods=['POST'])
def get_shortest_path():
    """
    Finds and returns the shortest, valid upstream supply path for a given demand SKU.
    """
    try:
        data = request.json
        sku_id = data.get('sku_id')
        print(f"Received SKU ID for SHORTEST PATH search: '{sku_id}'")
        if not sku_id:
            return jsonify({'error': 'SKU ID is required.'}), 400

        cypher_query = """
        MATCH (d:SKU {sku_id: $sku_id})
        WHERE d.demand_sku = true AND coalesce(d.broken_bom,false) = false
        MATCH path = (srcNode)-[:CONSUMED_BY|PRODUCES|SOURCING|PURCH_FROM*1..50]->(d)
        WHERE (srcNode:PurchGroup OR (srcNode:SKU AND coalesce(srcNode.infinite_supply,false) = true))
          AND NONE(n IN nodes(path) WHERE coalesce(n.broken_bom,false) = true)
        WITH d, path, head(nodes(path)) AS sourceNode,
             reduce(totalLT = 0, r IN relationships(path) | totalLT + coalesce(r.lead_time,0)) AS pathLeadTime
        WITH d, collect({p:path, src:sourceNode, leadTime:pathLeadTime}) AS allPaths
        WITH d,
             [x IN allPaths WHERE x.src:PurchGroup] AS purchPaths,
             [x IN allPaths WHERE NOT x.src:PurchGroup] AS skuPaths
        WITH d,
             CASE WHEN size(purchPaths) > 0 THEN purchPaths ELSE skuPaths END AS candidatePaths
        UNWIND candidatePaths AS cp
        WITH d, cp
        ORDER BY cp.leadTime ASC
        WITH d, collect(cp)[0] AS chosenPath
        WITH chosenPath, [n IN nodes(chosenPath.p) WHERE n:BOM] AS bomNodes
        UNWIND bomNodes AS bn
        OPTIONAL MATCH rp = (res:Res)-[:USES_RESOURCE]->(bn)
        WITH chosenPath, [p IN collect(DISTINCT rp) WHERE p IS NOT NULL] AS resPaths
        WITH resPaths + [chosenPath.p] AS allPaths
        UNWIND allPaths AS path
        RETURN path;
        """
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            result = session.run(cypher_query, sku_id=sku_id)
            paths = [row['path'] for row in result]
            serialized_paths = [serialize_path(path) for path in paths]
            return jsonify(serialized_paths)

    except Exception as e:
        print(f"Error fetching shortest path: {e}")
        return jsonify({'error': 'Internal server error'}), 500

# Endpoint for Resource Network
@app.route('/api/resource-network', methods=['POST'])
def get_resource_network():
    """
    Fetches the full network connected to a given resource.
    """
    try:
        data = request.json
        res_id = data.get('res_id')
        print(f"Received RES ID for network search: '{res_id}'")
        if not res_id:
            return jsonify({'error': 'Resource ID is required.'}), 400

        cypher_query = """
        MATCH (r:Res {res_id: $res_id})
        OPTIONAL MATCH rb = (r)-[:USES_RESOURCE]->(b:BOM)
        WITH r, collect(DISTINCT rb) AS resBomPaths, collect(DISTINCT b) AS startBomNodes
        UNWIND startBomNodes AS sb
        OPTIONAL MATCH p_prod = (sb)-[:PRODUCES]->(s:SKU)
        WITH r, resBomPaths,
             collect(DISTINCT p_prod) AS bomSkuPaths,
             collect(DISTINCT s)       AS seedSkus
        UNWIND seedSkus AS seed
        CALL(seed) {
          WITH seed
          OPTIONAL MATCH up = (u)-[:SOURCING|PRODUCES|CONSUMED_BY|PURCH_FROM*0..]->(seed)
          RETURN collect(DISTINCT up) AS ups
        }
        CALL(seed) {
          WITH seed
          OPTIONAL MATCH down = (seed)-[:SOURCING|PRODUCES|CONSUMED_BY|PURCH_FROM*0..]->(d)
          RETURN collect(DISTINCT down) AS downs
        }
        WITH r, resBomPaths, bomSkuPaths,
             ([p IN ups WHERE p IS NOT NULL] + [p IN downs WHERE p IS NOT NULL]) AS sPaths
        WITH r, resBomPaths, bomSkuPaths, collect(sPaths) AS skuPathSets
        WITH r, resBomPaths, bomSkuPaths,
             reduce(acc = [], ps IN skuPathSets | acc + ps) AS skuPaths
        UNWIND skuPaths AS sp
        UNWIND nodes(sp) AS n
        WITH r, resBomPaths, bomSkuPaths, skuPaths, collect(DISTINCT n) AS nodesInNet
        WITH r, resBomPaths, bomSkuPaths, skuPaths,
             nodesInNet AS nodesNetRaw
        WITH r, resBomPaths, bomSkuPaths, skuPaths,
             nodesNetRaw AS nodesNet
        WITH r, resBomPaths, bomSkuPaths, skuPaths,
             [x IN nodesNet WHERE x:BOM] AS bomInNet
        UNWIND bomInNet AS bn
        OPTIONAL MATCH r2b = (r2:Res)-[:USES_RESOURCE]->(bn)
        WITH resBomPaths, bomSkuPaths, skuPaths, collect(DISTINCT r2b) AS extraResPaths
        WITH resBomPaths + bomSkuPaths + skuPaths + extraResPaths AS allPaths
        UNWIND allPaths AS path
        WITH path
        WHERE path IS NOT NULL
        RETURN DISTINCT path;
        """
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            result = session.run(cypher_query, res_id=res_id)
            paths = [row['path'] for row in result]
            serialized_paths = [serialize_path(path) for path in paths]
            return jsonify(serialized_paths)
    except Exception as e:
        print(f"Error fetching resource network: {e}")
        return jsonify({'error': 'Internal server error'}), 500

# Endpoint to get BOM details (placeholder)
@app.route('/api/bom/<bom_id>', methods=['GET'])
def get_bom_detail(bom_id):
    """
    Returns dummy BOM detail data.
    """
    try:
        detail_data = {
            'name': f'BOM {bom_id}',
            'demandFulfillmentImpact': random.randint(1000, 50000),
            'status': random.choice(['Critical', 'Resolved']),
            'rootCause': 'Raw material shortage',
            'resolutionSteps': 'Sourced new supplier.',
            'affectedOrders': [
                {'id': 'ORD-123', 'customer': 'Cust A', 'due': '2023-11-01', 'value': 5000},
                {'id': 'ORD-456', 'customer': 'Cust B', 'due': '2023-11-15', 'value': 2500}
            ],
            'history': [
                {'date': '2023-10-20', 'description': 'Initial detection'},
                {'date': '2023-10-25', 'description': 'Resolution started'}
            ]
        }
        return jsonify(detail_data)
    except Exception as e:
        print(f"Error fetching BOM detail: {e}")
        return jsonify({'error': 'Internal server error'}), 500

# Run the Flask application
if __name__ == '__main__':
    app.run(debug=True, port=5000)