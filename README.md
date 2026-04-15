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

1. **Crawl pages** (optional):
```bash
cd crawler
python3 crawler.py
