# app.py
from flask import Flask, jsonify, request
from neo4j import GraphDatabase
from flask_cors import CORS
import random
import os
from dotenv import load_dotenv
import google.generativeai as genai
import requests

# Load environment variables from .env file
load_dotenv()

# --- Configure APIs ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)
NEWS_API_KEY = os.getenv("NEWS_API_KEY")

# Initialize the Flask application
app = Flask(__name__)
CORS(app)

# Neo4j connection details
NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USER")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE")

def get_db():
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    return driver

def serialize_path(path):
    def serialize_node(node):
        return {'id': node.element_id, 'labels': list(node.labels), 'properties': dict(node)}
    def serialize_rel(rel):
        return {'id': rel.element_id, 'type': rel.type, 'properties': dict(rel), 'startNode': rel.start_node.element_id, 'endNode': rel.end_node.element_id}
    nodes = [serialize_node(node) for node in path.nodes]
    relationships = [serialize_rel(rel) for rel in path.relationships]
    return {'nodes': nodes, 'relationships': relationships}

# --- LLM Tools ---
def get_bottleneck_skus_from_db() -> str:
    """Returns a list of bottleneck SKUs from the Neo4j database."""
    try:
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            result = session.run("MATCH (s:SKU {bottleneck: true}) RETURN s.sku_id AS sku_id LIMIT 10")
            sku_list = [record['sku_id'] for record in result]
            return "Here are the top bottleneck SKUs:\n- " + "\n- ".join(sku_list) if sku_list else "No bottleneck SKUs were found."
    except Exception as e:
        return f"Database error: {e}"

def get_broken_networks_from_db() -> str:
    """Returns a list of SKUs with broken networks from the Neo4j database."""
    try:
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            result = session.run("MATCH (s:SKU {broken_bom: true}) RETURN s.sku_id AS sku_id LIMIT 10")
            sku_list = [record['sku_id'] for record in result]
            return "Here are the top SKUs with broken networks:\n- " + "\n- ".join(sku_list) if sku_list else "No broken networks were found."
    except Exception as e:
        return f"Database error: {e}"

def get_bottleneck_resources_from_db() -> str:
    """Returns a list of bottlenecked resources from the Neo4j database."""
    try:
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            result = session.run("MATCH (r:Res {bottleneck: true}) RETURN r.res_id AS res_id LIMIT 10")
            res_list = [record['res_id'] for record in result]
            return "Here are the top bottleneck resources:\n- " + "\n- ".join(res_list) if res_list else "No bottleneck resources were found."
    except Exception as e:
        return f"Database error: {e}"

def get_network_for_sku(sku_id: str) -> list:
    """Gets the full network graph data for a specific SKU ID."""
    try:
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            cypher_query = "MATCH (s:SKU {sku_id: $sku_id}) CALL(s) { WITH s OPTIONAL MATCH up = (u)-[:SOURCING|PRODUCES|CONSUMED_BY|PURCH_FROM*0..]->(s) RETURN collect(DISTINCT up) AS ups } CALL(s) { WITH s OPTIONAL MATCH down = (s)-[:SOURCING|PRODUCES|CONSUMED_BY|PURCH_FROM*0..]->(d) RETURN collect(DISTINCT down) AS downs } WITH s, [p IN ups WHERE p IS NOT NULL] + [p IN downs WHERE p IS NOT NULL] AS netPaths UNWIND netPaths AS p UNWIND nodes(p) AS n WITH s, collect(DISTINCT p) AS allPaths, collect(DISTINCT n) AS nodesInNet WITH allPaths, [n IN nodesInNet WHERE n:BOM] AS bomNodes UNWIND bomNodes AS bn OPTIONAL MATCH rp = (res:Res)-[:USES_RESOURCE]->(bn) WITH allPaths, collect(DISTINCT rp) AS resPaths WITH [p IN resPaths WHERE p IS NOT NULL] AS resPathsClean, allPaths WITH allPaths + resPathsClean AS combinedPaths UNWIND combinedPaths AS path RETURN path;"
            result = session.run(cypher_query, sku_id=sku_id)
            return [serialize_path(row['path']) for row in result]
    except Exception as e:
        return [{'error': str(e)}]
        
available_tools = {"get_bottleneck_skus_from_db": get_bottleneck_skus_from_db, "get_broken_networks_from_db": get_broken_networks_from_db, "get_bottleneck_resources_from_db": get_bottleneck_resources_from_db, "get_network_for_sku": get_network_for_sku}

