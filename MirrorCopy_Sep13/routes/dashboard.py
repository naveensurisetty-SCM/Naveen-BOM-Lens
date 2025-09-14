# routes/dashboard.py
from flask import Blueprint, jsonify, request
import random
import os
from utils.neo4j_handler import get_db, serialize_record

dashboard_bp = Blueprint('dashboard_bp', __name__)

@dashboard_bp.route('/api/dashboard', methods=['GET'])
def get_dashboard_data():
    try:
        driver = get_db()
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
            cust_order_query = "LOAD CSV WITH HEADERS FROM 'file:///custorder.csv' AS row WITH row, toFloat(row.Qty) AS qty WHERE trim(row.Item) <> '' AND trim(row.Loc) <> '' MATCH (s:SKU {sku_id: trim(row.Item) + '@' + trim(row.Loc)}) WHERE s.demand_sku = true AND s.broken_bom = true RETURN count(row) AS orderCount, sum(qty) AS totalQty"
            cust_result = session.run(cust_order_query).single()
            cust_orders_count = cust_result.get('orderCount', 0) or 0; cust_orders_qty = cust_result.get('totalQty', 0) or 0
            
            fcst_order_query = "LOAD CSV WITH HEADERS FROM 'file:///fcstorder.csv' AS row WITH row, toFloat(row.Qty) AS qty WHERE trim(row.Item) <> '' AND trim(row.Loc) <> '' MATCH (s:SKU {sku_id: trim(row.Item) + '@' + trim(row.Loc)}) WHERE s.demand_sku = true AND s.broken_bom = true RETURN count(row) AS orderCount, sum(qty) AS totalQty"
            fcst_result = session.run(fcst_order_query).single()
            fcst_orders_count = fcst_result.get('orderCount', 0) or 0; fcst_orders_qty = fcst_result.get('totalQty', 0) or 0
            
            total_affected_orders_count = cust_orders_count + fcst_orders_count
            total_affected_orders_qty = cust_orders_qty + fcst_orders_qty
            
            broken_total_result = session.run("MATCH (s:SKU {broken_bom: true}) RETURN count(s) AS count").single()
            broken_fg_result = session.run("MATCH (s:SKU {broken_bom: true, demand_sku: true}) RETURN count(s) AS count").single()
            broken_skus_count = broken_total_result['count'] if broken_total_result else 0
            broken_fg_count = broken_fg_result['count'] if broken_fg_result else 0
    
        data = { 
            'totalDemandAtRisk': random.randint(100000, 999999), 
            'affectedOrdersCount': total_affected_orders_count, 
            'affectedOrdersQty': total_affected_orders_qty, 
            'affectedCustOrdersCount': cust_orders_count, 
            'affectedCustOrdersQty': cust_orders_qty, 
            'affectedFcstOrdersCount': fcst_orders_count, 
            'affectedFcstOrdersQty': fcst_orders_qty, 
            'brokenSkusCount': broken_skus_count, 
            'brokenFgNetworksCount': broken_fg_count
        }
        return jsonify(data)
    except Exception as e:
        print(f"An error occurred in get_dashboard_data: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@dashboard_bp.route('/api/broken-networks', methods=['GET'])
def get_broken_networks():
    try:
        driver = get_db()
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
            result = session.run("MATCH (s:SKU) WHERE s.broken_bom = true RETURN s LIMIT 10")
            return jsonify([{'id': record['s'].element_id, 'properties': dict(record['s'])} for record in result])
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

@dashboard_bp.route('/api/broken-demand-networks', methods=['GET'])
def get_broken_demand_networks():
    try:
        driver = get_db()
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
            result = session.run("MATCH (s:SKU) WHERE s.broken_bom = true AND s.demand_sku = true RETURN s LIMIT 10")
            return jsonify([{'id': record['s'].element_id, 'properties': dict(record['s'])} for record in result])
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

@dashboard_bp.route('/api/affected-cust-orders', methods=['GET'])
def get_affected_cust_orders():
    try:
        driver = get_db()
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
            query = "LOAD CSV WITH HEADERS FROM 'file:///custorder.csv' AS row WITH row, trim(row.Item) AS item, trim(row.Loc) AS loc, toFloat(row.Qty) AS qty, trim(row.Item) + '@' + trim(row.Loc) AS sku_id WHERE item <> '' AND loc <> '' MATCH (s:SKU {sku_id: sku_id}) WHERE s.demand_sku = true AND s.broken_bom = true RETURN s.sku_id AS sku_id, row AS full_record ORDER BY s.sku_id, qty DESC LIMIT 100;"
            result = session.run(query)
            return jsonify([serialize_record(record) for record in result])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@dashboard_bp.route('/api/affected-fcst-orders', methods=['GET'])
def get_affected_fcst_orders():
    try:
        driver = get_db()
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
            query = "LOAD CSV WITH HEADERS FROM 'file:///fcstorder.csv' AS row WITH row, trim(row.Item) AS item, trim(row.Loc) AS loc, toFloat(row.Qty) AS qty, trim(row.Item) + '@' + trim(row.Loc) AS sku_id WHERE item <> '' AND loc <> '' MATCH (s:SKU {sku_id: sku_id}) WHERE s.demand_sku = true AND s.broken_bom = true RETURN s.sku_id AS sku_id, row AS full_record ORDER BY s.sku_id, qty DESC LIMIT 100;"
            result = session.run(query)
            return jsonify([serialize_record(record) for record in result])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@dashboard_bp.route('/api/affected-cust-orders-by-sku', methods=['POST'])
def get_affected_cust_orders_by_sku():
    try:
        data = request.json
        sku_id = data.get('sku_id')
        driver = get_db()
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
            query = "LOAD CSV WITH HEADERS FROM 'file:///custorder.csv' AS row WITH row WHERE (trim(row.Item) + '@' + trim(row.Loc)) = $sku_id RETURN $sku_id AS sku_id, row AS full_record ORDER BY toFloat(row.Qty) DESC"
            result = session.run(query, sku_id=sku_id)
            return jsonify([serialize_record(record) for record in result])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@dashboard_bp.route('/api/affected-fcst-orders-by-sku', methods=['POST'])
def get_affected_fcst_orders_by_sku():
    try:
        data = request.json
        sku_id = data.get('sku_id')
        driver = get_db()
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
            query = "LOAD CSV WITH HEADERS FROM 'file:///fcstorder.csv' AS row WITH row WHERE (trim(row.Item) + '@' + trim(row.Loc)) = $sku_id RETURN $sku_id AS sku_id, row AS full_record ORDER BY toFloat(row.Qty) DESC"
            result = session.run(query, sku_id=sku_id)
            return jsonify([serialize_record(record) for record in result])
    except Exception as e:
        return jsonify({'error': str(e)}), 500