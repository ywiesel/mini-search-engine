# mini-search-engine

# Mini Search Engine

This project implements a simplified search engine capable of:

- Indexing documents
- Ranking results
- Retrieving relevant pages

## Features

- Inverted index
- TF-IDF ranking
- Search API (Flask)
- Simple React web interface

## Tech Stack

- Python
- Flask
- React
- HTML/CSS

## Project Structure

- `data/` - stores documents collected by crawler  
- `indexer/` - contains indexing logic (`indexer.py`)  
- `search/` - search and ranking logic (`search.py`)  
- `api/` - Flask backend (`app.py`)  
- `frontend/` - React UI  
- `crawler/` - bot to fetch webpages (`crawler.py`)  

## How to Run

1. **Install backend dependencies**:
```bash
cd /Users/olivetree/mini-search-engine-4
pip3 install flask requests beautifulsoup4
```

2. **Crawl pages** (optional):
```bash
cd /Users/olivetree/mini-search-engine-4
python3 crawler/crawler.py
```

You can crawl different topics/sites by passing your own seed URLs:
```bash
python3 crawler/crawler.py https://developer.mozilla.org https://www.nasa.gov https://www.si.edu
```

You can also expand the crawl size:
```bash
python3 crawler/crawler.py --max-pages 60 --max-depth 1 https://www.nasa.gov https://www.nationalgeographic.com
```

3. **Start the API** in one terminal:
```bash
python3 api/app.py
```
The Flask API runs at `http://127.0.0.1:5050`.

4. **Start the frontend** in a second terminal:
```bash
cd frontend
npm install
npm start
```
The React app runs at `http://localhost:3000` and connects to the API at `http://127.0.0.1:5050`.
