# 多格式文件转PDF工具 v2.0

一个功能强大的Python工具，支持多种格式文件转换为PDF，包括Office文件、文本文件、Markdown文件等。

## 🆕 v2.0 新功能

- ✅ **扩展格式支持**: 新增txt、md、drawio文件转换
- ✅ **图形用户界面**: 提供友好的GUI界面
- ✅ **Mac应用打包**: 可打包为原生Mac应用程序
- ✅ **性能优化**: 保留并优化了并发处理功能
- ✅ **向后兼容**: 完全兼容v1.0的所有功能

## 🚀 快速开始

### 安装依赖

```bash
# 创建虚拟环境（推荐使用uv）
uv venv
source .venv/bin/activate

# 安装项目依赖
uv pip install -e .
```

### 使用方法

#### 1. 图形界面（推荐）
```bash
python run_gui.py
```

#### 2. 命令行使用
```bash
# 转换单个文件
python -m office2pdf.converter document.docx

# 批量转换目录
python -m office2pdf.converter /path/to/files -r

# 指定输出目录和并发数
python -m office2pdf.converter /path/to/files -o /output -w 4
```

#### 3. 编程接口
```python
from office2pdf import UniversalConverter

converter = UniversalConverter()
success = converter.convert_file("document.md")
```

### 验证安装

```bash
python verify_installation.py
```

### 测试新功能

```bash
python test_new_features.py
```

## 📋 支持的文件格式

| 类型 | 扩展名 | 说明 |
|------|--------|------|
| **Office文件** | `.docx`, `.doc`, `.xlsx`, `.xls`, `.pptx`, `.ppt` | 使用LibreOffice转换 |
| **文本文件** | `.txt` | 使用ReportLab生成PDF |
| **Markdown文件** | `.md` | 解析Markdown后生成PDF |
| **Draw.io文件** | `.drawio` | 需要安装Draw.io Desktop |

## 🖥️ Mac应用打包

本工具可以打包为原生Mac应用程序：

```bash
# 安装打包依赖
uv pip install -e ".[gui]"

# 打包为Mac应用
python setup_app.py py2app
```

详细说明请查看 [MAC_APP_GUIDE.md](MAC_APP_GUIDE.md)

## 📖 详细文档

请查看 [office2pdf/README.md](office2pdf/README.md) 获取完整的使用说明和配置指南。

## ✅ 项目验证

查看 [PROJECT_VALIDATION_REPORT.md](PROJECT_VALIDATION_REPORT.md) 了解项目的验证结果和质量报告。

## 🏗️ 项目结构

```
Officetools/
├── office2pdf/                 # 核心转换包
│   ├── __init__.py            # 包初始化
│   ├── converter.py           # 通用转换器（v2.0新增）
│   ├── gui.py                 # GUI界面（v2.0新增）
│   ├── config.py              # 配置管理
│   ├── utils.py               # 工具函数
│   └── README.md              # 详细文档
├── run_gui.py                 # GUI启动脚本（v2.0新增）
├── setup_app.py               # Mac应用打包脚本（v2.0新增）
├── test_new_features.py       # 新功能测试（v2.0新增）
├── verify_installation.py     # 安装验证脚本
├── MAC_APP_GUIDE.md           # Mac应用打包指南（v2.0新增）
├── pyproject.toml             # 项目配置
└── README.md                  # 项目说明
```

## 🛠️ 系统要求

- Python 3.8+
- LibreOffice（用于实际转换）

## 📄 许可证

MIT License

## 👨‍💻 作者

Matthew Yin (2738550@qq.com)