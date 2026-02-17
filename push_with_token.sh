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
FILE_CONTENT=$(base64 index.html)

# 获取当前文件的SHA（如果存在）
SHA=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/repos/$REPO/contents/$FILE_PATH?ref=$BRANCH" | \
  grep -o '"sha":"[^"]*"' | cut -d'"' -f4)

# 创建JSON数据
if [ -z "$SHA" ]; then
    # 新文件
    DATA='{"message":"Add vocabulary learning webpage","content":"'$FILE_CONTENT'","branch":"'$BRANCH'"}'
else
    # 更新文件
    DATA='{"message":"Update vocabulary learning webpage","content":"'$FILE_CONTENT'","sha":"'$SHA'","branch":"'$BRANCH'"}'
fi

# 推送文件
curl -X PUT -H "Authorization: token $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$DATA" \
  "https://api.github.com/repos/$REPO/contents/$FILE_PATH"

echo ""
echo "如果成功，你应该能看到提交信息。"
