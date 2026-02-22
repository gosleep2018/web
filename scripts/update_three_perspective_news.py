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
    "中国视角": ["http://www.people.com.cn/rss/politics.xml"],
    "美国视角": ["http://rss.cnn.com/rss/edition.rss", "https://feeds.bbci.co.uk/news/world/rss.xml"],
    "半岛视角": ["https://www.aljazeera.com/xml/rss/all.xml"],
}

MAX_ITEMS = 30
MAX_HEADLINES = 18
MAX_EVENTS = 8
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


def build_headlines(sources):
    merged = []
    for src, items in sources.items():
        for it in items[:8]:
            merged.append({"source": src, **it})
    return merged[:MAX_HEADLINES]


def ai_view(event):
    zh = (event.get("中国视角", {}) or {}).get("title_zh", "")
    us = (event.get("美国视角", {}) or {}).get("title_zh", "")
    aj = (event.get("半岛视角", {}) or {}).get("title_zh", "")
    combined = f"{zh} {us} {aj}"
    if any(k in combined for k in ["关税", "贸易", "经济", "通胀", "市场", "股市"]):
        return "我的看法：这类议题短期看政策信号，长期看产业和资本流向；建议重点跟踪后续政策细则，而不是只看标题情绪。"
    if any(k in combined for k in ["冲突", "战争", "袭击", "停火", "导弹", "军事"]):
        return "我的看法：地缘冲突新闻容易情绪化，建议优先看‘是否升级’与‘是否外溢到油价/供应链’两个硬指标。"
    return "我的看法：三方报道框架不同，读者应先提取共同事实，再区分叙事角度与价值判断。"


def summary_view(event):
    return "总结：同一事件在中、美、半岛媒体中关注点不同，联合阅读能减少信息偏差。"


def best_for(base, arr):
    best, bs = None, 0
    for x in arr:
        s = match_score(base["title"], x["title"])
        if s > bs:
            best, bs = x, s
    return best, bs


def build_cross_events(sources):
    cn = sources.get("中国视角", [])
    us = sources.get("美国视角", [])
    aj = sources.get("半岛视角", [])
    events = []

    seeds = [("中国视角", x) for x in cn] + [("美国视角", x) for x in us] + [("半岛视角", x) for x in aj]

    for src, seed in seeds:
        c = seed if src == "中国视角" else None
        u = seed if src == "美国视角" else None
        a = seed if src == "半岛视角" else None

        if c is None:
            c, sc = best_for(seed, cn)
        else:
            sc = 1
        if u is None:
            u, su = best_for(seed, us)
        else:
            su = 1
        if a is None:
            a, sa = best_for(seed, aj)
        else:
            sa = 1

        media_count = (1 if (c and sc > 0) else 0) + (1 if (u and su > 0) else 0) + (1 if (a and sa > 0) else 0)
        if media_count < 2:
            continue

        event_hint = seed
        e = {
            "event_hint": event_hint["title"],
            "event_hint_zh": event_hint.get("title_zh", event_hint["title"]),
            "event_hint_en": event_hint.get("title_en", event_hint["title"]),
            "中国视角": c if (c and sc > 0) else None,
            "美国视角": u if (u and su > 0) else None,
            "半岛视角": a if (a and sa > 0) else None,
            "media_count": media_count,
            "score": sc + su + sa,
        }
        e["my_view"] = ai_view(e)
        e["summary"] = summary_view(e)
        events.append(e)

    # dedup by event_hint zh
    uniq = []
    seen = set()
    for e in sorted(events, key=lambda x: (x["media_count"], x["score"]), reverse=True):
        k = e.get("event_hint_zh", "")[:80]
        if k in seen:
            continue
        seen.add(k)
        uniq.append(e)

    return uniq[:MAX_EVENTS]


def main():
    payload = {
        "generated_at": datetime.now(TZ).strftime("%Y-%m-%d %H:%M:%S %Z"),
        "sources": {},
        "headlines": [],
        "cross_events": [],
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

        payload["sources"][name] = uniq[:MAX_ITEMS]
        if errs and not uniq:
            payload["errors"][name] = " | ".join(errs)

    payload["headlines"] = build_headlines(payload["sources"])
    payload["cross_events"] = build_cross_events(payload["sources"])

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"✅ Updated: {OUT}")


if __name__ == "__main__":
    main()
