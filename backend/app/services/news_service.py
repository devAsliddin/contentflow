"""Reliable-source news retrieval for AI-generated content.

When the AI Agent is asked to create posts about a topic or "fresh"/"news"
content, the caption must be grounded in real, current information rather than
made up by the LLM. This service pulls recent articles from a curated set of
reputable outlets via their public RSS/Atom feeds (no API key required) and
returns short digests the agent can base captions on — with source attribution.

Design notes:
- Feeds are hardcoded and chosen for reliability/reputation (the operator does
  not have to pick a source; we pick reputable ones). Grouped by topic so an
  "AI" request pulls AI outlets, a "world news" request pulls wire services, etc.
- Parsing uses the stdlib (xml.etree) so we add no new dependency. It handles
  both RSS 2.0 (<item>) and Atom (<entry>).
- Everything is best-effort and time-bounded: a slow or broken feed is skipped,
  never blocking the agent. Callers get whatever succeeded.
"""
from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree as ET

import httpx

logger = logging.getLogger(__name__)

# ── Curated reliable feeds, grouped by topic ────────────────────────────────────
# Each entry: (source display name, feed URL). Only reputable outlets that
# publish stable public RSS/Atom feeds are included.

# AI-specific feeds only (no general-tech feeds — they pull off-topic items).
_AI_FEEDS: list[tuple[str, str]] = [
    ("MIT Technology Review", "https://www.technologyreview.com/topic/artificial-intelligence/feed"),
    ("TechCrunch", "https://techcrunch.com/category/artificial-intelligence/feed/"),
    ("The Verge", "https://www.theverge.com/rss/artificial-intelligence/index.xml"),
    ("VentureBeat", "https://venturebeat.com/category/ai/feed/"),
]

_TECH_FEEDS: list[tuple[str, str]] = [
    ("TechCrunch", "https://techcrunch.com/feed/"),
    ("The Verge", "https://www.theverge.com/rss/index.xml"),
    ("Ars Technica", "https://feeds.arstechnica.com/arstechnica/index"),
    ("Wired", "https://www.wired.com/feed/rss"),
    ("The Guardian — Technology", "https://www.theguardian.com/technology/rss"),
]

# Dedicated cybersecurity outlets — a "kiberxavfsizlik" request used to fall
# through to _TECH_FEEDS' general tech mix, which rarely surfaces security
# news specifically.
_CYBER_FEEDS: list[tuple[str, str]] = [
    ("The Hacker News", "https://feeds.feedburner.com/TheHackersNews"),
    ("BleepingComputer", "https://www.bleepingcomputer.com/feed/"),
    ("Krebs on Security", "https://krebsonsecurity.com/feed/"),
    ("Dark Reading", "https://www.darkreading.com/rss.xml"),
]

_WORLD_FEEDS: list[tuple[str, str]] = [
    ("BBC News", "https://feeds.bbci.co.uk/news/world/rss.xml"),
    ("Al Jazeera", "https://www.aljazeera.com/xml/rss/all.xml"),
    ("The Guardian — World", "https://www.theguardian.com/world/rss"),
    ("NPR", "https://feeds.npr.org/1004/rss.xml"),
]

_BUSINESS_FEEDS: list[tuple[str, str]] = [
    ("BBC Business", "https://feeds.bbci.co.uk/news/business/rss.xml"),
    ("The Guardian — Business", "https://www.theguardian.com/business/rss"),
    ("TechCrunch", "https://techcrunch.com/feed/"),
]

_SCIENCE_FEEDS: list[tuple[str, str]] = [
    ("BBC Science", "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml"),
    ("The Guardian — Science", "https://www.theguardian.com/science/rss"),
    ("Ars Technica", "https://feeds.arstechnica.com/arstechnica/science"),
]

# Uzbekistan — local outlets with stable public RSS (verified 2026-07).
_UZ_FEEDS: list[tuple[str, str]] = [
    ("Kun.uz", "https://kun.uz/uz/news/rss"),
    ("Gazeta.uz", "https://www.gazeta.uz/uz/rss/"),
]

_SPORT_FEEDS: list[tuple[str, str]] = [
    ("BBC Sport", "https://feeds.bbci.co.uk/sport/rss.xml"),
    ("The Guardian — Sport", "https://www.theguardian.com/sport/rss"),
]

