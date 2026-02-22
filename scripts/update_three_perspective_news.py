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
    "中国": ["http://www.people.com.cn/rss/politics.xml"],
    "美国（欧美媒体）": [
        "http://rss.cnn.com/rss/edition.rss",
        "https://feeds.bbci.co.uk/news/world/rss.xml"
    ],
    "伊斯兰（半岛等）": ["https://www.aljazeera.com/xml/rss/all.xml"],
}

MAX_ITEMS = 30
MAX_CARD_ITEMS = 16
MAX_TRIANGLE = 10
STOPWORDS = {
    "the","a","an","to","of","for","in","on","at","and","or","with","from","is","are",
    "china","chinese","us","u.s","america","american","al","jazeera","says","new","after","over",
    "global","world","news","update","live"
}


def clean_text(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()


def translate_text(text: str, target: str = "zh-CN"):
    if not text:
        return ""
    try:
        q = urllib.parse.quote(text)
        u = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl={target}&dt=t&q={q}"
        req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=12) as r:
            data = json.loads(r.read().decode("utf-8", errors="ignore"))
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

    seen, dedup = set(), []
    for it in items:
        key = (it.get("title", ""), it.get("link", ""))
        if key in seen:
            continue
        seen.add(key)
        dedup.append(enrich_bilingual(it))

    return dedup[:MAX_ITEMS]


def tokenize(title: str):
    words = re.findall(r"[A-Za-z]{3,}", title.lower())
    return {w for w in words if w not in STOPWORDS}


def match_score(a: str, b: str):
    ta, tb = tokenize(a), tokenize(b)
    if not ta or not tb:
        return 0
    return len(ta & tb)


def best_for(base, arr):
    best, bs = None, 0
    for x in arr:
        s = match_score(base["title"], x["title"])
        if s > bs:
            best, bs = x, s
    return best, bs


def ai_view(event):
    zh = (event.get("中国", {}) or {}).get("title_zh", "")
    us = (event.get("美国", {}) or {}).get("title_zh", "")
    aj = (event.get("伊斯兰", {}) or {}).get("title_zh", "")
    combined = f"{zh} {us} {aj}"
    if any(k in combined for k in ["关税", "贸易", "经济", "通胀", "市场", "股市"]):
        return "我的看法：先看政策落地细则，再看市场反应，避免仅凭标题情绪做判断。"
    if any(k in combined for k in ["冲突", "战争", "袭击", "停火", "导弹", "军事"]):
        return "我的看法：地缘新闻重点看‘是否升级’与‘是否外溢到油价/供应链’。"
    return "我的看法：三方报道框架不同，建议先提取共识事实，再区分叙事立场。"


def summary_view(_event):
    return "总结：同一事件在中、美、伊斯兰媒体的关注重点不同，联合阅读有助于减少偏差。"


def build_triangle(sources):
    cn = sources.get("中国", [])
    us = sources.get("美国（欧美媒体）", [])
    aj = sources.get("伊斯兰（半岛等）", [])

    events = []
    seeds = [("中国", x) for x in cn] + [("美国", x) for x in us] + [("伊斯兰", x) for x in aj]

    for src, seed in seeds:
        c = seed if src == "中国" else None
        u = seed if src == "美国" else None
        a = seed if src == "伊斯兰" else None

        sc = 1 if c else 0
        su = 1 if u else 0
        sa = 1 if a else 0

        if c is None:
            c, sc = best_for(seed, cn)
        if u is None:
            u, su = best_for(seed, us)
        if a is None:
            a, sa = best_for(seed, aj)

        media_count = (1 if (c and sc > 0) else 0) + (1 if (u and su > 0) else 0) + (1 if (a and sa > 0) else 0)
        if media_count < 2:
            continue

        e = {
            "event_hint": seed["title"],
            "event_hint_zh": seed.get("title_zh", seed["title"]),
            "event_hint_en": seed.get("title_en", seed["title"]),
            "中国": c if (c and sc > 0) else None,
            "美国": u if (u and su > 0) else None,
            "伊斯兰": a if (a and sa > 0) else None,
            "media_count": media_count,
            "score": sc + su + sa,
        }
        e["my_view"] = ai_view(e)
        e["summary"] = summary_view(e)
        events.append(e)

    uniq, seen = [], set()
    for e in sorted(events, key=lambda x: (x["media_count"], x["score"]), reverse=True):
        k = e.get("event_hint_zh", "")[:90]
        if k in seen:
            continue
        seen.add(k)
        uniq.append(e)

    return uniq[:MAX_TRIANGLE]


def main():
    payload = {
        "generated_at": datetime.now(TZ).strftime("%Y-%m-%d %H:%M:%S %Z"),
        "sources": {},
        "triangle": [],
        "errors": {},
    }

    for name, urls in SOURCES.items():
        merged, errs = [], []
        for url in urls:
            try:
                merged.extend(fetch_rss(url))
            except Exception as e:
                errs.append(f"{url}: {e}")

        seen, uniq = set(), []
        for it in merged:
            key = (it.get("title", ""), it.get("link", ""))
            if key in seen:
                continue
            seen.add(key)
            uniq.append(it)

        payload["sources"][name] = uniq[:MAX_CARD_ITEMS]
        if errs and not uniq:
            payload["errors"][name] = " | ".join(errs)

    payload["triangle"] = build_triangle(payload["sources"])

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"✅ Updated: {OUT}")


if __name__ == "__main__":
    main()
