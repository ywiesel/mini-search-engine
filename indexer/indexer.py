import json
import re

def build_index():
    with open("data.json") as f:
        docs = json.load(f)

    index = {}

    for i, doc in enumerate(docs):
        words = re.findall(r'\w+', doc["content"].lower())

        for word in words:
            if word not in index:
                index[word] = set()
            index[word].add(i)

    return index, docs
