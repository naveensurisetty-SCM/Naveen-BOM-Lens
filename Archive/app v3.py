import os
from flask import Flask, jsonify
from flask_cors import CORS
from neo4j import GraphDatabase

# A simple Flask application to serve as the backend API
# NOTE: The variable name here should be __name__, not __app__.
app = Flask(__name__)
# Enable CORS to allow your HTML file to fetch data from this server
CORS(app)

# Database connection details from your Neo4j Desktop
# Update these with your specific username, password, and URI
URI = "bolt://localhost:7687"
AUTH = ("neo4j", "Lalli@4F4")

# Initialize Neo4j driver
try:
    driver = GraphDatabase.driver(URI, auth=AUTH)
    driver.verify_connectivity()
    print("Neo4j database connection successful.")
except Exception as e:
    print(f"Failed to connect to Neo4j: {e}")
    driver = None

# A simple function to execute a read query on the Neo4j database
def execute_read_query(query, parameters=None):
    if not driver:
        return []
    records, summary, keys = driver.execute_query(query, parameters, database_='neo4j')
    return [dict(record) for record in records]

@app.route('/api/dashboard', methods=['GET'])
def get_dashboard_data():
    """
    API endpoint to fetch all dashboard data.
    This will query your Neo4j database for high-level metrics.
    """
    # 1. Query for total demand at risk and affected orders
    # NOTE: You'll need to define your graph model (nodes and relationships)
    # The following is a placeholder query based on a potential model.
    # It assumes nodes like :BOM, :Order, and relationships like :AFFECTS.
    # Adapt this query to your specific data model in Neo4j.
    query_impact = """
    MATCH (b:BOM)-[:AFFECTS]->(o:Order)
    WHERE b.status = 'Broken'
    RETURN sum(o.value) AS totalDemandAtRisk, count(o) AS affectedOrders
    """
    impact_data = execute_read_query(query_impact)
    total_demand_at_risk = impact_data[0].get('totalDemandAtRisk', 0) if impact_data else 0
    affected_orders = impact_data[0].get('affectedOrders', 0) if impact_data else 0

    # 2. Query for broken networks and data inconsistencies
    # Placeholder queries
    query_broken_networks = """
    MATCH (b:BOM) WHERE b.isNetworkBroken = true
    RETURN count(b) AS brokenNetworks
    """
    broken_networks_count = execute_read_query(query_broken_networks)
    broken_networks = broken_networks_count[0].get('brokenNetworks', 0) if broken_networks_count else 0
    
    query_data_issues = """
    MATCH (b:BOM) WHERE b.hasDataIssue = true
    RETURN count(b) as dataInconsistencies
    """
    data_inconsistencies_count = execute_read_query(query_data_issues)
    data_inconsistencies = data_inconsistencies_count[0].get('dataInconsistencies', 0) if data_inconsistencies_count else 0

    # 3. Query for critical BOMs list
    query_critical_boms = """
    MATCH (b:BOM)-[:AFFECTS]->(o:Order)
    WHERE b.status = 'Broken'
    WITH b, count(o) AS affectedOrders, sum(o.value) AS impact
    ORDER BY impact DESC
    LIMIT 5
    RETURN b.name AS name, impact, affectedOrders, b.rootCause AS rootCause, b.status AS status
    """
    critical_boms = execute_read_query(query_critical_boms)

    dashboard_data = {
        "totalDemandAtRisk": total_demand_at_risk,
        "affectedOrders": affected_orders,
        "brokenNetworks": broken_networks,
        "dataInconsistencies": data_inconsistencies,
        "criticalBoms": critical_boms,
    }

    return jsonify(dashboard_data)

@app.route('/api/bom/<string:bom_id>', methods=['GET'])
def get_bom_detail(bom_id):
    """
    API endpoint to fetch details for a specific BOM.
    """
    # Query for all details of a single BOM, including its network, impact, and history.
    query_bom_detail = f"""
    MATCH (b:BOM {{id: '{bom_id}'}})
    OPTIONAL MATCH (b)-[:AFFECTS]->(o:Order)
    OPTIONAL MATCH (b)-[:HAS_ROOT_CAUSE]->(rc:RootCause)
    OPTIONAL MATCH (b)-[:HAS_HISTORY]->(h:History)
    WITH b, collect(o) as affectedOrders, collect(rc) as rootCauses, collect(h) as history
    RETURN 
        b.name AS name,
        b.status AS status,
        b.demandFulfillmentImpact AS demandFulfillmentImpact,
        head(rootCauses).description AS rootCause,
        b.resolutionSteps AS resolutionSteps,
        [o in affectedOrders | {{id: o.id, customer: o.customerName, due: toString(o.dueDate), value: o.value, status: o.status}}] AS affectedOrders,
        [h in history | {{date: toString(h.date), description: h.description}}] AS history
    """
    
    bom_data = execute_read_query(query_bom_detail)
    if bom_data:
        return jsonify(bom_data[0])
    return jsonify({"error": "BOM not found"}), 404

@app.route('/api/broken-networks', methods=['GET'])
def get_broken_networks():
    """
    API endpoint to fetch all nodes where broken_bom = true.
    """
    query = """
    MATCH (n) WHERE n.broken_bom = true
    RETURN properties(n) AS properties
    """
    nodes = execute_read_query(query)
    return jsonify(nodes)

@app.route('/api/broken-demand-networks', methods=['GET'])
def get_broken_demand_networks():
    """
    API endpoint to fetch all nodes where broken_bom = true AND demand_sku = true.
    """
    query = """
    MATCH (n) WHERE n.broken_bom = true AND n.demand_sku = true
    RETURN properties(n) AS properties
    """
    nodes = execute_read_query(query)
    return jsonify(nodes)


if __name__ == '__main__':
    # Running the Flask app on a specified port
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
