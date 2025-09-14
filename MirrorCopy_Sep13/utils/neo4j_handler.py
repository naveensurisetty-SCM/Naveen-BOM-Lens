# utils/neo4j_handler.py
from neo4j import GraphDatabase
import os

# Neo4j connection details are loaded from environment variables
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

def serialize_record(record):
    return {
        'sku_id': record['sku_id'],
        'properties': {'full_record': dict(record['full_record'])}
    }