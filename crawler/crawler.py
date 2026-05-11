import argparse
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
    "https://developer.mozilla.org/",
    "https://www.nasa.gov/",
    "https://www.si.edu/",
    "https://www.nationalgeographic.com/",
]
MAX_PAGES = 30
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


def extract_images(soup, base_url, page_title):
    discovered = []
    seen = set()

    for image in soup.find_all("img"):
        raw_src = (
            image.get("src")
            or image.get("data-src")
            or image.get("data-original")
            or image.get("data-lazy-src")
        )
        if not raw_src:
            continue

        image_url = normalize_url(urljoin(base_url, raw_src))
        lowered_url = image_url.lower()
        if image_url in seen:
            continue
        if lowered_url.startswith("data:"):
            continue
        if any(token in lowered_url for token in ["sprite", "icon", "favicon", "logo"]):
            continue

        alt_text = image.get("alt") or image.get("title") or page_title
        if not alt_text:
            alt_text = page_title

        seen.add(image_url)
        discovered.append(
            {
                "url": image_url,
                "alt": alt_text.strip(),
                "sourcePage": base_url,
            }
        )

        if len(discovered) >= 16:
            break

    return discovered


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
                "images": extract_images(soup, current_url, title),
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


def parse_args():
    parser = argparse.ArgumentParser(
        description="Crawl a small set of websites into the local search index."
    )
    parser.add_argument(
        "seed_urls",
        nargs="*",
        help="Optional seed URLs to crawl instead of the built-in defaults.",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=MAX_PAGES,
        help=f"Maximum number of pages to crawl. Default: {MAX_PAGES}.",
    )
    parser.add_argument(
        "--max-depth",
        type=int,
        default=1,
        help="How many link levels deep to crawl from each seed. Default: 1.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    seed_urls = args.seed_urls or DEFAULT_SEED_URLS
    pages = crawl(seed_urls, max_pages=args.max_pages, max_depth=args.max_depth)
    save_data(pages)
