import json
import re
from collections import deque
from pathlib import Path
from urllib.parse import urldefrag, urljoin, urlparse

import requests
from bs4 import BeautifulSoup

DEFAULT_SEED_URLS = [
    "https://www.python.org/",
    "https://react.dev/",
]
MAX_PAGES = 12
MAX_LINKS_PER_PAGE = 8
REQUEST_TIMEOUT = 10
MIN_CONTENT_LENGTH = 80
USER_AGENT = "mini-search-engine-bot/1.0"

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = PROJECT_ROOT / "data" / "data.json"


def normalize_url(url):
    cleaned_url, _fragment = urldefrag(url)
    return cleaned_url.rstrip("/")


def is_html_page(response):
    content_type = response.headers.get("Content-Type", "").lower()
    return "text/html" in content_type


def extract_page_text(soup):
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    text = soup.get_text(separator=" ", strip=True)
    text = re.sub(r"\s+", " ", text)
    return text


def should_visit(url, allowed_domains):
    parsed = urlparse(url)
    return (
        parsed.scheme in {"http", "https"}
        and parsed.netloc in allowed_domains
    )


def crawl(seed_urls, max_pages=MAX_PAGES, max_depth=1):
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    normalized_seeds = [normalize_url(url) for url in seed_urls]
    allowed_domains = {urlparse(url).netloc for url in normalized_seeds}
    queue = deque((url, 0) for url in normalized_seeds)
    visited = set()
    crawled_pages = []

    while queue and len(crawled_pages) < max_pages:
        current_url, depth = queue.popleft()
        if current_url in visited or depth > max_depth:
            continue

        visited.add(current_url)

        try:
            response = session.get(current_url, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
        except requests.RequestException as exc:
            print(f"Skipping {current_url}: {exc}")
            continue

        if not is_html_page(response):
            continue

        soup = BeautifulSoup(response.text, "html.parser")
        title = soup.title.string.strip() if soup.title and soup.title.string else current_url
        content = extract_page_text(soup)

        if len(content) < MIN_CONTENT_LENGTH:
            continue

        crawled_pages.append(
            {
                "url": current_url,
                "title": title,
                "content": content,
            }
        )
        print(f"Crawled ({len(crawled_pages)}/{max_pages}): {current_url}")

        if depth == max_depth:
            continue

        links_seen = 0
        for link in soup.find_all("a", href=True):
            absolute_url = normalize_url(urljoin(current_url, link["href"]))
            if not should_visit(absolute_url, allowed_domains):
                continue
            if absolute_url in visited:
                continue

            queue.append((absolute_url, depth + 1))
            links_seen += 1
            if links_seen >= MAX_LINKS_PER_PAGE:
                break

    return crawled_pages


def save_data(pages):
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    with DATA_PATH.open("w") as file:
        json.dump(pages, file, indent=2)
    print(f"Saved {len(pages)} pages to {DATA_PATH}")


if __name__ == "__main__":
    pages = crawl(DEFAULT_SEED_URLS, max_pages=MAX_PAGES, max_depth=1)
    save_data(pages)
