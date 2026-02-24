#!/usr/bin/env python3
"""
酷狗TOP500指数采集（增强版）
流程：点击每首歌右侧“更多” -> 点“歌曲数据/歌曲指数” -> 读取指数 -> 返回列表 -> 下一首
支持分批采集与断点续传。
"""

import json
import os
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from datetime import datetime

STATE_FILE = "kugou_index_state.json"
OUT_FILE = "kugou_index_results.json"


class ADB:
    @staticmethod
    def run(cmd: str, timeout: int = 12):
        full = f"adb {cmd}"
        p = subprocess.run(full, shell=True, capture_output=True, text=True, timeout=timeout)
        return p.returncode == 0, p.stdout.strip(), p.stderr.strip()

    @staticmethod
    def tap(x: int, y: int):
        return ADB.run(f"shell input tap {x} {y}")

    @staticmethod
    def back():
        return ADB.run("shell input keyevent 4")

    @staticmethod
    def swipe(x1, y1, x2, y2, dur=250):
        return ADB.run(f"shell input swipe {x1} {y1} {x2} {y2} {dur}")


def dump_ui(remote="/sdcard/kugou_ui.xml", local="/tmp/kugou_ui.xml"):
    ok, _, _ = ADB.run(f"shell uiautomator dump {remote}")
    if not ok:
        return None
    ADB.run(f"pull {remote} {local} 2>/dev/null")
    if not os.path.exists(local):
        return None
    return local


def parse_bounds(bounds: str):
    m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds or "")
    if not m:
        return None
    l, t, r, b = map(int, m.groups())
    return (l + r) // 2, (t + b) // 2, t


def find_more_buttons(xml_path: str):
    tree = ET.parse(xml_path)
    root = tree.getroot()
    points = []
    for e in root.iter():
        desc = e.get("content-desc", "") or ""
        text = e.get("text", "") or ""
        key = f"{desc} {text}"
        if "更多" in key:
            p = parse_bounds(e.get("bounds", ""))
            if p:
                points.append(p)
    # 去重 + 按y排序
    seen, out = set(), []
    for x, y, t in sorted(points, key=lambda i: i[2]):
        k = (x, y)
        if k not in seen:
            seen.add(k)
            out.append((x, y))
    return out


def find_menu_entry(xml_path: str):
    """优先找 歌曲数据/歌曲指数 菜单项"""
    targets = ["歌曲数据", "歌曲指数", "查看数据"]
    tree = ET.parse(xml_path)
    root = tree.getroot()
    for e in root.iter():
        text = (e.get("text", "") or "").strip()
        if any(t in text for t in targets):
            p = parse_bounds(e.get("bounds", ""))
            if p:
                return p[0], p[1], text
    return None


def extract_index_fields(xml_path: str):
    """提取指数页关键文本（尽可能鲁棒）"""
    tree = ET.parse(xml_path)
    root = tree.getroot()
    rows = []
    for e in root.iter():
        txt = (e.get("text", "") or "").strip()
        if txt:
            rows.append(txt)

    # 直接命中“歌曲指数”行
    song_index = None
    for i, t in enumerate(rows):
        if "歌曲指数" in t:
            # 常见情况：下一项就是数值
            if i + 1 < len(rows):
                nxt = rows[i + 1]
                if re.search(r"\d", nxt):
                    song_index = nxt
            if song_index is None:
                m = re.search(r"歌曲指数[:：]?\s*([\d,.万亿wW+]+)", t)
                if m:
                    song_index = m.group(1)
            break

    # 兜底：抓可能的热度/在听人数
    listening = None
    for t in rows:
        if "人正在听" in t or "在听" in t:
            listening = t
            break

    return {
        "song_index": song_index,
        "listening": listening,
        "raw_text_top30": rows[:30],
    }


def load_json(path, default):
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return default


def save_json(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)


def main():
    state = load_json(STATE_FILE, {"batch": 0, "done": 0})
    results = load_json(OUT_FILE, [])

    print("\n=== 酷狗指数分批采集 ===")
    print("请先手动打开：酷狗 -> TOP500 列表页")
    print("采集中请勿操作手机\n")

    batch_limit = input("本轮采集几首？(默认 5): ").strip()
    batch_limit = int(batch_limit) if batch_limit.isdigit() else 5

    menu_xy = None
    collected = 0

    # 每轮最多扫两屏，避免误操作过长
    for _ in range(2):
        ui = dump_ui()
        if not ui:
            print("❌ 无法抓取UI")
            break

        buttons = find_more_buttons(ui)
        if not buttons:
            print("⚠️ 当前屏幕没找到‘更多’按钮")
            break

        for x, y in buttons:
            if collected >= batch_limit:
                break

            # 1) 点更多
            ADB.tap(x, y)
            time.sleep(1.5)

            # 2) 找菜单项
            menu_ui = dump_ui("/sdcard/menu_ui.xml", "/tmp/menu_ui.xml")
            if not menu_ui:
                ADB.back(); time.sleep(0.8)
                continue

            if menu_xy is None:
                menu_found = find_menu_entry(menu_ui)
                if menu_found:
                    menu_xy = (menu_found[0], menu_found[1])
                else:
                    # 兜底：常见位置
                    menu_xy = (630, 1200)

            # 3) 点歌曲数据/指数
            ADB.tap(menu_xy[0], menu_xy[1])
            time.sleep(2.2)

            # 4) 抓指数页
            detail_ui = dump_ui("/sdcard/detail_ui.xml", "/tmp/detail_ui.xml")
            if detail_ui:
                fields = extract_index_fields(detail_ui)
            else:
                fields = {"song_index": None, "listening": None, "raw_text_top30": []}

            item = {
                "seq": state["done"] + 1,
                "time": datetime.now().isoformat(timespec="seconds"),
                "more_xy": [x, y],
                **fields,
            }
            results.append(item)
            state["done"] += 1
            collected += 1
            print(f"✅ 第{item['seq']}首: 指数={item['song_index']}  在听={item['listening']}")

            save_json(OUT_FILE, results)
            save_json(STATE_FILE, state)

            # 5) 返回列表（双保险）
            ADB.back(); time.sleep(0.9)
            ADB.back(); time.sleep(1.1)

        if collected >= batch_limit:
            break

        # 下一屏
        ADB.swipe(650, 2100, 650, 900, 260)
        time.sleep(1.6)

    state["batch"] += 1
    save_json(STATE_FILE, state)
    save_json(OUT_FILE, results)

    print("\n--- 完成 ---")
    print(f"本轮采集: {collected} 首")
    print(f"累计采集: {state['done']} 首")
    print(f"结果文件: {os.path.abspath(OUT_FILE)}")
    print(f"状态文件: {os.path.abspath(STATE_FILE)}")
    print("下一轮直接再运行即可断点续传。")


if __name__ == "__main__":
    main()