# --- News Feed Endpoint ---
def fetch_news_for_category(query, api_key):
    """Helper function to fetch news for a specific query."""
    base_url = "https://newsapi.org/v2/everything"
    params = {
        'q': f"(semiconductor OR chip) AND ({query})",
        'sortBy': 'relevancy',
        'language': 'en',
        'pageSize': 5, # Fetch 5 articles per category for the carousel
        'apiKey': api_key
    }
    try:
        response = requests.get(base_url, params=params)
        response.raise_for_status()
        articles = response.json().get("articles", [])
        return [
            {
                "title": article.get("title"),
                "url": article.get("url"),
                "source": article.get("source", {}).get("name"),
                "imageUrl": article.get("urlToImage")
            }
            for article in articles if article.get("title") and article.get("urlToImage")
        ]
    except requests.exceptions.RequestException as e:
        print(f"Error fetching news for query '{query}': {e}")
        return []

@app.route('/api/supply-chain-news', methods=['GET'])
def get_supply_chain_news():
    if not NEWS_API_KEY:
        return jsonify({'error': 'News API key is not configured.'}), 500

    categories = {
        "supplier": "supplier OR factory OR manufacturing",
        "logistics": "logistics OR shipping OR port OR freight",
        "market": "demand OR market OR sales",
        "geopolitical": "geopolitical OR tariff OR trade OR government",
        "compliance": "compliance OR regulation OR environment"
    }
    
    news_results = {key: fetch_news_for_category(query, NEWS_API_KEY) for key, query in categories.items()}
    
    return jsonify(news_results)

# --- Other API Endpoints ---
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
        data = {'totalDemandAtRisk': random.randint(100000, 999999), 'affectedOrders': random.randint(50, 500), 'brokenSkusCount': broken_skus_count, 'brokenFgNetworksCount': broken_fg_count, 'bottleneckResourcesCount': bottleneck_res_count, 'bottleneckSkusCount': bottleneck_sku_count}
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/sku-details', methods=['POST'])
def get_sku_details():
    try:
        data = request.json
        sku_id = data.get('sku_id')
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            result = session.run("MATCH (s:SKU {sku_id: $sku_id}) RETURN s", sku_id=sku_id).single()
            return jsonify({'found': True, 'properties': dict(result['s'])}) if result else jsonify({'found': False})
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/broken-networks', methods=['GET'])
def get_broken_networks():
    try:
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            result = session.run("MATCH (s:SKU) WHERE s.broken_bom = true RETURN s LIMIT 10")
            return jsonify([{'id': record['s'].element_id, 'properties': dict(record['s'])} for record in result])
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/bottleneck-resources', methods=['GET'])
def get_bottleneck_resources():
    try:
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            result = session.run("MATCH (r:Res) WHERE r.bottleneck = true RETURN r LIMIT 10")
            return jsonify([{'id': record['r'].element_id, 'properties': dict(record['r'])} for record in result])
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/bottleneck-skus', methods=['GET'])
def get_bottleneck_skus():
    try:
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            result = session.run("MATCH (s:SKU) WHERE s.bottleneck = true RETURN s LIMIT 10")
            return jsonify([{'id': record['s'].element_id, 'properties': dict(record['s'])} for record in result])
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/broken-demand-networks', methods=['GET'])
def get_broken_demand_networks():
    try:
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            result = session.run("MATCH (s:SKU) WHERE s.broken_bom = true AND s.demand_sku = true RETURN s LIMIT 10")
            return jsonify([{'id': record['s'].element_id, 'properties': dict(record['s'])} for record in result])
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/network-graph', methods=['POST'])
def get_network_graph():
    try:
        data = request.json
        sku_id = data.get('sku_id')
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            cypher_query = "MATCH (s:SKU {sku_id: $sku_id}) CALL(s) { WITH s OPTIONAL MATCH up = (u)-[:SOURCING|PRODUCES|CONSUMED_BY|PURCH_FROM*0..]->(s) RETURN collect(DISTINCT up) AS ups } CALL(s) { WITH s OPTIONAL MATCH down = (s)-[:SOURCING|PRODUCES|CONSUMED_BY|PURCH_FROM*0..]->(d) RETURN collect(DISTINCT down) AS downs } WITH s, [p IN ups WHERE p IS NOT NULL] + [p IN downs WHERE p IS NOT NULL] AS netPaths UNWIND netPaths AS p UNWIND nodes(p) AS n WITH s, collect(DISTINCT p) AS allPaths, collect(DISTINCT n) AS nodesInNet WITH allPaths, [n IN nodesInNet WHERE n:BOM] AS bomNodes UNWIND bomNodes AS bn OPTIONAL MATCH rp = (res:Res)-[:USES_RESOURCE]->(bn) WITH allPaths, collect(DISTINCT rp) AS resPaths WITH [p IN resPaths WHERE p IS NOT NULL] AS resPathsClean, allPaths WITH allPaths + resPathsClean AS combinedPaths UNWIND combinedPaths AS path RETURN path;"
            result = session.run(cypher_query, sku_id=sku_id)
            return jsonify([serialize_path(row['path']) for row in result])
    except Exception as e:
        return jsonify({'error': 'Internal server error.'}), 500

