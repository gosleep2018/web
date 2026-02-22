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
    
    # 如果有描述，清理HTML标签并存储（不翻译，避免API限制）
    desc = item.get("description", "")
    if desc:
        # 清理HTML标签
        desc_clean = re.sub(r'<[^>]+>', '', desc)
        # 截断过长的描述
        if len(desc_clean) > 500:
            desc_clean = desc_clean[:497] + "..."
        item["description"] = desc_clean
        # 不翻译，直接存储
    
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
        desc = clean_text(item.findtext("description") or item.findtext("content:encoded") or item.findtext("content"))
        if title and link:
            items.append({"title": title, "link": link, "published": pub, "description": desc})

    if not items:
        ns = {"a": "http://www.w3.org/2005/Atom"}
        for entry in root.findall(".//a:entry", ns):
            title = clean_text(entry.findtext("a:title", default="", namespaces=ns))
            link_el = entry.find("a:link", ns)
            link = clean_text(link_el.attrib.get("href", "") if link_el is not None else "")
            pub = clean_text(entry.findtext("a:updated", default="", namespaces=ns))
            desc = clean_text(entry.findtext("a:summary", default="", namespaces=ns) or entry.findtext("a:content", default="", namespaces=ns))
            if title and link:
                items.append({"title": title, "link": link, "published": pub, "description": desc})

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


def extract_key_sentences(text, max_sentences=2):
    """从文本中提取关键句子（简单版：取前两个句子）"""
    if not text:
        return ""
    # 按句子分割（简单分割）
    sentences = re.split(r'[.!?。！？]+', text)
    sentences = [s.strip() for s in sentences if s.strip()]
    return " ".join(sentences[:max_sentences]) + ("..." if len(sentences) > max_sentences else "")


