# Office文件工具集

一个功能强大的Python工具集合，提供多种办公文件处理功能。

## 🚀 快速开始

### 安装依赖
```bash
# 创建虚拟环境（推荐使用uv）
uv venv
source .venv/bin/activate

# 安装项目依赖
uv pip install -e .
```

### 启动应用
```bash
# 启动GUI界面
python office2pdf/run_gui.py

# 验证安装
python office2pdf/verify_installation.py
```

## 📁 项目结构

```text
Officetools/
├── pyproject.toml           # 项目配置文件
├── README.md               # 项目总体说明
└── office2pdf/             # Office转PDF工具模块
    ├── icons/              # 应用图标资源
    ├── run_gui.py          # GUI启动脚本
    ├── setup_app.py        # Mac应用打包脚本
    ├── verify_installation.py # 安装验证脚本
    ├── README.md           # 详细使用文档
    ├── BUILD_INSTRUCTIONS.md # 构建说明
    ├── ARCHITECTURE.md     # 技术架构文档
    └── [核心代码文件]       # 转换器实现
```

## 🛠️ 功能模块

### 1. Office2PDF - 多格式文件转PDF工具

**功能特性**：
- ✅ 支持多种格式：Office文件、txt、md、drawio转换为PDF
- ✅ 图形用户界面，支持文件选择按钮
- ✅ 命令行批量处理
- ✅ Mac应用打包支持
- ✅ 跨平台兼容（Windows、macOS、Linux）

**快速使用**：
```bash
# GUI界面
python office2pdf/run_gui.py

# 命令行转换
python -m office2pdf.converter document.txt

# Mac应用打包
python office2pdf/setup_app.py py2app
```

**详细文档**：[office2pdf/README.md](office2pdf/README.md)

## 🔮 未来规划

项目采用模块化设计，为将来添加更多办公文件处理功能预留了空间：

- 📊 **Excel数据分析工具** - 数据处理和可视化
- 📝 **Word文档批处理** - 模板生成和格式转换
- 🎨 **PPT自动生成器** - 基于数据自动生成演示文稿
- 📧 **邮件批量处理** - 邮件模板和批量发送
- 🔄 **文档格式转换器** - 更多格式间的相互转换

## 📚 文档导航

- **[Office2PDF详细文档](office2pdf/README.md)** - 完整的使用指南
- **[技术架构文档](office2pdf/ARCHITECTURE.md)** - 系统设计说明
- **[Mac应用构建指南](office2pdf/BUILD_INSTRUCTIONS.md)** - 打包说明

## 🤝 贡献指南

欢迎贡献新的功能模块！请遵循以下结构：

1. 在根目录创建新的功能模块目录
2. 每个模块包含完整的文档和测试
3. 保持根目录的简洁性
4. 遵循现有的代码规范

## 📄 许可证

MIT License

## 👨‍💻 作者

Matthew Yin (2738550@qq.com)

---

*最后更新: 2025-07-30*