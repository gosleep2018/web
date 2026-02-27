#!/usr/bin/env python3
import os
import imaplib
import email
from email.header import decode_header, make_header
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Asia/Singapore")
IMAP_HOST = os.getenv("ALI_IMAP_HOST", "imap.qiye.aliyun.com")
IMAP_PORT = int(os.getenv("ALI_IMAP_PORT", "993"))
ALI_EMAIL = os.getenv("ALI_EMAIL", "")
ALI_APP_PASSWORD = os.getenv("ALI_APP_PASSWORD", "")

WEEKLY_KW = ["周报", "weekly", "week", "周度", "report", "summary"]
ACTION_KW = ["请确认", "需回复", "deadline", "截止", "action required", "follow up", "待办", "审批"]


def dh(v: str) -> str:
    if not v:
        return ""
    try:
        return str(make_header(decode_header(v)))
    except Exception:
        return v


def connect():
    if not ALI_EMAIL or not ALI_APP_PASSWORD:
        raise RuntimeError("ALI_EMAIL/ALI_APP_PASSWORD 未设置")
    m = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
    m.login(ALI_EMAIL, ALI_APP_PASSWORD)
    return m


def fetch_headers(mail, msg_id):
    typ, data = mail.fetch(msg_id, "(RFC822.HEADER)")
    if typ != "OK" or not data or not data[0]:
        return None
    msg = email.message_from_bytes(data[0][1])
    return {
        "from": dh(msg.get("From", "")),
        "subject": dh(msg.get("Subject", "")),
        "date": dh(msg.get("Date", "")),
    }


def main():
    now = datetime.now(TZ)
    since = (now - timedelta(days=1)).strftime('%d-%b-%Y')

    mail = connect()
    try:
        mail.select("INBOX")
        typ, data = mail.search(None, f"(SINCE {since})")
        if typ != "OK":
            print("阿里邮箱日报：查询失败")
            return

        ids = data[0].split() if data and data[0] else []
        total = len(ids)

        unread_typ, unread_data = mail.search(None, f"(UNSEEN SINCE {since})")
        unread = len(unread_data[0].split()) if unread_typ == "OK" and unread_data and unread_data[0] else 0

        weekly = []
        actions = []
        top_senders = {}

        for mid in ids[-80:]:
            h = fetch_headers(mail, mid)
            if not h:
                continue
            sender = h["from"] or "(未知发件人)"
            subject = h["subject"] or "(无主题)"
            blob = f"{sender} {subject}".lower()

            top_senders[sender] = top_senders.get(sender, 0) + 1

            if any(k in blob for k in WEEKLY_KW):
                weekly.append((sender, subject))

            if any(k in blob for k in ACTION_KW):
                actions.append((sender, subject))

        sender_rank = sorted(top_senders.items(), key=lambda x: x[1], reverse=True)

        lines = []
        lines.append(f"📮 阿里邮箱当日汇总（{now.strftime('%Y-%m-%d')}）")
        lines.append(f"- 近24h邮件：{total}")
        lines.append(f"- 近24h未读：{unread}")
        lines.append("")

        lines.append(f"📊 周报/汇总类邮件：{len(weekly)}")
        if weekly:
            for s, sub in weekly[:8]:
                lines.append(f"- {s} ｜ {sub}")
            if len(weekly) > 8:
                lines.append(f"- …其余 {len(weekly)-8} 封")
        lines.append("")

        lines.append(f"⚠️ 可能需要处理的邮件：{len(actions)}")
        if actions:
            for s, sub in actions[:8]:
                lines.append(f"- {s} ｜ {sub}")
            if len(actions) > 8:
                lines.append(f"- …其余 {len(actions)-8} 封")
        lines.append("")

        lines.append("👥 高频发件人 Top5")
        for s, c in sender_rank[:5]:
            lines.append(f"- {s}: {c} 封")
        lines.append("")

        # 建议
        advice = []
        if len(actions) >= 5:
            advice.append("今晚优先清理“需回复/截止”类邮件，先处理有明确截止时间的事项。")
        if len(weekly) >= 3:
            advice.append("周报类邮件较多，建议先按部门/项目归档，再统一提炼行动项。")
        if unread >= 20:
            advice.append("未读较多，建议先按发件人优先级（老板/客户/财务）做三段式清理。")
        if not advice:
            advice.append("整体负载可控，建议按“重要且紧急”优先处理，并维持当日清零。")

        lines.append("✅ 建议")
        for a in advice:
            lines.append(f"- {a}")

        print("\n".join(lines))
    finally:
        try:
            mail.logout()
        except Exception:
            pass


if __name__ == "__main__":
    main()