def ai_view(event):
    # 获取三个视角的详细数据
    cn_data = event.get("中国", {}) or {}
    us_data = event.get("美国", {}) or {}
    aj_data = event.get("伊斯兰", {}) or {}
    
    # 获取描述（优先使用description，没有则用标题）
    cn_desc = cn_data.get("description_zh") or cn_data.get("description") or cn_data.get("title_zh", "")
    us_desc = us_data.get("description_zh") or us_data.get("description") or us_data.get("title_zh", "")
    aj_desc = aj_data.get("description_zh") or aj_data.get("description") or aj_data.get("title_zh", "")
    
    # 获取标题用于分类
    cn_title = cn_data.get("title_zh", "") or cn_data.get("title", "")
    us_title = us_data.get("title_zh", "") or us_data.get("title", "")
    aj_title = aj_data.get("title_zh", "") or aj_data.get("title", "")
    combined_titles = f"{cn_title} {us_title} {aj_title}"
    
    # 检查是否有描述内容可用于详细比较（至少一个视角有详细描述）
    has_detailed_descriptions = (len(cn_desc) > 50 or len(us_desc) > 50 or len(aj_desc) > 50)
    
    # 基础分析框架
    base_analysis = ""
    
    # 财经经济类
    if any(k in combined_titles for k in ["关税", "贸易", "经济", "通胀", "市场", "股市", "财政", "利率", "银行", "投资", "货币", "汇率"]):
        base_analysis = (
            "📊 我的深度分析（财经类）：\n\n"
            "1. **事实层验证**：首先需要区分是政策提案、官方声明还是已立法生效。中国媒体通常报道政策框架与宏观目标，"
            "欧美媒体聚焦市场反应与资本流动，半岛视角可能关注对发展中国家贸易的影响。\n\n"
            "2. **预期层解构**：标题情绪常有放大效应。建议同时查看债券收益率（美债10年期）、美元指数（DXY）、"
            "原油价格（Brent）的即时变动，这三项是判断财经新闻真实影响的领先指标。\n\n"
            "3. **执行层跟踪**：最终要看企业财报中的成本变化、产业链调研中的订单数据、以及国际资金流向报告。"
            "单一媒体报道往往缺少这些后续验证环节。\n\n"
            "建议操作：对财经新闻保持48小时观察期，等待市场消化与更多数据披露后再做判断。"
        )
        category = "财经经济"

    # 地缘冲突类
    elif any(k in combined_titles for k in ["冲突", "战争", "袭击", "停火", "导弹", "军事", "边境", "人道", "武器", "防御", "军队", "士兵"]):
        base_analysis = (
            "⚔️ 我的深度分析（地缘冲突类）：\n\n"
            "1. **叙事框架差异**：中国报道强调多边外交与地区稳定框架，常引述官方立场与联合国决议；"
            "欧美报道侧重战略博弈、盟友协调与安全威胁评估；半岛视角聚焦平民伤亡、人道危机与现场纪实。\n\n"
            "2. **事实交叉验证**：建议制作时间线对比表，标注三方都确认的核心事实（时间、地点、伤亡数字、武器类型），"
            "再单独列出各方独有的补充信息或解读角度。\n\n"
            "3. **影响评估矩阵**：短期看航运指数（BDI）、原油期货（WTI/Brent）、黄金价格；"
            "中期看相关国家主权CDS利差、货币汇率波动；长期看区域供应链重构可能。\n\n"
            "警惕点：避免过早接受单一归因叙事，冲突事件往往有复杂的历史脉络与代理战争背景。"
        )
        category = "地缘冲突"

    # 科技太空类
    elif any(k in combined_titles for k in ["NASA", "太空", "宇航", "卫星", "火箭", "航天", "月球", "火星", "探索", "科技", "创新", "人工智能", "AI"]):
        base_analysis = (
            "🚀 我的深度分析（科技太空类）：\n\n"
            "1. **报道角度对比**：中国媒体突出国家科技成就与工程突破，强调自主创新与团队协作；"
            "欧美媒体注重技术细节、商业应用与国际竞争；半岛视角可能关注科技伦理、全球合作与发展中国家参与。\n\n"
            "2. **技术成熟度评估**：区分概念验证、原型测试、正式部署等阶段。太空任务尤其要关注发射窗口、"
            "任务时长、有效载荷成功率等硬指标，而非仅仅宣传口径。\n\n"
            "3. **产业链影响**：航天科技带动新材料、通信、导航、遥感等多个产业链。"
            "建议跟踪相关上市公司表现、专利发布频率、国际合作协议签署情况。\n\n"
            "观察建议：科技新闻需结合专业期刊论文与工程师社群讨论，避免仅依赖大众媒体报道。"
        )
        category = "科技太空"

    # 政治外交类
    elif any(k in combined_titles for k in ["外交", "访问", "会谈", "协议", "条约", "峰会", "联合国", "制裁", "抗议", "选举", "总统", "总理"]):
        base_analysis = (
            "🏛️ 我的深度分析（政治外交类）：\n\n"
            "1. **议程设置分析**：中国报道强调双边关系与务实合作，聚焦具体成果与共识文件；"
            "欧美媒体关注权力动态、战略意图与潜在摩擦点；半岛视角常从全球南方视角分析权力平衡变化。\n\n"
            "2. **信号解读层次**：表层是官方声明与礼仪安排，中层是随行人员级别与议程时长，"
            "深层是后续政策调整与资金流向。外交新闻需要多层次信号交叉验证。\n\n"
            "3. **历史参照系**：当前事件应放在至少10年双边关系脉络中理解，"
            "关注此前类似情境下的各方反应模式与最终结果。\n\n"
            "关键提醒：政治外交报道最易受意识形态滤镜影响，建议同时查阅各方智库简报与学术分析。"
        )
        category = "政治外交"

    # 社会民生类
    elif any(k in combined_titles for k in ["民生", "教育", "医疗", "健康", "住房", "就业", "收入", "消费", "养老", "社保", "福利", "人口"]):
        base_analysis = (
            "🏥 我的深度分析（社会民生类）：\n\n"
            "1. **政策落地差异**：中国报道侧重政策出台与试点效果，强调政府投入与覆盖率提升；"
            "欧美媒体关注个体案例、制度比较与社会公平；半岛视角可能聚焦全球不平等与资源分配。\n\n"
            "2. **数据源对比**：民生议题需要具体数据支持。建议对比官方统计数据、学术调研报告、"
            "国际组织评估与民间调查，注意统计口径与样本代表性的差异。\n\n"
            "3. **长期趋势观察**：社会政策效果往往有3-5年滞后期。关注相关领域的学术论文发表、"
            "NGO评估报告、以及受影响群体的长期追踪研究。\n\n"
            "分析建议：避免仅凭短期媒体报道判断长期社会趋势，民生议题需要耐心与多维数据。"
        )
        category = "社会民生"

    # 默认综合类
    else:
        base_analysis = (
            "🔍 我的深度分析（综合类）：\n\n"
            "1. **信息矩阵构建**：建议创建三方报道对比表格，列出事件核心要素（时间、地点、主体、行动、结果），"
            "再标注各方独有的背景补充、因果解释与价值判断。\n\n"
            "2. **信源可靠性评估**：查验各方引用的原始信源（官方文件、现场影像、专家访谈、数据报告），"
            "注意匿名信源与明确署名的差异，以及信源的时间戳与地理位置。\n\n"
            "3. **认知偏差识别**：警惕确认偏误（只关注支持自己观点的报道）、可得性偏误（过度依赖最易获取的信息）、"
            "框架效应（同一事实不同表述导致不同判断）。\n\n"
            "最终建议：重要事件应等待24-48小时，待更多信息浮现与事实核查完成后再形成稳定判断。"
        )
        category = "综合"
    
    # 如果有详细描述，添加具体内容比较
    if has_detailed_descriptions:
        detailed_comparison = f"\n\n📝 **基于三方报道内容的详细比较（{category}类）**\n\n"
        
        # 中国视角重点
        if cn_desc:
            cn_key = extract_key_sentences(cn_desc)
            detailed_comparison += f"🇨🇳 **中国报道焦点**：{cn_key}\n\n"
        
        # 美国视角重点
        if us_desc:
            us_key = extract_key_sentences(us_desc)
            detailed_comparison += f"🇺🇸 **欧美报道焦点**：{us_key}\n\n"
        
        # 伊斯兰视角重点
        if aj_desc:
            aj_key = extract_key_sentences(aj_desc)
            detailed_comparison += f"🌍 **伊斯兰报道焦点**：{aj_key}\n\n"
        
        # 比较分析
        detailed_comparison += "🔍 **我的内容比较分析**：\n"
        
        # 检查报道角度差异（同时检查中英文关键词）
        angles = []
        cn_lower = cn_desc.lower()
        us_lower = us_desc.lower()
        aj_lower = aj_desc.lower()
        
        if any(k in cn_lower for k in ["发展", "合作", "稳定", "development", "cooperation", "stability", "progress"]):
            angles.append("中国报道强调发展与稳定框架")
        if any(k in us_lower for k in ["市场", "经济", "风险", "market", "economy", "risk", "investment", "financial"]):
            angles.append("欧美报道关注市场与风险评估")
        if any(k in aj_lower for k in ["人道", "平民", "现场", "humanitarian", "civilian", "on the ground", "victim", "crisis"]):
            angles.append("半岛报道聚焦人道与现场细节")
        
        if angles:
            detailed_comparison += "1. **报道角度差异**：" + "；".join(angles) + "。\n"
        else:
            detailed_comparison += "1. **报道角度**：三方均从各自常规框架报道此事。\n"
        
        # 检查事实侧重差异（同时检查中英文关键词）
        facts = []
        if any(word in cn_lower for word in ["政策", "措施", "决定", "宣布", "policy", "measure", "decision", "announce"]):
            facts.append("中国报道侧重政策层面")
        if any(word in us_lower for word in ["影响", "反应", "分析", "预测", "impact", "effect", "analysis", "predict", "response"]):
            facts.append("欧美报道侧重影响分析")
        if any(word in aj_lower for word in ["现场", "伤亡", "危机", "困难", "on site", "casualty", "crisis", "difficulty", "suffering"]):
            facts.append("半岛报道侧重现场情况")
        
        if facts:
            detailed_comparison += "2. **事实侧重**：" + "；".join(facts) + "。\n"
        
        # 建议
        detailed_comparison += "3. **阅读建议**：综合三方内容可获得更完整图景——中国视角提供政策框架，欧美视角提供风险分析，半岛视角提供地面现实。\n"
        
        return base_analysis + detailed_comparison
    else:
        # 没有详细描述，返回基础分析
        return base_analysis


