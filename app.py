# app.py
from flask import Flask, jsonify, request, send_from_directory
from neo4j import GraphDatabase
from flask_cors import CORS
import random
import os
from dotenv import load_dotenv
import google.generativeai as genai
import requests
import json

# Load environment variables from .env file
load_dotenv()

# --- Configure APIs ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
NEWS_API_KEY = os.getenv("NEWS_API_KEY")

# --- In-Memory Cache for AI Analysis ---
NEWS_ANALYSIS_CACHE = {}

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

def get_affected_orders_summary() -> str:
    """Returns a summary of the total count and quantity of affected customer and forecast orders."""
    try:
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            cust_order_query = "LOAD CSV WITH HEADERS FROM 'file:///custorder.csv' AS row WITH row, toFloat(row.Qty) AS qty WHERE trim(row.Item) <> '' AND trim(row.Loc) <> '' MATCH (s:SKU {sku_id: trim(row.Item) + '@' + trim(row.Loc)}) WHERE s.demand_sku = true AND s.broken_bom = true RETURN count(row) AS orderCount, sum(qty) AS totalQty"
            cust_result = session.run(cust_order_query).single()
            cust_orders_count = cust_result.get('orderCount', 0) or 0
            cust_orders_qty = cust_result.get('totalQty', 0) or 0

            fcst_order_query = "LOAD CSV WITH HEADERS FROM 'file:///fcstorder.csv' AS row WITH row, toFloat(row.Qty) AS qty WHERE trim(row.Item) <> '' AND trim(row.Loc) <> '' MATCH (s:SKU {sku_id: trim(row.Item) + '@' + trim(row.Loc)}) WHERE s.demand_sku = true AND s.broken_bom = true RETURN count(row) AS orderCount, sum(qty) AS totalQty"
            fcst_result = session.run(fcst_order_query).single()
            fcst_orders_count = fcst_result.get('orderCount', 0) or 0
            fcst_orders_qty = fcst_result.get('totalQty', 0) or 0

            total_count = cust_orders_count + fcst_orders_count
            total_qty = cust_orders_qty + fcst_orders_qty

            return f"Affected Orders Summary:\n- Customer Orders: {cust_orders_count} orders (Total Qty: {int(cust_orders_qty)})\n- Forecast Orders: {fcst_orders_count} orders (Total Qty: {int(fcst_orders_qty)})\n- Grand Total: {total_count} orders (Total Qty: {int(total_qty)})"
    except Exception as e:
        return f"Database error: {e}"

def get_affected_customer_orders() -> str:
    """Returns a detailed list of the top 20 affected customer orders from the database."""
    try:
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            query = "LOAD CSV WITH HEADERS FROM 'file:///custorder.csv' AS row WITH row, trim(row.Item) AS item, trim(row.Loc) AS loc, toFloat(row.Qty) AS qty, trim(row.Item) + '@' + trim(row.Loc) AS sku_id WHERE item <> '' AND loc <> '' MATCH (s:SKU {sku_id: sku_id}) WHERE s.demand_sku = true AND s.broken_bom = true RETURN row.Item as Item, row.Loc as Loc, row.Qty as Qty, row.OrderID as OrderID ORDER BY Qty DESC LIMIT 20"
            result = session.run(query)
            orders = [f"- Item: {r['Item']}, Loc: {r['Loc']}, Qty: {r['Qty']}, OrderID: {r['OrderID']}" for r in result]
            return "Here are the top affected customer orders:\n" + "\n".join(orders) if orders else "No affected customer orders were found."
    except Exception as e:
        return f"Database error: {e}"

def get_affected_forecast_orders() -> str:
    """Returns a detailed list of the top 20 affected forecast orders from the database."""
    try:
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            query = "LOAD CSV WITH HEADERS FROM 'file:///fcstorder.csv' AS row WITH row, trim(row.Item) AS item, trim(row.Loc) AS loc, toFloat(row.Qty) AS qty, trim(row.Item) + '@' + trim(row.Loc) AS sku_id WHERE item <> '' AND loc <> '' MATCH (s:SKU {sku_id: sku_id}) WHERE s.demand_sku = true AND s.broken_bom = true RETURN row.Item as Item, row.Loc as Loc, row.Qty as Qty, row.Date as Date ORDER BY Qty DESC LIMIT 20"
            result = session.run(query)
            orders = [f"- Item: {r['Item']}, Loc: {r['Loc']}, Qty: {r['Qty']}, Date: {r['Date']}" for r in result]
            return "Here are the top affected forecast orders:\n" + "\n".join(orders) if orders else "No affected forecast orders were found."
    except Exception as e:
        return f"Database error: {e}"
        
