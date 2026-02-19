# Azure TTS 公网部署说明（单词项目）

## 1) 在 Render 新建 Web Service
- 选择仓库：`gosleep2018/web`（或当前工作仓库）
- Render 会读取 `render.yaml` 自动建服务

## 2) 设置环境变量（必填）
- `AZURE_TTS_API_KEY` = 你的 Azure Speech Key
- `AZURE_TTS_REGION` = `eastus`（或你的区域）
- `ALLOWED_ORIGINS` = `https://gosleep2018.github.io`

## 3) 部署成功后拿到域名
示例：`https://azure-tts-proxy.onrender.com`

健康检查：
`https://你的域名/health`

## 4) 让网页强制使用 Azure 发音
打开：
`https://gosleep2018.github.io/web/?tts=https://你的域名/tts`

首次打开后地址会写入 localStorage，后续可直接访问：
`https://gosleep2018.github.io/web/`

## 5) 排错
- 页面仍是浏览器发音：检查 `/health` 是否返回 `status: ok`
- 403/CORS：确认 `ALLOWED_ORIGINS` 包含 `https://gosleep2018.github.io`
- 500：检查 Render 日志与 Azure key/region 是否正确
