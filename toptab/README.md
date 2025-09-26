# Topotab - 网络拓扑转换工具

[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![uv](https://img.shields.io/badge/uv-enabled-brightgreen.svg)](https://github.com/astral-sh/uv)

一个专业的网络拓扑转换工具，支持 draw.io 和 CSV 格式之间的双向转换，特别优化了中文字符支持和 Excel 兼容性。

## ✨ 功能特性

- 🔄 **双向转换**：支持 draw.io ↔ CSV 格式转换
- 🌐 **标准兼容**：读取任何标准 draw.io 文件，无需特殊格式
- 📊 **Excel 优化**：多种编码格式确保 Mac 和 Windows Excel 完美显示中文
- 🚀 **智能识别**：自动识别网络设备和连接关系
- 🔧 **灵活使用**：提供 CLI 命令行和 Python API 两种接口
- ⚡ **现代工具**：基于 uv 包管理器，无需手动环境配置

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
# 将 draw.io 文件转换为 CSV（推荐方式）
uv run toptab convert input/network.drawio output/topology.csv --encoding universal

# 查看帮助
uv run toptab --help
uv run toptab convert --help
```

## 📖 详细使用

### CLI 命令行接口

#### 基本语法
```bash
uv run toptab convert <输入文件> <输出文件> [选项]
```

#### 编码选项
- `universal` (推荐)：同时生成 UTF-8 BOM 和 GBK 两个版本
- `utf-8-bom`：UTF-8 BOM 格式，适用于现代 Excel
- `gbk`：GBK 编码，适用于中文 Windows Excel
- `utf-8`：标准 UTF-8，适用于其他工具

#### 使用示例
```bash
# 通用兼容模式（推荐）
uv run toptab convert network.drawio topology.csv --encoding universal

# 指定模板文件
uv run toptab convert network.drawio topology.csv --template custom_template.csv

# 使用结构化读取器
uv run toptab convert network.drawio topology.csv --structured
```

### Python API

```python
from pathlib import Path
from topotab import convert_drawio_to_csv

# 基本转换
links = convert_drawio_to_csv(
    input_path=Path("input/network.drawio"),
    output_path=Path("output/topology.csv"),
    encoding="universal"
)

print(f"转换完成，共 {len(links)} 条链路")
```

### 模块调用
```bash
# 直接调用转换模块
uv run python -m topotab.convert input/network.drawio output/topology.csv --encoding universal
```

## 📊 输出格式

转换后的 CSV 文件包含以下字段：

- **序号**：链路编号
- **源设备信息**：设备名、管理地址、区域、型号、类型等
- **源端口信息**：Port-Channel、物理接口、VRF、VLAN、IP 等
- **目标设备信息**：对应的目标设备完整信息
- **目标端口信息**：对应的目标端口完整信息
- **链路属性**：用途、序号等扩展信息

## 🖥️ Excel 兼容性

### Mac Excel
直接使用 UTF-8 BOM 版本（主文件）

### Windows Excel
1. 优先尝试 UTF-8 BOM 版本（主文件）
2. 如有乱码，使用 GBK 版本（.gbk.csv 文件）

### 通用兼容模式
使用 `--encoding universal` 会同时生成两个文件：
- `topology.csv` - UTF-8 BOM 格式
- `topology.gbk.csv` - GBK 格式

## 📁 项目结构

```
toptab/
├── src/topotab/           # 主要源代码
│   ├── cli.py            # 命令行接口
│   ├── convert.py        # 转换模块
│   ├── drawio_io.py      # draw.io 文件处理
│   ├── csv_io.py         # CSV 文件处理
│   ├── schema.py         # 数据模式定义
│   └── __init__.py       # 包初始化
├── input/                # 输入文件目录
├── output/               # 输出文件目录
├── tmp/                  # 模板文件目录
├── pyproject.toml        # 项目配置
└── README.md            # 项目说明
```

## 🔧 故障排除

### 1. 模板文件不存在
确保 `tmp/csvtmp.csv` 文件存在，或使用 `--template` 指定正确路径

### 2. Excel 显示乱码
- 尝试使用 `--encoding gbk` 选项
- 或使用 `universal` 模式生成的 `.gbk.csv` 文件

### 3. 设备识别不准确
- 检查 draw.io 文件中的设备名称是否清晰
- 尝试使用 `--structured` 选项

### 4. uv 命令不可用
```bash
# 安装 uv
curl -LsSf https://astral.sh/uv/install.sh | sh
# 或
pip install uv
```

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙏 致谢

- 感谢 [draw.io](https://www.diagrams.net/) 提供优秀的图表工具
- 感谢 [uv](https://github.com/astral-sh/uv) 提供现代化的 Python 包管理
- 感谢所有贡献者的支持

---

如有问题或建议，请提交 [Issue](https://github.com/Matthewyin/office-tools/issues) 或联系维护者。
