import requests
from bs4 import BeautifulSoup
import json

visited = set()
data = []

def crawl(url, depth=0, max_depth=1):
    if depth > max_depth or url in visited:
        return
    
    try:
        visited.add(url)
        res = requests.get(url)
        soup = BeautifulSoup(res.text, "html.parser")

        title = soup.title.string if soup.title else "No Title"
        text = soup.get_text()

        data.append({
            "url": url,
            "title": title,
            "content": text
        })

        # follow links (limited)
        for link in soup.find_all("a", href=True)[:5]:
            crawl(link["href"], depth+1, max_depth)

    except:
        pass

# START HERE
crawl("https://example.com")

with open("data.json", "w") as f:
    json.dump(data, f, indent=2)