def summary_view(event):
    c = event.get("中国")
    u = event.get("美国")
    i = event.get("伊斯兰")
    
    # 提取关键信息用于个性化总结
    event_title = event.get("event_hint_zh", "") or event.get("event_hint", "")
    categories = []
    if any(k in event_title for k in ["关税", "贸易", "经济", "股市"]):
        categories.append("财经经济")
    if any(k in event_title for k in ["冲突", "战争", "军事"]):
        categories.append("地缘安全")
    if any(k in event_title for k in ["NASA", "太空", "科技"]):
        categories.append("科技创新")
    if any(k in event_title for k in ["外交", "协议", "峰会"]):
        categories.append("政治外交")
    if any(k in event_title for k in ["民生", "教育", "医疗"]):
        categories.append("社会民生")
    
    category_str = "、".join(categories) if categories else "综合"
    
    parts = []
    parts.append(f"🔬 三方视角深度总结（{category_str}类事件）\n\n")
    
    if c:
        parts.append("🇨🇳 **中国视角特征**：通常聚焦政策框架、长期规划、社会稳定与集体成就；报道风格稳重，"
                    "强调制度优势与治理效能；在技术类新闻中突出自主创新，在外交新闻中强调合作共赢。\n\n")
    
    if u:
        parts.append("🇺🇸 **欧美视角特征**：侧重个体权利、制度制衡、市场竞争与战略博弈；报道常采用批判性质疑角度，"
                    "关注权力动态与潜在风险；在财经新闻中强调市场反应，在地缘新闻中分析安全影响。\n\n")
    
    if i:
        parts.append("🌍 **伊斯兰/半岛视角特征**：往往从全球南方与发展中国家立场出发，关注现场细节、"
                    "人道后果与权力不平等；报道风格更具叙事性，强调普通人的经历与情感；"
                    "常为西方主流叙事提供重要的补充与制衡视角。\n\n")
    
    parts.append("📈 **整合分析建议**：\n")
    parts.append("1. 用中国视角理解政策意图与长期框架\n")
    parts.append("2. 用欧美视角评估市场反应与风险变量\n")
    parts.append("3. 用半岛视角感受现场现实与人文维度\n\n")
    
    parts.append("💡 **最终洞察**：真正的信息优势不在于获取更多同类报道，而在于同时掌握不同认知框架，"
                "从而在复杂世界中形成更立体、更抗偏差的判断能力。")
    
    return "".join(parts)


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
