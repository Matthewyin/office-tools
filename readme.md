# Office转PDF工具

一个功能完整的Python工具，用于将Microsoft Office文件（Word、Excel、PowerPoint）转换为PDF格式。

## 🚀 快速开始

### 安装依赖

```bash
# 创建虚拟环境（推荐使用uv）
uv venv
source .venv/bin/activate

# 安装项目依赖
uv pip install -e .
```

### 验证安装

```bash
python verify_installation.py
```

### 演示转换功能

```bash
python demo_conversion.py
```

## 📖 详细文档

请查看 [office2pdf/README.md](office2pdf/README.md) 获取完整的使用说明和配置指南。

## ✅ 项目验证

查看 [PROJECT_VALIDATION_REPORT.md](PROJECT_VALIDATION_REPORT.md) 了解项目的验证结果和质量报告。

## 🏗️ 项目结构

```
Officetools/
├── office2pdf/                 # 核心转换包
│   ├── __init__.py
│   ├── config.py              # 配置管理
│   ├── office_to_pdf.py       # 标准转换器
│   ├── office_to_pdf_optimized.py  # 优化版转换器
│   ├── utils.py               # 工具函数
│   └── README.md              # 详细文档
├── verify_installation.py     # 安装验证脚本
├── demo_conversion.py         # 转换功能演示
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