from flask import Flask, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables from .env file first
load_dotenv()

# Import blueprints from their new files
from routes.news import news_bp
from routes.dashboard import dashboard_bp
from routes.bom_viewer import bom_viewer_bp
from routes.chat import chat_bp
# ## MODIFICATION START ##
from routes.constraints import constraints_bp
# ## MODIFICATION END ##

app = Flask(__name__)
CORS(app)

# Register each blueprint with the main app
app.register_blueprint(news_bp)
app.register_blueprint(dashboard_bp)
app.register_blueprint(bom_viewer_bp)
app.register_blueprint(chat_bp)
# ## MODIFICATION START ##
app.register_blueprint(constraints_bp)
# ## MODIFICATION END ##

# --- Static File Serving ---
@app.route('/')
def serve_index():
    """Serves the index.html file for the root URL."""
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static_files(path):
    """Serves static files like JS, CSS, and images."""
    return send_from_directory('.', path)

if __name__ == '__main__':
    app.run(debug=True, port=5000)