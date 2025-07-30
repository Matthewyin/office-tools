#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Mac应用打包脚本

使用py2app将多格式文件转PDF工具打包为Mac应用程序。

使用方法:
1. 安装依赖: pip install py2app
2. 构建应用: python setup_app.py py2app
3. 清理构建: python setup_app.py clean

作者: Matthew Yin
日期: 2025-07-30
"""

from setuptools import setup
import sys
import os
from pathlib import Path

# 应用信息
APP_NAME = "PDF转换工具"
APP_VERSION = "2.0.0"
APP_AUTHOR = "Matthew Yin"

# 主脚本
APP_SCRIPT = 'office2pdf/gui.py'

# 应用选项
OPTIONS = {
    'argv_emulation': True,
    'iconfile': None,  # 可以添加.icns图标文件
    'plist': {
        'CFBundleName': APP_NAME,
        'CFBundleDisplayName': APP_NAME,
        'CFBundleGetInfoString': f"{APP_NAME} {APP_VERSION}",
        'CFBundleIdentifier': 'com.matthewyin.pdfconverter',
        'CFBundleVersion': APP_VERSION,
        'CFBundleShortVersionString': APP_VERSION,
        'NSHumanReadableCopyright': f'Copyright © 2025 {APP_AUTHOR}. All rights reserved.',
        'NSHighResolutionCapable': True,
        'LSMinimumSystemVersion': '10.12',
        'CFBundleDocumentTypes': [
            {
                'CFBundleTypeName': 'Office Documents',
                'CFBundleTypeRole': 'Viewer',
                'LSItemContentTypes': [
                    'org.openxmlformats.wordprocessingml.document',
                    'org.openxmlformats.spreadsheetml.sheet',
                    'org.openxmlformats.presentationml.presentation',
                    'com.microsoft.word.doc',
                    'com.microsoft.excel.xls',
                    'com.microsoft.powerpoint.ppt'
                ]
            },
            {
                'CFBundleTypeName': 'Text Documents',
                'CFBundleTypeRole': 'Viewer',
                'LSItemContentTypes': [
                    'public.plain-text',
                    'net.daringfireball.markdown'
                ]
            },
            {
                'CFBundleTypeName': 'Draw.io Documents',
                'CFBundleTypeRole': 'Viewer',
                'CFBundleTypeExtensions': ['drawio', 'dio']
            }
        ]
    },
    'packages': [
        'office2pdf',
        'reportlab',
        'markdown',
        'weasyprint',
        'PIL'
    ],
    'includes': [
        'tkinter',
        'tkinter.ttk',
        'tkinter.filedialog',
        'tkinter.messagebox',
        'tkinter.scrolledtext'
    ],
    'excludes': [
        'test',
        'tests',
        'pytest',
        'numpy.tests',
        'pandas.tests'
    ],
    'resources': [],
    'frameworks': [],
    'site_packages': True
}

# 数据文件
DATA_FILES = []

def main():
    """主函数"""
    if len(sys.argv) == 1:
        print("使用方法:")
        print("  python setup_app.py py2app     # 构建应用")
        print("  python setup_app.py clean      # 清理构建文件")
        return
    
    # 检查主脚本是否存在
    if not Path(APP_SCRIPT).exists():
        print(f"错误: 找不到主脚本文件 {APP_SCRIPT}")
        return
    
    # 设置构建选项
    setup(
        app=[APP_SCRIPT],
        name=APP_NAME,
        version=APP_VERSION,
        author=APP_AUTHOR,
        description="多格式文件转PDF工具",
        data_files=DATA_FILES,
        options={'py2app': OPTIONS},
        setup_requires=['py2app'],
    )

if __name__ == '__main__':
    main()
