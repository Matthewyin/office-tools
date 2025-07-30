# 系统架构设计文档

## 📋 概述

多格式文件转PDF工具是一个基于Python的跨平台应用程序，采用模块化设计，支持多种文件格式转换为PDF。系统设计遵循单一职责原则、开闭原则和依赖倒置原则。

## 🏗️ 整体架构

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    用户界面层 (UI Layer)                      │
├─────────────────────┬───────────────────┬───────────────────┤
│   GUI界面 (gui.py)   │  命令行界面 (CLI)  │  编程接口 (API)    │
└─────────────────────┴───────────────────┴───────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   业务逻辑层 (Business Layer)                 │
├─────────────────────────────────────────────────────────────┤
│              通用转换器 (converter.py)                        │
│  ┌─────────────────┬─────────────────┬─────────────────┐    │
│  │  Office转换器    │   文本转换器     │  Markdown转换器  │    │
│  └─────────────────┴─────────────────┴─────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   支持服务层 (Service Layer)                  │
├─────────────────────┬───────────────────┬───────────────────┤
│   配置管理           │    工具函数        │    日志管理        │
│  (config.py)        │   (utils.py)      │   (logging)       │
└─────────────────────┴───────────────────┴───────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   外部依赖层 (External Layer)                 │
├─────────────────────┬───────────────────┬───────────────────┤
│    LibreOffice      │    ReportLab      │   Draw.io Desktop │
│   (Office文件)       │   (文本/PDF)       │   (图表文件)       │
└─────────────────────┴───────────────────┴───────────────────┘
```

### 设计原则

1. **分层架构**: 清晰的分层结构，每层职责明确
2. **模块化设计**: 高内聚、低耦合的模块设计
3. **插件化扩展**: 支持新文件格式的插件式扩展
4. **依赖注入**: 通过配置管理实现依赖注入
5. **错误隔离**: 完善的错误处理和隔离机制

## 🧩 核心模块设计

### 1. 转换器模块 (converter.py)

#### 类图
```
┌─────────────────────────────────────────┐
│            UniversalConverter            │
├─────────────────────────────────────────┤
│ - output_dir: Optional[Path]            │
│ - max_workers: int                      │
│ - logger: Logger                        │
│ - daemon_process: Optional[Process]     │
│ - libreoffice_cmd: Optional[str]        │
├─────────────────────────────────────────┤
│ + __init__(output_dir, max_workers)     │
│ + convert_file(input_file) -> bool      │
│ + convert_directory(dir, recursive)     │
│ + cleanup() -> None                     │
│ - _convert_office_file(...)             │
│ - _convert_text_file(...)               │
│ - _convert_markdown_file(...)           │
│ - _convert_drawio_file(...)             │
│ - _ensure_daemon_running() -> bool      │
└─────────────────────────────────────────┘
```

#### 设计模式
- **策略模式**: 不同文件格式使用不同的转换策略
- **工厂模式**: 根据文件扩展名选择合适的转换器
- **单例模式**: LibreOffice守护进程管理

#### 核心算法
```python
def convert_file(self, input_file: Path) -> bool:
    """
    文件转换主流程:
    1. 验证输入文件
    2. 检查文件格式支持
    3. 选择转换策略
    4. 执行转换
    5. 验证输出结果
    """
    # 文件格式检测
    file_ext = input_file.suffix.lower()
    
    # 策略选择
    if file_ext in OFFICE_EXTENSIONS:
        return self._convert_office_file(input_file, output_file)
    elif file_ext in TEXT_EXTENSIONS:
        return self._convert_text_file(input_file, output_file)
    # ... 其他格式
```

### 2. 配置管理模块 (config.py)

#### 类图
```
┌─────────────────────────────────────────┐
│                Config                   │
├─────────────────────────────────────────┤
│ + SUPPORTED_EXTENSIONS: List[str]       │
│ + CONVERSION_TIMEOUT: int               │
│ + LOG_LEVEL: str                        │
│ + LOG_DIR: str                          │
│ + PDF_QUALITY: str                      │
├─────────────────────────────────────────┤
│ + __init__()                            │
│ + get_libreoffice_command() -> str      │
│ + validate_config() -> Dict             │
│ + get_conversion_args() -> List[str]    │
│ + get_log_file_path() -> Path           │
└─────────────────────────────────────────┘
```

#### 配置加载流程
```
环境变量 → .env文件 → 默认配置
    ↓
配置验证 → 依赖检查 → 配置生效
```

### 3. GUI模块 (gui.py)

#### 架构模式
- **MVC模式**: Model-View-Controller分离
- **观察者模式**: 事件驱动的用户界面
- **命令模式**: 用户操作封装为命令

#### 组件结构
```
┌─────────────────────────────────────────┐
│              ConverterGUI               │
├─────────────────────────────────────────┤
│ - root: Tk                              │
│ - converter: UniversalConverter         │
│ - conversion_queue: Queue               │
│ - is_converting: bool                   │
├─────────────────────────────────────────┤
│ + __init__()                            │
│ + run()                                 │
│ - _create_widgets()                     │
│ - _select_files()                       │
│ - _start_conversion()                   │
│ - _conversion_worker()                  │
│ - _check_queue()                        │
└─────────────────────────────────────────┘
```

### 4. 工具函数模块 (utils.py)

#### 功能分类
```
文件操作
├── find_office_files()      # 文件发现
├── validate_input_path()    # 路径验证
└── ensure_output_directory() # 目录创建

格式化工具
├── get_file_size_mb()       # 文件大小
├── format_file_size()       # 大小格式化
└── get_relative_path()      # 相对路径

