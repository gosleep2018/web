#!/bin/bash
# 使用GitHub API推送文件
# 需要设置环境变量 GITHUB_TOKEN

if [ -z "$GITHUB_TOKEN" ]; then
    echo "错误: 需要设置 GITHUB_TOKEN 环境变量"
    echo "请运行: export GITHUB_TOKEN=你的GitHub个人访问令牌"
    exit 1
fi

REPO="gosleep2018/web"
BRANCH="main"
FILE_PATH="index.html"

# 使用正确的base64命令（Mac和Linux兼容）
if command -v gbase64 &> /dev/null; then
    FILE_CONTENT=$(gbase64 -w0 index.html)
elif command -v base64 &> /dev/null; then
    # Mac的base64需要-i参数
    FILE_CONTENT=$(base64 -i index.html)
else
    echo "错误: 找不到base64命令"
    exit 1
fi

echo "正在获取文件SHA..."
# 获取当前文件的SHA（如果存在）
SHA=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/$REPO/contents/$FILE_PATH?ref=$BRANCH" | \
  grep -o '"sha":"[^"]*"' | cut -d'"' -f4)

echo "文件SHA: $SHA"

# 创建JSON数据
if [ -z "$SHA" ]; then
    echo "创建新文件..."
    DATA='{"message":"Add vocabulary learning webpage","content":"'$FILE_CONTENT'","branch":"'$BRANCH'"}'
else
    echo "更新现有文件..."
    DATA='{"message":"Update vocabulary learning webpage","content":"'$FILE_CONTENT'","sha":"'$SHA'","branch":"'$BRANCH'"}'
fi

echo "正在推送文件到GitHub..."
# 推送文件
RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Content-Type: application/json" \
  -d "$DATA" \
  "https://api.github.com/repos/$REPO/contents/$FILE_PATH")

# 分离响应体和状态码
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP状态码: $HTTP_CODE"
echo "响应: $RESPONSE_BODY"

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo "✅ 成功！网页已推送到GitHub。"
    echo "📁 访问地址: https://gosleep2018.github.io/web/"
else
    echo "❌ 推送失败。"
    echo "可能的原因:"
    echo "1. 令牌权限不足（需要repo权限）"
    echo "2. 仓库不存在或没有访问权限"
    echo "3. 令牌已过期"
fi
