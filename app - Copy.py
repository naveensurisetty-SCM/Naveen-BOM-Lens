# app.py
from flask import Flask, jsonify, request
from neo4j import GraphDatabase
from flask_cors import CORS
import random
import os
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables from .env file
load_dotenv()

# --- Configure Gemini API ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)

# Initialize the Flask application
app = Flask(__name__)
CORS(app)

# Neo4j connection details are now loaded from the .env file
NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USER")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE")

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

# --- Database functions defined as tools for the LLM ---

def get_bottleneck_skus_from_db() -> str:
    """Returns a list of bottleneck SKUs from the Neo4j database."""
    try:
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            cypher_query = "MATCH (s:SKU {bottleneck: true}) RETURN s.sku_id AS sku_id LIMIT 10"
            result = session.run(cypher_query)
            sku_list = [record['sku_id'] for record in result]
            if sku_list:
                return "Here are the top bottleneck SKUs:\n- " + "\n- ".join(sku_list)
            else:
                return "No bottleneck SKUs were found in the database."
    except Exception as e:
        return f"An error occurred while querying the database: {e}"

def get_broken_networks_from_db() -> str:
    """Returns a list of SKUs with broken networks from the Neo4j database."""
    try:
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            cypher_query = "MATCH (s:SKU {broken_bom: true}) RETURN s.sku_id AS sku_id LIMIT 10"
            result = session.run(cypher_query)
            sku_list = [record['sku_id'] for record in result]
            if sku_list:
                return "Here are the top SKUs with broken networks:\n- " + "\n- ".join(sku_list)
            else:
                return "No broken networks were found in the database."
    except Exception as e:
        return f"An error occurred while querying the database: {e}"

def get_bottleneck_resources_from_db() -> str:
    """Returns a list of bottlenecked resources from the Neo4j database."""
    try:
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            cypher_query = "MATCH (r:Res {bottleneck: true}) RETURN r.res_id AS res_id LIMIT 10"
            result = session.run(cypher_query)
            res_list = [record['res_id'] for record in result]
            if res_list:
                return "Here are the top bottleneck resources:\n- " + "\n- ".join(res_list)
            else:
                return "No bottleneck resources were found in the database."
    except Exception as e:
        return f"An error occurred while querying the database: {e}"

def get_network_for_sku(sku_id: str) -> list:
    """Gets the full network graph data for a specific SKU ID. Use this when a user asks to see, show, draw, or get the network or graph for a SKU."""
    try:
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            cypher_query = "MATCH (s:SKU {sku_id: $sku_id}) CALL(s) { WITH s OPTIONAL MATCH up = (u)-[:SOURCING|PRODUCES|CONSUMED_BY|PURCH_FROM*0..]->(s) RETURN collect(DISTINCT up) AS ups } CALL(s) { WITH s OPTIONAL MATCH down = (s)-[:SOURCING|PRODUCES|CONSUMED_BY|PURCH_FROM*0..]->(d) RETURN collect(DISTINCT down) AS downs } WITH s, [p IN ups WHERE p IS NOT NULL] + [p IN downs WHERE p IS NOT NULL] AS netPaths UNWIND netPaths AS p UNWIND nodes(p) AS n WITH s, collect(DISTINCT p) AS allPaths, collect(DISTINCT n) AS nodesInNet WITH allPaths, [n IN nodesInNet WHERE n:BOM] AS bomNodes UNWIND bomNodes AS bn OPTIONAL MATCH rp = (res:Res)-[:USES_RESOURCE]->(bn) WITH allPaths, collect(DISTINCT rp) AS resPaths WITH [p IN resPaths WHERE p IS NOT NULL] AS resPathsClean, allPaths WITH allPaths + resPathsClean AS combinedPaths UNWIND combinedPaths AS path RETURN path;"
            result = session.run(cypher_query, sku_id=sku_id)
            paths = [serialize_path(row['path']) for row in result]
            return paths
    except Exception as e:
        return [{'error': str(e)}]

