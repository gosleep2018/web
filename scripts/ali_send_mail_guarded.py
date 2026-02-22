#!/usr/bin/env python3
"""
Guarded sender for AliMail: requires explicit CONFIRM=YES each run.
Usage:
  ALI_EMAIL=... ALI_APP_PASSWORD=... python3 ali_send_mail_guarded.py \
    --to a@b.com --subject "xx" --body "yy" --confirm YES
"""
import os
import smtplib
import argparse
from email.mime.text import MIMEText
from email.header import Header

SMTP_HOST = os.getenv("ALI_SMTP_HOST", "smtp.qiye.aliyun.com")
SMTP_PORT = int(os.getenv("ALI_SMTP_PORT", "465"))
ALI_EMAIL = os.getenv("ALI_EMAIL", "")
ALI_APP_PASSWORD = os.getenv("ALI_APP_PASSWORD", "")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--to", required=True)
    ap.add_argument("--subject", required=True)
    ap.add_argument("--body", required=True)
    ap.add_argument("--confirm", required=False, default="NO")
    args = ap.parse_args()

    if args.confirm != "YES":
        print("BLOCKED: send requires explicit confirmation (--confirm YES)")
        return

    if not ALI_EMAIL or not ALI_APP_PASSWORD:
        print("BLOCKED: ALI_EMAIL/ALI_APP_PASSWORD missing")
        return

    msg = MIMEText(args.body, 'plain', 'utf-8')
    msg['From'] = ALI_EMAIL
    msg['To'] = args.to
    msg['Subject'] = Header(args.subject, 'utf-8')

    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=25) as s:
        s.login(ALI_EMAIL, ALI_APP_PASSWORD)
        s.sendmail(ALI_EMAIL, [args.to], msg.as_string())

    print("SENT_OK")


if __name__ == '__main__':
    main()
