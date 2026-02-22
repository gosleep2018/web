# 综合服务网页（前后端）

## 入口页面（含 email 字样）
- `web_pages/portal/comprehensive_email_dashboard.html`

## 后端 API
- `scripts/comprehensive_dashboard_api.py`
- 默认监听：`http://127.0.0.1:8788`

## 启动步骤
```bash
export DASHBOARD_EMAIL_PASSWORD='你自己的邮件区密码'
export DASHBOARD_REMINDER_PASSWORD='你自己的提醒区密码'
python3 /Users/lin/.openclaw/workspace/scripts/comprehensive_dashboard_api.py
```

然后在浏览器打开：
- `file:///Users/lin/.openclaw/workspace/web_pages/portal/comprehensive_email_dashboard.html`

## 功能
1. 网址导航（你现有网页服务地址）
2. 邮件服务（密码区）：调用 Gmail 每日汇总脚本
3. 提醒服务（密码区）：拉取近三个月 NUS 提醒

## 备注
- 邮件区使用 `gmail_daily_report.py`，垃圾邮件只显示数量+发件人。
- 两个密码区互相独立。
