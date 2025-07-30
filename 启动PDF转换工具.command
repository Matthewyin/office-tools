#!/bin/bash

# PDF转换工具 - 双击启动脚本
# 可以直接双击运行

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 启动PDF转换工具..."
echo "📁 工作目录: $SCRIPT_DIR"

# 检查虚拟环境
if [ ! -d ".venv" ]; then
    echo ""
    echo "❌ 虚拟环境不存在"
    echo "请先在终端中运行以下命令："
    echo "   cd '$SCRIPT_DIR'"
    echo "   uv venv"
    echo "   source .venv/bin/activate"
    echo "   uv pip install -e ."
    echo ""
    read -p "按回车键退出..."
    exit 1
fi

# 激活虚拟环境
echo "🔧 激活虚拟环境..."
source .venv/bin/activate

# 检查依赖
echo "📦 检查依赖..."
if ! python -c "import office2pdf" 2>/dev/null; then
    echo "⚠️  依赖缺失，正在安装..."
    if command -v uv >/dev/null 2>&1; then
        uv pip install -e .
    else
        pip install -e .
    fi
fi

# 启动GUI
echo "📱 启动图形界面..."
echo ""
python office2pdf/run_gui.py

echo ""
echo "✅ 应用已关闭"
echo "💡 如需重新启动，双击此文件即可"
read -p "按回车键退出..."
