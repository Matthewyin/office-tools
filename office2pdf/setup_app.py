#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Mac应用打包脚本

使用py2app将多格式文件转PDF工具打包为Mac应用程序。

使用方法:
1. 安装依赖: uv pip install py2app
2. 构建应用: python setup_app.py py2app
3. 清理构建: python setup_app.py clean

注意: 推荐使用uv进行依赖管理，速度更快且更可靠

作者: Matthew Yin
日期: 2025-07-30
"""

import sys
import subprocess
from pathlib import Path

# 尝试导入setuptools，如果失败则安装
try:
    from setuptools import setup
except ImportError:
    print("📦 setuptools未安装，正在安装...")
    try:
        # 尝试使用uv
        subprocess.run(['uv', 'pip', 'install', 'setuptools'], check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        # 回退到pip
        subprocess.run(['pip', 'install', 'setuptools'], check=True)

    from setuptools import setup

# 应用信息
APP_NAME = "PDF转换工具"
APP_VERSION = "2.0.0"
APP_AUTHOR = "Matthew Yin"

# 主脚本
APP_SCRIPT = 'office2pdf/run_gui.py'

# 应用选项
OPTIONS = {
    'argv_emulation': True,
    'iconfile': 'office2pdf/icons/o2p_icon.icns',  # O2P图标文件
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

def check_and_install_dependencies():
    """检查并安装必要的依赖"""
    print("🔍 检查打包依赖...")

    # 检查是否有uv
    try:
        result = subprocess.run(['uv', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ 找到uv: {result.stdout.strip()}")
            install_cmd = ['uv', 'pip', 'install']
        else:
            raise FileNotFoundError
    except FileNotFoundError:
        print("⚠️  未找到uv，使用pip")
        install_cmd = ['pip', 'install']

    # 检查py2app
    try:
        import py2app
        print(f"✅ py2app已安装: {py2app.__version__}")
    except ImportError:
        print("📦 安装py2app...")
        try:
            subprocess.run(install_cmd + ['py2app'], check=True)
            print("✅ py2app安装成功")
        except subprocess.CalledProcessError as e:
            print(f"❌ py2app安装失败: {e}")
            return False

    # 检查setuptools
    try:
        import setuptools
        print(f"✅ setuptools已安装: {setuptools.__version__}")
    except ImportError:
        print("📦 安装setuptools...")
        try:
            subprocess.run(install_cmd + ['setuptools'], check=True)
            print("✅ setuptools安装成功")
        except subprocess.CalledProcessError as e:
            print(f"❌ setuptools安装失败: {e}")
            return False

    return True

def main():
    """主函数"""
    if len(sys.argv) == 1:
        print("🍎 Mac应用打包工具")
        print("=" * 50)
        print("使用方法:")
        print("  python setup_app.py py2app     # 构建应用")
        print("  python setup_app.py clean      # 清理构建文件")
        print()
        print("💡 提示:")
        print("  - 推荐使用uv进行依赖管理")
        print("  - 首次运行会自动安装py2app")
        print("  - 构建完成后在dist/目录找到.app文件")
        return

    # 检查并安装依赖
    if not check_and_install_dependencies():
        print("❌ 依赖安装失败，无法继续")
        return
    
    # 检查主脚本是否存在
    if not Path(APP_SCRIPT).exists():
        print(f"❌ 错误: 找不到主脚本文件 {APP_SCRIPT}")
        print("💡 请确保在项目根目录运行此脚本")
        return

    print(f"📱 开始构建Mac应用: {APP_NAME} v{APP_VERSION}")
    print(f"📄 主脚本: {APP_SCRIPT}")
    
    # 设置构建选项
    try:
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

        # 构建成功提示
        if 'py2app' in sys.argv:
            print()
            print("🎉 Mac应用构建完成！")
            print("=" * 50)
            print(f"📁 应用位置: dist/{APP_NAME}.app")
            print("💡 使用提示:")
            print("  - 双击.app文件启动应用")
            print("  - 可以拖拽到Applications文件夹")
            print("  - 首次运行可能需要在系统偏好设置中允许")
            print()

    except Exception as e:
        print(f"❌ 构建失败: {e}")
        print("💡 请检查依赖是否正确安装")

if __name__ == '__main__':
    main()
