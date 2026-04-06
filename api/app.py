import json
import os
import re
from collections import Counter
from pathlib import Path

from flask import Flask, request, jsonify

app = Flask(__name__)

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "data.json"

# Load documents
with DATA_PATH.open() as f:
    docs = json.load(f)

# Simple inverted index
index = {}
doc_terms = []
suggestion_terms = set()

for i, doc in enumerate(docs):
    words = re.findall(r'\w+', doc["content"].lower())
    title_words = re.findall(r"\w+", doc["title"].lower())
    url_words = re.findall(r"\w+", doc["url"].lower())
    doc_terms.append(Counter(words))
    suggestion_terms.update(words)
    suggestion_terms.update(title_words)
    suggestion_terms.update(url_words)
    for word in words + title_words:
        index.setdefault(word, set()).add(i)

sorted_suggestion_terms = sorted(
    term for term in suggestion_terms if len(term) > 1
)


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    return response


def build_snippet(content, query_terms, max_length=150):
    lowered_content = content.lower()

    for term in query_terms:
        position = lowered_content.find(term)
        if position != -1:
            start = max(position - 40, 0)
            end = min(start + max_length, len(content))
            snippet = content[start:end].strip()
            if start > 0:
                snippet = f"...{snippet}"
            if end < len(content):
                snippet = f"{snippet}..."
            return snippet

    return f"{content[:max_length].strip()}..." if len(content) > max_length else content


def tokenize_query(text):
    return re.findall(r"\w+", text.lower())


def build_suggestions(query, limit=6):
    stripped_query = query.strip().lower()
    if len(stripped_query) < 2:
        return []

    query_parts = stripped_query.split()
    active_fragment = query_parts[-1]
    leading_terms = query_parts[:-1]
    suggestions = []
    seen = set()

    title_matches = [
        doc["title"]
        for doc in docs
        if doc["title"].lower().startswith(stripped_query)
    ]

    for suggestion in title_matches:
        if suggestion not in seen:
            suggestions.append(suggestion)
            seen.add(suggestion)
        if len(suggestions) >= limit:
            return suggestions

    for term in sorted_suggestion_terms:
        if not term.startswith(active_fragment):
            continue
        full_suggestion = " ".join(leading_terms + [term]).strip()
        if full_suggestion not in seen:
            suggestions.append(full_suggestion)
            seen.add(full_suggestion)
        if len(suggestions) >= limit:
            break

    return suggestions

@app.route("/search")
def search():
    query = request.args.get("q", "").lower()
    if not query:
        return jsonify({"results": []})

    query_terms = tokenize_query(query)
    if not query_terms:
        return jsonify({"results": []})

    matched_doc_ids = set()
    for term in query_terms:
        matched_doc_ids.update(index.get(term, set()))

    ranked_doc_ids = sorted(
        matched_doc_ids,
        key=lambda doc_id: (
            sum(doc_terms[doc_id][term] for term in query_terms),
            sum(1 for term in query_terms if doc_terms[doc_id][term] > 0),
        ),
        reverse=True,
    )

    output = []
    for doc_id in ranked_doc_ids:
        doc = docs[doc_id]
        output.append({
            "title": doc["title"],
            "snippet": build_snippet(doc["content"], query_terms),
            "url": doc["url"],
        })
    return jsonify({"results": output})


@app.route("/suggest")
def suggest():
    query = request.args.get("q", "")
    return jsonify({"suggestions": build_suggestions(query)})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    app.run(host="127.0.0.1", port=port, debug=True)
