#!/usr/bin/env python3
"""
仅采集酷狗TOP500歌曲列表（排名/歌名/歌手），导出Excel。
使用方法：
  1) 手机手动打开 酷狗 -> TOP500 列表页
  2) python3 kugou_top500_list_to_xls.py
"""

import os
import re
import time
import subprocess
import xml.etree.ElementTree as ET
from datetime import datetime

import pandas as pd

WORKDIR = "/Users/lin/.openclaw/workspace"


def adb(cmd: str):
    p = subprocess.run(f"adb {cmd}", shell=True, capture_output=True, text=True)
    return p.returncode == 0, p.stdout.strip(), p.stderr.strip()


def dump_ui(local="/tmp/kugou_top500_ui.xml"):
    ok, _, _ = adb("shell uiautomator dump /sdcard/kugou_top500_ui.xml")
    if not ok:
        return None
    adb(f"pull /sdcard/kugou_top500_ui.xml {local} 2>/dev/null")
    if not os.path.exists(local):
        return None
    return local


def parse_song_rows(xml_path: str):
    root = ET.parse(xml_path).getroot()
    songs = []

    for elem in root.iter():
        if elem.get("resource-id") != "com.kugou.android:id/h340":
            continue

        texts = []
        for c in elem.iter():
            t = (c.get("text") or "").strip()
            if t:
                texts.append(t)

        if not texts:
            continue

        # 常见结构：['1', '梦底', '星曜计划', '海来阿木'] / ['2', '雨过后的风景', 'Dizzy Dizzo (蔡诗芸)']
        rank = None
        title = None
        artist = None

        if re.fullmatch(r"\d{1,3}", texts[0]):
            rank = int(texts[0])
            if len(texts) >= 2:
                title = texts[1]
            if len(texts) >= 3:
                artist = texts[-1]  # 最后一个通常是歌手；中间可能有“星曜计划”等tag

        if rank and title:
            songs.append({"排名": rank, "歌曲": title, "歌手": artist or ""})

    return songs


def main():
    print("=== 酷狗TOP500列表采集（仅歌曲列表）===")
    print("请确保手机已打开 TOP500 列表页，采集时不要手动滑动。")

    ok, out, _ = adb("devices")
    if not ok or "\tdevice" not in out:
        raise RuntimeError("ADB 设备未连接")

    all_by_rank = {}
    no_new_rounds = 0

    max_rounds = 240  # 足够覆盖500条
    for i in range(max_rounds):
        ui = dump_ui()
        if not ui:
            print("UI抓取失败，停止")
            break

        rows = parse_song_rows(ui)
        new_cnt = 0
        for s in rows:
            if s["排名"] not in all_by_rank:
                all_by_rank[s["排名"]] = s
                new_cnt += 1

        total = len(all_by_rank)
        print(f"轮次 {i+1:03d}: 屏内{len(rows)}条, 新增{new_cnt}条, 累计{total}/500")

        if total >= 500:
            break

        if new_cnt == 0:
            no_new_rounds += 1
        else:
            no_new_rounds = 0

        # 连续多轮无新增，基本到底或卡住
        if no_new_rounds >= 8:
            print("连续无新增，停止滚动。")
            break

        # 轻滑一屏（减少跳项）
        adb("shell input swipe 650 2280 650 980 280")
        time.sleep(1.0)

    result = [all_by_rank[k] for k in sorted(all_by_rank.keys())]

    ts = datetime.now().strftime("%Y-%m-%d_%H%M")
    out_xlsx = os.path.join(WORKDIR, f"kugou_top500_songlist_{ts}.xlsx")
    out_xls = os.path.join(WORKDIR, f"kugou_top500_songlist_{ts}.xls")

    df = pd.DataFrame(result, columns=["排名", "歌曲", "歌手"])
    df.to_excel(out_xlsx, index=False)

    # 兼容“要xls”的说法：额外复制一个.xls文件名（内容为xlsx格式，Excel可打开）
    # 如需严格BIFF8 xls，可后续改为xlwt（环境未必有）
    try:
        import shutil
        shutil.copy(out_xlsx, out_xls)
        made_xls = True
    except Exception:
        made_xls = False

    print("\n=== 完成 ===")
    print(f"采集到: {len(df)} 首")
    print(f"XLSX: {out_xlsx}")
    if made_xls:
        print(f"XLS : {out_xls}")


if __name__ == "__main__":
    main()