available_tools = {
    "get_bottleneck_skus_from_db": get_bottleneck_skus_from_db, 
    "get_broken_networks_from_db": get_broken_networks_from_db, 
    "get_bottleneck_resources_from_db": get_bottleneck_resources_from_db, 
    "get_network_for_sku": get_network_for_sku,
    "get_affected_orders_summary": get_affected_orders_summary,
    "get_affected_customer_orders": get_affected_customer_orders,
    "get_affected_forecast_orders": get_affected_forecast_orders
}

# --- News Feed Logic ---
def fetch_news_for_category(query, api_key):
    if not api_key:
        print(f"WARNING: NEWS_API_KEY not found. Loading mock data for query: '{query}'")
        try:
            with open('mock-news.json', 'r') as f:
                return json.load(f).get("articles", [])
        except FileNotFoundError:
            print("ERROR: mock-news.json not found. Returning empty list.")
            return []

    base_url = "https://newsapi.org/v2/everything"
    params = { 'q': f"(semiconductor OR chip) AND ({query})", 'sortBy': 'relevancy', 'language': 'en', 'pageSize': 5, 'apiKey': api_key }
    try:
        response = requests.get(base_url, params=params)
        response.raise_for_status()
        articles = response.json().get("articles", [])
        return [
            {
                "title": article.get("title"), "description": article.get("description"),
                "url": article.get("url"), "source": article.get("source", {}).get("name"), 
                "imageUrl": article.get("urlToImage")
            }
            for article in articles if article.get("title") and article.get("url")
        ]
    except requests.exceptions.RequestException as e:
        print(f"Error fetching live news for query '{query}': {e}. Loading mock data.")
        try:
            with open('mock-news.json', 'r') as f:
                return json.load(f).get("articles", [])
        except FileNotFoundError:
            print("ERROR: mock-news.json not found. Returning empty list.")
            return []

@app.route('/api/supply-chain-news', methods=['GET'])
def get_supply_chain_news():
    categories = {
        "supplier": "supplier OR factory OR manufacturing", "logistics": "logistics OR shipping OR port OR freight",
        "market": "demand OR market OR sales", "geopolitical": "geopolitical OR tariff OR trade OR government",
        "compliance": "compliance OR regulation OR environment"
    }
    news_results = {key: fetch_news_for_category(query, NEWS_API_KEY) for key, query in categories.items()}
    return jsonify(news_results)

@app.route('/api/analyze-article', methods=['POST'])
def analyze_article():
    data = request.json
    article = data.get('article', {})
    
    title = article.get('title')
    text_to_analyze = article.get('description') or title
    
    default_impacts = {
        "Supply Availability": "Neutral", "Raw Material Cost": "Neutral",
        "Logistics & Freight Cost": "Neutral", "Market Demand": "Neutral", "OTIF": "Neutral"
    }

    if not text_to_analyze: return jsonify(default_impacts)
    
    cache_key = title 
    if not GEMINI_API_KEY:
        print("WARNING: GEMINI_API_KEY not found. Skipping AI analysis.")
        return jsonify(default_impacts)
    if cache_key in NEWS_ANALYSIS_CACHE:
        return jsonify(NEWS_ANALYSIS_CACHE[cache_key])

    model = genai.GenerativeModel('gemini-1.5-flash')
    prompt = f"""You are a supply chain risk analyst for Intel, a major US semiconductor manufacturer. Your task is to read a news summary and determine its likely impact (Positive, Negative, or Neutral) on five specific supply chain KPIs. Respond only with a JSON object.
The KPIs are:
1. Supply Availability: Ability to get raw materials from suppliers to US factories. Negative for disruptions, Positive for new sources.
2. Raw Material Cost: Cost of components. Negative for tariffs/inflation, Positive for subsidies/discounts.
3. Logistics & Freight Cost: Cost to ship materials internationally. Negative for port congestion, Positive for new shipping lanes.
4. Market Demand: Customer demand for finished goods. Positive for strong sales, Negative for recession fears.
5. OTIF (On-Time In-Full): Ability to deliver finished chips on time. Negative impact on Supply or Logistics often causes a Negative impact here.
News Summary: "{text_to_analyze}"
Your Response (JSON only):"""
    
    try:
        response = model.generate_content(prompt)
        cleaned_text = response.text.strip().replace("```json", "").replace("```", "").strip()
        parsed_response = json.loads(cleaned_text)

        final_impacts = default_impacts.copy()
        if isinstance(parsed_response, dict):
            final_impacts.update(parsed_response)

        NEWS_ANALYSIS_CACHE[cache_key] = final_impacts
        return jsonify(final_impacts)
    except Exception as e:
        print(f"Error analyzing content with AI: '{text_to_analyze[:50]}...': {e}. Returning neutral impacts.")
        NEWS_ANALYSIS_CACHE[cache_key] = default_impacts
        return jsonify(default_impacts)

