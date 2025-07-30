#!/bin/bash

# PDF转换工具启动脚本
# 使用Python直接运行GUI界面

echo "🚀 启动PDF转换工具..."

# 检查Python环境
if [ ! -d ".venv" ]; then
    echo "❌ 虚拟环境不存在，请先创建："
    echo "   uv venv"
    echo "   source .venv/bin/activate"
    echo "   uv pip install -e ."
    exit 1
fi

# 检查GUI脚本是否存在
if [ ! -f "office2pdf/run_gui.py" ]; then
    echo "❌ GUI脚本不存在: office2pdf/run_gui.py"
    exit 1
fi

# 激活虚拟环境
echo "� 激活虚拟环境..."
source .venv/bin/activate

# 检查依赖
echo "📦 检查依赖..."
python -c "import office2pdf" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "⚠️  依赖缺失，正在安装..."
    uv pip install -e .
fi

# 启动GUI
echo "📱 启动图形界面..."
python office2pdf/run_gui.py

echo ""
echo "💡 提示："
echo "   - 如需重新启动，运行: ./start_app.sh"
echo "   - 如需验证安装，运行: python office2pdf/verify_installation.py"
echo "   - 如需命令行转换，运行: python -m office2pdf.converter file.txt"
