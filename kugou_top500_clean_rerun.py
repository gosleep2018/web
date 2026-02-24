#!/usr/bin/env python3
"""
酷狗TOP500列表清洗重跑版
- 仅抓 排名/歌曲/歌手（基于稳定resource-id）
- 自动多轮：正向1 + 正向2(不同步长) + 反向补扫
- 输出干净xlsx，并生成与 2026-02-22 的变化报告
"""

import os
import re
import time
import subprocess
import xml.etree.ElementTree as ET
from datetime import datetime
import pandas as pd

WORKDIR = "/Users/lin/.openclaw/workspace"
OLD_FILE = f"{WORKDIR}/kugou_top500_2026-02-22.xlsx"


def adb(cmd: str):
    p = subprocess.run(f"adb {cmd}", shell=True, capture_output=True, text=True)
    return p.returncode == 0, p.stdout.strip(), p.stderr.strip()


def dump_ui(local="/tmp/kugou_clean_ui.xml"):
    ok, _, _ = adb("shell uiautomator dump /sdcard/kugou_clean_ui.xml")
    if not ok:
        return None
    adb(f"pull /sdcard/kugou_clean_ui.xml {local} 2>/dev/null")
    return local if os.path.exists(local) else None


def parse_screen(xml_path: str):
    root = ET.parse(xml_path).getroot()
    rows = []
    for e in root.iter():
        if e.get("resource-id") != "com.kugou.android:id/h340":
            continue

        rank = None
        title = None
        artist = None

        for c in e.iter():
            rid = c.get("resource-id", "")
            txt = (c.get("text") or "").strip()
            if not txt:
                continue

            if rid == "com.kugou.android:id/faw0" and re.fullmatch(r"\d{1,3}", txt):
                rank = int(txt)
            elif rid == "com.kugou.android:id/fac1":
                title = txt
            elif rid == "com.kugou.android:id/f431":
                artist = txt

        if rank and title:
            rows.append({"排名": rank, "歌曲": title, "歌手": artist or ""})

    # 去重（同屏可能重复）
    uniq = {}
    for r in rows:
        uniq[r["排名"]] = r
    return [uniq[k] for k in sorted(uniq)]


def swipe_up(distance=1000, dur=280):
    y1 = 2220
    y2 = max(700, y1 - distance)
    adb(f"shell input swipe 650 {y1} 650 {y2} {dur}")


def swipe_down(distance=1000, dur=280):
    y1 = 1000
    y2 = min(2400, y1 + distance)
    adb(f"shell input swipe 650 {y1} 650 {y2} {dur}")


def to_top():
    for _ in range(18):
        swipe_down(1300, 260)
        time.sleep(0.18)


def to_bottom():
    for _ in range(38):
        swipe_up(1250, 260)
        time.sleep(0.2)


def run_pass(rank_map, direction="down", distance=1000, max_rounds=220, label="pass"):
    stagnate = 0
    for i in range(1, max_rounds + 1):
        ui = dump_ui()
        if not ui:
            continue
        rows = parse_screen(ui)
        add = 0
        for r in rows:
            if r["排名"] not in rank_map:
                rank_map[r["排名"]] = r
                add += 1

        print(f"{label} {i:03d}: 屏内{len(rows)} 新增{add} 累计{len(rank_map)}/500")

        if len(rank_map) >= 500:
            break

        if add == 0:
            stagnate += 1
        else:
            stagnate = 0

        if stagnate >= 12:
            break

        if direction == "down":
            swipe_up(distance, 280)
        else:
            swipe_down(distance, 280)
        time.sleep(0.9)


