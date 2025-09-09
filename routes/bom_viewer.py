# routes/bom_viewer.py
from flask import Blueprint, jsonify, request
import os
from utils.neo4j_handler import get_db, serialize_path

bom_viewer_bp = Blueprint('bom_viewer_bp', __name__)

@bom_viewer_bp.route('/api/sku-details', methods=['POST'])
def get_sku_details():
    try:
        data = request.json
        sku_id = data.get('sku_id')
        driver = get_db()
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
            result = session.run("MATCH (s:SKU {sku_id: $sku_id}) RETURN s", sku_id=sku_id).single()
            return jsonify({'found': True, 'properties': dict(result['s'])}) if result else jsonify({'found': False})
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

@bom_viewer_bp.route('/api/network-graph', methods=['POST'])
def get_network_graph():
    try:
        data = request.json
        sku_id = data.get('sku_id')
        driver = get_db()
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
            cypher_query = "MATCH (s:SKU {sku_id: $sku_id}) CALL(s) { WITH s OPTIONAL MATCH up = (u)-[:SOURCING|PRODUCES|CONSUMED_BY|PURCH_FROM*0..]->(s) RETURN collect(DISTINCT up) AS ups } CALL(s) { WITH s OPTIONAL MATCH down = (s)-[:SOURCING|PRODUCES|CONSUMED_BY|PURCH_FROM*0..]->(d) RETURN collect(DISTINCT down) AS downs } WITH s, [p IN ups WHERE p IS NOT NULL] + [p IN downs WHERE p IS NOT NULL] AS netPaths UNWIND netPaths AS p UNWIND nodes(p) AS n WITH s, collect(DISTINCT p) AS allPaths, collect(DISTINCT n) AS nodesInNet WITH allPaths, [n IN nodesInNet WHERE n:BOM] AS bomNodes UNWIND bomNodes AS bn OPTIONAL MATCH rp = (res:Res)-[:USES_RESOURCE]->(bn) WITH allPaths, collect(DISTINCT rp) AS resPaths WITH [p IN resPaths WHERE p IS NOT NULL] AS resPathsClean, allPaths WITH allPaths + resPathsClean AS combinedPaths UNWIND combinedPaths AS path RETURN path;"
            result = session.run(cypher_query, sku_id=sku_id)
            return jsonify([serialize_path(row['path']) for row in result])
    except Exception as e:
        return jsonify({'error': 'Internal server error.'}), 500

@bom_viewer_bp.route('/api/network-with-shortest-path', methods=['POST'])
def get_network_with_shortest_path():
    try:
        data = request.json
        sku_id = data.get('sku_id')
        driver = get_db()
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
            full_network_query = "MATCH (s:SKU {sku_id: $sku_id}) CALL(s) { WITH s OPTIONAL MATCH up = (u)-[:SOURCING|PRODUCES|CONSUMED_BY|PURCH_FROM*0..]->(s) RETURN collect(DISTINCT up) AS ups } CALL(s) { WITH s OPTIONAL MATCH down = (s)-[:SOURCING|PRODUCES|CONSUMED_BY|PURCH_FROM*0..]->(d) RETURN collect(DISTINCT down) AS downs } WITH s, [p IN ups WHERE p IS NOT NULL] + [p IN downs WHERE p IS NOT NULL] AS netPaths UNWIND netPaths AS p UNWIND nodes(p) AS n WITH s, collect(DISTINCT p) AS allPaths, collect(DISTINCT n) AS nodesInNet WITH allPaths, [n IN nodesInNet WHERE n:BOM] AS bomNodes UNWIND bomNodes AS bn OPTIONAL MATCH rp = (res:Res)-[:USES_RESOURCE]->(bn) WITH allPaths, collect(DISTINCT rp) AS resPaths WITH [p IN resPaths WHERE p IS NOT NULL] AS resPathsClean, allPaths WITH allPaths + resPathsClean AS combinedPaths UNWIND combinedPaths AS path RETURN path;"
            full_network_result = session.run(full_network_query, sku_id=sku_id)
            full_network_paths = [serialize_path(row['path']) for row in full_network_result]
            shortest_path_query = "MATCH (d:SKU {sku_id: $sku_id}) WHERE d.demand_sku = true AND coalesce(d.broken_bom,false) = false MATCH path = (srcNode)-[:CONSUMED_BY|PRODUCES|SOURCING|PURCH_FROM*1..50]->(d) WHERE (srcNode:PurchGroup OR (srcNode:SKU AND coalesce(srcNode.infinite_supply,false) = true)) AND NONE(n IN nodes(path) WHERE coalesce(n.broken_bom,false) = true) WITH d, path, head(nodes(path)) AS sourceNode, reduce(totalLT = 0, r IN relationships(path) | totalLT + coalesce(r.lead_time,0)) AS pathLeadTime WITH d, collect({p:path, src:sourceNode, leadTime:pathLeadTime}) AS allPaths WITH d, [x IN allPaths WHERE x.src:PurchGroup] AS purchPaths, [x IN allPaths WHERE NOT x.src:PurchGroup] AS skuPaths WITH d, CASE WHEN size(purchPaths) > 0 THEN purchPaths ELSE skuPaths END AS candidatePaths UNWIND candidatePaths AS cp WITH d, cp ORDER BY cp.leadTime ASC WITH d, collect(cp)[0] AS chosenPath WITH chosenPath, [n IN nodes(chosenPath.p) WHERE n:BOM] AS bomNodes UNWIND bomNodes AS bn OPTIONAL MATCH rp = (res:Res)-[:USES_RESOURCE]->(bn) WITH chosenPath, [p IN collect(DISTINCT rp) WHERE p IS NOT NULL] AS resPaths WITH resPaths + [chosenPath.p] AS allPaths UNWIND allPaths AS path RETURN path;"
            shortest_path_result = session.run(shortest_path_query, sku_id=sku_id)
            shortest_path_paths = [serialize_path(row['path']) for row in shortest_path_result]
        return jsonify({'full_network': full_network_paths, 'shortest_path': shortest_path_paths})
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

