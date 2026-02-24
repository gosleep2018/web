#!/usr/bin/env python3
"""
全面补位：缺哪补哪（自动多策略重扫）
- 基于已采集Excel，自动重扫榜单并只补缺失排名
- 使用多种滑动步长，降低边界漏项
"""

import os
import re
import time
import subprocess
import xml.etree.ElementTree as ET
import pandas as pd
from datetime import datetime

BASE = "/Users/lin/.openclaw/workspace/kugou_top500_songlist_2026-02-24_1406_filled.xlsx"
OUT = "/Users/lin/.openclaw/workspace/kugou_top500_songlist_2026-02-24_1406_filled_final.xlsx"
MISS = "/Users/lin/.openclaw/workspace/kugou_missing_ranks_final.txt"


def adb(cmd: str):
    p = subprocess.run(f"adb {cmd}", shell=True, capture_output=True, text=True)
    return p.returncode == 0, p.stdout.strip(), p.stderr.strip()


def dump_ui(local="/tmp/kugou_refill_ui.xml"):
    ok, _, _ = adb("shell uiautomator dump /sdcard/kugou_refill_ui.xml")
    if not ok:
        return None
    adb(f"pull /sdcard/kugou_refill_ui.xml {local} 2>/dev/null")
    return local if os.path.exists(local) else None


def parse_screen(xml_path):
    root = ET.parse(xml_path).getroot()
    rows = []
    for e in root.iter():
        if e.get("resource-id") != "com.kugou.android:id/h340":
            continue
        texts = []
        for c in e.iter():
            t = (c.get("text") or "").strip()
            if t:
                texts.append(t)
        if len(texts) >= 2 and re.fullmatch(r"\d{1,3}", texts[0]):
            rank = int(texts[0])
            title = texts[1]
            artist = texts[-1] if len(texts) >= 3 else ""
            rows.append({"排名": rank, "歌曲": title, "歌手": artist})
    return rows


def load_map(path):
    df = pd.read_excel(path)
    df["排名"] = pd.to_numeric(df["排名"], errors="coerce")
    df = df.dropna(subset=["排名"])
    df["排名"] = df["排名"].astype(int)
    m = {}
    for _, r in df.iterrows():
        m[int(r["排名"])] = {"排名": int(r["排名"]), "歌曲": str(r.get("歌曲", "")), "歌手": str(r.get("歌手", ""))}
    return m


def save(rank_map):
    out = [rank_map[k] for k in sorted(rank_map)]
    pd.DataFrame(out, columns=["排名", "歌曲", "歌手"]).to_excel(OUT, index=False)
    missing = [i for i in range(1, 501) if i not in rank_map]
    with open(MISS, "w", encoding="utf-8") as f:
        f.write(",".join(map(str, missing)))
    return missing


def main():
    if not os.path.exists(BASE):
        raise FileNotFoundError(BASE)

    rank_map = load_map(BASE)
    missing = save(rank_map)

    print("=== 全面补位开始 ===")
    print(f"当前: {len(rank_map)}/500, 缺失: {len(missing)}")
    print("请先手动回到TOP500靠前位置（越靠前越好），然后按回车开始")
    input()

    # 多策略滑动步长（小步为主）
    swipe_patterns = [
        (650, 2220, 650, 1220, 280),
        (650, 2220, 650, 1320, 260),
        (650, 2220, 650, 1120, 300),
    ]

    stagnate = 0
    rounds = 0
    max_rounds = 520

    while rounds < max_rounds:
        rounds += 1
        ui = dump_ui()
        if not ui:
            continue

        rows = parse_screen(ui)
        now_missing = set(i for i in range(1, 501) if i not in rank_map)
        add = 0
        for r in rows:
            if r["排名"] in now_missing:
                rank_map[r["排名"]] = r
                add += 1

        missing = save(rank_map)
        print(f"轮次{rounds:03d}: 屏内{len(rows)} 新补{add} 累计{len(rank_map)}/500 缺{len(missing)}")

        if len(missing) == 0:
            break

        if add == 0:
            stagnate += 1
        else:
            stagnate = 0

        # 长时间无新增，尝试提示人工跳转缺失区间
        if stagnate in (18, 36, 54):
            print("⚠️ 连续无新增。请手动跳到缺失区间后回车继续...")
            print(f"当前前20缺失: {missing[:20]}")
            input()
            stagnate = 0

        x1, y1, x2, y2, d = swipe_patterns[rounds % len(swipe_patterns)]
        adb(f"shell input swipe {x1} {y1} {x2} {y2} {d}")
        time.sleep(0.9)

    missing = save(rank_map)
    print("\n=== 完成 ===")
    print(f"最终: {len(rank_map)}/500, 缺失: {len(missing)}")
    print(f"输出: {OUT}")
    print(f"缺失: {MISS}")


if __name__ == "__main__":
    main()
