# Topotab - 网络拓扑双向转换工具

[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![uv](https://img.shields.io/badge/uv-enabled-brightgreen.svg)](https://github.com/astral-sh/uv)

一个专业的网络拓扑双向转换工具，基于**连接关系模型**实现 draw.io 网络拓扑图与结构化 CSV 文件的无损互转，特别优化了中文字符支持和 Excel 兼容性。

## 🎯 核心理念

**连接关系驱动**：采用"一条连接线 = 一条连接关系 = 一条CSV记录"的直观业务模型，每条网络连接包含：
- **源端信息**：父区域 → 所属区域 → 设备（名称、型号、管理地址、机柜、U位）→ 端口（Port-Channel、物理接口、VRF、VLAN、IP）
- **目标端信息**：对应的完整目标端信息
- **链路属性**：互联用途、线缆类型、带宽、备注等

## ✨ 功能特性

- 🔄 **双向转换**：支持 CSV ↔ draw.io 双向无损转换
- 🧠 **智能识别**：自动检测文件类型，无需指定转换方向
- 🌐 **通用格式**：支持任何符合约定的CSV格式，不限于特定文件
- 📊 **多连接支持**：完整保持CSV中的多条连接关系，不合并不裁剪
- 🎯 **连接关系模型**：直观的网络连接业务逻辑，易于理解和维护
- 📋 **标准兼容**：支持任何标准 draw.io 文件，无需特殊格式要求
- 💻 **Excel 优化**：多种编码格式确保 Mac 和 Windows Excel 完美显示中文
- 🚀 **智能解析**：自动识别设备信息、区域层次和端口配置
- ⚙️ **配置驱动**：JSON配置文件支持灵活的字段定义和解析规则
- 🔧 **统一接口**：单一命令支持所有转换功能
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
# CSV转drawio（自动检测）
uv run python -m topotab network.csv

# drawio转CSV（自动检测）
uv run python -m topotab network.drawio

# 指定输出文件
uv run python -m topotab network.csv -o topology.drawio
uv run python -m topotab network.drawio -o topology.csv

# 详细日志模式
uv run python -m topotab network.csv -v

# 查看帮助
uv run python -m topotab --help
```

## 📖 详细使用

### 主要命令接口

#### 基本语法

```bash
uv run python -m topotab <输入文件> [选项]
```

#### 转换方向自动检测

- **CSV文件** (`.csv`) → 自动转换为 draw.io 文件
- **draw.io文件** (`.drawio`) → 自动转换为 CSV 文件
- **无需指定转换方向**，工具根据文件扩展名智能判断

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
# CSV转drawio - 最简单用法
uv run python -m topotab network.csv

# drawio转CSV - 最简单用法  
uv run python -m topotab network.drawio

# 指定完整路径
uv run python -m topotab /path/to/network.csv
uv run python -m topotab /path/to/network.drawio

# 指定输出文件名
uv run python -m topotab network.csv -o my_topology.drawio
uv run python -m topotab network.drawio -o my_connections.csv

# 使用自定义配置
uv run python -m topotab network.csv -c custom_config.json

# 只生成UTF-8编码（仅对CSV输出有效）
uv run python -m topotab network.drawio --single-encoding
```

### Python API

```python
from topotab.connection_main import convert_drawio_to_csv, convert_csv_to_drawio

# drawio转CSV
convert_drawio_to_csv(
    input_file="input/network.drawio",
    output_file="output/topology.csv",
    multiple_encodings=True
)

# CSV转drawio
convert_csv_to_drawio(
    input_file="input/network.csv", 
    output_file="output/topology.drawio"
)
```

## 🔄 双向转换特性

### CSV → draw.io 转换

- **通用格式支持**：自动检测CSV格式约定，支持多种命名风格
- **智能字段映射**：自动识别源端、目标端、链路字段
- **多连接保持**：每条CSV记录生成一条独立的连接线
- **区域层级**：自动创建父区域和子区域的嵌套结构
- **设备去重**：相同设备只创建一个节点，支持多条连接

### draw.io → CSV 转换

- **连接关系提取**：解析每条连接线为独立的连接关系
- **设备信息收集**：提取设备名称、型号、区域等完整信息
- **端口信息解析**：识别连接线标签中的端口配置
- **多编码输出**：生成UTF-8和GBK两种编码格式

### 数据一致性保证

- **往返转换**：CSV → drawio → CSV 保持数据完全一致
- **无损转换**：不丢失任何连接关系和设备信息
- **格式验证**：自动验证转换结果的完整性

## 📊 CSV格式约定

### 通用格式检测

工具支持以下CSV格式约定：

#### 列名模式
- **源端前缀**：`源-`、`src-`、`source-`、`from-`
- **目标端前缀**：`目标-`、`dst-`、`target-`、`to-`、`dest-`
- **字段分类**：自动识别区域、设备、端口、链路字段

#### 字段类型
- **区域字段**：包含"区域"、"区"、"域"、"机房"等关键词
- **设备字段**：包含"设备"、"主机"、"节点"等关键词  
- **端口字段**：包含"接口"、"端口"、"VLAN"等关键词
- **链路字段**：包含"用途"、"类型"、"带宽"、"备注"等关键词

### 示例CSV格式

```csv
序号,源-父区域,源-所属区域,源-设备名,源-设备型号,源-物理接口,目标-父区域,目标-所属区域,目标-设备名,目标-设备型号,目标-物理接口,互联用途,线缆类型,带宽
1,互联网区,核心区,intcsw01,CE8865-4C,GE1/0/1,互联网区,核心区,intcsw02,CE8865-4C,GE1/0/1,核心互联,光纤,10G
```

## 🖥️ Excel 兼容性

### 自动多编码支持（仅CSV输出）

默认情况下，drawio转CSV会自动生成两种编码格式：

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
│   ├── __main__.py             # 统一程序入口
│   ├── connection_main.py       # 主程序逻辑
│   ├── connection_parser.py     # 连接关系解析器
│   ├── connection_csv.py        # 连接关系CSV处理器
│   ├── connection_config.py     # 连接关系配置管理器
│   ├── universal_format.py      # 通用格式检测器
│   ├── universal_csv.py         # 通用CSV读取器
│   ├── universal_drawio.py      # 通用drawio写入器
│   ├── models.py               # 数据模型定义
│   ├── drawio_io.py            # draw.io 文件处理
│   └── csv_io.py               # CSV 文件处理
├── input/                       # 输入文件目录
├── output/                      # 输出文件目录
├── pyproject.toml              # 项目配置
└── README.md                   # 项目说明
```

## 🔧 故障排除

### 常见问题

#### 1. 文件格式不支持

**现象**：提示"不支持的文件格式"

**解决方案**：
- 确保文件扩展名为 `.csv` 或 `.drawio`
- 检查文件是否损坏或为空
- 使用 `-v` 选项查看详细错误信息

#### 2. CSV格式检测失败

**现象**：CSV转drawio时提示格式检测失败

**解决方案**：
- 检查CSV列名是否符合约定（包含源-、目标-等前缀）
- 确保至少包含设备名称字段
- 参考示例CSV格式调整列名

#### 3. Excel 显示乱码

**现象**：CSV文件在Excel中显示乱码

**解决方案**：
- 优先使用主文件（UTF-8 BOM 格式）
- 如仍有乱码，使用 `.gbk.csv` 文件
- 或使用 `--single-encoding` 选项生成标准格式

#### 4. 连接关系数量不符合预期

**检查步骤**：
1. 确认输入文件中的连接数量
2. 检查是否有格式不规范的记录
3. 使用 `-v` 选项查看详细解析日志
4. 验证往返转换的数据一致性

#### 5. draw.io文件无法打开

**解决方案**：
- 确认生成的文件扩展名为 `.drawio`
- 检查文件大小是否正常（不为空）
- 尝试在 draw.io 网站或应用中打开
- 查看生成日志是否有错误信息

## 🎯 最佳实践

### CSV文件准备

1. **列名规范**：使用清晰的前缀区分源端和目标端
2. **数据完整**：确保关键字段（设备名、区域）不为空
3. **编码统一**：建议使用UTF-8编码保存CSV文件
4. **格式一致**：同类字段使用统一的命名风格

### draw.io文件要求

1. **设备节点**：使用清晰的设备名称和型号标识
2. **区域层次**：合理使用容器表示区域层级关系
3. **连接线**：确保每条连接线都有明确的源和目标
4. **标签信息**：在连接线上添加端口等详细信息

### 性能优化

1. **文件大小**：大型网络建议分批处理
2. **内存使用**：处理大文件时关注内存占用
3. **验证结果**：重要数据建议进行往返转换验证

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

---

如有问题或建议，请提交 [Issue](https://github.com/Matthewyin/office-tools/issues) 或联系维护者。
