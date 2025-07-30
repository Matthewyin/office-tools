#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
多格式文件转PDF工具 - GUI启动脚本

直接启动图形界面版本的转换工具。

作者: Matthew Yin
日期: 2025-07-30
"""

import sys
from pathlib import Path

# 添加项目路径到Python路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

try:
    from office2pdf.gui import main
    
    if __name__ == "__main__":
        main()
        
except ImportError as e:
    print(f"导入错误: {e}")
    print("请确保已安装所有依赖包:")
    print("  pip install -e .")
    sys.exit(1)
except Exception as e:
    print(f"启动错误: {e}")
    sys.exit(1)
