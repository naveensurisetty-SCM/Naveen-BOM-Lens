from .neo4j_handler import get_db, serialize_path
import os

def get_order_summary_for_multiple_skus(sku_ids: list[str]) -> str:
    """
    Calculates an order summary for a GIVEN LIST of SKU IDs. Use this for follow-up questions when multiple SKUs are discussed.
    """
    try:
        if not isinstance(sku_ids, list) or not sku_ids:
            return "Error: A list of SKU IDs must be provided."
        
        processed_sku_ids = []
        for item in sku_ids:
            processed_sku_ids.extend(item.splitlines())
        
        cleaned_sku_ids = [s.strip(" *-•\t") for s in processed_sku_ids if s.strip()]
        
        if not cleaned_sku_ids:
            return "Error: The provided list of SKUs was empty or invalid."

        driver = get_db()
        
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
            query = """
            UNWIND $sku_ids AS skuId
            MATCH (s:SKU {sku_id: skuId})
            RETURN s.sku_id AS sku, s.cust_demand_qty AS cust_qty, s.fcst_demand_qty AS fcst_qty
            """
            result = session.run(query, sku_ids=cleaned_sku_ids)
            records = [dict(record) for record in result]

        if not records:
            return "No order data found for the provided SKUs in the graph."

        # Build Markdown Table String
        header = "| SKU ID | Total Demand | Customer Orders | Forecast Orders |\n"
        separator = "| :--- | :--- | :--- | :--- |\n"
        rows = []
        for record in records:
            cust_qty = record.get("cust_qty") or 0
            fcst_qty = record.get("fcst_qty") or 0
            total_qty = cust_qty + fcst_qty
            row_string = f"| `{record['sku']}` | **{int(total_qty)}** | {int(cust_qty)} | {int(fcst_qty)} |"
            rows.append(row_string)
        
        return header + separator + "\n".join(rows)

    except Exception as e:
        print(f"ERROR in get_order_summary_for_multiple_skus: {e}")
        return f"A database error occurred while fetching order summaries. Please check server logs. Error: {e}"

def get_order_summary_for_single_sku(sku_id: str) -> str:
    """
    Calculates an order summary for a SINGLE SKU ID. Use this when the user provides one specific SKU.
    """
    return get_order_summary_for_multiple_skus([sku_id])

def get_bottleneck_skus_from_db() -> str:
    """Returns a list of bottleneck SKUs from the Neo4j database."""
    try:
        driver = get_db()
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
            result = session.run("MATCH (s:SKU {bottleneck: true}) RETURN s.sku_id AS sku_id LIMIT 10")
            sku_list = [record['sku_id'] for record in result]
            return "Here are the top **bottleneck SKUs**:\n\n* `" + "`\n* `".join(sku_list) + "`" if sku_list else "No bottleneck SKUs were found."
    except Exception as e:
        print(f"ERROR in get_bottleneck_skus_from_db: {e}")
        return f"A database error occurred: {e}"

def get_broken_networks_from_db() -> str:
    """Returns a list of SKUs with broken networks from the Neo4j database."""
    try:
        driver = get_db()
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
            result = session.run("MATCH (s:SKU {broken_bom: true}) RETURN s.sku_id AS sku_id LIMIT 10")
            sku_list = [record['sku_id'] for record in result]
            return "Here are the top SKUs with **broken networks**:\n\n* `" + "`\n* `".join(sku_list) + "`" if sku_list else "No broken networks were found."
    except Exception as e:
        print(f"ERROR in get_broken_networks_from_db: {e}")
        return f"A database error occurred: {e}"

def get_bottleneck_resources_from_db() -> str:
    """Returns a list of bottlenecked resources from the Neo4j database."""
    try:
        driver = get_db()
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
            result = session.run("MATCH (r:Res {bottleneck: true}) RETURN r.res_id AS res_id LIMIT 10")
            res_list = [record['res_id'] for record in result]
            return "Here are the top **bottleneck resources**:\n\n* `" + "`\n* `".join(res_list) + "`" if res_list else "No bottleneck resources were found."
    except Exception as e:
        print(f"ERROR in get_bottleneck_resources_from_db: {e}")
        return f"A database error occurred: {e}"