清理工具
├── clean_temp_files()       # 临时文件清理
└── log_system_info()        # 系统信息记录
```

## 🔄 数据流设计

### 转换流程数据流

```
用户输入
    ↓
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  文件路径    │ →  │  格式检测    │ →  │  转换策略    │
└─────────────┘    └─────────────┘    └─────────────┘
    ↓                    ↓                    ↓
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  参数配置    │ →  │  转换执行    │ →  │  结果验证    │
└─────────────┘    └─────────────┘    └─────────────┘
    ↓                    ↓                    ↓
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  日志记录    │ ←  │  错误处理    │ ←  │  PDF输出    │
└─────────────┘    └─────────────┘    └─────────────┘
```

### 并发处理数据流

```
文件队列
    ↓
┌─────────────────────────────────────────┐
│            ThreadPoolExecutor            │
├─────────────┬─────────────┬─────────────┤
│   Worker 1  │   Worker 2  │   Worker N  │
│      ↓      │      ↓      │      ↓      │
│  转换任务1   │  转换任务2   │  转换任务N   │
└─────────────┴─────────────┴─────────────┘
    ↓             ↓             ↓
┌─────────────────────────────────────────┐
│              结果收集器                  │
└─────────────────────────────────────────┘
    ↓
统计结果输出
```

## 🔌 扩展性设计

### 新文件格式扩展

#### 1. 添加新的转换器
```python
def _convert_new_format_file(self, input_file: Path, output_file: Path) -> bool:
    """新格式转换器"""
    try:
        # 实现转换逻辑
        return True
    except Exception as e:
        self.logger.error(f"新格式转换失败: {e}")
        return False
```

#### 2. 注册文件扩展名
```python
NEW_FORMAT_EXTENSIONS = {'.newext'}
ALL_EXTENSIONS = OFFICE_EXTENSIONS | TEXT_EXTENSIONS | NEW_FORMAT_EXTENSIONS
```

#### 3. 添加转换分发
```python
elif file_ext in NEW_FORMAT_EXTENSIONS:
    success = self._convert_new_format_file(input_path, output_path)
```

### GUI扩展

#### 插件化界面组件
```python
class PluginInterface:
    def get_name(self) -> str: pass
    def get_widget(self, parent) -> Widget: pass
    def on_convert(self, files: List[Path]) -> None: pass
```

## 🛡️ 错误处理架构

### 错误分层处理

```
┌─────────────────────────────────────────┐
│              用户界面层                  │
│  ┌─────────────────────────────────────┐ │
│  │        用户友好错误提示              │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
                    ↑
┌─────────────────────────────────────────┐
│              业务逻辑层                  │
│  ┌─────────────────────────────────────┐ │
│  │      业务异常捕获和处理              │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
                    ↑
┌─────────────────────────────────────────┐
│              系统服务层                  │
│  ┌─────────────────────────────────────┐ │
│  │      系统异常记录和恢复              │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 异常类型设计

```python
class ConversionError(Exception):
    """转换相关异常基类"""
    pass

class UnsupportedFormatError(ConversionError):
    """不支持的文件格式"""
    pass

class LibreOfficeError(ConversionError):
    """LibreOffice相关错误"""
    pass

class FileAccessError(ConversionError):
    """文件访问错误"""
    pass
```

## 📊 性能优化设计

### 1. 并发处理优化

#### 线程池管理
```python
class ThreadPoolManager:
    def __init__(self, max_workers: int):
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.futures = []
    
    def submit_task(self, func, *args):
        future = self.executor.submit(func, *args)
        self.futures.append(future)
        return future
    
    def wait_all(self):
        for future in as_completed(self.futures):
            yield future.result()
```

#### 负载均衡策略
- **文件大小均衡**: 大文件优先分配给空闲线程
- **格式类型均衡**: 不同格式分配给不同线程
- **动态调整**: 根据系统资源动态调整并发数

### 2. 内存管理优化

#### 流式处理
```python
def process_large_file(file_path: Path):
    """大文件流式处理"""
    with open(file_path, 'rb') as f:
        while chunk := f.read(8192):
            # 分块处理，避免内存溢出
            process_chunk(chunk)
```

#### 资源清理
```python
def cleanup_resources(self):
    """资源清理"""
    if self.daemon_process:
        self.daemon_process.terminate()
    
    # 清理临时文件
    temp_files = glob.glob("/tmp/office2pdf_*")
    for temp_file in temp_files:
        os.remove(temp_file)
```

### 3. 缓存策略

#### 转换结果缓存
```python
class ConversionCache:
    def __init__(self):
        self.cache = {}
    
    def get_cache_key(self, file_path: Path) -> str:
        """生成缓存键"""
        stat = file_path.stat()
        return f"{file_path}_{stat.st_mtime}_{stat.st_size}"
    
    def is_cached(self, file_path: Path) -> bool:
        """检查是否已缓存"""
        key = self.get_cache_key(file_path)
        return key in self.cache
```

## 🔒 安全性设计

### 1. 输入验证
- 文件路径验证
- 文件格式验证
- 文件大小限制
- 恶意文件检测

### 2. 权限控制
- 文件访问权限检查
- 输出目录权限验证
- 进程权限最小化

### 3. 错误信息安全
- 敏感信息过滤
- 错误信息脱敏
- 日志安全记录

## 📈 监控和日志

### 日志架构
```
应用日志 → 结构化日志 → 日志聚合 → 监控告警
    ↓           ↓           ↓           ↓
转换记录    JSON格式    文件存储    性能监控
错误追踪    时间戳      日志轮转    异常告警
性能指标    级别分类    压缩归档    趋势分析
```

### 监控指标
- 转换成功率
- 转换耗时分布
- 内存使用情况
- 错误类型统计
- 并发性能指标

---

*最后更新: 2025-07-30*
