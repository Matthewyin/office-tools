# Topotab - 网络拓扑转换工具

[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![uv](https://img.shields.io/badge/uv-enabled-brightgreen.svg)](https://github.com/astral-sh/uv)

一个专业的网络拓扑转换工具，基于**连接关系模型**将 draw.io 网络拓扑图转换为结构化的 CSV 文件，特别优化了中文字符支持和 Excel 兼容性。

## 🎯 核心理念

**连接关系驱动**：采用"一条连接线 = 一条连接关系 = 一条CSV记录"的直观业务模型，每条网络连接包含：
- **源端信息**：父区域 → 所属区域 → 设备（名称、型号、管理地址、机柜、U位）→ 端口（Port-Channel、物理接口、VRF、VLAN、IP）
- **目标端信息**：对应的完整目标端信息
- **链路属性**：互联用途、线缆类型、带宽、备注等

## ✨ 功能特性

- � **连接关系模型**：直观的网络连接业务逻辑，易于理解和维护
- � **标准兼容**：支持任何标准 draw.io 文件，无需特殊格式要求
- 📊 **Excel 优化**：多种编码格式确保 Mac 和 Windows Excel 完美显示中文
- 🚀 **智能解析**：自动识别设备信息、区域层次和端口配置
- ⚙️ **配置驱动**：JSON配置文件支持灵活的字段定义和解析规则
- 🔧 **双接口**：提供现代化 CLI 和 Python API 两种使用方式
- ⚡ **现代工具**：基于 uv 包管理器，快速安装和运行

## 🚀 快速开始

### 安装

```bash
# 克隆项目
git clone https://github.com/Matthewyin/office-tools.git
cd office-tools/toptab

# 使用 uv 安装依赖
uv sync
```

### 基本使用

```bash
# 基本转换（推荐）- 自动使用默认输入输出目录
uv run python -m topotab network.drawio

# 指定输出文件
uv run python -m topotab network.drawio -o topology.csv

# 详细日志模式
uv run python -m topotab network.drawio -v

# 查看帮助
uv run python -m topotab --help
```

## 📖 详细使用

### 主要命令接口

#### 基本语法

```bash
uv run python -m topotab <输入文件> [选项]
```

#### 命令选项

- `-o, --output`：指定输出文件路径（可选，默认输出到output目录）
- `-c, --config`：指定配置文件路径（可选，使用内置配置）
- `--single-encoding`：只生成UTF-8编码文件（默认生成多种编码）
- `-v, --verbose`：显示详细日志信息

#### 智能路径处理

- **输入文件**：如果文件名不包含路径，自动在 `input/` 目录中查找
- **输出文件**：如果未指定，自动输出到 `output/` 目录
- **相对路径**：支持相对路径，自动基于项目根目录解析

#### 使用示例

```bash
# 最简单用法 - 文件在input目录中
uv run python -m topotab network.drawio

# 指定完整路径
uv run python -m topotab /path/to/network.drawio

# 指定输出文件名（自动放在output目录）
uv run python -m topotab network.drawio -o my_topology.csv

# 使用自定义配置
uv run python -m topotab network.drawio -c custom_config.json

# 只生成UTF-8编码
uv run python -m topotab network.drawio --single-encoding
```

### 传统CLI（兼容模式）

```bash
# 传统转换方式（仍然可用，但不推荐）
uv run topotab convert input/network.drawio output/topology.csv --encoding universal
```

### Python API

```python
from topotab.connection_main import convert_drawio_to_csv

# 基本转换
convert_drawio_to_csv(
    input_file="input/network.drawio",
    output_file="output/topology.csv",
    multiple_encodings=True
)
```

## 📊 输出格式

转换后的 CSV 文件采用连接关系模型，包含以下字段：

### 基本信息

- **序号**：连接关系编号

### 源端信息

- **源-父区域**、**源-所属区域**：设备所在的网络区域层次
- **源-设备名**、**源-设备型号**、**源-设备类型**：设备基本信息
- **源-管理地址**、**源-机柜**、**源-U位**：设备物理位置信息
- **源-Port-Channel号**、**源-物理接口**：端口连接信息
- **源-所属VRF**、**源-所属VLAN**、**源-接口IP**：网络配置信息

### 目标端信息

- 对应的完整目标端信息（字段结构与源端相同）

### 链路属性

- **互联用途**、**线缆类型**、**带宽**、**备注**：连接关系的扩展属性

## 🖥️ Excel 兼容性

### 自动多编码支持

默认情况下，工具会自动生成两种编码格式：

- **主文件**（如 `topology.csv`）：UTF-8 BOM 格式，适用于现代 Excel
- **兼容文件**（如 `topology.gbk.csv`）：GBK 格式，适用于传统中文 Windows Excel

### 使用建议

- **Mac Excel**：直接使用主文件
- **Windows Excel**：优先尝试主文件，如有乱码则使用 `.gbk.csv` 文件
- **其他工具**：使用 `--single-encoding` 选项生成标准 UTF-8 格式

## 📁 项目结构

```text
toptab/
├── config/                      # 配置文件
│   └── connection_metadata.json # 连接关系元数据配置
├── src/topotab/                 # 主要源代码
│   ├── connection_main.py       # 新的主程序入口
│   ├── connection_parser.py     # 连接关系解析器
│   ├── connection_csv.py        # 连接关系CSV处理器
│   ├── connection_config.py     # 连接关系配置管理器
│   ├── models.py               # 数据模型定义
│   ├── cli.py                  # 传统命令行接口
│   ├── convert.py              # 传统转换模块
│   ├── drawio_io.py            # draw.io 文件处理
│   ├── csv_io.py               # CSV 文件处理
│   └── schema.py               # 数据模式定义
├── input/                       # 输入文件目录
├── output/                      # 输出文件目录
├── pyproject.toml              # 项目配置
└── README.md                   # 项目说明
```

## 🔧 故障排除

### 常见问题

#### 1. Excel 显示乱码

**解决方案**：
- 优先使用主文件（UTF-8 BOM 格式）
- 如仍有乱码，使用 `.gbk.csv` 文件
- 或使用 `--single-encoding` 选项生成标准格式

#### 2. 设备信息解析不完整

**可能原因**：
- draw.io 文件中设备名称格式不标准
- 缺少边标签信息

**解决方案**：
- 确保设备节点包含清晰的设备名和型号信息
- 在连接线上添加端口信息标签
- 检查区域命名的唯一性

#### 3. 连接关系数量不符合预期

**检查步骤**：
1. 确认 draw.io 文件中所有连接线都有明确的源和目标
2. 检查是否有重复的连接线
3. 使用 `-v` 选项查看详细解析日志

#### 4. 配置文件相关问题

**自定义配置**：
- 复制 `config/connection_metadata.json` 作为模板
- 根据需要修改字段定义和解析规则
- 使用 `-c` 选项指定自定义配置文件

#### 5. uv 命令不可用

```bash
# 安装 uv
curl -LsSf https://astral.sh/uv/install.sh | sh
# 或
pip install uv
```

## 🎯 Draw.io 文件要求

为了获得最佳的转换效果，建议遵循以下规范：

### 设备节点

- **命名格式**：`设备名<div>设备型号</div>` 或 `设备名\n设备型号`
- **区域归属**：确保设备位于正确的区域容器中
- **唯一性**：同一区域内设备名称应唯一

### 区域层次

- **父区域**：顶层区域容器（如"分机房"、"总局机房"）
- **子区域**：具体功能区域（如"核心区"、"DMZ区"）
- **命名唯一**：所有区域名称在全局范围内应唯一

### 连接线

- **标准连接**：使用 draw.io 的标准连接线
- **端口标签**：可在连接线上添加端口信息标签
- **避免重复**：同一对设备间避免绘制多条相同用途的连接线

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

---

如有问题或建议，请提交 [Issue](https://github.com/Matthewyin/office-tools/issues) 或联系维护者。
