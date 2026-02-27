#!/usr/bin/env python3
import os
from google_auth_oauthlib.flow import InstalledAppFlow

WORKSPACE = "/Users/lin/.openclaw/workspace"
CRED_FILE = os.path.join(WORKSPACE, "credentials.json")
TOKEN_FILE = os.path.join(WORKSPACE, "google_gmail_token.json")

# Gmail full access (includes read, send, reply, modify, labels, trash, etc.)
SCOPES = ["https://mail.google.com/"]

flow = InstalledAppFlow.from_client_secrets_file(CRED_FILE, SCOPES)
creds = flow.run_local_server(port=0, open_browser=True)
with open(TOKEN_FILE, "w", encoding="utf-8") as f:
    f.write(creds.to_json())
print(f"OK token saved: {TOKEN_FILE}")
print(f"SCOPES: {SCOPES}")
