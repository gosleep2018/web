#!/usr/bin/env python3
"""
酷狗TOP500补位脚本（人机协同）
- 读取已有榜单Excel
- 计算缺失排名
- 每次抓取“当前屏幕”可见歌曲，自动补进缺失排名
- 适合用户手动定位到缺失区段后，按回车逐屏补齐
"""

import os
import re
import time
import subprocess
import xml.etree.ElementTree as ET
import pandas as pd

BASE_XLSX = "/Users/lin/.openclaw/workspace/kugou_top500_songlist_2026-02-24_1406.xlsx"
OUT_XLSX = "/Users/lin/.openclaw/workspace/kugou_top500_songlist_2026-02-24_1406_filled.xlsx"
MISSING_TXT = "/Users/lin/.openclaw/workspace/kugou_missing_ranks.txt"


def adb(cmd: str):
    p = subprocess.run(f"adb {cmd}", shell=True, capture_output=True, text=True)
    return p.returncode == 0, p.stdout.strip(), p.stderr.strip()


def dump_ui(local="/tmp/kugou_fill_ui.xml"):
    ok, _, _ = adb("shell uiautomator dump /sdcard/kugou_fill_ui.xml")
    if not ok:
        return None
    adb(f"pull /sdcard/kugou_fill_ui.xml {local} 2>/dev/null")
    if not os.path.exists(local):
        return None
    return local


def parse_screen_songs(xml_path: str):
    root = ET.parse(xml_path).getroot()
    out = []

    for elem in root.iter():
        if elem.get("resource-id") != "com.kugou.android:id/h340":
            continue

        texts = []
        for c in elem.iter():
            t = (c.get("text") or "").strip()
            if t:
                texts.append(t)

        if len(texts) < 2:
            continue

        # 常见: [排名, 歌名, (标签), 歌手]
        if re.fullmatch(r"\d{1,3}", texts[0]):
            rank = int(texts[0])
            title = texts[1]
            artist = texts[-1] if len(texts) >= 3 else ""
            out.append({"排名": rank, "歌曲": title, "歌手": artist})

    return out


def main():
    if not os.path.exists(BASE_XLSX):
        raise FileNotFoundError(f"未找到基础文件: {BASE_XLSX}")

    df = pd.read_excel(BASE_XLSX)
    for c in ["排名", "歌曲", "歌手"]:
        if c not in df.columns:
            raise ValueError(f"缺少列: {c}")

    df["排名"] = pd.to_numeric(df["排名"], errors="coerce")
    df = df.dropna(subset=["排名"])
    df["排名"] = df["排名"].astype(int)

    rank_map = {int(r["排名"]): {"排名": int(r["排名"]), "歌曲": str(r.get("歌曲", "")), "歌手": str(r.get("歌手", ""))}
                for _, r in df.iterrows()}

    def missing_ranks():
        return [i for i in range(1, 501) if i not in rank_map]

    miss = missing_ranks()
    with open(MISSING_TXT, "w", encoding="utf-8") as f:
        f.write("缺失排名:\n")
        f.write(",".join(map(str, miss)))

    print("=== 补位模式启动 ===")
    print(f"当前已采集: {len(rank_map)}/500, 缺失: {len(miss)}")
    print(f"缺失清单: {MISSING_TXT}")
    print("\n操作方式：")
    print("1) 你手动滑到缺失区段（例如 1-40, 40-80...）")
    print("2) 回到终端按回车 -> 脚本抓当前屏并自动补位")
    print("3) 重复直到缺失=0；输入 q 退出")

    round_i = 0
    while True:
        now_miss = missing_ranks()
        print("\n----------------------------------------")
        print(f"剩余缺失 {len(now_miss)} 个")
        print(f"前20个缺失: {now_miss[:20]}")
        cmd = input("按回车抓当前屏（q退出）: ").strip().lower()
        if cmd == "q":
            break

        ui = dump_ui()
        if not ui:
            print("抓UI失败，重试")
            continue

        songs = parse_screen_songs(ui)
        if not songs:
            print("当前屏未识别到歌曲行")
            continue

        round_i += 1
        added = 0
        for s in songs:
            r = s["排名"]
            if r in now_miss:
                rank_map[r] = s
                added += 1

        print(f"第{round_i}轮: 识别{len(songs)}条, 新补{added}条")

        # 每轮落盘
        out = [rank_map[r] for r in sorted(rank_map)]
        out_df = pd.DataFrame(out, columns=["排名", "歌曲", "歌手"])
        out_df.to_excel(OUT_XLSX, index=False)

        left = missing_ranks()
        with open(MISSING_TXT, "w", encoding="utf-8") as f:
            f.write("缺失排名:\n")
            f.write(",".join(map(str, left)))

        print(f"已保存: {OUT_XLSX}")
        if len(left) == 0:
            print("\n🎉 已补齐 500/500")
            break

    # 结束时再保存一次
    out = [rank_map[r] for r in sorted(rank_map)]
    out_df = pd.DataFrame(out, columns=["排名", "歌曲", "歌手"])
    out_df.to_excel(OUT_XLSX, index=False)
    print("\n结束。")
    print(f"最终文件: {OUT_XLSX}")


if __name__ == "__main__":
    main()
