#!/usr/bin/env python3
import os
import imaplib
import email
from email.header import decode_header, make_header
from datetime import datetime
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Asia/Singapore")
IMAP_HOST = os.getenv("QQ_IMAP_HOST", "imap.qq.com")
IMAP_PORT = int(os.getenv("QQ_IMAP_PORT", "993"))
QQ_EMAIL = os.getenv("QQ_EMAIL", "700008@qq.com")
QQ_APP_PASSWORD = os.getenv("QQ_APP_PASSWORD", "")
TARGET_FOLDER = os.getenv("QQ_FIN_FOLDER", "fin")
KEYWORDS = ["hsbc", "moomoo"]


def dh(v: str) -> str:
    if not v:
        return ""
    try:
        return str(make_header(decode_header(v)))
    except Exception:
        return v


def get_header(msg, name):
    return dh(msg.get(name, ""))


def parse_mailboxes(raw_lines):
    names = []
    for line in raw_lines:
        try:
            s = line.decode(errors="ignore")
        except Exception:
            continue
        # format: (... ) "/" "INBOX"
        if '"' in s:
            part = s.rsplit('"', 2)
            if len(part) >= 2:
                name = part[-2]
                if name:
                    names.append(name)
                    continue
        # fallback
        bits = s.split()
        if bits:
            names.append(bits[-1].strip('"'))
    return names


def ensure_folder(mail, name):
    typ, data = mail.list()
    names = parse_mailboxes(data or []) if typ == "OK" else []
    low = {n.lower(): n for n in names}
    if name.lower() in low:
        return low[name.lower()]
    mail.create(name)
    return name


def fetch_header(mail, msg_id):
    typ, data = mail.fetch(msg_id, "(RFC822.HEADER)")
    if typ != "OK" or not data or not data[0]:
        return None
    raw = data[0][1]
    msg = email.message_from_bytes(raw)
    sender = get_header(msg, "From")
    subject = get_header(msg, "Subject")
    return sender, subject


def move_message(mail, msg_id, folder):
    # copy then delete + expunge
    ctyp, _ = mail.copy(msg_id, folder)
    if ctyp != "OK":
        return False
    styp, _ = mail.store(msg_id, "+FLAGS", "\\Deleted")
    if styp != "OK":
        return False
    return True


def main():
    if not QQ_APP_PASSWORD:
        print("ERROR: QQ_APP_PASSWORD 未设置")
        return

    mail = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
    mail.login(QQ_EMAIL, QQ_APP_PASSWORD)

    try:
        target = ensure_folder(mail, TARGET_FOLDER)
        mail.select("INBOX")
        typ, data = mail.search(None, "UNSEEN")
        if typ != "OK" or not data or not data[0]:
            print("NO_MOVE")
            return

        ids = data[0].split()
        moved = []
        for mid in ids[:200]:
            head = fetch_header(mail, mid)
            if not head:
                continue
            sender, subject = head
            blob = f"{sender} {subject}".lower()
            if not any(k in blob for k in KEYWORDS):
                continue

            if move_message(mail, mid, target):
                moved.append((sender or "(未知发件人)", subject or "(无主题)"))

        if moved:
            mail.expunge()
            lines = [f"📁 QQ规则执行：已将 {len(moved)} 封 HSBC/Moomoo 邮件移至 {TARGET_FOLDER}"]
            for s, sub in moved[:10]:
                lines.append(f"- {s} ｜ {sub}")
            if len(moved) > 10:
                lines.append(f"- …其余 {len(moved)-10} 封")
            lines.append(f"时间：{datetime.now(TZ).strftime('%Y-%m-%d %H:%M:%S %Z')}")
            print("\n".join(lines))
        else:
            print("NO_MOVE")
    finally:
        try:
            mail.logout()
        except Exception:
            pass


if __name__ == "__main__":
    main()
