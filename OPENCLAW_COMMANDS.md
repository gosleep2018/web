# OpenClaw 常用命令集合（速查版）

> 面向日常运维与排障，优先覆盖：状态查看、网关管理、模型切换、日志检查、定时任务。

---

## 0) 帮助

```bash
openclaw help
openclaw gateway --help
```

---

## 1) 状态与版本

```bash
openclaw status
```

用途：查看当前服务状态、版本、连接情况。  
排障第一步先跑这个。

---

## 2) Gateway 网关管理（你最常用）

```bash
openclaw gateway status
openclaw gateway start
openclaw gateway stop
openclaw gateway restart
```

典型场景：
- 端口占用/服务异常 → `stop` 后 `start`
- 改配置后重载 → `restart`

---

## 3) 日志查看（macOS 本地）

OpenClaw 常见日志目录：`~/.openclaw/logs/`

```bash
ls -lah ~/.openclaw/logs/
tail -n 80 ~/.openclaw/logs/gateway.log
tail -n 80 ~/.openclaw/logs/gateway.err.log
```

快速定位关键错误：
```bash
grep -Ei "error|failed|timeout|exception" ~/.openclaw/logs/gateway.err.log | tail -n 50
```

---

## 4) 模型与会话（在聊天里用）

> 这些通常通过会话命令或 Agent 工具完成，终端侧重点是配置检查。

### 4.1 聊天内查看当前模型
- 使用：`/status`（会显示当前模型、推理开关等）

### 4.2 聊天内切换模型（常用别名）
- `gpt` → `openai-codex/gpt-5.3-codex`
- `deepseek` / `deepseek-r1`

### 4.3 本地配置文件检查
```bash
cat ~/.openclaw/openclaw.json
```
重点看：
- `agents.defaults.model.primary`
- `agents.defaults.model.fallbacks`
- `models.providers`

---

## 5) 定时任务 / 自动任务（常见自检动作）

```bash
openclaw status
```

然后结合日志看最近执行：
```bash
tail -n 120 ~/.openclaw/logs/gateway.log
```

如果你有脚本任务（如 HotNews）：
```bash
python3 /Users/lin/.openclaw/workspace/scripts/update_three_perspective_news.py
```

---

## 6) 常见故障一键处理套路

### 6.1 报错：Gateway already running / Port in use
```bash
openclaw gateway stop
openclaw gateway start
openclaw gateway status
```

### 6.2 报错：配置变更后不生效
```bash
openclaw gateway restart
openclaw status
```

### 6.3 报错：模型切换后看起来没生效
1. 在聊天里执行 `/status` 确认当前模型
2. 必要时重切一次模型
3. 查看 `gateway.err.log` 末尾关键报错

---

## 7) 你这台机器的常用路径

```text
工作区: /Users/lin/.openclaw/workspace
配置:   /Users/lin/.openclaw/openclaw.json
日志:   /Users/lin/.openclaw/logs/
```

---

## 8) 最短排障清单（30秒版）

```bash
openclaw status
openclaw gateway status
tail -n 50 ~/.openclaw/logs/gateway.err.log
```

看完这三条，80%问题都能先定位方向。
