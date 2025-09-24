# 机柜部署图生成工具 - 用户使用手册

## 1. 快速入门

### 1.1 环境准备

#### 系统要求
- Python 3.8 或更高版本
- 操作系统：Windows、macOS、Linux

#### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/Matthewyin/office-tools.git
cd office-tools/cabinet_diagram_generator
```

2. **创建虚拟环境**
```bash
# 使用uv（推荐）
uv venv
source .venv/bin/activate  # Linux/macOS
# 或
.venv\Scripts\activate     # Windows

# 或使用标准venv
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# 或
.venv\Scripts\activate     # Windows
```

3. **安装依赖**
```bash
# 使用uv（推荐）
uv pip install -e .

# 或使用pip
pip install -e .
```

### 1.2 基本使用

#### 准备CSV文件
将您的设备清单保存为CSV格式，放在 `input/` 目录下。

#### 生成机柜部署图
```bash
python -m src.main generate input/your_devices.csv --output output/cabinet_diagram.drawio
```

#### 在draw.io中查看
1. 打开 [draw.io](https://app.diagrams.net/)
2. 选择 "打开现有图表"
3. 选择生成的 `.drawio` 文件
4. 查看多个机房的sheet页

## 2. 命令行接口

### 2.1 主要命令

#### generate - 生成机柜部署图
```bash
python -m src.main generate <input_file> [options]
```

**参数说明：**
- `input_file`: CSV输入文件路径
- `--output, -o`: 输出文件路径（可选）
- `--config, -c`: 配置文件路径（可选）

**示例：**
```bash
# 基本用法
python -m src.main generate input/cmdb.csv

# 指定输出文件
python -m src.main generate input/cmdb.csv --output output/my_diagram.drawio

# 使用自定义配置
python -m src.main generate input/cmdb.csv --config config/custom.yaml
```

#### validate - 验证CSV数据
```bash
python -m src.main validate <input_file>
```

**功能：**
- 检查CSV格式是否正确
- 验证必需字段是否存在
- 检查数据类型是否有效
- 报告发现的错误

**示例：**
```bash
python -m src.main validate input/cmdb.csv
```

#### preview - 预览布局信息
```bash
python -m src.main preview <input_file>
```

**功能：**
- 显示机房和机柜统计
- 显示设备分布情况
- 显示可能的冲突
- 不生成实际图形文件

**示例：**
```bash
python -m src.main preview input/cmdb.csv
```

### 2.2 全局选项

- `--help, -h`: 显示帮助信息
- `--version, -v`: 显示版本信息
- `--verbose`: 显示详细日志
- `--quiet`: 静默模式

## 3. CSV数据格式

### 3.1 必需字段

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| 设备名 | 文本 | 设备名称标识 | intdmzfw01 |
| 型号 | 文本 | 设备具体型号 | USG6635F |
| 设备高度 | 文本 | 设备占用U位数量 | 1U, 2U, 4U |
| 设备用途 | 文本 | 设备类型分类 | 安全防护, 网络核心 |
| 机柜 | 文本 | 设备所属机柜编号 | 1-A01, 2-B02 |
| U位 | 数字 | 设备起始位置 | 18, 20, 37 |
| 机房 | 文本 | 机房编号 | 1, 2, 3 |

### 3.2 可选字段

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| 资产编号 | 文本 | 资产管理编号 | AS001234 |
| 序号 | 数字 | 设备序号 | 1, 2, 3 |
| 备注 | 文本 | 额外说明信息 | 备用设备 |

### 3.3 数据格式要求

#### 设备高度格式
- 支持格式：`1U`, `2U`, `4U`, `1`, `2`, `4`
- 有效范围：1-42U
- 不区分大小写

#### U位格式
- 支持格式：数字（如 `18`, `20`）
- 有效范围：1-42
- 必须为整数

#### 机柜编号格式
- 推荐格式：`机房-区域编号`（如 `1-A01`, `2-B02`）
- 支持任意文本格式
- 同一机柜的设备必须使用相同的机柜编号

#### 机房编号格式
- 支持任意文本格式（如 `1`, `机房A`, `IDC-1`）
- 同一机房的设备必须使用相同的机房编号

### 3.4 CSV文件示例

```csv
设备名,型号,设备高度,设备用途,机柜,U位,机房,资产编号
intdmzfw01,USG6635F,1U,安全防护,1-A01,18,1,AS001234
intcsw01,S5755-H48T4Y2CZ,2U,网络核心,1-A01,20,1,AS001235
back01,AnyBackup Family 7,5U,其他,1-A01,5,1,AS001236
intdmzfw02,USG6635F,1U,安全防护,2-A02,18,2,AS001237
```

## 4. 配置选项

### 4.1 显示配置

#### 显示模式
```python
# 在config.py中配置
显示模式 = DisplayMode.详细  # 或 DisplayMode.简洁
```

- **详细模式**：显示设备名和型号
- **简洁模式**：只显示设备名

#### 显示选项
```python
显示U位标尺 = True      # 是否显示U位标尺
显示机房标题 = True      # 是否显示机房标题
显示资产编号 = False     # 是否显示资产编号
```

### 4.2 样式配置

#### 颜色设置
```python
# 机柜和设备颜色
机柜颜色 = "#FFFFFF"        # 白色机柜背景
设备颜色 = "#FFFFCC"        # 浅黄色设备
边框颜色 = "#000000"        # 黑色边框
文字颜色 = "#000000"        # 黑色文字
```

#### 尺寸设置
```python
# 机柜尺寸
机柜宽度 = 250             # 像素
机柜高度 = 800             # 像素
U位高度 = 20               # 像素

