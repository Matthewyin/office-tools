# 机柜部署图生成工具

## 项目概述

本项目是一个基于Python开发的自动化机柜部署图生成工具，能够读取CSV格式的设备清单数据，自动生成符合draw.io（diagrams.net）格式的机柜部署可视化图表。

## 核心特性

### 🎯 网格化机柜视图
- **精确U位对齐**：设备精确对齐到U位网格，一目了然
- **可视化网格**：每个U位都有可见的网格线，便于验证设备位置
- **统一设计**：所有设备使用统一的浅黄色（#FFFFCC），视觉清晰

### 🏢 多机房支持
- **独立Sheet页**：每个机房生成独立的sheet页
- **智能命名**：sheet页自动按机房名称命名
- **完整分离**：不同机房的设备完全分离，便于管理

### 🔧 智能布局
- **冲突检测**：自动检测并解决U位冲突
- **精确计算**：设备位置与CSV中指定的U位完全对应
- **灵活配置**：支持多种显示模式和配置选项

## 项目结构

```
cabinet_diagram_generator/
├── README.md                 # 项目说明文档
├── docs/                     # 项目文档目录
│   ├── architecture.md       # 架构设计文档
│   └── user_manual.md        # 用户使用手册
├── src/                      # 源代码目录
│   ├── main.py              # 主程序入口
│   ├── config.py            # 配置管理
│   ├── csv_processor.py     # CSV数据处理
│   ├── layout_engine.py     # 布局引擎
│   ├── drawio_generator.py  # Draw.io图形生成
│   ├── models.py            # 数据模型
│   └── utils.py             # 工具函数
├── input/                    # 输入文件目录（不上传到Git）
└── pyproject.toml           # 项目配置文件
```

## 快速开始

### 环境要求

- Python 3.8+
- [uv](https://docs.astral.sh/uv/) 包管理工具（推荐）

### 🎯 交互式使用（推荐）

最简单的使用方式，无需记忆复杂命令：

```bash
cd cabinet_diagram_generator

# 启动交互式界面
uv run python -m src.main

# 或者显式启动交互模式
uv run python -m src.main interactive
```

交互式界面提供：
- 📁 自动发现input目录中的CSV文件
- 🎨 引导式生成机柜部署图
- 🔍 文件验证和预览
- ⚙️ 配置信息查看
- 🌐 自动打开draw.io查看结果

### 命令行使用（高级用户）

如果您更喜欢命令行方式：

```bash
# 生成机柜部署图
uv run python -m src.main generate input/cmdb.csv --output output/cabinet_diagram.drawio

# 验证CSV数据
uv run python -m src.main validate input/cmdb.csv

# 预览布局信息
uv run python -m src.main preview input/cmdb.csv
```

### 使用项目脚本

如果安装了项目，可以使用全局命令：

```bash
# 安装项目到环境中
uv pip install -e .

# 使用全局命令
cabinet-diagram generate input/cmdb.csv --output output/cabinet_diagram.drawio
```

### 传统方式（备选）

如果您更喜欢传统的虚拟环境管理：

```bash
cd cabinet_diagram_generator
uv venv
source .venv/bin/activate  # Linux/macOS
# 或 .venv\Scripts\activate  # Windows
uv pip install -e .

# 然后使用标准Python命令
python -m src.main generate input/cmdb.csv
```

## 输入数据格式

CSV文件支持以下字段：

| 字段名 | 必需 | 说明 | 示例 |
|--------|------|------|------|
| 设备名 | ✅ | 设备名称标识 | intdmzfw01 |
| 型号 | ✅ | 设备具体型号 | USG6635F |
| 设备高度 | ✅ | 设备占用U位数量 | 1U, 2U, 4U |
| 设备用途 | ✅ | 设备类型分类 | 安全防护, 网络核心 |
| 机柜 | ✅ | 设备所属机柜编号 | 1-A01, 2-B02 |
| U位 | ✅ | 设备起始位置 | 18, 20, 37 |
| 机房 | ✅ | 机房编号 | 1, 2, 3 |
| 资产编号 | ❌ | 资产管理编号 | AS001234 |

## 输出特性

生成的draw.io文件包含：

### 📊 多Sheet页结构
- 每个机房对应一个独立的sheet页
- Sheet页名称自动使用机房名称
- 便于按机房查看和管理

### 🎨 网格化视图
- 白色机柜背景
- 浅灰色U位网格线
- 浅黄色设备矩形
- 黑色文字标签

### 📏 精确对齐
- 设备底部与U位底部边界精确对齐
- 设备高度精确覆盖指定的U位数量
- 可视化验证设备位置是否正确

## 开发状态

✅ **项目已完成**

- [x] 需求分析和技术方案设计
- [x] 核心模块开发
- [x] 网格化机柜视图实现
- [x] 多机房Sheet页支持
- [x] U位精确对齐修复
- [x] 文档完善

## 文档

详细文档请参考：
- [架构设计文档](docs/architecture.md) - 了解系统架构和设计原理
- [用户使用手册](docs/user_manual.md) - 详细的使用指南和配置说明

## 许可证

MIT License
