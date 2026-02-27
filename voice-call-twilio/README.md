# Twilio 电话提醒（OpenClaw 集成）

## 1) 准备 Twilio 账号
你需要：
- Account SID
- Auth Token
- Twilio 语音号码（支持外呼）

> 中国大陆号码外呼可用性受 Twilio 线路与当地政策影响，建议先实测。

## 2) 本地配置
```bash
cd /Users/lin/.openclaw/workspace/voice-call-twilio
cp .env.example .env
# 填入 TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER
npm install
```

## 3) 启动服务
```bash
npm start
```

健康检查：
```bash
curl http://127.0.0.1:3100/health
```

## 4) 手动试拨
```bash
curl -X POST http://127.0.0.1:3100/call \
  -H 'Content-Type: application/json' \
  -d '{
    "to":"+8618502825799",
    "text":"Boss，这是Twilio电话提醒测试。",
    "lang":"zh-CN",
    "voice":"alice",
    "repeat":2
  }'
```

## 5) 接 OpenClaw 定时任务
让 cron 的 agentTurn 执行：
`bash /Users/lin/.openclaw/workspace/voice-call-twilio/trigger_call.sh`

建议：
- 加“未接听重拨”
- 加“Telegram 兜底通知”
- 夜间免打扰