# --- Other API Endpoints ---
@app.route('/api/dashboard', methods=['GET'])
def get_dashboard_data():
    try:
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            cust_order_query = "LOAD CSV WITH HEADERS FROM 'file:///custorder.csv' AS row WITH row, toFloat(row.Qty) AS qty WHERE trim(row.Item) <> '' AND trim(row.Loc) <> '' MATCH (s:SKU {sku_id: trim(row.Item) + '@' + trim(row.Loc)}) WHERE s.demand_sku = true AND s.broken_bom = true RETURN count(row) AS orderCount, sum(qty) AS totalQty"
            cust_result = session.run(cust_order_query).single()
            cust_orders_count = cust_result.get('orderCount', 0) or 0; cust_orders_qty = cust_result.get('totalQty', 0) or 0
            fcst_order_query = "LOAD CSV WITH HEADERS FROM 'file:///fcstorder.csv' AS row WITH row, toFloat(row.Qty) AS qty WHERE trim(row.Item) <> '' AND trim(row.Loc) <> '' MATCH (s:SKU {sku_id: trim(row.Item) + '@' + trim(row.Loc)}) WHERE s.demand_sku = true AND s.broken_bom = true RETURN count(row) AS orderCount, sum(qty) AS totalQty"
            fcst_result = session.run(fcst_order_query).single()
            fcst_orders_count = fcst_result.get('orderCount', 0) or 0; fcst_orders_qty = fcst_result.get('totalQty', 0) or 0
            total_affected_orders_count = cust_orders_count + fcst_orders_count
            total_affected_orders_qty = cust_orders_qty + fcst_orders_qty
            res_count_result = session.run("MATCH (r:Res {bottleneck: true}) RETURN count(r) AS count").single()
            sku_count_result = session.run("MATCH (s:SKU {bottleneck: true}) RETURN count(s) AS count").single()
            bottleneck_res_count = res_count_result['count'] if res_count_result else 0
            bottleneck_sku_count = sku_count_result['count'] if sku_count_result else 0
            broken_total_result = session.run("MATCH (s:SKU {broken_bom: true}) RETURN count(s) AS count").single()
            broken_fg_result = session.run("MATCH (s:SKU {broken_bom: true, demand_sku: true}) RETURN count(s) AS count").single()
            broken_skus_count = broken_total_result['count'] if broken_total_result else 0
            broken_fg_count = broken_fg_result['count'] if broken_fg_result else 0
        data = { 'totalDemandAtRisk': random.randint(100000, 999999), 'affectedOrdersCount': total_affected_orders_count, 'affectedOrdersQty': total_affected_orders_qty, 'affectedCustOrdersCount': cust_orders_count, 'affectedCustOrdersQty': cust_orders_qty, 'affectedFcstOrdersCount': fcst_orders_count, 'affectedFcstOrdersQty': fcst_orders_qty, 'brokenSkusCount': broken_skus_count, 'brokenFgNetworksCount': broken_fg_count, 'bottleneckResourcesCount': bottleneck_res_count, 'bottleneckSkusCount': bottleneck_sku_count }
        return jsonify(data)
    except Exception as e:
        print(f"An error occurred in get_dashboard_data: {e}")
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

