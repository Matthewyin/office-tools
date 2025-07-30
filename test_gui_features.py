#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
GUI功能测试脚本

测试改进后的GUI文件选择功能和转换能力。

作者: Matthew Yin
日期: 2025-07-30
"""

import tempfile
from pathlib import Path
import sys

# 添加项目路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

def create_test_files():
    """创建测试文件"""
    print("📝 创建测试文件...")
    
    # 创建临时目录
    test_dir = Path.home() / "Desktop" / "PDF转换测试"
    test_dir.mkdir(exist_ok=True)
    
    test_files = []
    
    # 创建文本文件
    txt_file = test_dir / "测试文档.txt"
    txt_content = """多格式文件转PDF工具 v2.0 测试

这是一个测试文本文件，用于验证文本转PDF功能。

主要特性：
1. 支持多种文件格式
2. 图形用户界面
3. 批量转换功能
4. 跨平台兼容

测试时间：2025-07-30
"""
    txt_file.write_text(txt_content, encoding='utf-8')
    test_files.append(txt_file)
    print(f"✅ 创建: {txt_file.name}")
    
    # 创建Markdown文件
    md_file = test_dir / "功能说明.md"
    md_content = """# 多格式文件转PDF工具 v2.0

## 🚀 新增功能

### 文件选择改进
- **文件选择按钮**: 点击选择单个或多个文件
- **目录选择按钮**: 选择包含文件的目录
- **文件预览**: 显示选择的文件信息
- **安全处理**: 避免macOS兼容性问题

### 支持的格式
- Office文件: `.docx`, `.xlsx`, `.pptx`
- 文本文件: `.txt`
- Markdown文件: `.md`
- Draw.io文件: `.drawio`

## 📋 使用步骤

1. 启动GUI界面
2. 点击"选择文件"或"选择目录"
3. 设置转换选项
4. 点击"开始转换"
5. 查看转换结果

## ✅ 测试验证

这个Markdown文件用于测试Markdown转PDF功能。
"""
    md_file.write_text(md_content, encoding='utf-8')
    test_files.append(md_file)
    print(f"✅ 创建: {md_file.name}")
    
    # 创建一个简单的CSV文件（作为不支持格式的示例）
    csv_file = test_dir / "数据表.csv"
    csv_content = """名称,类型,状态
文本文件,txt,支持
Markdown文件,md,支持
CSV文件,csv,不支持
Office文件,docx,支持
"""
    csv_file.write_text(csv_content, encoding='utf-8')
    print(f"✅ 创建: {csv_file.name} (不支持格式)")
    
    return test_dir, test_files

def test_command_line_conversion():
    """测试命令行转换功能"""
    print("\n🧪 测试命令行转换功能...")
    
    try:
        from office2pdf import UniversalConverter
        
        # 创建测试文件
        test_dir, test_files = create_test_files()
        
        # 创建转换器
        output_dir = test_dir / "PDF输出"
        converter = UniversalConverter(output_dir=str(output_dir))
        
        print(f"\n🔄 开始转换 {len(test_files)} 个文件...")
        
        success_count = 0
        for file_path in test_files:
            print(f"\n📄 转换: {file_path.name}")
            try:
                if converter.convert_file(file_path):
                    success_count += 1
                    pdf_file = output_dir / f"{file_path.stem}.pdf"
                    if pdf_file.exists():
                        size_kb = pdf_file.stat().st_size / 1024
                        print(f"✅ 成功: {pdf_file.name} ({size_kb:.1f} KB)")
                    else:
                        print(f"⚠️  转换成功但PDF文件未找到")
                else:
                    print(f"❌ 失败: {file_path.name}")
            except Exception as e:
                print(f"❌ 异常: {e}")
        
        print(f"\n📊 转换结果: {success_count}/{len(test_files)} 成功")
        
        if success_count > 0:
            print(f"\n📁 输出目录: {output_dir}")
            print("💡 您可以在GUI中选择这些文件进行测试")
        
        return test_dir
        
    except Exception as e:
        print(f"❌ 命令行测试失败: {e}")
        return None

def show_gui_instructions(test_dir):
    """显示GUI使用说明"""
    print(f"\n🖥️  GUI测试说明:")
    print("=" * 50)
    print("1. 启动GUI:")
    print("   python run_gui_simple.py")
    print()
    print("2. 测试文件选择:")
    print(f"   - 点击'选择文件'按钮")
    print(f"   - 导航到: {test_dir}")
    print(f"   - 选择测试文件")
    print()
    print("3. 测试目录选择:")
    print(f"   - 点击'选择目录'按钮")
    print(f"   - 选择目录: {test_dir}")
    print()
    print("4. 验证功能:")
    print("   - 查看文件预览信息")
    print("   - 设置转换选项")
    print("   - 开始转换并查看日志")
    print()
    print("5. 预期结果:")
    print("   - 文本和Markdown文件应该转换成功")
    print("   - CSV文件应该被跳过（不支持格式）")
    print("   - 转换日志应该显示详细信息")

def test_gui_import():
    """测试GUI模块导入"""
    print("\n🔍 测试GUI模块...")
    
    try:
        # 测试简化版GUI
        import run_gui_simple
        print("✅ 简化版GUI模块导入成功")
        
        # 测试原版GUI
        from office2pdf.gui import ConverterGUI
        print("✅ 原版GUI模块导入成功")
        
        return True
        
    except Exception as e:
        print(f"❌ GUI模块导入失败: {e}")
        return False

def main():
    """主函数"""
    print("🧪 GUI功能测试")
    print("=" * 60)
    
    # 测试GUI模块导入
    if not test_gui_import():
        print("❌ GUI模块有问题，请检查依赖安装")
        return
    
    # 测试命令行转换功能
    test_dir = test_command_line_conversion()
    
    if test_dir:
        # 显示GUI测试说明
        show_gui_instructions(test_dir)
        
        print(f"\n🎉 测试准备完成！")
        print(f"📁 测试文件位置: {test_dir}")
        print(f"🚀 现在可以启动GUI进行测试:")
        print(f"   python run_gui_simple.py")
    else:
        print("❌ 测试准备失败")

if __name__ == "__main__":
    main()