# 间距设置
机柜间距 = 50              # 机柜之间的间距
机房间距 = 100             # 机房之间的间距
```

#### 字体设置
```python
# 字体配置
字体大小 = 10              # 设备文字大小
机房标题字体大小 = 14       # 机房标题字体大小
```

### 4.3 布局配置

#### 自动优化
```python
自动优化 = False           # 是否启用自动优化
```

- **True**：自动调整设备位置以减少空隙
- **False**：严格按照CSV中指定的U位放置设备

#### 冲突处理
```python
冲突处理策略 = "向上优先"    # 冲突时的处理策略
```

- **向上优先**：冲突时优先向上移动设备
- **向下优先**：冲突时优先向下移动设备

## 5. 输出说明

### 5.1 文件结构

生成的draw.io文件包含：

#### 多Sheet页结构
- 每个机房对应一个独立的sheet页
- Sheet页名称使用机房编号
- 可通过底部标签切换不同机房

#### 网格化机柜视图
- **白色机柜背景**：清晰的机柜边界
- **浅灰色网格线**：每个U位都有可见的网格
- **浅黄色设备块**：统一的设备颜色
- **黑色文字标签**：清晰的设备信息

### 5.2 视觉特性

#### 精确对齐
- 设备底部与U位底部边界精确对齐
- 设备高度精确覆盖指定的U位数量
- 可视化验证设备位置是否正确

#### 层次结构
1. **底层**：白色机柜背景
2. **中层**：浅灰色U位网格线
3. **上层**：浅黄色设备矩形
4. **顶层**：黑色文字标签

### 5.3 信息显示

#### 设备信息
- **设备名称**：主要标识
- **设备型号**：详细规格（详细模式）
- **资产编号**：管理编号（可选）

#### 位置信息
- **U位标尺**：左侧显示U1-U42标识
- **机柜标题**：顶部显示机柜编号
- **机房标题**：顶部显示机房信息（可选）

## 6. 常见问题

### 6.1 数据问题

**Q: CSV文件格式不正确怎么办？**
A: 使用 `validate` 命令检查文件格式：
```bash
python -m src.main validate input/your_file.csv
```

**Q: 设备位置冲突怎么处理？**
A: 系统会自动检测并解决冲突，调整记录会在日志中显示。

**Q: 支持哪些设备高度？**
A: 支持1U到42U的任意高度，常见的有1U、2U、4U、5U等。

### 6.2 显示问题

**Q: 设备位置不准确怎么办？**
A: 检查CSV中的U位数据是否正确，确保在1-42范围内。

**Q: 如何调整设备颜色？**
A: 修改 `src/config.py` 中的颜色配置。

**Q: 如何隐藏U位标尺？**
A: 在配置中设置 `显示U位标尺 = False`。

### 6.3 文件问题

**Q: 生成的文件无法在draw.io中打开？**
A: 检查文件是否完整生成，查看日志中的错误信息。

**Q: 如何批量处理多个文件？**
A: 编写脚本循环调用生成命令：
```bash
for file in input/*.csv; do
    python -m src.main generate "$file"
done
```

## 7. 高级用法

### 7.1 自定义配置文件

创建自定义配置文件 `config/custom.yaml`：
```yaml
display:
  mode: "详细"
  show_u_ruler: true
  show_room_title: true
  show_asset_number: false

style:
  cabinet_color: "#F5F5F5"
  device_color: "#E6F3FF"
  border_color: "#333333"
  text_color: "#333333"

layout:
  cabinet_width: 300
  cabinet_height: 840
  u_height: 20
  auto_optimize: false
```

### 7.2 批量处理脚本

创建批量处理脚本 `batch_process.py`：
```python
#!/usr/bin/env python3
import os
import subprocess
from pathlib import Path

input_dir = Path("input")
output_dir = Path("output")

for csv_file in input_dir.glob("*.csv"):
    output_file = output_dir / f"{csv_file.stem}_diagram.drawio"
    cmd = [
        "python", "-m", "src.main", "generate",
        str(csv_file), "--output", str(output_file)
    ]
    subprocess.run(cmd)
```

### 7.3 集成到其他系统

#### API调用示例
```python
from src.csv_processor import CSVProcessor
from src.layout_engine import LayoutEngine
from src.drawio_generator import DrawioGenerator

# 处理数据
processor = CSVProcessor()
devices = processor.process_file("input/data.csv")

# 创建布局
layout_engine = LayoutEngine()
layout = layout_engine.create_layout(devices)

# 生成图形
generator = DrawioGenerator()
output_path = generator.generate_diagram(layout, "output/result.drawio")
```

## 8. 故障排除

### 8.1 常见错误

#### 导入错误
```
ModuleNotFoundError: No module named 'src'
```
**解决方案**：确保在项目根目录运行命令，并已安装依赖。

#### 文件权限错误
```
PermissionError: [Errno 13] Permission denied
```
**解决方案**：检查文件和目录权限，确保有读写权限。

#### 内存错误
```
MemoryError: Unable to allocate array
```
**解决方案**：处理大文件时增加系统内存或分批处理。

### 8.2 日志分析

查看详细日志：
```bash
python -m src.main generate input/data.csv --verbose
```

日志级别说明：
- **INFO**：正常处理信息
- **WARNING**：警告信息（如数据调整）
- **ERROR**：错误信息
- **DEBUG**：详细调试信息

### 8.3 性能优化

#### 大文件处理
- 使用流式处理：分批读取CSV数据
- 增加内存：处理大量设备时
- 并行处理：多机房独立处理

#### 输出优化
- 压缩输出：减少文件大小
- 缓存结果：避免重复计算
- 增量更新：只更新变化的部分

## 9. 更新和维护

### 9.1 版本更新

检查更新：
```bash
git pull origin main
```

更新依赖：
```bash
uv pip install -e . --upgrade
```

### 9.2 备份和恢复

备份配置：
```bash
cp -r config/ backup/config_$(date +%Y%m%d)/
```

恢复配置：
```bash
cp -r backup/config_20231201/ config/
```

### 9.3 问题反馈

如遇到问题，请提供：
1. 错误信息和日志
2. 输入CSV文件示例
3. 系统环境信息
4. 复现步骤

提交Issue：[GitHub Issues](https://github.com/Matthewyin/office-tools/issues)