@bom_viewer_bp.route('/api/resource-network', methods=['POST'])
def get_resource_network():
    try:
        data = request.json
        res_id = data.get('res_id')
        driver = get_db()
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
            cypher_query = "MATCH (r:Res {res_id: $res_id}) OPTIONAL MATCH rb = (r)-[:USES_RESOURCE]->(b:BOM) WITH r, collect(DISTINCT rb) AS resBomPaths, collect(DISTINCT b) AS startBomNodes UNWIND startBomNodes AS sb OPTIONAL MATCH p_prod = (sb)-[:PRODUCES]->(s:SKU) WITH r, resBomPaths, collect(DISTINCT p_prod) AS bomSkuPaths, collect(DISTINCT s) AS seedSkus UNWIND seedSkus AS seed CALL(seed) { WITH seed OPTIONAL MATCH up = (u)-[:SOURCING|PRODUCES|CONSUMED_BY|PURCH_FROM*0..]->(seed) RETURN collect(DISTINCT up) AS ups } CALL(seed) { WITH seed OPTIONAL MATCH down = (seed)-[:SOURCING|PRODUCES|CONSUMED_BY|PURCH_FROM*0..]->(d) RETURN collect(DISTINCT down) AS downs } WITH r, resBomPaths, bomSkuPaths, ([p IN ups WHERE p IS NOT NULL] + [p IN downs WHERE p IS NOT NULL]) AS sPaths WITH r, resBomPaths, bomSkuPaths, collect(sPaths) AS skuPathSets WITH r, resBomPaths, bomSkuPaths, reduce(acc = [], ps IN skuPathSets | acc + ps) AS skuPaths UNWIND skuPaths AS sp UNWIND nodes(sp) AS n WITH r, resBomPaths, bomSkuPaths, skuPaths, collect(DISTINCT n) AS nodesInNet WITH r, resBomPaths, bomSkuPaths, skuPaths, [x IN nodesInNet WHERE x:BOM] AS bomInNet UNWIND bomInNet AS bn OPTIONAL MATCH r2b = (r2:Res)-[:USES_RESOURCE]->(bn) WITH resBomPaths, bomSkuPaths, skuPaths, collect(DISTINCT r2b) AS extraResPaths WITH resBomPaths + bomSkuPaths + skuPaths + extraResPaths AS allPaths UNWIND allPaths AS path WITH path WHERE path IS NOT NULL RETURN DISTINCT path;"
            result = session.run(cypher_query, res_id=res_id)
            return jsonify([serialize_path(row['path']) for row in result])
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500