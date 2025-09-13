from flask import Blueprint, jsonify, request
import os
from utils.neo4j_handler import get_db

constraints_bp = Blueprint('constraints_bp', __name__)

# ## MODIFICATION START ##
@constraints_bp.route('/api/constraints/impacted-demands/summary', methods=['GET'])
def get_impacted_demands_summary():
    try:
        driver = get_db()
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
            query = """
            MATCH (c:Constraint)-[:IMPACTS_DEMAND]->(d:Demand)
            RETURN count(DISTINCT d) AS orderCount, sum(d.qty) AS totalQty
            """
            result = session.run(query).single()
            
            data = {
                'orderCount': result.get('orderCount') or 0,
                'totalQty': result.get('totalQty') or 0
            }
            return jsonify(data)
    except Exception as e:
        print(f"An error occurred in get_impacted_demands_summary: {e}")
        return jsonify({'error': 'Internal server error'}), 500
# ## MODIFICATION END ##


@constraints_bp.route('/api/constraints/impacted-demands', methods=['GET'])
def get_impacted_demands():
    try:
        driver = get_db()
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
            query = """
            MATCH (c:Constraint)-[:IMPACTS_DEMAND]->(d:Demand)
            WITH d, collect(properties(c)) AS constraints
            RETURN properties(d) AS demand, constraints
            ORDER BY d.date
            """
            result = session.run(query)
            
            data = [dict(record) for record in result]
            return jsonify(data)

    except Exception as e:
        print(f"An error occurred in get_impacted_demands: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@constraints_bp.route('/api/constraints/order-search', methods=['POST'])
def search_order_constraints():
    try:
        data = request.json
        order_id = data.get('orderId')
        if not order_id:
            return jsonify({'error': 'orderId is required'}), 400

        driver = get_db()
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
            query = """
            MATCH (d:Demand)
            WHERE d.orderId = $order_id OR d.seqnum = $order_id
            OPTIONAL MATCH (d)<-[:IMPACTS_DEMAND]-(c:Constraint)
            RETURN d, collect(c) AS constraints
            LIMIT 1
            """
            result = session.run(query, order_id=order_id).single()

            if not result:
                return jsonify({'orderDetails': None, 'constraints': []})

            order_details = dict(result['d'])
            constraints = [dict(node) for node in result['constraints'] if node is not None]

            return jsonify({'orderDetails': order_details, 'constraints': constraints})

    except Exception as e:
        print(f"An error occurred in search_order_constraints: {e}")
        return jsonify({'error': 'Internal server error'}), 500