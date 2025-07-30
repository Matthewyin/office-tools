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

## 💡 使用建议

### 推荐启动方式
**双击启动**是最简单的方式，无需处理任何技术细节：
- 双击 `启动PDF转换工具.command` 文件
- 自动处理环境设置和依赖检查
- 直接启动GUI界面

### 为什么不推荐Mac应用打包？
- macOS安全机制会阻止未签名的应用
- 需要复杂的权限设置和用户干预
- Python版本功能完全相同且更稳定

## 🔧 故障排除

### 常见问题
1. **虚拟环境未找到**: 运行 `uv venv && source .venv/bin/activate && uv pip install -e .`
2. **依赖缺失**: 启动脚本会自动安装缺失的依赖
3. **GUI无法启动**: 检查Python环境和依赖安装

### 获取帮助
- 详细文档: [office2pdf/README.md](office2pdf/README.md)
- 技术架构: [office2pdf/ARCHITECTURE.md](office2pdf/ARCHITECTURE.md)

---

*最后更新: 2025-07-30*
