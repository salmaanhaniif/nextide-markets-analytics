"""
Daily news fetch — runs via GitHub Actions cron.
Fetches latest Bitcoin news from RSS feeds and saves to data/news.json.
"""
import json
import feedparser
from datetime import datetime, timezone
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parent / "data"
NEWS_FILE = DATA_PATH / "news.json"

RSS_SOURCES = [
    "https://cointelegraph.com/rss",
    "https://www.coindesk.com/arc/outboundfeeds/rss/",
    "https://bitcoinmagazine.com/feed",
]


def fetch_news(limit: int = 8) -> list[dict]:
    """Fetch latest headlines from multiple RSS sources."""
    headlines = []
    for url in RSS_SOURCES:
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:5]:
                headlines.append({
                    "title":     entry.get("title", "").strip(),
                    "link":      entry.get("link", ""),
                    "published": entry.get("published", entry.get("updated", "")),
                })
        except Exception as e:
            print(f"  Warning: Failed to fetch {url}: {e}")
            continue

    return headlines[:limit]


def main():
    print("=" * 60)
    print("NexTide Analytics — Daily News Fetch")
    print(f"UTC: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    print("\nFetching news from RSS feeds...")
    headlines = fetch_news(limit=12)

    if not headlines:
        print("  [!] No headlines fetched (all sources failed)")
        headlines = []
    else:
        print(f"  [OK] Fetched {len(headlines)} headlines")

    # Save to JSON
    DATA_PATH.mkdir(exist_ok=True)
    with open(NEWS_FILE, "w", encoding="utf-8") as f:
        json.dump(headlines, f, indent=2)

    print(f"  [OK] Saved to {NEWS_FILE.relative_to(Path.cwd())}")
    print(f"\nLatest 3 headlines:")
    for i, h in enumerate(headlines[:3], 1):
        print(f"  {i}. {h['title'][:70]}")
    print("\nDone.")


if __name__ == "__main__":
    main()
