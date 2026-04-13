import argparse
import json
import re
from collections import Counter
from pathlib import Path


DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "data.json"
RELEVANCE_PATH = Path(__file__).resolve().parents[1] / "data" / "relevance.json"

DEFAULT_RELEVANCE_SETTINGS = {
    "web": {
        "titleWeight": 4,
        "urlWeight": 2,
        "contentWeight": 1,
        "coverageBonus": 3,
        "exactTitleBonus": 6,
    }
}


def tokenize(text):
    return re.findall(r"\w+", text.lower())


def load_documents(data_path=DATA_PATH):
    with data_path.open() as file:
        return json.load(file)


def load_relevance_settings(relevance_path=RELEVANCE_PATH):
    settings = json.loads(json.dumps(DEFAULT_RELEVANCE_SETTINGS))

    if not relevance_path.exists():
        return settings

    with relevance_path.open() as file:
        stored = json.load(file)

    for key, default_value in settings["web"].items():
        incoming_value = stored.get("web", {}).get(key)
        if isinstance(incoming_value, (int, float)):
            settings["web"][key] = incoming_value
        else:
            settings["web"][key] = default_value

    return settings


def build_search_state(documents):
    index = {}
    doc_terms = []

    for doc_id, document in enumerate(documents):
        content_terms = tokenize(document.get("content", ""))
        title_terms = tokenize(document.get("title", ""))
        url_terms = tokenize(document.get("url", ""))
        combined_terms = content_terms + title_terms + url_terms

        doc_terms.append(Counter(combined_terms))

        for term in combined_terms:
            index.setdefault(term, set()).add(doc_id)

    return index, doc_terms


def score_document(doc, term_counter, query_terms, relevance_settings):
    title = doc.get("title", "").lower()
    url = doc.get("url", "").lower()
    web_settings = relevance_settings["web"]

    term_frequency_score = (
        sum(term_counter[term] for term in query_terms) * web_settings["contentWeight"]
    )
    coverage_score = sum(1 for term in query_terms if term_counter[term] > 0)
    title_score = sum(title.count(term) for term in query_terms) * web_settings["titleWeight"]
    url_score = sum(url.count(term) for term in query_terms) * web_settings["urlWeight"]
    exact_title_bonus = (
        web_settings["exactTitleBonus"] if " ".join(query_terms) in title else 0
    )

    return (
        title_score
        + url_score
        + exact_title_bonus
        + term_frequency_score
        + (coverage_score * web_settings["coverageBonus"])
    )


def build_snippet(content, query_terms, max_length=150):
    lowered_content = content.lower()

    for term in query_terms:
        position = lowered_content.find(term)
        if position == -1:
            continue

        start = max(position - 40, 0)
        end = min(start + max_length, len(content))
        snippet = content[start:end].strip()

        if start > 0:
            snippet = f"...{snippet}"
        if end < len(content):
            snippet = f"{snippet}..."

        return snippet

    if len(content) <= max_length:
        return content
    return f"{content[:max_length].strip()}..."


def search(query, limit=5, data_path=DATA_PATH, relevance_path=RELEVANCE_PATH):
    normalized_query = query.strip().lower()
    if not normalized_query:
        return []

    query_terms = tokenize(normalized_query)
    if not query_terms:
        return []

    documents = load_documents(data_path)
    relevance_settings = load_relevance_settings(relevance_path)
    index, doc_terms = build_search_state(documents)

    matched_doc_ids = set()
    for term in query_terms:
        matched_doc_ids.update(index.get(term, set()))

    ranked_doc_ids = sorted(
        matched_doc_ids,
        key=lambda doc_id: (
            score_document(
                documents[doc_id],
                doc_terms[doc_id],
                query_terms,
                relevance_settings,
            ),
            sum(doc_terms[doc_id][term] for term in query_terms),
        ),
        reverse=True,
    )

    results = []
    for doc_id in ranked_doc_ids[:limit]:
        document = documents[doc_id]
        results.append(
            {
                "title": document.get("title", ""),
                "url": document.get("url", ""),
                "snippet": build_snippet(document.get("content", ""), query_terms),
                "score": score_document(
                    document,
                    doc_terms[doc_id],
                    query_terms,
                    relevance_settings,
                ),
            }
        )

    return results


def main():
    parser = argparse.ArgumentParser(description="Search indexed documents.")
    parser.add_argument("query", help="Search query to run against the local index.")
    parser.add_argument(
        "--limit",
        type=int,
        default=5,
        help="Maximum number of results to print.",
    )
    args = parser.parse_args()

    results = search(args.query, limit=max(args.limit, 1))

    if not results:
        print("No results found.")
        return

    for index, result in enumerate(results, start=1):
        print(f"{index}. {result['title']}")
        print(f"   URL: {result['url']}")
        print(f"   Score: {result['score']}")
        print(f"   Snippet: {result['snippet']}")


if __name__ == "__main__":
    main()
