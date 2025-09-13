# routes/chat.py
from flask import Blueprint, jsonify, request
import os
import google.generativeai as genai
from utils.llm_tools import available_tools

chat_bp = Blueprint('chat_bp', __name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

@chat_bp.route('/api/chat', methods=['POST', 'OPTIONS'])
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