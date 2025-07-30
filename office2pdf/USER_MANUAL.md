# 用户操作手册

## 📖 完整的用户操作指南

本手册提供多格式文件转PDF工具的完整使用说明，包括安装、配置、使用和故障排除。

## 📋 目录

1. [系统要求](#系统要求)
2. [安装指南](#安装指南)
3. [配置说明](#配置说明)
4. [使用方法](#使用方法)
5. [高级功能](#高级功能)
6. [故障排除](#故障排除)
7. [最佳实践](#最佳实践)

## 🛠️ 系统要求

### 最低系统要求

| 组件 | 要求 | 说明 |
|------|------|------|
| **操作系统** | Windows 10+, macOS 10.14+, Ubuntu 18.04+ | 支持主流操作系统 |
| **Python** | 3.8+ | 推荐使用3.10+ |
| **内存** | 2GB RAM | 推荐4GB+ |
| **存储** | 500MB可用空间 | 包含依赖和临时文件 |
| **LibreOffice** | 6.0+ | 用于Office文件转换 |

### 推荐系统配置

| 组件 | 推荐配置 | 性能提升 |
|------|----------|----------|
| **CPU** | 4核心+ | 并发转换性能 |
| **内存** | 8GB+ | 大文件处理 |
| **存储** | SSD | 文件读写速度 |
| **网络** | 稳定连接 | 依赖下载 |

## 📦 安装指南

### 步骤1: 安装Python环境

#### Windows
```bash
# 从官网下载Python 3.10+
# https://www.python.org/downloads/

# 验证安装
python --version
pip --version
```

#### macOS
```bash
# 使用Homebrew安装
brew install python

# 或从官网下载安装包
# 验证安装
python3 --version
pip3 --version
```

#### Linux (Ubuntu/Debian)
```bash
# 更新包管理器
sudo apt update

# 安装Python
sudo apt install python3 python3-pip python3-venv

# 验证安装
python3 --version
pip3 --version
```

### 步骤2: 安装LibreOffice

#### Windows
1. 访问 https://www.libreoffice.org/download/
2. 下载Windows版本安装包
3. 运行安装程序，按默认设置安装
4. 验证安装：在命令行运行 `soffice --version`

#### macOS
```bash
# 使用Homebrew安装（推荐）
brew install --cask libreoffice

# 或从官网下载安装包
# 验证安装
/Applications/LibreOffice.app/Contents/MacOS/soffice --version
```

#### Linux
```bash
# Ubuntu/Debian
sudo apt install libreoffice

# CentOS/RHEL
sudo yum install libreoffice

# 验证安装
soffice --version
```

### 步骤3: 安装Draw.io Desktop（可选）

#### 用于.drawio文件转换

```bash
# macOS
brew install --cask drawio

# Windows/Linux
# 从GitHub下载: https://github.com/jgraph/drawio-desktop/releases
```

### 步骤4: 安装项目依赖

#### 方法1: 使用uv（推荐）
```bash
# 安装uv
pip install uv

# 创建虚拟环境
uv venv

# 激活虚拟环境
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

# 安装项目依赖
uv pip install -e .
```

#### 方法2: 使用传统pip
```bash
# 创建虚拟环境
python -m venv .venv

# 激活虚拟环境
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

# 安装项目依赖
pip install -e .
```

### 步骤5: 验证安装

```bash
# 运行验证脚本
python verify_installation.py

# 预期输出：
# ✅ 所有包导入成功
# ✅ LibreOffice: soffice
# ✅ 配置验证通过
```

## ⚙️ 配置说明

### 环境变量配置

创建`.env`文件进行个性化配置：

```env
# 转换设置
CONVERSION_TIMEOUT=300          # 转换超时时间（秒）
PDF_QUALITY=standard           # PDF质量：standard, high
OVERWRITE_EXISTING=false       # 是否覆盖已存在的PDF

# 日志设置
LOG_LEVEL=INFO                 # 日志级别：DEBUG, INFO, WARNING, ERROR
LOG_DIR=logs                   # 日志目录

# 文件处理
SKIP_TEMP_FILES=true          # 跳过临时文件
DEFAULT_OUTPUT_DIR=           # 默认输出目录（留空使用源文件目录）

# 性能设置
MAX_WORKERS=2                 # 默认并发线程数
```

### 配置文件位置

| 系统 | 配置文件路径 |
|------|-------------|
| **Windows** | `%USERPROFILE%\.office2pdf\config.env` |
| **macOS** | `~/.office2pdf/config.env` |
| **Linux** | `~/.office2pdf/config.env` |

### 高级配置选项

#### LibreOffice配置
```env
# LibreOffice路径（自动检测失败时使用）
LIBREOFFICE_PATH=/usr/bin/soffice

# LibreOffice守护进程端口
LIBREOFFICE_PORT=2002

# 守护进程超时时间
DAEMON_TIMEOUT=30
```

#### 性能调优
```env
# 内存限制（MB）
MAX_MEMORY_MB=1024

# 临时文件目录
TEMP_DIR=/tmp/office2pdf

# 并发策略：thread, process
CONCURRENCY_TYPE=thread
```

## 🎯 使用方法

### GUI界面使用

#### 启动GUI
```bash
# 简化版GUI（推荐，macOS兼容）
python run_gui_simple.py

# 标准版GUI
python run_gui.py
```

#### 基本操作流程

1. **启动应用**
   - 双击启动脚本或在终端运行命令
   - 等待界面加载完成

2. **选择文件**
   - 点击"选择文件"按钮选择单个或多个文件
   - 或点击"选择目录"按钮选择包含文件的目录
   - 支持拖拽文件到输入框

3. **配置选项**
   - **输出目录**: 留空则在源文件同目录生成PDF
   - **递归处理**: 勾选以处理子目录中的文件
   - **并发线程数**: 根据系统性能调整（1-8个）

4. **开始转换**
   - 点击"开始转换"按钮
   - 观察进度条和日志信息
   - 转换完成后查看结果

#### GUI界面说明

```
┌─────────────────────────────────────────────────────────┐
│  多格式文件转PDF工具 v2.0                                │
├─────────────────────────────────────────────────────────┤
│  选择文件或目录                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ [文件路径输入框]  [选择文件] [选择目录]              │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│  输出目录（可选）                                        │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ [输出目录路径]                                      │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│  转换选项                                               │
│  ☐ 递归处理子目录    并发线程数: [2] ▼                   │
│                                                         │
│  [开始转换] [停止转换] [清空日志]                        │
│                                                         │
│  状态: 就绪                                             │
│  ████████████████████████████████████████████████████   │
│                                                         │
│  转换日志                                               │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ [12:34:56] INFO: 欢迎使用多格式文件转PDF工具 v2.0    │ │
│  │ [12:34:57] INFO: 请选择文件或目录进行转换            │ │
│  │ ...                                                 │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 命令行使用

#### 基本语法
```bash
python -m office2pdf.converter [选项] <输入路径>
```

#### 常用命令示例

```bash
# 转换单个文件
python -m office2pdf.converter document.docx

# 转换多个文件
python -m office2pdf.converter file1.txt file2.md file3.docx

# 批量转换目录
python -m office2pdf.converter /path/to/documents

# 递归处理子目录
python -m office2pdf.converter /path/to/documents --recursive

# 指定输出目录
python -m office2pdf.converter /path/to/documents -o /path/to/output

# 设置并发线程数
python -m office2pdf.converter /path/to/documents -w 4

# 顺序处理（禁用并发）
python -m office2pdf.converter /path/to/documents --sequential
```

#### 命令行选项详解

| 选项 | 简写 | 说明 | 示例 |
|------|------|------|------|
| `--output` | `-o` | 指定输出目录 | `-o /path/to/output` |
| `--recursive` | `-r` | 递归处理子目录 | `-r` |
| `--workers` | `-w` | 并发线程数 | `-w 4` |
| `--sequential` | | 顺序处理 | `--sequential` |
| `--help` | `-h` | 显示帮助信息 | `-h` |

### 编程接口使用

#### 基本使用示例

```python
from office2pdf import UniversalConverter

# 创建转换器
converter = UniversalConverter()

# 转换单个文件
success = converter.convert_file("document.txt")
if success:
    print("转换成功")
else:
    print("转换失败")

# 批量转换目录
stats = converter.convert_directory("/path/to/files", recursive=True)
print(f"总计: {stats['total']}, 成功: {stats['success']}, 失败: {stats['failed']}")

# 清理资源
converter.cleanup()
```

#### 高级配置示例

```python
from office2pdf import UniversalConverter
from pathlib import Path

# 创建高性能转换器
converter = UniversalConverter(
    output_dir="/path/to/output",  # 输出目录
    max_workers=4                  # 并发线程数
)

# 批量处理文件列表
files = [
    Path("document1.txt"),
    Path("document2.md"),
    Path("document3.docx")
]

results = []
for file_path in files:
    success = converter.convert_file(file_path)
    results.append((file_path.name, success))

# 输出结果
for filename, success in results:
    status = "✅" if success else "❌"
    print(f"{status} {filename}")

# 清理资源
converter.cleanup()
```

#### 错误处理示例

```python
from office2pdf import UniversalConverter
import logging

# 配置日志
logging.basicConfig(level=logging.INFO)

try:
    converter = UniversalConverter()
    
    # 转换文件
    success = converter.convert_file("document.txt")
    
    if not success:
        print("转换失败，请检查日志文件")
        
except Exception as e:
    print(f"程序异常: {e}")
    
finally:
    if 'converter' in locals():
        converter.cleanup()
```

## 🚀 高级功能

### 批量处理脚本

创建自定义批量处理脚本：

```python
#!/usr/bin/env python
# batch_convert.py

import sys
from pathlib import Path
from office2pdf import UniversalConverter

def batch_convert(input_dirs, output_dir):
    """批量转换多个目录"""
    converter = UniversalConverter(output_dir=output_dir, max_workers=4)
    
    total_stats = {'total': 0, 'success': 0, 'failed': 0}
    
    for input_dir in input_dirs:
        print(f"处理目录: {input_dir}")
        stats = converter.convert_directory(input_dir, recursive=True)
        
        # 累计统计
        for key in total_stats:
            total_stats[key] += stats[key]
    
    print(f"批量转换完成: {total_stats}")
    converter.cleanup()

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("用法: python batch_convert.py <输出目录> <输入目录1> [输入目录2] ...")
        sys.exit(1)
    
    output_dir = sys.argv[1]
    input_dirs = sys.argv[2:]
    
    batch_convert(input_dirs, output_dir)
```

### 定时任务集成

#### Windows任务计划程序
```batch
@echo off
cd /d "C:\path\to\project"
call .venv\Scripts\activate
python -m office2pdf.converter "C:\input\folder" -o "C:\output\folder" -r
```

#### macOS/Linux cron任务
```bash
# 编辑crontab
crontab -e

# 添加定时任务（每天凌晨2点执行）
0 2 * * * cd /path/to/project && source .venv/bin/activate && python -m office2pdf.converter /input/folder -o /output/folder -r
```

### 监控和通知

#### 邮件通知脚本
```python
import smtplib
from email.mime.text import MIMEText
from office2pdf import UniversalConverter

def send_notification(stats):
    """发送转换结果通知"""
    msg = MIMEText(f"转换完成: 成功{stats['success']}, 失败{stats['failed']}")
    msg['Subject'] = 'PDF转换任务完成'
    msg['From'] = 'sender@example.com'
    msg['To'] = 'recipient@example.com'
    
    # 发送邮件
    server = smtplib.SMTP('smtp.example.com', 587)
    server.starttls()
    server.login('username', 'password')
    server.send_message(msg)
    server.quit()

# 使用示例
converter = UniversalConverter()
stats = converter.convert_directory("/path/to/files")
send_notification(stats)
```

## 🔧 故障排除

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
# 使用简化版GUI
python run_gui_simple.py

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
