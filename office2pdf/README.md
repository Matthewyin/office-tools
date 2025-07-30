# 多格式文件转PDF工具 v2.0

一个功能强大的Python工具包，支持多种格式文件转换为PDF，包括Office文件、文本文件、Markdown文件等。

## 🚀 快速开始

### 安装依赖
```bash
# 创建虚拟环境（推荐使用uv）
uv venv
source .venv/bin/activate

# 安装项目依赖
uv pip install -e .
```

### 启动GUI界面
```bash
# 启动GUI界面
python office2pdf/run_gui.py
```

### 命令行使用
```bash
# 转换单个文件
python -m office2pdf.converter document.txt

# 批量转换目录
python -m office2pdf.converter /path/to/files -r -w 4
```

## 🆕 v2.0 新功能

- ✅ **扩展格式支持**: 新增txt、md、drawio文件转换
- ✅ **图形用户界面**: 提供友好的GUI界面，支持文件选择按钮
- ✅ **Mac应用打包**: 可打包为原生Mac应用程序
- ✅ **性能优化**: 保留并优化了并发处理功能
- ✅ **向后兼容**: 完全兼容v1.0的所有功能

## 📋 支持的文件格式

| 类型 | 扩展名 | 转换方式 | 说明 |
|------|--------|----------|------|
| **Office文件** | `.docx`, `.doc`, `.xlsx`, `.xls`, `.pptx`, `.ppt` | LibreOffice | 完整支持 |
| **文本文件** | `.txt` | ReportLab | 纯文本转PDF |
| **Markdown文件** | `.md`, `.markdown` | Markdown + ReportLab | 支持基本格式 |
| **Draw.io文件** | `.drawio`, `.dio` | Draw.io Desktop | 需要额外安装 |

## 🛠️ 系统要求

### 最低要求
- **Python**: 3.8+ 
- **LibreOffice**: 用于Office文件转换
- **操作系统**: Windows, macOS, Linux

### 推荐配置
- **Python**: 3.10+
- **内存**: 4GB RAM 或更多
- **存储**: 至少500MB可用空间

## 📦 安装说明

### 1. 安装LibreOffice
```bash
# macOS
brew install --cask libreoffice

# Ubuntu/Debian
sudo apt-get install libreoffice

# Windows
# 从官网下载安装: https://www.libreoffice.org/
```

### 2. 安装Draw.io Desktop（可选）
```bash
# macOS
brew install --cask drawio

# 或从GitHub下载: https://github.com/jgraph/drawio-desktop
```

### 3. 安装Python依赖
```bash
# 使用uv（推荐）
uv pip install -e .

# 或使用pip
pip install -e .
```

## 🎯 使用方法

### GUI界面使用

#### 1. 启动应用
```bash
# 启动GUI界面
python office2pdf/run_gui.py
```

#### 2. 操作步骤
1. **选择文件**: 点击"选择文件"按钮选择要转换的文件
2. **选择目录**: 点击"选择目录"按钮选择包含文件的目录
3. **设置选项**: 配置输出目录、递归处理、并发数等
4. **开始转换**: 点击"开始转换"按钮并查看实时日志

### 命令行使用

#### 基本用法
```bash
# 转换单个文件
python -m office2pdf.converter document.docx

# 转换多种格式
python -m office2pdf.converter file.txt file.md file.docx

# 批量转换目录
python -m office2pdf.converter /path/to/files -r

# 指定输出目录和并发数
python -m office2pdf.converter /path/to/files -o /output -w 4
```

#### 高级选项
```bash
# 递归处理子目录
python -m office2pdf.converter /path/to/files --recursive

# 设置并发线程数
python -m office2pdf.converter /path/to/files --workers 8

# 顺序处理（禁用并发）
python -m office2pdf.converter /path/to/files --sequential
```

### 编程接口

