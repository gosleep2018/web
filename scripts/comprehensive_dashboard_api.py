#!/usr/bin/env python3
import json
import os
import secrets
import subprocess
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from flask import Flask, jsonify, request, Response

app = Flask(__name__)
TZ = ZoneInfo("Asia/Singapore")

EMAIL_PASSWORD = os.getenv("DASHBOARD_EMAIL_PASSWORD", "change-me-email")
REMINDER_PASSWORD = os.getenv("DASHBOARD_REMINDER_PASSWORD", "change-me-reminder")

TOKENS = {"email": set(), "reminder": set()}


def issue_token(section):
    t = secrets.token_urlsafe(24)
    TOKENS[section].add(t)
    return t


def check_token(section):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return False
    token = auth.split(" ", 1)[1].strip()
    return token in TOKENS[section]


@app.post("/api/login")
def login():
    data = request.get_json(force=True, silent=True) or {}
    section = data.get("section")
    pwd = data.get("password", "")

    if section not in ["email", "reminder"]:
        return jsonify({"error": "invalid section"}), 400

    expected = EMAIL_PASSWORD if section == "email" else REMINDER_PASSWORD
    if pwd != expected:
        return jsonify({"error": "password incorrect"}), 401

    return jsonify({"token": issue_token(section)})


@app.get("/api/nav")
def nav():
    base = "https://gosleep2018.github.io/web"
    items = [
        {"name": "主页", "url": f"{base}/", "note": "词汇学习主页"},
        {"name": "HotNews 三视角", "url": f"{base}/hotnews/", "note": "早中晚追加更新"},
        {"name": "词源学习固定版", "url": f"{base}/index_etymology_fixed.html", "note": "词根词缀+TTS"},
        {"name": "Welsh 学习", "url": f"{base}/welsh/", "note": "威尔士语"},
        {"name": "Welsh 2.0", "url": f"{base}/welsh-2.0/", "note": "升级版"},
        {"name": "Welsh Enhanced", "url": f"{base}/welsh-enhanced/", "note": "增强版"},
    ]
    return jsonify({"items": items})


@app.get("/api/email/report")
def email_report():
    if not check_token("email"):
        return Response("UNAUTHORIZED", status=401)

    cmd = ["python3", "/Users/lin/.openclaw/workspace/scripts/gmail_daily_report.py"]
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        return Response(f"ERROR\n{p.stderr}", status=500)
    return Response(p.stdout, mimetype="text/plain")


@app.get("/api/reminders/upcoming")
def reminders_upcoming():
    if not check_token("reminder"):
        return jsonify({"error": "UNAUTHORIZED"}), 401

    p = subprocess.run(["openclaw", "cron", "list", "--json"], capture_output=True, text=True)
    if p.returncode != 0:
        return jsonify({"error": p.stderr or "cron list failed"}), 500

    raw = json.loads(p.stdout)
    jobs = raw.get("jobs", [])

    now = datetime.now(TZ)
    end = now + timedelta(days=92)

    items = []
    for j in jobs:
        sc = j.get("schedule", {})
        if sc.get("kind") != "at":
            continue
        at = sc.get("at")
        if not at:
            continue

        dt = datetime.fromisoformat(at.replace("Z", "+00:00")).astimezone(TZ)
        if not (now <= dt <= end):
            continue

        name = j.get("name", "")
        if "nus120" not in name.lower():
            continue

        msg = (j.get("payload", {}) or {}).get("message", "")
        items.append({
            "date_sgt": dt.strftime("%Y-%m-%d %H:%M"),
            "name": name,
            "message": msg,
        })

    items.sort(key=lambda x: x["date_sgt"])
    return jsonify({"items": items})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8788, debug=False)
