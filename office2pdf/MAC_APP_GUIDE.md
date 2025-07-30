# Mac应用打包指南

## 📱 将多格式文件转PDF工具打包为Mac应用

### 🛠️ 准备工作

1. **安装打包依赖**：
```bash
# 激活虚拟环境
source .venv/bin/activate

# 安装GUI相关依赖
uv pip install -e ".[gui]"
```

2. **验证功能**：
```bash
# 测试GUI界面
python run_gui.py

# 测试转换功能
python test_new_features.py
```

### 📦 打包为Mac应用

#### 方法1: 使用py2app（推荐）

1. **安装py2app**：
```bash
pip install py2app
```

2. **构建应用**：
```bash
python setup_app.py py2app
```

3. **查看结果**：
```bash
ls -la dist/
# 应该看到 "PDF转换工具.app" 应用包
```

4. **测试应用**：
```bash
open "dist/PDF转换工具.app"
```

#### 方法2: 使用PyInstaller

1. **安装PyInstaller**：
```bash
pip install pyinstaller
```

2. **创建应用**：
```bash
pyinstaller --windowed --onedir --name "PDF转换工具" run_gui.py
```

### 🎯 应用功能

打包后的Mac应用具有以下功能：

#### 支持的文件格式
- **Office文件**: `.docx`, `.doc`, `.xlsx`, `.xls`, `.pptx`, `.ppt`
- **文本文件**: `.txt`
- **Markdown文件**: `.md`
- **Draw.io文件**: `.drawio` (需要安装Draw.io Desktop)

#### 主要特性
- 🖱️ **拖拽支持**: 直接拖拽文件到应用窗口
- 📁 **批量转换**: 支持选择多个文件或整个目录
- ⚡ **并发处理**: 多线程并行转换提升速度
- 📊 **实时进度**: 显示转换进度和详细日志
- 🔄 **递归处理**: 可递归处理子目录中的文件

### 🚀 使用方法

#### 启动应用
1. 双击 `PDF转换工具.app` 启动应用
2. 或者在终端中运行：`open "dist/PDF转换工具.app"`

#### 转换文件
1. **选择文件**：
   - 点击"选择文件"按钮选择单个或多个文件
   - 点击"选择目录"按钮选择包含文件的目录

2. **设置选项**：
   - 选择输出目录（可选，默认与源文件同目录）
   - 勾选"递归处理子目录"（如果需要）
   - 调整并发线程数（默认2个）

3. **开始转换**：
   - 点击"开始转换"按钮
   - 查看实时转换日志
   - 转换完成后查看结果

### 🔧 高级配置

#### 自定义应用图标
1. 准备一个 `.icns` 格式的图标文件
2. 修改 `setup_app.py` 中的 `iconfile` 参数：
```python
OPTIONS = {
    'iconfile': 'path/to/your/icon.icns',
    # ... 其他选项
}
```

#### 文件关联
应用已配置支持以下文件类型的关联：
- Office文档
- 文本文档
- Markdown文档
- Draw.io文档

用户可以直接双击支持的文件类型来启动应用进行转换。

### 📋 系统要求

#### 最低要求
- **macOS**: 10.12 (Sierra) 或更高版本
- **Python**: 3.8+ (打包时需要)
- **LibreOffice**: 用于Office文件转换
- **Draw.io Desktop**: 用于.drawio文件转换（可选）

#### 推荐配置
- **macOS**: 11.0 (Big Sur) 或更高版本
- **内存**: 4GB RAM 或更多
- **存储**: 至少500MB可用空间

### 🐛 故障排除

#### 常见问题

1. **应用无法启动**：
   - 检查macOS版本是否满足要求
   - 尝试在终端中运行查看错误信息

2. **LibreOffice未找到**：
   - 安装LibreOffice: `brew install --cask libreoffice`
   - 或从官网下载安装

3. **转换失败**：
   - 检查文件是否损坏
   - 确认文件格式是否支持
   - 查看应用日志获取详细错误信息

4. **权限问题**：
   - 确保应用有读取源文件的权限
   - 确保输出目录可写

#### 调试模式
如果遇到问题，可以在终端中运行GUI脚本进行调试：
```bash
cd /path/to/project
source .venv/bin/activate
python run_gui.py
```

### 📝 开发说明

#### 项目结构
```
Officetools/
├── office2pdf/
│   ├── converter.py        # 核心转换器
│   ├── gui.py             # GUI界面
│   ├── config.py          # 配置管理
│   └── utils.py           # 工具函数
├── run_gui.py             # GUI启动脚本
├── setup_app.py           # Mac应用打包脚本
└── MAC_APP_GUIDE.md       # 本文档
```

#### 自定义开发
- 修改 `office2pdf/gui.py` 来调整界面
- 修改 `office2pdf/converter.py` 来添加新的文件格式支持
- 修改 `setup_app.py` 来调整应用打包选项

### 📄 许可证

本应用基于MIT许可证开源。

### 👨‍💻 作者

Matthew Yin (2738550@qq.com)

---

*最后更新: 2025-07-30*