def serialize_record(record):
    return {
        'sku_id': record['sku_id'],
        'properties': {'full_record': dict(record['full_record'])}
    }

@app.route('/api/affected-cust-orders', methods=['GET'])
def get_affected_cust_orders():
    try:
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            query = "LOAD CSV WITH HEADERS FROM 'file:///custorder.csv' AS row WITH row, trim(row.Item) AS item, trim(row.Loc) AS loc, toFloat(row.Qty) AS qty, trim(row.Item) + '@' + trim(row.Loc) AS sku_id WHERE item <> '' AND loc <> '' MATCH (s:SKU {sku_id: sku_id}) WHERE s.demand_sku = true AND s.broken_bom = true RETURN s.sku_id AS sku_id, row AS full_record ORDER BY s.sku_id, qty DESC LIMIT 100;"
            result = session.run(query)
            return jsonify([serialize_record(record) for record in result])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/affected-fcst-orders', methods=['GET'])
def get_affected_fcst_orders():
    try:
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            query = "LOAD CSV WITH HEADERS FROM 'file:///fcstorder.csv' AS row WITH row, trim(row.Item) AS item, trim(row.Loc) AS loc, toFloat(row.Qty) AS qty, trim(row.Item) + '@' + trim(row.Loc) AS sku_id WHERE item <> '' AND loc <> '' MATCH (s:SKU {sku_id: sku_id}) WHERE s.demand_sku = true AND s.broken_bom = true RETURN s.sku_id AS sku_id, row AS full_record ORDER BY s.sku_id, qty DESC LIMIT 100;"
            result = session.run(query)
            return jsonify([serialize_record(record) for record in result])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/affected-cust-orders-by-sku', methods=['POST'])
def get_affected_cust_orders_by_sku():
    try:
        data = request.json
        sku_id = data.get('sku_id')
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            query = "LOAD CSV WITH HEADERS FROM 'file:///custorder.csv' AS row WITH row WHERE (trim(row.Item) + '@' + trim(row.Loc)) = $sku_id RETURN $sku_id AS sku_id, row AS full_record ORDER BY toFloat(row.Qty) DESC"
            result = session.run(query, sku_id=sku_id)
            return jsonify([serialize_record(record) for record in result])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/affected-fcst-orders-by-sku', methods=['POST'])
def get_affected_fcst_orders_by_sku():
    try:
        data = request.json
        sku_id = data.get('sku_id')
        driver = get_db()
        with driver.session(database=NEO4J_DATABASE) as session:
            query = "LOAD CSV WITH HEADERS FROM 'file:///fcstorder.csv' AS row WITH row WHERE (trim(row.Item) + '@' + trim(row.Loc)) = $sku_id RETURN $sku_id AS sku_id, row AS full_record ORDER BY toFloat(row.Qty) DESC"
            result = session.run(query, sku_id=sku_id)
            return jsonify([serialize_record(record) for record in result])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/chat', methods=['POST', 'OPTIONS'])
def handle_chat():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        if not GEMINI_API_KEY:
            return jsonify({'response_type': 'text', 'data': "Error: GEMINI_API_KEY is not configured on the server."}), 500
        data = request.json
        user_message = data.get('message', '')
        system_instruction = "You are a supply chain assistant. Your primary function is to use the provided tools to answer user questions about supply chain data. If a user asks to see, show, draw, or get a network or graph, you must instruct them to use the 'BOM Viewer' for that functionality. For other questions, use the available tools. Only answer conversationally if no tool is appropriate for the user's query."
        model = genai.GenerativeModel('gemini-1.5-flash', tools=list(available_tools.values()), system_instruction=system_instruction)
        chat = model.start_chat(enable_automatic_function_calling=True)
        response = chat.send_message(user_message)
        return jsonify({'response_type': 'text', 'data': response.text.replace('\\_', '_')})
    except Exception as e:
        return jsonify({'response_type': 'text', 'data': f"An error occurred: {e}"}), 500

# --- Static File Serving ---
@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static_files(path):
    return send_from_directory('.', path)

if __name__ == '__main__':
    app.run(debug=True, port=5000)