def save_outputs(rank_map):
    ts = datetime.now().strftime("%Y-%m-%d_%H%M")
    out_xlsx = f"{WORKDIR}/kugou_top500_songlist_clean_{ts}.xlsx"
    out_xls = f"{WORKDIR}/kugou_top500_songlist_clean_{ts}.xls"
    miss_txt = f"{WORKDIR}/kugou_top500_songlist_clean_{ts}_missing.txt"
    cmp_md = f"{WORKDIR}/kugou_top500_vs_2026-02-22_{ts}.md"

    df = pd.DataFrame([rank_map[k] for k in sorted(rank_map)], columns=["排名", "歌曲", "歌手"])
    df.to_excel(out_xlsx, index=False)
    try:
        import shutil
        shutil.copy(out_xlsx, out_xls)
    except Exception:
        pass

    missing = [i for i in range(1, 501) if i not in rank_map]
    with open(miss_txt, "w", encoding="utf-8") as f:
        f.write(",".join(map(str, missing)))

    # 对比昨天
    if os.path.exists(OLD_FILE):
        old = pd.read_excel(OLD_FILE).rename(columns={"歌名": "歌曲"})
        old = old[["排名", "歌曲", "歌手"]].copy()
        old["key"] = old["歌曲"].astype(str).str.strip() + "|||" + old["歌手"].astype(str).str.strip()
        df2 = df.copy()
        df2["key"] = df2["歌曲"].astype(str).str.strip() + "|||" + df2["歌手"].astype(str).str.strip()

        old_map = old.set_index("key")["排名"].to_dict()
        new_map = df2.set_index("key")["排名"].to_dict()
        old_keys, new_keys = set(old_map), set(new_map)
        common = old_keys & new_keys
        added = new_keys - old_keys
        dropped = old_keys - new_keys

        changes = []
        for k in common:
            if old_map[k] != new_map[k]:
                delta = old_map[k] - new_map[k]
                song, artist = k.split("|||", 1)
                changes.append((song, artist, old_map[k], new_map[k], delta))

        up = sorted([c for c in changes if c[4] > 0], key=lambda x: x[4], reverse=True)
        down = sorted([c for c in changes if c[4] < 0], key=lambda x: x[4])

        with open(cmp_md, "w", encoding="utf-8") as f:
            f.write(f"# 酷狗TOP500变化对比（2026-02-22 vs {ts}）\n\n")
            f.write(f"- 今日采集总数: {len(df)}\n")
            f.write(f"- 共同歌曲: {len(common)}\n")
            f.write(f"- 新上榜: {len(added)}\n")
            f.write(f"- 掉榜: {len(dropped)}\n")
            f.write(f"- 排名变化: {len(changes)}\n\n")

            f.write("## 上升TOP20\n\n")
            for s, a, o, n, d in up[:20]:
                f.write(f"- ↑{d}: {o} → {n}｜{s} - {a}\n")

            f.write("\n## 下降TOP20\n\n")
            for s, a, o, n, d in down[:20]:
                f.write(f"- {d}: {o} → {n}｜{s} - {a}\n")

            f.write("\n## 今日TOP10\n\n")
            for _, r in df.sort_values("排名").head(10).iterrows():
                f.write(f"- {int(r['排名'])}. {r['歌曲']} - {r['歌手']}\n")

    return out_xlsx, out_xls, miss_txt, cmp_md if os.path.exists(cmp_md) else None


def main():
    print("请先手动打开酷狗TOP500列表页，然后回车开始")
    input()

    rank_map = {}

    # pass1: 从顶部正向（小步）
    to_top()
    run_pass(rank_map, direction="down", distance=920, label="正向1")

    # pass2: 再次从顶部正向（不同步长）
    if len(rank_map) < 500:
        to_top()
        run_pass(rank_map, direction="down", distance=1080, label="正向2")

    # pass3: 从底部反向补扫
    if len(rank_map) < 500:
        to_bottom()
        run_pass(rank_map, direction="up", distance=980, label="反向")

    out_xlsx, out_xls, miss_txt, cmp_md = save_outputs(rank_map)
    print("\n=== 完成 ===")
    print(f"采集: {len(rank_map)}/500")
    print(f"XLSX: {out_xlsx}")
    print(f"XLS : {out_xls}")
    print(f"缺失: {miss_txt}")
    if cmp_md:
        print(f"对比: {cmp_md}")


if __name__ == "__main__":
    main()
