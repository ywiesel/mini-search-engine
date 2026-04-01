from flask import Flask, request, jsonify
import json, re

app = Flask(__name__)

# Load documents
with open("data.json") as f:
    docs = json.load(f)

# Simple inverted index
index = {}
for i, doc in enumerate(docs):
    words = re.findall(r'\w+', doc["content"].lower())
    for word in words:
        index.setdefault(word, set()).add(i)

@app.route("/search")
def search():
    query = request.args.get("q", "").lower()
    if not query:
        return jsonify({"results": []})
    
    results = index.get(query, set())
    output = []
    for doc_id in results:
        doc = docs[doc_id]
        output.append({
            "title": doc["title"],
            "snippet": doc["content"][:150],
            "url": doc["url"]
        })
    return jsonify({"results": output})

if __name__ == "__main__":
    app.run(debug=True)
