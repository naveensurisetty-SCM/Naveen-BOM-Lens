# routes/news.py
from flask import Blueprint, jsonify, request
import os
import requests
import json
import google.generativeai as genai

news_bp = Blueprint('news_bp', __name__)

NEWS_API_KEY = os.getenv("NEWS_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
NEWS_ANALYSIS_CACHE = {}

def fetch_news_for_category(query, api_key):
    if not api_key:
        print(f"WARNING: NEWS_API_KEY not found. Returning empty list for query: '{query}'")
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
        print(f"Error fetching live news for query '{query}': {e}. Returning empty list.")
        return []

@news_bp.route('/api/supply-chain-news', methods=['GET'])
def get_supply_chain_news():
    categories = {
        "supplier": "supplier OR factory OR manufacturing", "logistics": "logistics OR shipping OR port OR freight",
        "market": "demand OR market OR sales", "geopolitical": "geopolitical OR tariff OR trade OR government",
        "compliance": "compliance OR regulation OR environment"
    }
    news_results = {key: fetch_news_for_category(query, NEWS_API_KEY) for key, query in categories.items()}
    return jsonify(news_results)

@news_bp.route('/api/analyze-article', methods=['POST'])
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