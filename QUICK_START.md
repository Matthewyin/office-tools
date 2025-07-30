# 🚀 快速开始指南

## 📋 使用Office2PDF工具

### 1. 启动GUI界面

#### 方法1: 双击启动（推荐）
```bash
# 双击文件启动
启动PDF转换工具.command
```

#### 方法2: 一键脚本
```bash
# 运行启动脚本
./start_app.sh
```

#### 方法3: 手动启动
```bash
# 确保在项目根目录
cd /path/to/Officetools

# 激活虚拟环境
source .venv/bin/activate

# 启动图形界面
python office2pdf/run_gui.py
```

### 2. 验证安装
```bash
# 检查安装是否正确
python office2pdf/verify_installation.py
```

### 3. 命令行使用
```bash
# 转换单个文件
python -m office2pdf.converter document.txt

# 批量转换目录
python -m office2pdf.converter /path/to/files -r
```

## ⚠️ 关于Mac应用打包

### 重要说明
由于macOS的安全机制，打包的.app应用可能无法正常启动。**推荐直接使用Python版本**，功能完全相同且更稳定。

### 如果仍需打包（可选）
```bash
# 1. 确保在项目根目录
cd /path/to/Officetools

# 2. 激活虚拟环境
source .venv/bin/activate

# 3. 构建Mac应用
python office2pdf/setup_app.py py2app

# 4. 启动应用
open dist/PDF转换工具.app
```

### 注意事项
- ✅ 必须在项目根目录运行打包命令
- ✅ 构建过程中的权限警告是正常的
- ✅ 构建成功后应用位于 `dist/PDF转换工具.app`
- ✅ 首次运行可能需要在系统偏好设置中允许

## 🔧 故障排除

### 常见问题
1. **找不到主脚本文件**: 确保在项目根目录运行
2. **权限错误**: 这些是正常警告，不影响应用功能
3. **应用无法启动**: 检查macOS安全设置

### 获取帮助
- 详细文档: [office2pdf/README.md](office2pdf/README.md)
- 构建指南: [office2pdf/BUILD_INSTRUCTIONS.md](office2pdf/BUILD_INSTRUCTIONS.md)
- 技术架构: [office2pdf/ARCHITECTURE.md](office2pdf/ARCHITECTURE.md)

---

*最后更新: 2025-07-30*
