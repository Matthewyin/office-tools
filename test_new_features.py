#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
新功能测试脚本

测试多格式文件转PDF工具的新增功能。

作者: Matthew Yin
日期: 2025-07-30
"""

import tempfile
from pathlib import Path
from office2pdf import UniversalConverter


def create_test_files(temp_dir: Path):
    """创建测试文件"""
    test_files = []
    
    # 创建文本文件
    txt_file = temp_dir / "测试文档.txt"
    txt_content = """这是一个测试文本文件

多格式文件转PDF工具 v2.0

新增功能：
1. 支持文本文件(.txt)转PDF
2. 支持Markdown文件(.md)转PDF  
3. 支持Draw.io文件(.drawio)转PDF
4. 提供图形用户界面
5. 可打包为Mac应用程序

技术特性：
- 并发处理提升转换速度
- 智能文件格式检测
- 详细的转换日志
- 跨平台兼容性

这个文本文件将被转换为PDF格式，
展示文本到PDF的转换功能。

感谢使用我们的工具！
"""
    txt_file.write_text(txt_content, encoding='utf-8')
    test_files.append(txt_file)
    
    # 创建Markdown文件
    md_file = temp_dir / "功能介绍.md"
    md_content = """# 多格式文件转PDF工具 v2.0

## 🚀 新增功能

### 支持的文件格式

- **Office文件**: `.docx`, `.xlsx`, `.pptx`, `.doc`, `.xls`, `.ppt`
- **文本文件**: `.txt`
- **Markdown文件**: `.md`
- **Draw.io文件**: `.drawio`

### 主要特性

1. **多格式支持**
   - 扩展了原有的Office文件支持
   - 新增文本和Markdown文件转换
   - 支持Draw.io图表文件

2. **性能优化**
   - 并发处理多个文件
   - LibreOffice守护进程模式
   - 智能回退机制

3. **用户界面**
   - 图形用户界面(GUI)
   - 拖拽文件支持
   - 实时转换进度

4. **Mac应用**
   - 可打包为原生Mac应用
   - 支持文件关联
   - 系统集成

## 📝 使用示例

### 命令行使用

```bash
# 转换单个文件
python -m office2pdf.converter document.md

# 批量转换目录
python -m office2pdf.converter /path/to/files -r

# 启动GUI界面
python run_gui.py
```

### 编程接口

```python
from office2pdf import UniversalConverter

converter = UniversalConverter()
success = converter.convert_file("document.md")
```

## 🛠️ 技术实现

- **文本转PDF**: 使用ReportLab库
- **Markdown转PDF**: 使用Markdown + WeasyPrint
- **Draw.io转PDF**: 调用Draw.io命令行工具
- **GUI界面**: 基于Tkinter
- **Mac打包**: 使用py2app

## 📊 性能对比

| 功能 | v1.0 | v2.0 |
|------|------|------|
| 支持格式 | 3种 | 7种+ |
| 转换速度 | 标准 | 2-3倍提升 |
| 用户界面 | 命令行 | GUI + 命令行 |
| Mac应用 | 否 | 是 |

---

*这个Markdown文件展示了新版本的功能和特性。*
"""
    md_file.write_text(md_content, encoding='utf-8')
    test_files.append(md_file)
    
    return test_files


def test_conversion():
    """测试转换功能"""
    print("🚀 测试多格式文件转PDF工具 v2.0")
    print("=" * 50)
    
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        print(f"📁 测试目录: {temp_path}")
        
        # 创建测试文件
        print("\n📝 创建测试文件...")
        test_files = create_test_files(temp_path)
        
        for file in test_files:
            print(f"✅ 创建: {file.name}")
        
        # 创建转换器
        print(f"\n🔄 开始转换 {len(test_files)} 个文件...")
        output_dir = temp_path / "pdf_output"
        converter = UniversalConverter(output_dir=str(output_dir))
        
        # 转换文件
        success_count = 0
        for file_path in test_files:
            print(f"\n📄 转换文件: {file_path.name}")
            try:
                if converter.convert_file(file_path):
                    success_count += 1
                    pdf_file = output_dir / f"{file_path.stem}.pdf"
                    if pdf_file.exists():
                        file_size = pdf_file.stat().st_size / 1024  # KB
                        print(f"✅ 转换成功: {pdf_file.name} ({file_size:.1f} KB)")
                    else:
                        print(f"⚠️  转换命令成功但未找到PDF文件")
                else:
                    print(f"❌ 转换失败: {file_path.name}")
            except Exception as e:
                print(f"❌ 转换异常: {e}")
        
        # 总结
        print(f"\n📊 转换结果:")
        print(f"   总文件数: {len(test_files)}")
        print(f"   成功转换: {success_count}")
        print(f"   失败数量: {len(test_files) - success_count}")
        
        if success_count > 0:
            print(f"\n📁 输出目录: {output_dir}")
            if output_dir.exists():
                pdf_files = list(output_dir.glob("*.pdf"))
                print(f"   生成PDF文件: {len(pdf_files)} 个")
                for pdf_file in pdf_files:
                    size_kb = pdf_file.stat().st_size / 1024
                    print(f"   - {pdf_file.name} ({size_kb:.1f} KB)")
        
        print(f"\n🎉 测试完成！")
        
        # 提示用户
        if success_count > 0:
            print(f"\n💡 提示: PDF文件已生成在临时目录中")
            print(f"   如需保留，请在程序结束前复制文件")
            input("按回车键继续...")


def test_gui():
    """测试GUI界面"""
    print("\n🖥️  测试GUI界面...")
    try:
        from office2pdf.gui import ConverterGUI
        print("✅ GUI模块导入成功")
        print("💡 可以运行 'python run_gui.py' 启动图形界面")
    except ImportError as e:
        print(f"❌ GUI模块导入失败: {e}")


def test_dependencies():
    """测试依赖包"""
    print("\n🔍 检查新增依赖...")
    
    dependencies = {
        'reportlab': '文本转PDF支持',
        'markdown': 'Markdown解析支持', 
        'weasyprint': 'HTML/CSS转PDF支持',
        'PIL': '图像处理支持'
    }
    
    for module, description in dependencies.items():
        try:
            __import__(module)
            print(f"✅ {module}: {description}")
        except ImportError:
            print(f"❌ {module}: {description} - 未安装")


def main():
    """主函数"""
    print("🧪 多格式文件转PDF工具 - 新功能测试")
    print("=" * 60)
    
    # 测试依赖
    test_dependencies()
    
    # 测试GUI
    test_gui()
    
    # 测试转换功能
    test_conversion()


if __name__ == "__main__":
    main()
