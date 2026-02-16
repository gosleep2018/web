# 阿里云电话提醒（OpenClaw 集成版）

## 你现在得到的东西
- 一个本地电话外呼服务：`POST /call`
- 使用阿里云语音 API：`SingleCallByTts`
- 可被 OpenClaw 的定时任务/脚本触发

目录：
- `server.js`：服务入口
- `.env.example`：环境变量模板

---

## 1) 阿里云侧准备（必须）

在阿里云控制台完成：
1. 开通 **语音服务（Dyvms）**
2. 申请并审核：
   - 外呼显示号码（`ALIYUN_CALLED_SHOW_NUMBER`）
   - 语音模板（`ALIYUN_TTS_CODE`）
     - 模板参数里建议用 `text`，例如：`${text}`
3. 创建 RAM 子账号并授予最小权限（可调用 `dyvmsapi:SingleCallByTts`）
4. 拿到 AccessKey：
   - `ALIBABA_ACCESS_KEY_ID`
   - `ALIBABA_ACCESS_KEY_SECRET`

---

## 2) 本地配置

```bash
cd ~/.openclaw/workspace/voice-call-aliyun
cp .env.example .env
# 编辑 .env 填入你的阿里云参数
```

---

## 3) 启动服务

```bash
cd ~/.openclaw/workspace/voice-call-aliyun
node server.js
```

看到：`aliyun voice call service listening on :3099` 即成功。

健康检查：
```bash
curl http://127.0.0.1:3099/health
```

---

## 4) 手动测试外呼

```bash
curl -X POST http://127.0.0.1:3099/call \
  -H 'Content-Type: application/json' \
  -d '{
    "to":"你的手机号(含国家码，如+86xxxxxxxxxxx)",
    "text":"Boss，现在是提醒时间，请开始拉伸十分钟",
    "playTimes":2,
    "outId":"test-001"
  }'
```

---

## 5) 和 OpenClaw 定时任务集成（推荐做法）

### 5.1 建一个触发脚本
新建 `trigger_call.sh`：

```bash
#!/usr/bin/env bash
curl -sS -X POST http://127.0.0.1:3099/call \
  -H 'Content-Type: application/json' \
  -d '{"to":"+86你的号码","text":"Boss，22点30分了，请做拉伸10分钟","playTimes":2,"outId":"stretch-2230"}'
```

```bash
chmod +x trigger_call.sh
```

### 5.2 让 OpenClaw 定时触发
可用 OpenClaw cron 建立一个 `agentTurn` 任务，消息内容写：
- “执行 ~/.openclaw/workspace/voice-call-aliyun/trigger_call.sh 进行电话提醒”

> 如果你希望我帮你直接建 cron，我可以按你的提醒时间和文案直接落地。

---

## 6) 生产建议（强烈建议）
1. 只允许白名单号码外呼（避免误呼）
2. 夜间静默时间（比如 23:00-08:00）
3. 未接听重拨最多 1~2 次
4. 所有失败都发 Telegram 补提醒
5. `.env` 永不入库

---

## 7) 常见报错
- `Missing env ...`：`.env` 没配完整
- `isv.BUSINESS_LIMIT_CONTROL`：触发频控，需降频
- `isv.OUT_OF_SERVICE`：号码/模板/资质未开通或未审核
- `SignatureDoesNotMatch`：AK/SK 不对或有空格

---

## 8) 下一步我可以帮你做
- 加“确认按1”逻辑
- 加“未接听自动重拨”
- 接入回执并写入每日提醒成功率报表
