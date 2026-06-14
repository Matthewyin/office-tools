#!/bin/bash
# 启动脚本：由 launchd 调用，使用 homebrew 的 node 环境运行 vite dev server
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd /Users/matthewyin/Coding/Officetools/sidebar
exec /opt/homebrew/bin/npx vite
