# 腾讯云语音电话提醒（OpenClaw）

## 一、先在腾讯云准备
1. 开通 **语音通知（VMS）**
2. 创建并审核 **语音模板**（拿到模板ID）
3. 准备 SecretId / SecretKey
4. 确保账户有余额且线路可呼叫中国号码

## 二、本地配置
```bash
cd /Users/lin/.openclaw/workspace/voice-call-tencentcloud
cp .env.example .env
# 填：TENCENT_SECRET_ID / TENCENT_SECRET_KEY / TENCENT_VMS_TEMPLATE_ID
npm install
npm start
```

健康检查：
```bash
curl http://127.0.0.1:3110/health
```

## 三、测试外呼
```bash
curl -X POST http://127.0.0.1:3110/call \
  -H 'Content-Type: application/json' \
  -d '{
    "to":"+8618502825799",
    "templateParamSet":["Boss","现在是提醒时间"],
    "playTimes":2
  }'
```

> `templateParamSet` 要和你的语音模板变量一一对应。

## 四、接 OpenClaw cron
用 cron 的 agentTurn 执行：
`bash /Users/lin/.openclaw/workspace/voice-call-tencentcloud/trigger_call.sh`

---
我可以继续帮你：
- 加未接听重拨
- 加夜间免打扰
- 失败自动发 Telegram 兜底提醒
