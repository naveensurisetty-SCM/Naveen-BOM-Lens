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
            'id': node.id,
            'labels': list(node.labels),
            'properties': dict(node)
        }

    # A helper function to serialize relationships
    def serialize_rel(rel):
        return {
            'id': rel.id,
            'type': rel.type,
            'properties': dict(rel),
            'startNode': rel.start_node.id,
            'endNode': rel.end_node.id
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
        # NOTE: For a real application, these values would be fetched from the database
        # with Cypher queries. Here, we use random values for demonstration.
        data = {
            'totalDemandAtRisk': random.randint(100000, 999999),
            'affectedOrders': random.randint(50, 500),
            'brokenNetworks': random.randint(10, 100),
            'dataInconsistencies': random.randint(5, 50)
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
                {'id': record['s'].id, 'properties': dict(record['s'])}
                for record in result
            ]
            return jsonify(broken_skus)
    except Exception as e:
        print(f"Error fetching broken networks: {e}")
        return jsonify({'error': 'Internal server error'}), 500

# Endpoint to get broken demand networks
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
                {'id': record['s'].id, 'properties': dict(record['s'])}
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

        if not sku_id:
            return jsonify({'error': 'SKU ID is required.'}), 400

        # Cypher query from the user's request
        cypher_query = """
        MATCH (s:SKU {sku_id: $sku_id})
        
        /* Collect all upstream paths to s (0..∞ hops) */
        CALL {
          WITH s
          OPTIONAL MATCH up = (u)-[:SOURCING|PRODUCES|CONSUMED_BY|PURCH_FROM*0..]->(s)
          RETURN collect(DISTINCT up) AS ups
        }
        
        /* Collect all downstream paths from s (0..∞ hops) */
        CALL {
          WITH s
          OPTIONAL MATCH down = (s)-[:SOURCING|PRODUCES|CONSUMED_BY|PURCH_FROM*0..]->(d)
          RETURN collect(DISTINCT down) AS downs
        }
        
        /* Deduplicate all network paths and nodes */
        WITH s, [p IN ups WHERE p IS NOT NULL] + [p IN downs WHERE p IS NOT NULL] AS netPaths
        UNWIND netPaths AS p
        UNWIND nodes(p) AS n
        WITH s, collect(DISTINCT p) AS allPaths, collect(DISTINCT n) AS nodesInNet
        
        /* From that node set, pick the BOMs */
        WITH allPaths, [n IN nodesInNet WHERE n:BOM] AS bomNodes
        
        /* For every BOM in the network, get resource→BOM paths */
        UNWIND bomNodes AS bn
        OPTIONAL MATCH rp = (res:Res)-[:USES_RESOURCE]->(bn)
        WITH allPaths, collect(DISTINCT rp) AS resPaths
        
        /* Return one combined list of paths (avoid UNION & scoping issues) */
        WITH [p IN resPaths WHERE p IS NOT NULL] AS resPathsClean, allPaths
        WITH allPaths + resPathsClean AS combinedPaths
        UNWIND combinedPaths AS path
        RETURN path;
        """
        
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            result = session.run(cypher_query, sku_id=sku_id)
            
            # Process the results
            paths = [row['path'] for row in result]
            
            # Serialize paths into a list of dictionaries
            serialized_paths = [serialize_path(path) for path in paths]

            return jsonify(serialized_paths)

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': 'Internal server error.'}), 500

# Endpoint to get BOM details (placeholder)
@app.route('/api/bom/<bom_id>', methods=['GET'])
def get_bom_detail(bom_id):
    """
    Returns dummy BOM detail data.
    """
    try:
        # NOTE: This is placeholder data. A real implementation would query the DB.
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

