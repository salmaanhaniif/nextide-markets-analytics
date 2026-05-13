import os
import json
import feedparser
import google.generativeai as genai
from groq import Groq
from pathlib import Path
from typing import Tuple

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

_HISTORY_PATH = Path(__file__).resolve().parent.parent / "data" / "prediction_history.json"

PROMPT_TEMPLATE = """You are a quantitative crypto sentiment analyst.
Read the following Bitcoin-related news headlines and return a sentiment score.
Score range: -1.0 (extremely bearish) to 1.0 (extremely bullish).
Return ONLY valid JSON with no extra text: {{"score": float, "reasoning": string, "key_topics": list}}

Headlines:
{headlines}"""


def fetch_today_headlines() -> str:
    """Scrape latest headlines from CoinDesk RSS feed (joined string for LLM prompt)."""
    url = "https://www.coindesk.com/arc/outboundfeeds/rss/"
    try:
        feed = feedparser.parse(url)
        headlines = [entry.title for entry in feed.entries[:8]]
        print(f"  Fetched {len(headlines)} headlines.")
        return " | ".join(headlines)
    except Exception as e:
        print(f"  RSS fetch failed: {e}")
        return ""


def fetch_headlines_detailed() -> list:
    """Fetch headlines with title, link, and publish time from CoinDesk RSS."""
    url = "https://www.coindesk.com/arc/outboundfeeds/rss/"
    try:
        feed = feedparser.parse(url)
        results = []
        for entry in feed.entries[:10]:
            published = getattr(entry, "published", None) or getattr(entry, "updated", "")
            results.append({
                "title": entry.title,
                "link": entry.link,
                "published": published,
            })
        return results
    except Exception as e:
        print(f"  RSS detailed fetch failed: {e}")
        return []


def _fallback_from_history() -> Tuple[float, str]:
    """Return 7-day average NLP score from prediction history."""
    try:
        if not _HISTORY_PATH.exists():
            return 0.0, "unavailable"
        with open(_HISTORY_PATH, "r") as f:
            history = json.load(f)
        recent_scores = [
            entry["current"]["nlp_sentiment"]
            for entry in history[-7:]
            if entry.get("current", {}).get("nlp_sentiment") is not None
        ]
        if not recent_scores:
            return 0.0, "unavailable"
        avg = sum(recent_scores) / len(recent_scores)
        return float(avg), "fallback_7d_avg"
    except Exception as e:
        print(f"  History fallback failed: {e}")
        return 0.0, "unavailable"


def _parse_llm_response(text: str) -> float:
    """Extract score float from LLM JSON response."""
    import re
    text = text.strip()
    # Try JSON parse first
    try:
        import json as _json
        data = _json.loads(text)
        return float(data["score"])
    except Exception:
        pass
    # Fallback: regex extract first float
    match = re.search(r"[-+]?\d*\.?\d+", text)
    if match:
        return float(match.group())
    raise ValueError(f"Cannot parse LLM response: {text[:100]}")


def get_live_nlp_sentiment() -> Tuple[float, str]:
    """
    Fetch live NLP sentiment with fallback hierarchy (Priority 2).
    Returns (score, status) where status is:
      "live"           - fresh from Gemini or Groq
      "fallback_7d_avg" - using recent history average
      "unavailable"    - defaulting to 0.0 neutral
    """
    headlines = fetch_today_headlines()

    if not headlines:
        print("  No headlines — using history fallback.")
        return _fallback_from_history()

    prompt = PROMPT_TEMPLATE.format(headlines=headlines)

    # 1. Gemini 2.5 Flash (primary)
    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)
        raw_score = _parse_llm_response(response.text)
        score = float(max(-1.0, min(1.0, raw_score)))
        print(f"  Gemini sentiment: {score:.3f}")
        return score, "live"
    except Exception as e:
        print(f"  Gemini failed: {e}")

    # 2. Groq Llama 3 (secondary)
    try:
        completion = groq_client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
            temperature=0.0,
        )
        raw_score = _parse_llm_response(completion.choices[0].message.content)
        score = float(max(-1.0, min(1.0, raw_score)))
        print(f"  Groq sentiment: {score:.3f}")
        return score, "live"
    except Exception as e:
        print(f"  Groq failed: {e}")

    # 3. 7-day history average
    score, status = _fallback_from_history()
    print(f"  NLP fallback ({status}): {score:.3f}")
    return score, status