#### 基本使用
```python
from office2pdf import UniversalConverter

# 创建转换器
converter = UniversalConverter(output_dir="/path/to/output")

# 转换单个文件
success = converter.convert_file("document.md")

# 批量转换目录
stats = converter.convert_directory("/path/to/files", recursive=True)
print(f"成功: {stats['success']}, 失败: {stats['failed']}")
```

#### 高级配置
```python
from office2pdf import UniversalConverter

# 创建高性能转换器
converter = UniversalConverter(
    output_dir="/path/to/output",
    max_workers=4  # 并发线程数
)

# 转换并获取详细结果
success = converter.convert_file("document.txt")
if success:
    print("转换成功")
else:
    print("转换失败，请查看日志")

# 清理资源
converter.cleanup()
```

## ⚙️ 配置选项

### 环境变量配置
可以通过环境变量或`.env`文件配置：

```bash
# 转换超时时间（秒）
CONVERSION_TIMEOUT=300

# 日志级别
LOG_LEVEL=INFO

# 日志目录
LOG_DIR=logs

# 跳过临时文件
SKIP_TEMP_FILES=true

# 覆盖已存在的PDF文件
OVERWRITE_EXISTING=false

# PDF质量设置
PDF_QUALITY=standard
```

### 配置文件示例
创建`.env`文件：
```env
CONVERSION_TIMEOUT=600
LOG_LEVEL=DEBUG
OVERWRITE_EXISTING=true
PDF_QUALITY=high
```

## 🔧 故障排除

### 常见问题

#### 1. LibreOffice未找到
```bash
# 检查安装
which soffice

# macOS安装
brew install --cask libreoffice

# 验证安装
soffice --version
```

#### 2. GUI崩溃问题
```bash
# 使用简化版GUI
python run_gui_simple.py

# 或使用命令行版本
python -m office2pdf.converter
```

#### 3. 转换失败
- 检查文件是否损坏
- 确认文件格式是否支持
- 查看日志文件获取详细错误信息
- 确保有足够的磁盘空间

#### 4. 权限问题
- 确保有读取源文件的权限
- 确保输出目录可写
- 在macOS上可能需要授予应用权限

### 日志文件
转换日志保存在`logs/`目录下，包含详细的转换信息和错误信息。

## 📚 详细文档

- **[系统架构文档](ARCHITECTURE.md)** - 技术架构和设计说明

## 🏗️ 项目结构

```
office2pdf/
├── __init__.py              # 包初始化
├── converter.py             # 通用转换器核心
├── gui.py                   # 标准GUI界面
├── config.py                # 配置管理
├── utils.py                 # 工具函数
├── README.md                # 详细说明文档
├── ARCHITECTURE.md          # 系统架构文档
├── USER_MANUAL.md           # 用户操作手册
├── GUI_USER_GUIDE.md        # GUI使用指南
├── MAC_APP_GUIDE.md         # Mac应用打包指南
└── GUI_TROUBLESHOOTING.md   # 故障排除指南
```

## 📄 许可证

MIT License

## 👨‍💻 作者

Matthew Yin (2738550@qq.com)

## 🖥️ GUI使用指南

### 界面功能说明

#### 1. 文件选择区域
- **选择文件按钮**: 点击选择单个或多个文件进行转换
- **选择目录按钮**: 选择包含文件的目录进行批量转换
- **路径输入框**: 显示选择的文件/目录路径，也可手动输入

#### 2. 输出设置
- **输出目录**: 可选设置，留空则在源文件同目录生成PDF
- **递归处理**: 勾选后会处理子目录中的文件
- **并发线程数**: 设置同时转换的文件数量（1-8个）

#### 3. 转换控制
- **开始转换**: 启动转换过程
- **停止转换**: 中止正在进行的转换
- **清空日志**: 清除转换日志记录

#### 4. 进度显示
- **状态栏**: 显示当前转换状态
- **进度条**: 转换过程中显示动画进度
- **日志区域**: 详细的转换日志和结果信息

