# Naveen BOM Lens
---

## 📢 Notice
This project is shared publicly for demonstration purposes only.  
All rights reserved. No part of the code may be copied, reused, or redistributed without explicit permission from the author.

A simple BOM viewer built with:
- **Backend**: Python Flask
- **Frontend**: HTML + JavaScript
- **Database**: Neo4j
- **Assets**: Images used for rendering

## Project Structure

app.py # Flask backend
index.html # Frontend page
main.js # Frontend logic
images/ # Folder with static images


## How to Run
1. Install Python 3.10+  
2. (Optional) Create a virtual environment  
   ```bash
   python -m venv .venv
   .venv\Scripts\activate
3. Install required packages
	pip install Flask neo4j
4. Ensure Neo4j Database is running (locally or remotely)
5. Start the Flask server
	python app.py
6. Open the app in your browser
	http://localhost:5000
7. Create .env file in the format provided in .env.example file