@app.route('/api/network-with-shortest-path', methods=['POST'])
def get_network_with_shortest_path():
    try:
        data = request.json
        sku_id = data.get('sku_id')
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
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/resource-network', methods=['POST'])
def get_resource_network():
    try:
        data = request.json
        res_id = data.get('res_id')
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            cypher_query = "MATCH (r:Res {res_id: $res_id}) OPTIONAL MATCH rb = (r)-[:USES_RESOURCE]->(b:BOM) WITH r, collect(DISTINCT rb) AS resBomPaths, collect(DISTINCT b) AS startBomNodes UNWIND startBomNodes AS sb OPTIONAL MATCH p_prod = (sb)-[:PRODUCES]->(s:SKU) WITH r, resBomPaths, collect(DISTINCT p_prod) AS bomSkuPaths, collect(DISTINCT s) AS seedSkus UNWIND seedSkus AS seed CALL(seed) { WITH seed OPTIONAL MATCH up = (u)-[:SOURCING|PRODUCES|CONSUMED_BY|PURCH_FROM*0..]->(seed) RETURN collect(DISTINCT up) AS ups } CALL(seed) { WITH seed OPTIONAL MATCH down = (seed)-[:SOURCING|PRODUCES|CONSUMED_BY|PURCH_FROM*0..]->(d) RETURN collect(DISTINCT down) AS downs } WITH r, resBomPaths, bomSkuPaths, ([p IN ups WHERE p IS NOT NULL] + [p IN downs WHERE p IS NOT NULL]) AS sPaths WITH r, resBomPaths, bomSkuPaths, collect(sPaths) AS skuPathSets WITH r, resBomPaths, bomSkuPaths, reduce(acc = [], ps IN skuPathSets | acc + ps) AS skuPaths UNWIND skuPaths AS sp UNWIND nodes(sp) AS n WITH r, resBomPaths, bomSkuPaths, skuPaths, collect(DISTINCT n) AS nodesInNet WITH r, resBomPaths, bomSkuPaths, skuPaths, [x IN nodesInNet WHERE x:BOM] AS bomInNet UNWIND bomInNet AS bn OPTIONAL MATCH r2b = (r2:Res)-[:USES_RESOURCE]->(bn) WITH resBomPaths, bomSkuPaths, skuPaths, collect(DISTINCT r2b) AS extraResPaths WITH resBomPaths + bomSkuPaths + skuPaths + extraResPaths AS allPaths UNWIND allPaths AS path WITH path WHERE path IS NOT NULL RETURN DISTINCT path;"
            result = session.run(cypher_query, res_id=res_id)
            return jsonify([serialize_path(row['path']) for row in result])
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/chat', methods=['POST', 'OPTIONS'])
def handle_chat():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.json
        user_message = data.get('message', '')
        system_instruction = "You are a supply chain assistant. Your primary function is to use the provided tools to answer user questions about supply chain data. If a user asks to see, show, draw, or get a network or graph, you must instruct them to use the 'BOM Viewer' for that functionality. For other questions, use the available tools. Only answer conversationally if no tool is appropriate for the user's query."
        model = genai.GenerativeModel('gemini-1.5-flash', tools=list(available_tools.values()), system_instruction=system_instruction)
        chat = model.start_chat(enable_automatic_function_calling=True)
        response = chat.send_message(user_message)
        return jsonify({'response_type': 'text', 'data': response.text.replace('\\_', '_')})
    except Exception as e:
        return jsonify({'response_type': 'text', 'data': f"An error occurred: {e}"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)