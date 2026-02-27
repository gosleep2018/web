# DR Model Policy

生效时间：2026-02-19

## 主备链路
1. 主：`anthropic/claude-sonnet-4-5`
2. 备1：`openai-codex/gpt-5.3-codex`
3. 备2：`deepseek/deepseek-chat`
4. 备3：`deepseek/deepseek-reasoner`

## 快速切换口令（对话中）
- 切到 Claude
- 切到 GPT
- 切到 DeepSeek

## 说明
- 默认自动按主备顺序容错切换。
- Gemini 待授权完成后再加入备用链。