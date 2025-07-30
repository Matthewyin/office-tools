# Office转PDF工具

一个功能完整的Python工具，用于将Microsoft Office文件（Word、Excel、PowerPoint）转换为PDF格式。

## 功能特性

- ✅ 支持多种Office格式：`.docx`, `.doc`, `.xlsx`, `.xls`, `.pptx`, `.ppt`
- ✅ 批量转换整个目录的文件
- ✅ 递归处理子目录
- ✅ 自动跳过临时文件（如`~$`开头的文件）
- ✅ 详细的日志记录
- ✅ 跨平台支持（Windows、macOS、Linux）
- ✅ 类型提示和完整的错误处理
- ✅ 配置文件支持

## 系统要求

### 必需软件

1. **Python 3.8+**
2. **LibreOffice** - 用于实际的文件转换

### LibreOffice安装

```bash
# macOS
brew install --cask libreoffice

# Ubuntu/Debian
sudo apt-get install libreoffice

# CentOS/RHEL
sudo yum install libreoffice

# Windows
# 从官网下载安装: https://www.libreoffice.org/
```

### Python依赖

```bash
# 安装项目依赖
pip install -r requirements.txt

# 或者使用项目根目录的pyproject.toml
pip install -e .
```

## 使用方法

### 标准版本（适合单文件或小批量）

```bash
# 转换单个文件
python office_to_pdf.py document.docx

# 转换目录中的所有Office文件
python office_to_pdf.py /path/to/office/files

# 递归转换子目录
python office_to_pdf.py /path/to/files -r

# 指定输出目录
python office_to_pdf.py document.xlsx -o /output/directory
```

### 优化版本（适合大批量转换，速度提升2-3倍）

```bash
# 并发转换目录（默认2个线程）
python office_to_pdf_optimized.py /path/to/office/files

# 指定并发线程数
python office_to_pdf_optimized.py /path/to/files -w 4

# 递归转换子目录
python office_to_pdf_optimized.py /path/to/files -r -w 3

# 如果遇到问题，可回退到顺序模式
python office_to_pdf_optimized.py /path/to/files --sequential
```

### 性能测试

```bash
# 运行性能对比测试
python performance_test.py
```

### 编程接口使用

```python
from office_to_pdf import OfficeConverter

# 创建转换器
converter = OfficeConverter(output_dir="/path/to/output")

# 转换单个文件
success = converter.convert_file("document.docx")

# 批量转换目录
stats = converter.convert_directory("/path/to/files", recursive=True)
print(f"成功: {stats['success']}, 失败: {stats['failed']}")
```

## 配置选项

可以通过`.env`文件或环境变量进行配置：

```bash
# .env文件示例
CONVERSION_TIMEOUT=300
DEFAULT_OUTPUT_DIR=/path/to/default/output
LOG_LEVEL=INFO
LOG_DIR=logs
SKIP_TEMP_FILES=true
OVERWRITE_EXISTING=false
PDF_QUALITY=default
```

### 配置参数说明

- `CONVERSION_TIMEOUT`: 转换超时时间（秒），默认300
- `DEFAULT_OUTPUT_DIR`: 默认输出目录
- `LOG_LEVEL`: 日志级别（DEBUG, INFO, WARNING, ERROR）
- `LOG_DIR`: 日志文件目录
- `SKIP_TEMP_FILES`: 是否跳过临时文件
- `OVERWRITE_EXISTING`: 是否覆盖已存在的PDF文件
- `PDF_QUALITY`: PDF质量（low, default, high）

## 项目结构

```
Officetools/
├── office_to_pdf.py    # 主转换器模块
├── config.py           # 配置管理
├── utils.py            # 实用工具函数
├── test_converter.py   # 测试脚本
└── README.md           # 说明文档
```

## 测试

运行测试脚本检查环境配置：

```bash
python test_converter.py
```

测试脚本会检查：
- LibreOffice是否正确安装
- 配置是否有效
- 转换器基本功能
- 目录权限

## 日志

工具会在`logs/`目录下生成详细的日志文件：

```
logs/
└── office_converter_20250129_143022.log
```

日志包含：
- 转换过程详情
- 错误信息和堆栈跟踪
- 系统信息
- 性能统计

## 错误处理

常见问题及解决方案：

### 1. LibreOffice未找到

```
错误: LibreOffice未安装
解决: 安装LibreOffice并确保命令行可访问
```

### 2. 转换超时

```
错误: 转换超时
解决: 增加CONVERSION_TIMEOUT值或检查文件是否损坏
```

### 3. 权限错误

```
错误: 无法写入输出目录
解决: 检查目录权限或更改输出目录
```

### 4. 文件被占用

```
错误: 文件正在使用中
解决: 关闭Office应用程序或等待文件释放
```

## 性能优化

### 两个版本对比

| 特性 | 标准版 | 优化版 |
|------|--------|--------|
| 单文件转换 | 7秒左右 | 2-3秒 |
| 批量转换 | 顺序处理 | 并发处理 |
| 内存占用 | 低 | 中等 |
| 稳定性 | 高 | 高 |
| 适用场景 | 单文件、小批量 | 大批量转换 |

### 优化技术

1. **LibreOffice守护进程模式**: 避免重复启动LibreOffice
2. **并发处理**: 多线程同时转换多个文件
3. **优化启动参数**: 减少不必要的LibreOffice功能
4. **智能回退**: 守护进程失败时自动回退到标准模式

### 性能调优建议

- 大文件转换可能需要较长时间，建议调整超时设置
- 批量转换时建议使用SSD存储以提高I/O性能
- 可以通过`PDF_QUALITY`设置平衡文件大小和质量
- 并发线程数建议设置为CPU核心数的1-2倍
- 内存不足时减少并发线程数

## 开发规范

本项目严格遵循现代Python开发规范：

- ✅ 使用类型提示（Type Hints）
- ✅ 遵循PEP 8代码风格
- ✅ 完整的错误处理和日志记录
- ✅ 模块化设计和单一职责原则
- ✅ 详细的中文注释和文档字符串
- ✅ 使用`pathlib`进行路径操作
- ✅ 环境变量和配置文件管理

## 许可证

MIT License

## 作者

Matthew Yin (2738550@qq.com)

## 更新日志

### v1.0.0 (2025-01-29)
- 初始版本发布
- 支持Word、Excel、PowerPoint转PDF
- 批量转换和递归处理
- 完整的配置和日志系统