### GUI使用步骤

#### 步骤1: 选择文件
1. **选择单个/多个文件**:
   - 点击"选择文件"按钮
   - 在文件选择对话框中选择要转换的文件
   - 支持多选（按住Ctrl/Cmd键）

2. **选择目录**:
   - 点击"选择目录"按钮
   - 选择包含文件的目录
   - 应用会自动扫描并显示支持的文件

3. **手动输入**:
   - 直接在路径输入框中输入文件路径
   - 多个文件用分号(;)分隔
   - 示例: `/path/to/file1.txt;/path/to/file2.md`

#### 步骤2: 设置选项
1. **输出目录**（可选）:
   - 留空: PDF文件生成在源文件同目录
   - 指定: PDF文件生成在指定目录

2. **转换选项**:
   - **递归处理**: 处理子目录中的文件
   - **并发线程数**: 根据系统性能调整（推荐2-4个）

#### 步骤3: 开始转换
1. 点击"开始转换"按钮
2. 观察转换进度和日志信息
3. 转换完成后查看结果

## 🍎 Mac应用打包指南

### 前提条件
1. **macOS系统**: macOS 10.12 或更高版本
2. **Python环境**: Python 3.8+
3. **uv包管理器**: 已安装并配置
4. **Xcode命令行工具**: 用于编译原生组件

### 快速构建步骤

#### 1. 准备环境
```bash
# 确保在项目根目录
cd /path/to/Officetools

# 激活虚拟环境
source .venv/bin/activate

# 验证uv可用
uv --version
```

#### 2. 安装构建依赖
```bash
# 使用uv安装py2app（推荐）
uv pip install py2app

# 或者让脚本自动安装
python setup_app.py
```

#### 3. 构建应用
```bash
# 开始构建Mac应用
python setup_app.py py2app

# 构建完成后清理（可选）
python setup_app.py clean
```

#### 4. 测试应用
```bash
# 启动构建的应用
open dist/PDF转换工具.app

# 或者在Finder中双击应用图标
```

### 构建过程说明

脚本会自动：
- ✅ 检测uv是否可用
- ✅ 安装py2app（如果未安装）
- ✅ 验证setuptools可用性
- ✅ 显示详细的构建进度

### 构建故障排除

#### 常见问题

**1. uv未找到**
```bash
# 安装uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# 或使用Homebrew
brew install uv
```

**2. py2app安装失败**
```bash
# 手动安装
uv pip install py2app

# 如果仍然失败，尝试pip
pip install py2app
```

**3. 构建失败**
```bash
# 清理之前的构建
python setup_app.py clean
rm -rf build/ dist/

# 重新构建
python setup_app.py py2app
```

**4. 应用无法启动**
- 检查macOS安全设置
- 在"系统偏好设置 > 安全性与隐私"中允许应用
- 确保LibreOffice已安装

## 🔧 故障排除指南

### 常见问题及解决方案

#### 1. LibreOffice相关问题

**问题**: LibreOffice未找到
```
错误: LibreOffice未安装，无法转换Office文件
```

**解决方案**:
```bash
# 检查LibreOffice安装
which soffice

# macOS重新安装
brew uninstall --cask libreoffice
brew install --cask libreoffice

# 手动指定路径
export LIBREOFFICE_PATH=/Applications/LibreOffice.app/Contents/MacOS/soffice
```

**问题**: LibreOffice转换失败
```
错误: 转换过程中LibreOffice返回错误代码1
```

**解决方案**:
```bash
# 检查文件权限
ls -la input_file.docx

# 检查输出目录权限
ls -ld output_directory

# 手动测试LibreOffice
soffice --headless --convert-to pdf input_file.docx
```

#### 2. GUI界面问题

**问题**: GUI界面崩溃
```
NSInvalidArgumentException: object cannot be nil
```

