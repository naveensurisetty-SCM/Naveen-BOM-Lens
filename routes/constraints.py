# routes/constraints.py
from flask import Blueprint, jsonify, request
import os
from utils.neo4j_handler import get_db

constraints_bp = Blueprint('constraints_bp', __name__)

@constraints_bp.route('/api/constraints/fg-search', methods=['POST'])
def fg_search():
    """
    For a given SKU, gathers all demands, constrained demands, and the constraints themselves.
    Returns a full "Health Report" for the SKU.
    """
    try:
        req_data = request.json
        item = req_data.get('item')
        loc = req_data.get('loc')
        sku_id = f"{item}@{loc}"

        if not item or not loc:
            return jsonify({'error': 'Item and Location are required'}), 400

        driver = get_db()
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
            query = """
            MATCH (s:SKU {sku_id: $sku_id})
            CALL(s) {
                WITH s
                MATCH (s)<-[:IS_FOR_SKU]-(d:Demand)
                RETURN collect(d {.*, broken_bom: s.broken_bom}) AS all_demands, 
                       count(d) AS total_demand_count, 
                       coalesce(sum(d.qty), 0) AS total_demand_qty
            }
            CALL(s) {
                WITH s
                MATCH (s)<-[:IS_FOR_SKU]-(d:Demand)<-[:IMPACTS_DEMAND]-(c:Constraint)
                WITH s, d, collect(properties(c)) as demand_constraints
                WITH s, collect(d {.*, broken_bom: s.broken_bom, constraints: demand_constraints}) AS constrained_demands, 
                     count(d) as constrained_demand_count,
                     coalesce(sum(d.qty), 0) as constrained_demand_qty
                MATCH (s)<-[:IS_FOR_SKU]-(d:Demand)<-[:IMPACTS_DEMAND]-(c:Constraint)
                RETURN constrained_demands, constrained_demand_count, constrained_demand_qty, 
                       collect(DISTINCT properties(c)) as constraints
            }
            RETURN s.sku_id as sku, all_demands, total_demand_count, total_demand_qty, 
                   constrained_demands, constrained_demand_count, constrained_demand_qty, constraints
            """
            result = session.run(query, sku_id=sku_id).single()

            if not result:
                return jsonify({'found': False, 'sku': sku_id})

            total_qty = result['total_demand_qty']
            constrained_qty = result['constrained_demand_qty']
            status = "Healthy"
            if constrained_qty > 0:
                percentage_constrained = constrained_qty / total_qty if total_qty > 0 else 0
                if percentage_constrained >= 0.5:
                    status = "Constrained"
                else:
                    status = "At Risk"
            
            response_data = dict(result)
            response_data['status'] = status
            response_data['found'] = True

            return jsonify(response_data)

    except Exception as e:
        print(f"An error occurred in fg_search: {e}")
        return jsonify({'error': 'Internal server error'}), 500


# ## MODIFICATION START ## - This function has been simplified and corrected
@constraints_bp.route('/api/constraints/resource-time-phase', methods=['GET'])
def get_resource_time_phase_data():
    """
    Fetches all ResWeek node data for a specific constrained resource.
    """
    try:
        res_id_filter = request.args.get('resId')
        if not res_id_filter:
            return jsonify({'error': 'resId query parameter is required'}), 400
            
        driver = get_db()
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
            query = """
            MATCH (r:Res {res_id: $resId})
            MATCH (rw:ResWeek {res_id: $resId})
            RETURN r.res_id AS resId, r.res_descr AS resDescr, collect(properties(rw)) AS weeklyData
            """
            result = session.run(query, resId=res_id_filter)
            
            data = [dict(record) for record in result]
            return jsonify(data)
    except Exception as e:
        print(f"An error occurred in get_resource_time_phase_data: {e}")
        return jsonify({'error': 'Internal server error'}), 500
# ## MODIFICATION END ##

@constraints_bp.route('/api/constraints/demands-for-resource-week', methods=['POST'])
def get_demands_for_resource_week():
    """
    For a given resource and week, finds all demands pegged to it.
    """
    try:
        req_data = request.json
        res_id = req_data.get('resourceId')
        week = req_data.get('week')

        if not res_id or week is None:
            return jsonify({'error': 'resourceId and week are required'}), 400

        driver = get_db()
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
            query = """
            MATCH (d:Demand)-[p:PEGGED_TO_RESOURCE]->(r:Res {res_id: $res_id})
            WHERE p.week = $week
            RETURN properties(d) as demand, p.loadQty as loadQty
            ORDER BY loadQty DESC
            """
            result = session.run(query, res_id=res_id, week=week)
            data = [dict(record) for record in result]
            return jsonify(data)
    except Exception as e:
        print(f"An error occurred in get_demands_for_resource_week: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@constraints_bp.route('/api/constraints/summary', methods=['GET'])
def get_constraints_summary():
    """Provides all summary numbers for the constraints page cards in one call."""
    try:
        driver = get_db()
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
            res_query = """
            MATCH (r:Res)-[:HAS_CONSTRAINT]->(c:Constraint)
            RETURN count(DISTINCT r) AS constrainedResourceCount
            """
            res_result = session.run(res_query).single()
            constrained_res_count = res_result['constrainedResourceCount'] if res_result else 0

            sku_query = "MATCH (s:SKU {bottleneck: true}) RETURN count(s) AS count"
            sku_result = session.run(sku_query).single()
            bottleneck_sku_count = sku_result['count'] if sku_result else 0

            demands_query = """
            MATCH (c:Constraint)-[:IMPACTS_DEMAND]->(d:Demand)
            RETURN count(DISTINCT d) AS orderCount, sum(d.qty) AS totalQty
            """
            demands_result = session.run(demands_query).single()
            
            data = {
                'constrainedResourceCount': constrained_res_count,
                'bottleneckSkusCount': bottleneck_sku_count,
                'impactedDemandsCount': demands_result.get('orderCount') or 0,
                'impactedDemandsQty': demands_result.get('totalQty') or 0
            }
            return jsonify(data)
    except Exception as e:
        print(f"An error occurred in get_constraints_summary: {e}")
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

@constraints_bp.route('/api/constraints/constrained-resources', methods=['GET'])
def get_constrained_resources():
    """Gets resources, their constraints, and the demands impacted by each constraint."""
    try:
        driver = get_db()
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
            query = """
            MATCH (r:Res)-[:HAS_CONSTRAINT]->(c:Constraint)
            OPTIONAL MATCH (c)-[:IMPACTS_DEMAND]->(d:Demand)
            WITH r, c, collect(properties(d)) AS demands, sum(d.qty) as totalDemandQty
            WITH r, collect({constraint: properties(c), demands: demands, totalDemandQty: totalDemandQty}) AS constraintDetails
            RETURN r, constraintDetails
            ORDER BY size(constraintDetails) DESC
            """
            result = session.run(query)
            
            data = []
            for record in result:
                res_properties = dict(record['r'])
                data.append({
                    "properties": res_properties,
                    "constraintDetails": record['constraintDetails']
                })
            return jsonify(data)
    except Exception as e:
        print(f"An error occurred in get_constrained_resources: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@constraints_bp.route('/api/constraints/bottleneck-skus', methods=['GET'])
def get_bottleneck_skus():
    try:
        driver = get_db()
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
            result = session.run("MATCH (s:SKU) WHERE s.bottleneck = true RETURN s LIMIT 10")
            return jsonify([{'id': record['s'].element_id, 'properties': dict(record['s'])} for record in result])
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500