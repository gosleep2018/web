#!/usr/bin/env python3
import json
import re
import ssl
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from zoneinfo import ZoneInfo
from pathlib import Path

TZ = ZoneInfo("Asia/Singapore")
OUT = Path("/Users/lin/.openclaw/workspace/web_pages/hotnews/data/news.json")

SOURCES = {
    "中国视角": "https://www.globaltimes.cn/rss/outbrain.xml",
    "美国视角": "https://rss.nytimes.com/services/xml/rss/nyt/US.xml",
    "半岛视角": "https://www.aljazeera.com/xml/rss/all.xml",
}

MAX_ITEMS = 20
MAX_COMPARE = 10

STOPWORDS = {
    "the","a","an","to","of","for","in","on","at","and","or","with","from","is","are",
    "china","chinese","us","u.s","america","american","al","jazeera","says","new","after","over",
    "global","world","news","s"}


def clean_text(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()


def translate_text(text: str, target: str = "zh-CN"):
    """Use public Google translate endpoint (unofficial, no key) with graceful fallback."""
    if not text:
        return ""
    try:
        q = urllib.parse.quote(text)
        u = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl={target}&dt=t&q={q}"
        req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=12) as r:
            data = json.loads(r.read().decode("utf-8", errors="ignore"))
        # data[0] is sentence chunks
        return "".join(part[0] for part in data[0] if part and part[0]).strip() or text
    except Exception:
        return text


def enrich_bilingual(item: dict):
    title = item.get("title", "")
    item["title_en"] = translate_text(title, "en")
    item["title_zh"] = translate_text(title, "zh-CN")
    return item


def fetch_rss(url: str):
    ctx = ssl.create_default_context()
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 OpenClawNewsBot"})
    with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
        data = r.read()

    root = ET.fromstring(data)
    items = []

    for item in root.findall(".//channel/item"):
        title = clean_text(item.findtext("title"))
        link = clean_text(item.findtext("link"))
        pub = clean_text(item.findtext("pubDate"))
        if title and link:
            items.append({"title": title, "link": link, "published": pub})

    if not items:
        ns = {"a": "http://www.w3.org/2005/Atom"}
        for entry in root.findall(".//a:entry", ns):
            title = clean_text(entry.findtext("a:title", default="", namespaces=ns))
            link_el = entry.find("a:link", ns)
            link = clean_text(link_el.attrib.get("href", "") if link_el is not None else "")
            pub = clean_text(entry.findtext("a:updated", default="", namespaces=ns))
            if title and link:
                items.append({"title": title, "link": link, "published": pub})

    dedup, seen = [], set()
    for it in items:
        key = (it.get("title", ""), it.get("link", ""))
        if key in seen:
            continue
        seen.add(key)
        dedup.append(it)

    return [enrich_bilingual(x) for x in dedup[:MAX_ITEMS]]


def tokenize(title: str):
    words = re.findall(r"[A-Za-z]{3,}", title.lower())
    return {w for w in words if w not in STOPWORDS}


def best_match(base, candidates):
    bt = tokenize(base["title"])
    best, best_score = None, 0
    for c in candidates:
        ct = tokenize(c["title"])
        if not bt or not ct:
            continue
        score = len(bt & ct)
        if score > best_score:
            best, best_score = c, score
    return best, best_score


def build_comparisons(china, us, alj):
    comps = []
    for c in china:
        um, us_score = best_match(c, us)
        am, aj_score = best_match(c, alj)
        confidence = us_score + aj_score
        if confidence <= 0:
            continue
        comps.append({
            "event_hint": c["title"],
            "中国视角": c,
            "美国视角": um,
            "半岛视角": am,
            "score": confidence,
        })
    comps.sort(key=lambda x: x["score"], reverse=True)
    return comps[:MAX_COMPARE]


def main():
    payload = {
        "generated_at": datetime.now(TZ).strftime("%Y-%m-%d %H:%M:%S %Z"),
        "sources": {},
        "comparisons": [],
        "errors": {},
    }

    for name, url in SOURCES.items():
        try:
            payload["sources"][name] = fetch_rss(url)
        except Exception as e:
            payload["sources"][name] = []
            payload["errors"][name] = str(e)

    payload["comparisons"] = build_comparisons(
        payload["sources"].get("中国视角", []),
        payload["sources"].get("美国视角", []),
        payload["sources"].get("半岛视角", []),
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"✅ Updated: {OUT}")


if __name__ == "__main__":
    main()