**解决方案**:
```bash
# 重启应用程序
python run_gui.py

# 或使用命令行版本
python -m office2pdf.converter
```

**问题**: 文件选择按钮无响应

**解决方案**:
1. 手动输入文件路径
2. 检查文件权限
3. 重启应用程序

#### 3. 转换质量问题

**问题**: PDF质量不佳

**解决方案**:
```env
# 在.env文件中设置高质量
PDF_QUALITY=high
CONVERSION_TIMEOUT=600
```

**问题**: 中文字符显示异常

**解决方案**:
1. 确保系统安装了中文字体
2. 检查源文件编码
3. 使用UTF-8编码保存源文件

#### 4. 性能问题

**问题**: 转换速度慢

**解决方案**:
```bash
# 增加并发线程数
python -m office2pdf.converter /path/to/files -w 8

# 使用SSD存储
# 关闭不必要的程序
# 增加系统内存
```

**问题**: 内存使用过高

**解决方案**:
```bash
# 减少并发线程数
python -m office2pdf.converter /path/to/files -w 1

# 分批处理大量文件
# 定期清理临时文件
```

### 日志分析

#### 日志文件位置
- **默认位置**: `logs/converter_YYYYMMDD_HHMMSS.log`
- **自定义位置**: 通过`LOG_DIR`环境变量设置

#### 日志级别说明
- **DEBUG**: 详细的调试信息
- **INFO**: 一般信息记录
- **WARNING**: 警告信息
- **ERROR**: 错误信息

#### 常见错误日志

```log
# 文件不存在
ERROR - 输入文件不存在: /path/to/file.txt

# 格式不支持
ERROR - 不支持的文件格式: .xyz

# 权限问题
ERROR - 无法写入输出目录: /path/to/output

# LibreOffice错误
ERROR - LibreOffice转换失败: 返回码1
```

## 💡 最佳实践

### 文件组织建议

#### 目录结构
```
项目目录/
├── 输入文件/
│   ├── 文档/
│   │   ├── word文档/
│   │   ├── excel表格/
│   │   └── ppt演示/
│   ├── 文本文件/
│   └── markdown文件/
├── 输出PDF/
│   ├── 按日期分类/
│   └── 按类型分类/
└── 备份/
    └── 原始文件备份/
```

#### 文件命名规范
- 使用有意义的文件名
- 避免特殊字符和空格
- 使用日期前缀便于排序
- 示例: `20250730_项目报告.docx`

### 性能优化建议

#### 1. 硬件优化
- **CPU**: 多核心处理器提升并发性能
- **内存**: 8GB+内存处理大文件
- **存储**: SSD提升文件读写速度
- **网络**: 稳定网络连接

#### 2. 软件配置
```env
# 高性能配置
MAX_WORKERS=4
CONVERSION_TIMEOUT=600
PDF_QUALITY=standard
SKIP_TEMP_FILES=true
```

#### 3. 批处理策略
- 按文件大小分组处理
- 按文件类型分组处理
- 避免同时处理过多大文件
- 定期清理临时文件

### 安全建议

#### 1. 文件安全
- 定期备份重要文件
- 验证转换结果完整性
- 使用版本控制管理文档

#### 2. 系统安全
- 定期更新依赖包
- 使用虚拟环境隔离
- 限制文件访问权限

#### 3. 数据隐私
- 敏感文件本地处理
- 及时清理临时文件
- 加密存储重要文档

### 维护建议

#### 定期维护任务
```bash
# 每周执行
# 1. 清理日志文件
find logs/ -name "*.log" -mtime +7 -delete

# 2. 清理临时文件
rm -rf /tmp/office2pdf_*

# 3. 更新依赖
pip list --outdated
pip install --upgrade package_name

# 4. 检查磁盘空间
df -h
```

#### 监控指标
- 转换成功率
- 平均转换时间
- 错误类型分布
- 系统资源使用

---

*最后更新: 2025-07-30*
