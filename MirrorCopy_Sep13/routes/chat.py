from flask import Blueprint, jsonify, request
import os
import re
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
        history = data.get('history', [])
                                                
        system_instruction = (
            "You are a helpful and expert supply chain assistant. Your primary goal is to answer user questions by using the tools provided. "
            "You **must** use Markdown formatting in your responses to improve readability. Use lists, bold text, and tables where appropriate. "
            "Here is a critical example of how to handle a follow-up question:\n"
            "--- EXAMPLE START ---\n"
            "USER: 'what are the broken skus?'\n"
            "AI: (Calls `get_broken_networks_from_db` tool which returns a list of SKUs)\n"
            "AI: 'Here are the top SKUs with broken networks: - 2000-231-476@SAL - 2000-321-901@SAL'\n"
            "USER: 'summarize orders for them'\n"
            "AI: (User said 'them', so I must look at the previous list of SKUs: ['2000-231-476@SAL', '2000-321-901@SAL']. I will now call the `get_order_summary_for_multiple_skus` tool with this list as the `sku_ids` argument.)\n"
            "--- EXAMPLE END ---\n"
            "If the user provides only one SKU, use the `get_order_summary_for_single_sku` tool. "
            "If they refer to multiple SKUs from the context like in the example, you must extract them and use the `get_order_summary_for_multiple_skus` tool. "
            "If asked to draw a network or graph, instruct the user to use the 'BOM Viewer'."
        )

        model = genai.GenerativeModel('gemini-1.5-flash', tools=list(available_tools.values()), system_instruction=system_instruction)
                                                        
        chat = model.start_chat(history=history, enable_automatic_function_calling=True)
        
        response = chat.send_message(user_message)
        return jsonify({'response_type': 'text', 'data': response.text.replace('\\_', '_')})
    except Exception as e:
        return jsonify({'response_type': 'text', 'data': f"An error occurred: {e}"}), 500