# Create a dictionary to map tool names to functions
available_tools = {
    "get_bottleneck_skus_from_db": get_bottleneck_skus_from_db,
    "get_broken_networks_from_db": get_broken_networks_from_db,
    "get_bottleneck_resources_from_db": get_bottleneck_resources_from_db,
    "get_network_for_sku": get_network_for_sku,
}

# Endpoint for the main dashboard metrics
@app.route('/api/dashboard', methods=['GET'])
def get_dashboard_data():
    try:
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            res_count_result = session.run("MATCH (r:Res {bottleneck: true}) RETURN count(r) AS count").single()
            sku_count_result = session.run("MATCH (s:SKU {bottleneck: true}) RETURN count(s) AS count").single()
            bottleneck_res_count = res_count_result['count'] if res_count_result else 0
            bottleneck_sku_count = sku_count_result['count'] if sku_count_result else 0
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

@app.route('/api/sku-details', methods=['POST'])
def get_sku_details():
    try:
        data = request.json
        sku_id = data.get('sku_id')
        if not sku_id:
            return jsonify({'error': 'SKU ID is required.'}), 400
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            result = session.run("MATCH (s:SKU {sku_id: $sku_id}) RETURN s", sku_id=sku_id).single()
            if result:
                return jsonify({'found': True, 'properties': dict(result['s'])})
            else:
                return jsonify({'found': False})
    except Exception as e:
        print(f"Error fetching SKU details: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/broken-networks', methods=['GET'])
def get_broken_networks():
    try:
        driver = get_db()
        cypher_query = "MATCH (s:SKU) WHERE s.broken_bom = true RETURN s LIMIT 10"
        with driver.session(database=NEO4J_DATABASE) as session:
            result = session.run(cypher_query)
            broken_skus = [{'id': record['s'].element_id, 'properties': dict(record['s'])} for record in result]
            return jsonify(broken_skus)
    except Exception as e:
        print(f"Error fetching broken networks: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/sfg-skus', methods=['GET'])
def get_sfg_skus():
    try:
        driver = get_db()
        cypher_query = "MATCH (s:SKU) WHERE s.demand_sku = false RETURN s LIMIT 10"
        with driver.session(database=NEO4J_DATABASE) as session:
            result = session.run(cypher_query)
            sfg_skus = [{'id': record['s'].element_id, 'properties': dict(record['s'])} for record in result]
            return jsonify(sfg_skus)
    except Exception as e:
        print(f"Error fetching SFG SKUs: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/fg-skus', methods=['GET'])
def get_fg_skus():
    try:
        driver = get_db()
        cypher_query = "MATCH (s:SKU) WHERE s.demand_sku = true RETURN s LIMIT 10"
        with driver.session(database=NEO4J_DATABASE) as session:
            result = session.run(cypher_query)
            fg_skus = [{'id': record['s'].element_id, 'properties': dict(record['s'])} for record in result]
            return jsonify(fg_skus)
    except Exception as e:
        print(f"Error fetching FG SKUs: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/bottleneck-resources', methods=['GET'])
def get_bottleneck_resources():
    try:
        driver = get_db()
        cypher_query = "MATCH (r:Res) WHERE r.bottleneck = true RETURN r LIMIT 10"
        with driver.session(database=NEO4J_DATABASE) as session:
            result = session.run(cypher_query)
            resources = [{'id': record['r'].element_id, 'properties': dict(record['r'])} for record in result]
            return jsonify(resources)
    except Exception as e:
        print(f"Error fetching bottleneck resources: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/bottleneck-skus', methods=['GET'])
def get_bottleneck_skus():
    try:
        driver = get_db()
        cypher_query = "MATCH (s:SKU) WHERE s.bottleneck = true RETURN s LIMIT 10"
        with driver.session(database=NEO4J_DATABASE) as session:
            result = session.run(cypher_query)
            skus = [{'id': record['s'].element_id, 'properties': dict(record['s'])} for record in result]
            return jsonify(skus)
    except Exception as e:
        print(f"Error fetching bottleneck SKUs: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/broken-demand-networks', methods=['GET'])
def get_broken_demand_networks():
    try:
        driver = get_db()
        cypher_query = "MATCH (s:SKU) WHERE s.broken_bom = true AND s.demand_sku = true RETURN s LIMIT 10"
        with driver.session(database=NEO4J_DATABASE) as session:
            result = session.run(cypher_query)
            broken_demand_skus = [{'id': record['s'].element_id, 'properties': dict(record['s'])} for record in result]
            return jsonify(broken_demand_skus)
    except Exception as e:
        print(f"Error fetching broken demand networks: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/network-graph', methods=['POST'])
def get_network_graph():
    try:
        data = request.json
        sku_id = data.get('sku_id')
        if not sku_id:
            return jsonify({'error': 'SKU ID is required.'}), 400
        cypher_query = "MATCH (s:SKU {sku_id: $sku_id}) CALL(s) { WITH s OPTIONAL MATCH up = (u)-[:SOURCING|PRODUCES|CONSUMED_BY|PURCH_FROM*0..]->(s) RETURN collect(DISTINCT up) AS ups } CALL(s) { WITH s OPTIONAL MATCH down = (s)-[:SOURCING|PRODUCES|CONSUMED_BY|PURCH_FROM*0..]->(d) RETURN collect(DISTINCT down) AS downs } WITH s, [p IN ups WHERE p IS NOT NULL] + [p IN downs WHERE p IS NOT NULL] AS netPaths UNWIND netPaths AS p UNWIND nodes(p) AS n WITH s, collect(DISTINCT p) AS allPaths, collect(DISTINCT n) AS nodesInNet WITH allPaths, [n IN nodesInNet WHERE n:BOM] AS bomNodes UNWIND bomNodes AS bn OPTIONAL MATCH rp = (res:Res)-[:USES_RESOURCE]->(bn) WITH allPaths, collect(DISTINCT rp) AS resPaths WITH [p IN resPaths WHERE p IS NOT NULL] AS resPathsClean, allPaths WITH allPaths + resPathsClean AS combinedPaths UNWIND combinedPaths AS path RETURN path;"
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            result = session.run(cypher_query, sku_id=sku_id)
            paths = [row['path'] for row in result]
            serialized_paths = [serialize_path(path) for path in paths]
            return jsonify(serialized_paths)
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': 'Internal server error.'}), 500

@app.route('/api/network-with-shortest-path', methods=['POST'])
def get_network_with_shortest_path():
    try:
        data = request.json
        sku_id = data.get('sku_id')
        if not sku_id:
            return jsonify({'error': 'SKU ID is required.'}), 400
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            full_network_query = "MATCH (s:SKU {sku_id: $sku_id}) CALL(s) { WITH s OPTIONAL MATCH up = (u)-[:SOURCING|PRODUCES|CONSUMED_BY|PURCH_FROM*0..]->(s) RETURN collect(DISTINCT up) AS ups } CALL(s) { WITH s OPTIONAL MATCH down = (s)-[:SOURCING|PRODUCES|CONSUMED_BY|PURCH_FROM*0..]->(d) RETURN collect(DISTINCT down) AS downs } WITH s, [p IN ups WHERE p IS NOT NULL] + [p IN downs WHERE p IS NOT NULL] AS netPaths UNWIND netPaths AS p UNWIND nodes(p) AS n WITH s, collect(DISTINCT p) AS allPaths, collect(DISTINCT n) AS nodesInNet WITH allPaths, [n IN nodesInNet WHERE n:BOM] AS bomNodes UNWIND bomNodes AS bn OPTIONAL MATCH rp = (res:Res)-[:USES_RESOURCE]->(bn) WITH allPaths, collect(DISTINCT rp) AS resPaths WITH [p IN resPaths WHERE p IS NOT NULL] AS resPathsClean, allPaths WITH allPaths + resPathsClean AS combinedPaths UNWIND combinedPaths AS path RETURN path;"
            full_network_result = session.run(full_network_query, sku_id=sku_id)
            full_network_paths = [serialize_path(row['path']) for row in full_network_result]
            shortest_path_query = "MATCH (d:SKU {sku_id: $sku_id}) WHERE d.demand_sku = true AND coalesce(d.broken_bom,false) = false MATCH path = (srcNode)-[:CONSUMED_BY|PRODUCES|SOURCING|PURCH_FROM*1..50]->(d) WHERE (srcNode:PurchGroup OR (srcNode:SKU AND coalesce(srcNode.infinite_supply,false) = true)) AND NONE(n IN nodes(path) WHERE coalesce(n.broken_bom,false) = true) WITH d, path, head(nodes(path)) AS sourceNode, reduce(totalLT = 0, r IN relationships(path) | totalLT + coalesce(r.lead_time,0)) AS pathLeadTime WITH d, collect({p:path, src:sourceNode, leadTime:pathLeadTime}) AS allPaths WITH d, [x IN allPaths WHERE x.src:PurchGroup] AS purchPaths, [x IN allPaths WHERE NOT x.src:PurchGroup] AS skuPaths WITH d, CASE WHEN size(purchPaths) > 0 THEN purchPaths ELSE skuPaths END AS candidatePaths UNWIND candidatePaths AS cp WITH d, cp ORDER BY cp.leadTime ASC WITH d, collect(cp)[0] AS chosenPath WITH chosenPath, [n IN nodes(chosenPath.p) WHERE n:BOM] AS bomNodes UNWIND bomNodes AS bn OPTIONAL MATCH rp = (res:Res)-[:USES_RESOURCE]->(bn) WITH chosenPath, [p IN collect(DISTINCT rp) WHERE p IS NOT NULL] AS resPaths WITH resPaths + [chosenPath.p] AS allPaths UNWIND allPaths AS path RETURN path;"
            shortest_path_result = session.run(shortest_path_query, sku_id=sku_id)
            shortest_path_paths = [serialize_path(row['path']) for row in shortest_path_result]
        return jsonify({'full_network': full_network_paths, 'shortest_path': shortest_path_paths})
    except Exception as e:
        print(f"Error fetching combined network data: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/resource-network', methods=['POST'])
def get_resource_network():
    try:
        data = request.json
        res_id = data.get('res_id')
        if not res_id:
            return jsonify({'error': 'Resource ID is required.'}), 400
        cypher_query = "MATCH (r:Res {res_id: $res_id}) OPTIONAL MATCH rb = (r)-[:USES_RESOURCE]->(b:BOM) WITH r, collect(DISTINCT rb) AS resBomPaths, collect(DISTINCT b) AS startBomNodes UNWIND startBomNodes AS sb OPTIONAL MATCH p_prod = (sb)-[:PRODUCES]->(s:SKU) WITH r, resBomPaths, collect(DISTINCT p_prod) AS bomSkuPaths, collect(DISTINCT s) AS seedSkus UNWIND seedSkus AS seed CALL(seed) { WITH seed OPTIONAL MATCH up = (u)-[:SOURCING|PRODUCES|CONSUMED_BY|PURCH_FROM*0..]->(seed) RETURN collect(DISTINCT up) AS ups } CALL(seed) { WITH seed OPTIONAL MATCH down = (seed)-[:SOURCING|PRODUCES|CONSUMED_BY|PURCH_FROM*0..]->(d) RETURN collect(DISTINCT down) AS downs } WITH r, resBomPaths, bomSkuPaths, ([p IN ups WHERE p IS NOT NULL] + [p IN downs WHERE p IS NOT NULL]) AS sPaths WITH r, resBomPaths, bomSkuPaths, collect(sPaths) AS skuPathSets WITH r, resBomPaths, bomSkuPaths, reduce(acc = [], ps IN skuPathSets | acc + ps) AS skuPaths UNWIND skuPaths AS sp UNWIND nodes(sp) AS n WITH r, resBomPaths, bomSkuPaths, skuPaths, collect(DISTINCT n) AS nodesInNet WITH r, resBomPaths, bomSkuPaths, skuPaths, nodesInNet AS nodesNetRaw WITH r, resBomPaths, bomSkuPaths, skuPaths, nodesNetRaw AS nodesNet WITH r, resBomPaths, bomSkuPaths, skuPaths, [x IN nodesNet WHERE x:BOM] AS bomInNet UNWIND bomInNet AS bn OPTIONAL MATCH r2b = (r2:Res)-[:USES_RESOURCE]->(bn) WITH resBomPaths, bomSkuPaths, skuPaths, collect(DISTINCT r2b) AS extraResPaths WITH resBomPaths + bomSkuPaths + skuPaths + extraResPaths AS allPaths UNWIND allPaths AS path WITH path WHERE path IS NOT NULL RETURN DISTINCT path;"
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            result = session.run(cypher_query, res_id=res_id)
            paths = [row['path'] for row in result]
            serialized_paths = [serialize_path(path) for path in paths]
            return jsonify(serialized_paths)
    except Exception as e:
        print(f"Error fetching resource network: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/bom/<bom_id>', methods=['GET'])
def get_bom_detail(bom_id):
    try:
        detail_data = {
            'name': f'BOM {bom_id}', 'demandFulfillmentImpact': random.randint(1000, 50000),
            'status': random.choice(['Critical', 'Resolved']), 'rootCause': 'Raw material shortage',
            'resolutionSteps': 'Sourced new supplier.',
            'affectedOrders': [{'id': 'ORD-123', 'customer': 'Cust A', 'due': '2023-11-01', 'value': 5000}, {'id': 'ORD-456', 'customer': 'Cust B', 'due': '2023-11-15', 'value': 2500}],
            'history': [{'date': '2023-10-20', 'description': 'Initial detection'}, {'date': '2023-10-25', 'description': 'Resolution started'}]
        }
        return jsonify(detail_data)
    except Exception as e:
        print(f"Error fetching BOM detail: {e}")
        return jsonify({'error': 'Internal server error'}), 500

# --- CHAT ENDPOINT ---
@app.route('/api/chat', methods=['POST'])
def handle_chat():
    try:
        data = request.json
        user_message = data.get('message', '')
        if not user_message:
            return jsonify({'error': 'No message provided.'}), 400

        if not GEMINI_API_KEY:
            return jsonify({'response_type': 'text', 'data': 'Error: Gemini API key is not configured.'})

        # Define the model and tools
        tools = [
            get_bottleneck_skus_from_db, 
            get_broken_networks_from_db, 
            get_bottleneck_resources_from_db,
            get_network_for_sku
        ]
        
        system_instruction = "You are a supply chain assistant. Your primary function is to use the provided tools to answer user questions about supply chain data. Only answer conversationally if no tool is appropriate for the user's query."

        model = genai.GenerativeModel(
            'gemini-1.5-flash', 
            tools=tools,
            system_instruction=system_instruction
        )
        chat = model.start_chat(enable_automatic_function_calling=True)
        
        # Send message to Gemini
        response = chat.send_message(user_message)
        
        # Check if the model made a function call
        if response.candidates[0].content.parts[0].function_call:
            function_call = response.candidates[0].content.parts[0].function_call
            function_response = response.candidates[0].content.parts[0].function_response
            
            if function_call.name == 'get_network_for_sku':
                # Handle graph data response
                graph_data = function_response.response['result']
                sku_id = function_call.args['sku_id']
                # Check for errors from the function call
                if isinstance(graph_data, list) and len(graph_data) > 0 and 'error' in graph_data[0]:
                     return jsonify({'response_type': 'text', 'data': f"An error occurred while fetching the graph: {graph_data[0]['error']}"})
                return jsonify({
                    'response_type': 'graph',
                    'data': graph_data,
                    'display_text': f"Certainly, here is the network graph for {sku_id}:"
                })
            else:
                # Handle simple text response from other tools
                text_result = function_response.response['text'].replace('\\_', '_')
                return jsonify({'response_type': 'text', 'data': text_result})
        else:
            # Handle a general conversational response
            return jsonify({'response_type': 'text', 'data': response.text.replace('\\_', '_')})
        
    except Exception as e:
        print(f"Error in chat endpoint: {e}")
        return jsonify({'response_type': 'text', 'data': f"An error occurred: {e}"}), 500

# Run the Flask application
if __name__ == '__main__':
    app.run(debug=True, port=5000)