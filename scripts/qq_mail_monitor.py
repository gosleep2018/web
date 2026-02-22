#!/usr/bin/env python3
import os
import json
import imaplib
import email
from email.header import decode_header, make_header
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path

TZ = ZoneInfo("Asia/Singapore")
IMAP_HOST = os.getenv("QQ_IMAP_HOST", "imap.qq.com")
IMAP_PORT = int(os.getenv("QQ_IMAP_PORT", "993"))
QQ_EMAIL = os.getenv("QQ_EMAIL", "700008@qq.com")
QQ_APP_PASSWORD = os.getenv("QQ_APP_PASSWORD", "")
KEYWORDS = [k.strip() for k in os.getenv("QQ_KEYWORDS", "NUS,账单,验证码").split(",") if k.strip()]
STATE_FILE = Path('/Users/lin/.openclaw/workspace/memory/qq_keyword_seen.json')


def dh(v: str) -> str:
    if not v:
        return ""
    try:
        return str(make_header(decode_header(v)))
    except Exception:
        return v


def connect():
    if not QQ_APP_PASSWORD:
        raise RuntimeError("QQ_APP_PASSWORD 未设置")
    m = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
    m.login(QQ_EMAIL, QQ_APP_PASSWORD)
    return m


def search_ids(mail, folder='INBOX', criterion='ALL'):
    mail.select(folder)
    typ, data = mail.search(None, criterion)
    if typ != 'OK' or not data or not data[0]:
        return []
    return data[0].split()


def fetch_meta(mail, msg_id):
    typ, data = mail.fetch(msg_id, '(RFC822.HEADER)')
    if typ != 'OK' or not data or not data[0]:
        return None
    raw = data[0][1]
    msg = email.message_from_bytes(raw)
    return {
        'id': msg_id.decode(),
        'from': dh(msg.get('From', '')),
        'subject': dh(msg.get('Subject', '')),
        'date': msg.get('Date', ''),
    }


def daily_report():
    mail = connect()
    try:
        # 近24小时
        since = (datetime.now(TZ) - timedelta(days=1)).strftime('%d-%b-%Y')
        inbox_ids = search_ids(mail, 'INBOX', f'(SINCE {since})')
        unread_ids = search_ids(mail, 'INBOX', f'(UNSEEN SINCE {since})')

        # QQ 垃圾箱常见名：Junk / Spam
        spam_ids = []
        for folder in ['Junk', 'Spam']:
            try:
                spam_ids = search_ids(mail, folder, f'(SINCE {since})')
                if spam_ids is not None:
                    break
            except Exception:
                continue

        senders = []
        for mid in spam_ids[:50]:
            meta = fetch_meta(mail, mid)
            if meta and meta['from'] and meta['from'] not in senders:
                senders.append(meta['from'])

        lines = []
        lines.append(f"📮 QQ邮件每日报告（{datetime.now(TZ).strftime('%Y-%m-%d')}）")
        lines.append(f"- 收件箱邮件（近24h）：{len(inbox_ids)}")
        lines.append(f"- 未读邮件（近24h）：{len(unread_ids)}")
        lines.append("")
        lines.append(f"🗑️ 垃圾邮件（近24h）：{len(spam_ids)}")
        if senders:
            lines.append("发件人：")
            for s in senders[:20]:
                lines.append(f"- {s}")
            if len(senders) > 20:
                lines.append(f"- … 其余 {len(senders)-20} 个发件人")
        else:
            lines.append("发件人：无")

        print('\n'.join(lines))
    finally:
        try:
            mail.logout()
        except Exception:
            pass


def load_seen():
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text(encoding='utf-8'))
        except Exception:
            return {}
    return {}


def save_seen(data):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


def keyword_alert():
    mail = connect()
    try:
        ids = search_ids(mail, 'INBOX', 'UNSEEN')
        seen = load_seen()
        new_hits = []
        for mid in ids[:80]:
            sid = mid.decode()
            if sid in seen:
                continue
            meta = fetch_meta(mail, mid)
            if not meta:
                continue
            blob = f"{meta['subject']} {meta['from']}".lower()
            hit_kw = [k for k in KEYWORDS if k.lower() in blob]
            if hit_kw:
                meta['keywords'] = hit_kw
                new_hits.append(meta)
            seen[sid] = int(datetime.now(TZ).timestamp())

        save_seen(seen)

        if not new_hits:
            print('NO_HIT')
            return

        lines = ['🔔 QQ关键词邮件提醒']
        for h in new_hits[:10]:
            lines.append(f"- 关键词: {', '.join(h['keywords'])}")
            lines.append(f"  主题: {h['subject'] or '(无主题)'}")
            lines.append(f"  发件人: {h['from'] or '(未知)'}")
        if len(new_hits) > 10:
            lines.append(f"- 其余 {len(new_hits)-10} 封命中")
        print('\n'.join(lines))
    finally:
        try:
            mail.logout()
        except Exception:
            pass


if __name__ == '__main__':
    mode = os.getenv('QQ_MONITOR_MODE', 'report').strip().lower()
    if mode == 'keywords':
        keyword_alert()
    else:
        daily_report()