def get_network_for_sku(sku_id: str) -> list:
    """Gets the full network graph data for a specific SKU ID."""
    try:
        driver = get_db()
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
            cypher_query = "MATCH (s:SKU {sku_id: $sku_id}) CALL(s) { WITH s OPTIONAL MATCH up = (u)-[:SOURCING|PRODUCES|CONSUMED_BY|PURCH_FROM*0..]->(s) RETURN collect(DISTINCT up) AS ups } CALL(s) { WITH s OPTIONAL MATCH down = (s)-[:SOURCING|PRODUCES|CONSUMED_BY|PURCH_FROM*0..]->(d) RETURN collect(DISTINCT down) AS downs } WITH s, [p IN ups WHERE p IS NOT NULL] + [p IN downs WHERE p IS NOT NULL] AS netPaths UNWIND netPaths AS p UNWIND nodes(p) AS n WITH s, collect(DISTINCT p) AS allPaths, collect(DISTINCT n) AS nodesInNet WITH allPaths, [n IN nodesInNet WHERE n:BOM] AS bomNodes UNWIND bomNodes AS bn OPTIONAL MATCH rp = (res:Res)-[:USES_RESOURCE]->(bn) WITH allPaths, collect(DISTINCT rp) AS resPaths WITH [p IN resPaths WHERE p IS NOT NULL] AS resPathsClean, allPaths WITH allPaths + resPathsClean AS combinedPaths UNWIND combinedPaths AS path RETURN path;"
            result = session.run(cypher_query, sku_id=sku_id)
            return [serialize_path(row['path']) for row in result]
    except Exception as e:
        return [{'error': str(e)}]

def get_affected_orders_summary() -> str:
    """Returns a summary of the total count and quantity of affected customer and forecast orders."""
    try:
        driver = get_db()
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
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

            return f"**Affected Orders Summary**:\n* Customer Orders: {cust_orders_count} orders (Total Qty: {int(cust_orders_qty)})\n* Forecast Orders: {fcst_orders_count} orders (Total Qty: {int(fcst_orders_qty)})\n* Grand Total: {total_count} orders (Total Qty: {int(total_qty)})"
    except Exception as e:
        print(f"ERROR in get_affected_orders_summary: {e}")
        return f"A database error occurred: {e}"

def get_affected_customer_orders() -> str:
    """Returns a detailed list of the top 20 affected customer orders from the database."""
    try:
        driver = get_db()
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
            query = "LOAD CSV WITH HEADERS FROM 'file:///custorder.csv' AS row WITH row, trim(row.Item) AS item, trim(row.Loc) AS loc, toFloat(row.Qty) AS qty, trim(row.Item) + '@' + trim(row.Loc) AS sku_id WHERE item <> '' AND loc <> '' MATCH (s:SKU {sku_id: sku_id}) WHERE s.demand_sku = true AND s.broken_bom = true RETURN row.Item as Item, row.Loc as Loc, row.Qty as Qty, row.OrderID as OrderID ORDER BY Qty DESC LIMIT 20"
            result = session.run(query)
            records = list(result)
            if not records: return "No affected customer orders were found."
            header = "| OrderID | Item | Loc | Qty |\n"
            separator = "| :--- | :--- | :--- | :--- |\n"
            rows = [f"| {r['OrderID']} | {r['Item']} | {r['Loc']} | {r['Qty']} |" for r in records]
            return "**Top Affected Customer Orders**:\n" + header + separator + "\n".join(rows)
    except Exception as e:
        print(f"ERROR in get_affected_customer_orders: {e}")
        return f"A database error occurred: {e}"

def get_affected_forecast_orders() -> str:
    """Returns a detailed list of the top 20 affected forecast orders from the database."""
    try:
        driver = get_db()
        with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:
            query = "LOAD CSV WITH HEADERS FROM 'file:///fcstorder.csv' AS row WITH row, trim(row.Item) AS item, trim(row.Loc) AS loc, toFloat(row.Qty) AS qty, trim(row.Item) + '@' + trim(row.Loc) AS sku_id WHERE item <> '' AND loc <> '' MATCH (s:SKU {sku_id: sku_id}) WHERE s.demand_sku = true AND s.broken_bom = true RETURN row.Item as Item, row.Loc as Loc, row.Qty as Qty, row.Date as Date ORDER BY Qty DESC LIMIT 20"
            result = session.run(query)
            records = list(result)
            if not records: return "No affected forecast orders were found."
            header = "| Date | Item | Loc | Qty |\n"
            separator = "| :--- | :--- | :--- | :--- |\n"
            rows = [f"| {r['Date']} | {r['Item']} | {r['Loc']} | {r['Qty']} |" for r in records]
            return "**Top Affected Forecast Orders**:\n" + header + separator + "\n".join(rows)
    except Exception as e:
        print(f"ERROR in get_affected_forecast_orders: {e}")
        return f"A database error occurred: {e}"

available_tools = {
    "get_order_summary_for_single_sku": get_order_summary_for_single_sku,
    "get_order_summary_for_multiple_skus": get_order_summary_for_multiple_skus,
    "get_bottleneck_skus_from_db": get_bottleneck_skus_from_db, 
    "get_broken_networks_from_db": get_broken_networks_from_db, 
    "get_bottleneck_resources_from_db": get_bottleneck_resources_from_db, 
    "get_network_for_sku": get_network_for_sku,
    "get_affected_orders_summary": get_affected_orders_summary,
    "get_affected_customer_orders": get_affected_customer_orders,
    "get_affected_forecast_orders": get_affected_forecast_orders
}