# Explicit category → feeds. Used by the /news API where the user picks a
# category directly instead of relying on keyword matching.
CATEGORIES: dict[str, dict] = {
    "uzbekistan": {"label": "O'zbekiston", "feeds": _UZ_FEEDS},
    "world":      {"label": "Dunyo",       "feeds": _WORLD_FEEDS},
    "tech":       {"label": "Texnologiya", "feeds": _TECH_FEEDS},
    "ai":         {"label": "Sun'iy intellekt", "feeds": _AI_FEEDS},
    "cyber":      {"label": "Kiberxavfsizlik", "feeds": _CYBER_FEEDS},
    "business":   {"label": "Biznes",      "feeds": _BUSINESS_FEEDS},
    "science":    {"label": "Fan",         "feeds": _SCIENCE_FEEDS},
    "sport":      {"label": "Sport",       "feeds": _SPORT_FEEDS},
}

# topic keyword → feed group. First matching group wins; otherwise DEFAULT.
_TOPIC_GROUPS: list[tuple[frozenset[str], list[tuple[str, str]]]] = [
    (frozenset({
        "o'zbekiston", "ozbekiston", "uzbekistan", "toshkent", "tashkent",
        "mahalliy", "uzb",
    }), _UZ_FEEDS),
    (frozenset({
        "kiberxavfsizlik", "kiber", "xavfsizlik", "cyber", "cybersecurity",
        "hacker", "hacking", "hack", "malware", "ransomware", "phishing",
        "breach", "vulnerability", "exploit",
    }), _CYBER_FEEDS),
    (frozenset({
        "ai", "sun'iy", "suniy", "intellekt", "intelekt", "chatgpt", "openai",
        "gpt", "llm", "neyron", "neural", "machine learning", "mashina",
        "robot", "claude", "gemini", "grok", "model",
    }), _AI_FEEDS),
    (frozenset({
        "tech", "texnologi", "gadget", "smartfon", "iphone", "android",
        "software", "dastur", "startup", "apple", "google", "microsoft",
    }), _TECH_FEEDS),
    (frozenset({
        "biznes", "business", "iqtisod", "economy", "market", "bozor",
        "moliya", "finance", "invest",
    }), _BUSINESS_FEEDS),
    (frozenset({
        "science", "fan", "ilm", "kosmos", "space", "kashfiyot", "tadqiqot",
        "climate", "iqlim",
    }), _SCIENCE_FEEDS),
    (frozenset({
        "world", "dunyo", "yangilik", "news", "xabar", "siyosat", "politics",
    }), _WORLD_FEEDS),
]

# Fallback when no topic keyword matches: a broad, high-quality mix.
_DEFAULT_FEEDS: list[tuple[str, str]] = _AI_FEEDS[:2] + _TECH_FEEDS[:2] + _WORLD_FEEDS[:1]

_FETCH_TIMEOUT = 8.0  # seconds per feed
_MAX_ITEMS_PER_FEED = 6
_USER_AGENT = "ContentFlow/1.0 (+https://contentflow) news-fetcher"

# Atom namespace (RSS 2.0 needs none).
_ATOM_NS = "{http://www.w3.org/2005/Atom}"


@dataclass
class NewsItem:
    title: str
    summary: str
    source: str
    url: str
    published: datetime | None

    def as_prompt_line(self) -> str:
        date = self.published.strftime("%Y-%m-%d") if self.published else "sana yo'q"
        summary = self.summary[:220].strip()
        return f"- [{self.source}, {date}] {self.title.strip()} — {summary} ({self.url})"


# ── Topic → feeds ───────────────────────────────────────────────────────────────


def _feeds_for_topic(topic: str | None) -> list[tuple[str, str]]:
    if not topic:
        return _DEFAULT_FEEDS
    low = topic.lower()
    for keywords, feeds in _TOPIC_GROUPS:
        if any(kw in low for kw in keywords):
            return feeds
    return _DEFAULT_FEEDS


def _topic_tokens(topic: str | None) -> set[str]:
    """Meaningful words from the topic used to rank/filter items."""
    if not topic:
        return set()
    return {t for t in re.findall(r"[a-z0-9']+", topic.lower()) if len(t) > 3}


# ── Parsing ─────────────────────────────────────────────────────────────────────


def _clean_html(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text or "")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _parse_date(raw: str | None) -> datetime | None:
    if not raw:
        return None
    raw = raw.strip()
    # RFC 822 (RSS <pubDate>)
    try:
        dt = parsedate_to_datetime(raw)
        if dt is not None:
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        pass
    # ISO 8601 (Atom <updated>/<published>)
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _text(el) -> str:
    return (el.text or "").strip() if el is not None else ""


