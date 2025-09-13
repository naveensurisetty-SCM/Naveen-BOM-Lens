# routes/constraints.py
from flask import Blueprint, jsonify, request
import os
from utils.neo4j_handler import get_db

constraints_bp = Blueprint('constraints_bp', __name__)

@constraints_bp.route('/api/constraints/summary', methods=['GET'])
def get_constraints_summary():
    """Provides summary numbers specifically for the constraints page."""
    try:
        driver = get_db()
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
            # New logic: Count distinct resources connected to a Constraint node
            res_query = """
            MATCH (r:Res)-[:HAS_CONSTRAINT]->(c:Constraint)
            RETURN count(DISTINCT r) AS constrainedResourceCount
            """
            res_result = session.run(res_query).single()
            constrained_res_count = res_result['constrainedResourceCount'] if res_result else 0

            # Existing logic for SKU bottlenecks (unchanged for now)
            sku_query = "MATCH (s:SKU {bottleneck: true}) RETURN count(s) AS count"
            sku_result = session.run(sku_query).single()
            bottleneck_sku_count = sku_result['count'] if sku_result else 0

            data = {
                'constrainedResourceCount': constrained_res_count,
                'bottleneckSkusCount': bottleneck_sku_count
            }
            return jsonify(data)
    except Exception as e:
        print(f"An error occurred in get_constraints_summary: {e}")
        return jsonify({'error': 'Internal server error'}), 500


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

# ## MODIFICATION START ## - Data structure reverted to match manual formatter expectation
@constraints_bp.route('/api/constraints/constrained-resources', methods=['GET'])
def get_constrained_resources():
    """Gets resources linked to constraints and the details of those constraints."""
    try:
        driver = get_db()
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
            query = """
            MATCH (r:Res)-[:HAS_CONSTRAINT]->(c:Constraint)
            WITH r, collect(c) AS constraints
            RETURN r, constraints
            ORDER BY size(constraints) DESC
            """
            result = session.run(query)
            
            data = []
            for record in result:
                res_properties = dict(record['r'])
                constraint_list = [dict(constraint) for constraint in record['constraints']]
                data.append({
                    "properties": res_properties,
                    "constraints": constraint_list
                })
            return jsonify(data)
    except Exception as e:
        print(f"An error occurred in get_constrained_resources: {e}")
        return jsonify({'error': 'Internal server error'}), 500
# ## MODIFICATION END ##


@constraints_bp.route('/api/constraints/bottleneck-skus', methods=['GET'])
def get_bottleneck_skus():
    try:
        driver = get_db()
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
            result = session.run("MATCH (s:SKU) WHERE s.bottleneck = true RETURN s LIMIT 10")
            return jsonify([{'id': record['s'].element_id, 'properties': dict(record['s'])} for record in result])
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500