# moomoo / Futu 新加坡账户 API 快速接入（中文）

## 1) 安装依赖
```bash
python3 -m pip install --upgrade pip
python3 -m pip install futu-api python-dotenv
```

## 2) 启动 OpenD
- 从 Futu OpenAPI 官方页面下载并启动 OpenD
- 确认监听端口（通常 11111）

## 3) 准备配置
```bash
cd moomoo_setup
cp .env.example .env
```
然后编辑 `.env`，至少填：
- `MOOMOO_HOST`
- `MOOMOO_PORT`
- `MOOMOO_ENV`（先用 `SIM`）
- `MOOMOO_ACCOUNT_ID`
- `MOOMOO_TRADE_PWD`（交易解锁密码）

## 4) 先做连通性测试（只读）
```bash
python3 check_opend.py
```
看到 `✅ OpenD 连接成功` 才进入下一步。

## 5) 下一步（我来帮你）
连通成功后，我会继续给你：
1. 账户/权限检测脚本
2. 标普500规则引擎（只提醒不下单）
3. 自动下单版（先确认后执行）

## 常见问题
- 连接失败：先确认 OpenD 已启动，端口正确，防火墙未拦截。
- 下单失败：通常是交易解锁未完成或账户权限不足。