def _parse_feed(source: str, xml: bytes) -> list[NewsItem]:
    try:
        root = ET.fromstring(xml)
    except ET.ParseError as exc:
        logger.debug("news: parse error for %s: %s", source, exc)
        return []

    items: list[NewsItem] = []

    # RSS 2.0: channel/item
    for item in root.iter("item"):
        title = _text(item.find("title"))
        link = _text(item.find("link"))
        desc = _clean_html(_text(item.find("description")))
        pub = _parse_date(_text(item.find("pubDate")))
        if title and link:
            items.append(NewsItem(title, desc, source, link, pub))
        if len(items) >= _MAX_ITEMS_PER_FEED:
            return items

    if items:
        return items

    # Atom: entry
    for entry in root.iter(f"{_ATOM_NS}entry"):
        title = _text(entry.find(f"{_ATOM_NS}title"))
        link_el = entry.find(f"{_ATOM_NS}link")
        link = link_el.get("href") if link_el is not None else ""
        summary = _clean_html(
            _text(entry.find(f"{_ATOM_NS}summary"))
            or _text(entry.find(f"{_ATOM_NS}content"))
        )
        pub = _parse_date(
            _text(entry.find(f"{_ATOM_NS}published"))
            or _text(entry.find(f"{_ATOM_NS}updated"))
        )
        if title and link:
            items.append(NewsItem(title, summary, source, link, pub))
        if len(items) >= _MAX_ITEMS_PER_FEED:
            break

    return items


# ── Fetch ───────────────────────────────────────────────────────────────────────


async def _fetch_one(client: httpx.AsyncClient, source: str, url: str) -> list[NewsItem]:
    try:
        resp = await client.get(url, timeout=_FETCH_TIMEOUT)
        resp.raise_for_status()
        return _parse_feed(source, resp.content)
    except Exception as exc:  # noqa: BLE001
        logger.info("news: feed skipped source=%s url=%s err=%s", source, url, exc)
        return []


def _score(item: NewsItem, tokens: set[str]) -> tuple[int, float]:
    """Rank items: keyword match count first, then recency."""
    hay = f"{item.title} {item.summary}".lower()
    matches = sum(1 for t in tokens if t in hay) if tokens else 0
    ts = item.published.timestamp() if item.published else 0.0
    return (matches, ts)


async def fetch_news(
    topic: str | None = None, limit: int = 5, category: str | None = None
) -> list[NewsItem]:
    """Fetch recent articles from reputable outlets for `topic`.

    `category` (a key of ``CATEGORIES``) picks the feed group explicitly;
    otherwise the group is inferred from topic keywords. Best-effort: returns
    whatever feeds responded in time, ranked by relevance to the topic
    keywords and recency. Never raises.
    """
    if category and category in CATEGORIES:
        feeds = CATEGORIES[category]["feeds"]
    else:
        feeds = _feeds_for_topic(topic)
    tokens = _topic_tokens(topic)

    headers = {"User-Agent": _USER_AGENT, "Accept": "application/rss+xml, application/xml, text/xml, */*"}
    async with httpx.AsyncClient(headers=headers, follow_redirects=True) as client:
        results = await asyncio.gather(
            *(_fetch_one(client, name, url) for name, url in feeds),
            return_exceptions=True,
        )

    items: list[NewsItem] = []
    seen_titles: set[str] = set()
    for res in results:
        if isinstance(res, Exception) or not res:
            continue
        for it in res:
            key = it.title.lower().strip()
            if key in seen_titles:
                continue
            seen_titles.add(key)
            items.append(it)

    # When the topic has keywords, keep only items that match at least one so
    # captions stay on-topic; if that leaves nothing, fall back to recency.
    if tokens:
        matched = [it for it in items if _score(it, tokens)[0] > 0]
        items = matched or items

    items.sort(key=lambda it: _score(it, tokens), reverse=True)
    return items[:limit]


def build_sources_block(items: list[NewsItem]) -> str:
    """Render fetched items as a prompt block the LLM grounds captions on."""
    if not items:
        return ""
    lines = "\n".join(it.as_prompt_line() for it in items)
    return (
        "ISHONCHLI MANBALARDAN OLINGAN SO'NGGI MA'LUMOTLAR (post matni SHU faktlarga "
        "asoslansin, o'zingdan to'qib chiqarma):\n"
        f"{lines}"
    )
