# 酷狗音乐榜单变化监控

自动抓取酷狗TOP500榜单，对比每日变化并生成报告。

## 功能
- 每日自动抓取酷狗TOP500榜单前20名
- 对比昨日数据，识别新上榜、排名变动、排名不变歌曲
- 保存JSON数据到 `data/kugou-charts/YYYY-MM-DD.json`
- 输出可读的变化报告

## 安装
```bash
cd /Users/lin/.openclaw/workspace/scripts/kugou-chart-monitor
npm install
```

## 使用
### 手动运行
```bash
npm start
```

### 接OpenClaw cron
创建cron任务，每天固定时间运行：
```bash
node /Users/lin/.openclaw/workspace/scripts/kugou-chart-monitor.js
```

## 输出示例
```
=== 酷狗TOP500榜单变化报告 (2026-02-17) ===
总计: 20 首歌曲

📈 新上榜 (2):
  3. 歌曲A - 歌手A
  15. 歌曲B - 歌手B

🔄 排名变动 (5):
  2 → 1 ↑1位: 歌曲C - 歌手C
  1 → 2 ↓1位: 歌曲D - 歌手D

⏸️ 排名不变 (13):
  4. 歌曲E - 歌手E
  ...
```

## 数据存储
- `data/kugou-charts/2026-02-17.json` - 完整榜单数据+变化分析
- 历史文件按日期保存，便于回溯

## 后续扩展
- 增加更多榜单（飙升榜、新歌榜等）
- 发送Telegram/微信通知
- 生成可视化图表
