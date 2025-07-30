# GUI故障排除指南

## 🐛 macOS GUI问题修复

### 问题描述
在macOS上运行GUI时可能遇到以下错误：
```
NSInvalidArgumentException: *** -[__NSArrayM insertObject:atIndex:]: object cannot be nil
```

这是由于macOS上Tkinter文件对话框的兼容性问题导致的。

### 🔧 解决方案

#### 方案1: 使用简化版GUI（推荐）
```bash
python run_gui_simple.py
```

简化版GUI特点：
- ✅ 避免了文件对话框兼容性问题
- ✅ 手动输入文件路径，更加可控
- ✅ 支持所有核心转换功能
- ✅ 实时转换日志和进度显示

#### 方案2: 使用命令行版本
```bash
# 转换单个文件
python -m office2pdf.converter document.txt

# 批量转换目录
python -m office2pdf.converter /path/to/files -r -w 4

# 指定输出目录
python -m office2pdf.converter /path/to/files -o /output/dir
```

#### 方案3: 使用编程接口
```python
from office2pdf import UniversalConverter

converter = UniversalConverter(output_dir="/output/path")
success = converter.convert_file("document.md")
```

### 📝 使用简化版GUI的步骤

1. **启动应用**：
   ```bash
   python run_gui_simple.py
   ```

2. **输入文件路径**：
   - 单个文件：`/Users/username/document.txt`
   - 多个文件：`/Users/username/doc1.txt;/Users/username/doc2.md`
   - 目录：`/Users/username/documents/`

3. **设置选项**：
   - 输出目录（可选）
   - 递归处理子目录
   - 并发线程数

4. **开始转换**：
   - 点击"开始转换"按钮
   - 查看实时转换日志

### 🎯 功能验证

#### 测试核心转换功能
```bash
python -c "
import tempfile
from pathlib import Path
from office2pdf import UniversalConverter

# 创建测试文件
with tempfile.TemporaryDirectory() as temp_dir:
    temp_path = Path(temp_dir)
    
    # 创建文本文件
    txt_file = temp_path / 'test.txt'
    txt_file.write_text('测试内容', encoding='utf-8')
    
    # 转换
    converter = UniversalConverter(output_dir=str(temp_path))
    success = converter.convert_file(txt_file)
    
    if success:
        pdf_file = temp_path / 'test.pdf'
        if pdf_file.exists():
            print('✅ 转换功能正常')
        else:
            print('❌ PDF文件未生成')
    else:
        print('❌ 转换失败')
"
```

#### 测试GUI导入
```bash
python -c "
try:
    from office2pdf.gui import ConverterGUI
    print('✅ 原版GUI模块可导入')
except Exception as e:
    print(f'❌ 原版GUI导入失败: {e}')

try:
    import run_gui_simple
    print('✅ 简化版GUI模块可导入')
except Exception as e:
    print(f'❌ 简化版GUI导入失败: {e}')
"
```

### 🔍 常见问题

#### Q1: 简化版GUI无法启动
**A1**: 检查依赖是否完整安装：
```bash
source .venv/bin/activate
uv pip install -e .
```

#### Q2: 转换功能不工作
**A2**: 检查系统要求：
- LibreOffice是否安装：`which soffice`
- Python依赖是否完整：`python -c "import reportlab, markdown"`

#### Q3: 文件路径输入格式
**A3**: 路径格式示例：
- macOS: `/Users/username/Documents/file.txt`
- 多文件: `file1.txt;file2.md;file3.docx`
- 目录: `/Users/username/Documents/`

#### Q4: 权限问题
**A4**: 确保：
- 有读取源文件的权限
- 输出目录可写
- 应用有必要的系统权限

### 🚀 性能优化建议

1. **并发设置**：
   - 小文件：可设置4-8个线程
   - 大文件：建议2-4个线程
   - 系统资源有限：使用1个线程

2. **批量处理**：
   - 使用目录模式而非逐个文件
   - 启用递归处理子目录
   - 合理设置输出目录

3. **系统资源**：
   - 确保足够的磁盘空间
   - 关闭不必要的应用程序
   - 监控内存使用情况

### 📋 技术说明

#### 原版GUI vs 简化版GUI

| 特性 | 原版GUI | 简化版GUI |
|------|---------|-----------|
| 文件选择 | 文件对话框 | 手动输入路径 |
| macOS兼容性 | 可能有问题 | 完全兼容 |
| 功能完整性 | 100% | 100% |
| 用户体验 | 更友好 | 更稳定 |

#### 错误原因分析
macOS上的Tkinter文件对话框在某些情况下会传递nil对象给NSArray，导致崩溃。这是一个已知的跨平台兼容性问题。

### 📞 获取帮助

如果仍然遇到问题，请：

1. 查看转换日志获取详细错误信息
2. 尝试使用命令行版本验证核心功能
3. 检查系统要求和依赖安装
4. 使用简化版GUI避免兼容性问题

---

*最后更新: 2025-07-30*
