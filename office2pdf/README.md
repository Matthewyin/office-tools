# 多格式文件转PDF工具 v2.0

一个功能强大的Python工具包，支持多种格式文件转换为PDF，包括Office文件、文本文件、Markdown文件等。

## 🚀 快速开始

### 安装依赖
```bash
# 创建虚拟环境（推荐使用uv）
uv venv
source .venv/bin/activate

# 安装项目依赖
uv pip install -e .
```

### 启动GUI界面
```bash
# 简化版GUI（推荐，macOS兼容）
python run_gui_simple.py

# 标准版GUI
python run_gui.py
```

### 命令行使用
```bash
# 转换单个文件
python -m office2pdf.converter document.txt

# 批量转换目录
python -m office2pdf.converter /path/to/files -r -w 4
```

## 🆕 v2.0 新功能

- ✅ **扩展格式支持**: 新增txt、md、drawio文件转换
- ✅ **图形用户界面**: 提供友好的GUI界面，支持文件选择按钮
- ✅ **Mac应用打包**: 可打包为原生Mac应用程序
- ✅ **性能优化**: 保留并优化了并发处理功能
- ✅ **向后兼容**: 完全兼容v1.0的所有功能

## 📋 支持的文件格式

| 类型 | 扩展名 | 转换方式 | 说明 |
|------|--------|----------|------|
| **Office文件** | `.docx`, `.doc`, `.xlsx`, `.xls`, `.pptx`, `.ppt` | LibreOffice | 完整支持 |
| **文本文件** | `.txt` | ReportLab | 纯文本转PDF |
| **Markdown文件** | `.md`, `.markdown` | Markdown + ReportLab | 支持基本格式 |
| **Draw.io文件** | `.drawio`, `.dio` | Draw.io Desktop | 需要额外安装 |

## 🛠️ 系统要求

### 最低要求
- **Python**: 3.8+ 
- **LibreOffice**: 用于Office文件转换
- **操作系统**: Windows, macOS, Linux

### 推荐配置
- **Python**: 3.10+
- **内存**: 4GB RAM 或更多
- **存储**: 至少500MB可用空间

## 📦 安装说明

### 1. 安装LibreOffice
```bash
# macOS
brew install --cask libreoffice

# Ubuntu/Debian
sudo apt-get install libreoffice

# Windows
# 从官网下载安装: https://www.libreoffice.org/
```

### 2. 安装Draw.io Desktop（可选）
```bash
# macOS
brew install --cask drawio

# 或从GitHub下载: https://github.com/jgraph/drawio-desktop
```

### 3. 安装Python依赖
```bash
# 使用uv（推荐）
uv pip install -e .

# 或使用pip
pip install -e .
```

## 🎯 使用方法

### GUI界面使用

#### 1. 启动应用
```bash
# 简化版（推荐）
python run_gui_simple.py
```

#### 2. 操作步骤
1. **选择文件**: 点击"选择文件"按钮选择要转换的文件
2. **选择目录**: 点击"选择目录"按钮选择包含文件的目录
3. **设置选项**: 配置输出目录、递归处理、并发数等
4. **开始转换**: 点击"开始转换"按钮并查看实时日志

### 命令行使用

#### 基本用法
```bash
# 转换单个文件
python -m office2pdf.converter document.docx

# 转换多种格式
python -m office2pdf.converter file.txt file.md file.docx

# 批量转换目录
python -m office2pdf.converter /path/to/files -r

# 指定输出目录和并发数
python -m office2pdf.converter /path/to/files -o /output -w 4
```

#### 高级选项
```bash
# 递归处理子目录
python -m office2pdf.converter /path/to/files --recursive

# 设置并发线程数
python -m office2pdf.converter /path/to/files --workers 8

# 顺序处理（禁用并发）
python -m office2pdf.converter /path/to/files --sequential
```

### 编程接口

#### 基本使用
```python
from office2pdf import UniversalConverter

# 创建转换器
converter = UniversalConverter(output_dir="/path/to/output")

# 转换单个文件
success = converter.convert_file("document.md")

# 批量转换目录
stats = converter.convert_directory("/path/to/files", recursive=True)
print(f"成功: {stats['success']}, 失败: {stats['failed']}")
```

#### 高级配置
```python
from office2pdf import UniversalConverter

# 创建高性能转换器
converter = UniversalConverter(
    output_dir="/path/to/output",
    max_workers=4  # 并发线程数
)

# 转换并获取详细结果
success = converter.convert_file("document.txt")
if success:
    print("转换成功")
else:
    print("转换失败，请查看日志")

# 清理资源
converter.cleanup()
```

## ⚙️ 配置选项

### 环境变量配置
可以通过环境变量或`.env`文件配置：

```bash
# 转换超时时间（秒）
CONVERSION_TIMEOUT=300

# 日志级别
LOG_LEVEL=INFO

# 日志目录
LOG_DIR=logs

# 跳过临时文件
SKIP_TEMP_FILES=true

# 覆盖已存在的PDF文件
OVERWRITE_EXISTING=false

# PDF质量设置
PDF_QUALITY=standard
```

### 配置文件示例
创建`.env`文件：
```env
CONVERSION_TIMEOUT=600
LOG_LEVEL=DEBUG
OVERWRITE_EXISTING=true
PDF_QUALITY=high
```

## 🔧 故障排除

### 常见问题

#### 1. LibreOffice未找到
```bash
# 检查安装
which soffice

# macOS安装
brew install --cask libreoffice

# 验证安装
soffice --version
```

#### 2. GUI崩溃问题
```bash
# 使用简化版GUI
python run_gui_simple.py

# 或使用命令行版本
python -m office2pdf.converter
```

#### 3. 转换失败
- 检查文件是否损坏
- 确认文件格式是否支持
- 查看日志文件获取详细错误信息
- 确保有足够的磁盘空间

#### 4. 权限问题
- 确保有读取源文件的权限
- 确保输出目录可写
- 在macOS上可能需要授予应用权限

### 日志文件
转换日志保存在`logs/`目录下，包含详细的转换信息和错误信息。

## 📚 详细文档

- **[用户操作手册](USER_MANUAL.md)** - 完整的用户操作指南
- **[系统架构文档](ARCHITECTURE.md)** - 技术架构和设计说明
- **[GUI使用指南](GUI_USER_GUIDE.md)** - 图形界面详细使用说明
- **[Mac应用打包指南](MAC_APP_GUIDE.md)** - 打包为Mac应用的完整指南
- **[故障排除指南](GUI_TROUBLESHOOTING.md)** - 常见问题解决方案

## 🏗️ 项目结构

```
office2pdf/
├── __init__.py              # 包初始化
├── converter.py             # 通用转换器核心
├── gui.py                   # 标准GUI界面
├── config.py                # 配置管理
├── utils.py                 # 工具函数
├── README.md                # 详细说明文档
├── ARCHITECTURE.md          # 系统架构文档
├── USER_MANUAL.md           # 用户操作手册
├── GUI_USER_GUIDE.md        # GUI使用指南
├── MAC_APP_GUIDE.md         # Mac应用打包指南
└── GUI_TROUBLESHOOTING.md   # 故障排除指南
```

## 📄 许可证

MIT License

## 👨‍💻 作者

Matthew Yin (2738550@qq.com)

---

*最后更新: 2025-07-30*
