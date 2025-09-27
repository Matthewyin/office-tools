# Office工具
## Cabinet Diagram Generator

### 项目概述

本项目是一个基于Python开发的自动化机柜部署图生成工具，能够读取CSV格式的设备清单数据，自动生成符合draw.io（diagrams.net）格式的机柜部署可视化图表。

### 核心特性

#### 🎯 网格化机柜视图
- **精确U位对齐**：设备精确对齐到U位网格，一目了然
- **可视化网格**：每个U位都有可见的网格线，便于验证设备位置

#### 执行命令，生成机柜部署图

```bash
uv run python -m src.main generate input/cmdb.csv --output output/cabinet_diagram.drawio

## toptab
#### 执行命令，生成drawio文件或csv文件

```bash 
uv run toptab convert