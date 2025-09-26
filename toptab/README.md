# 拓扑转换工具

Python 命令行工具，用于在网络拓扑 CSV 与 draw.io 图之间互转，支持区域嵌套、设备去重以及链路属性保留。

## 快速开始

```bash
uv sync --project toptab
uv run --project toptab toptab
```

CLI 将按顺序询问：
- 输入文件或目录路径（默认 `toptab/input`）
- 输出目录路径（默认 `toptab/output`）
- draw.io 模板文件（可选，留空时使用内置样式）
- CSV 模板文件（默认 `toptab/tamp/csvtamp.csv`）

## 工作流程

1. **CSV → draw.io**：读取 CSV 字段（含父区域/所属区域、链路属性等），构建拓扑模型，自动布局后生成 draw.io 图并写入输出目录。
2. **draw.io → CSV**：解析图中区域、设备及边的 data 属性，还原为标准 CSV 字段；同时生成 `toptab/tmp/csvtmp.csv` 临时文件与最终 CSV。

## 规范说明

- 设备唯一键：`设备名 + 管理地址`。重复出现的设备会合并属性。
- 区域：支持父区域层级，缺省时归类到 `Unassigned`。
- 链路：同一对设备的多条链路将全部保留，接口/VLAN/VRF/IP 等信息写入边标签与 CSV。
- 模板：推荐维护一份带有自定义样式与数据字段的 draw.io 模板，便于提升呈现效果。

## 示例与验证

- 示例数据：`toptab/examples/sample_topology.csv`。
- demo 脚本：`PYTHONPATH=toptab/src python3 toptab/tests/run_demo.py`，演示 CSV → draw.io → CSV 的完整流程。

## 目录结构

```
toptab/
├── input/            # 默认输入文件位置
├── output/           # 默认输出目录
├── tamp/csvtamp.csv  # CSV 字段模板
├── tmp/              # 临时文件目录
├── examples/         # 示例 CSV/Draw.io
├── src/topotab/      # 转换核心代码
└── tests/            # 辅助测试脚本
```

## 常见问题

- **提示缺少 typer/rich**：确保运行前执行 `uv sync --project toptab` 同步依赖。
- **模板路径无效**：CLI 会回退到默认布局；如需固定样式，请提供有效的 draw.io 模板。
- **字段缺失**：从 draw.io 导出的 CSV 会按模板列顺序输出，缺省值为空字符串，便于人工补齐。
