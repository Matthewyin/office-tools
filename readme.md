# Office工具集 (Office Tools)

本项目是一个办公自动化与辅助工具集，包含以下实用工具：

1. [🤖 Office AI 助手 (Sidebar)](#-office-ai-助手-sidebar)：基于 Office Web Add-ins 的多功能 AI 侧边栏助手，支持 Word/Excel/PowerPoint，本地后台静默运行。
2. [🗄️ 机柜部署图生成器 (Cabinet Diagram Generator)](#️-机柜部署图生成器-cabinet-diagram-generator)：基于 Python 自动将 CSV 数据生成 Draw.io 机柜图。
3. [📊 toptab](#-toptab)：Draw.io 图表与 CSV 格式转换工具。

---

## 🤖 Office AI 助手 (Sidebar)

这是一个基于 Office Web Add-ins 技术开发的多功能 AI 侧边栏助手，同时支持 **Word**、**Excel** 和 **PowerPoint** 三大微软 Office 宿主应用。它允许你直接在 Office 内部与各类大语言模型（LLM）进行流式对话，并可直接读取选中的文档、表格、幻灯片内容，或一键将 AI 生成的结果写回文档。

### ✨ 核心特性

- **三宿主一体化**：一个插件包同时支持 Word、Excel 和 PowerPoint，交互与样式高度统一。
- **后台守护静默运行**：使用 macOS `launchd` 守护进程将 Vite 本地服务挂载在后台运行，开机自启，无需手动保持终端窗口开启。
- **自定义 LLM API**：支持接入 OpenAI、DeepSeek、Claude、Gemini、Ollama 等任何兼容 OpenAI API 规范的 LLM 供应商，输入你自己的 API Key 即可。
- **流式响应 (SSE)**：AI 回复支持打字机流式输出，极致响应体验。
- **深度上下文关联**：支持一键获取文档/幻灯片中所选的文字，或 Excel 中选中的单元格数据（自动转为表格和 CSV 格式提供给 AI）。
- **一键回写/改写**：支持将 AI 生成的回复、改写结果一键“插入至光标处”或“替换选中内容”。

### 🛠️ 首次安装与 Sideload 步骤 (macOS)

1. **安装本地 HTTPS 证书**（Office Web Add-in 强制要求 HTTPS 服务）：
   进入 `sidebar` 目录，安装并信任证书：
   ```bash
   cd sidebar
   npx office-addin-dev-certs install
   ```
   *根据系统提示输入密码以信任该证书。*

2. **一键 Sideload 载入插件**：
   运行项目内置的 sideload 脚本，这会自动将 `manifest.xml` 复制到 macOS Office 对应的 WEF 目录中：
   ```bash
   npm run sideload
   ```

3. **配置并启动后台服务**（开机自启，免开终端）：
   本插件使用端口 `30030` 提供本地 HTTPS 服务。我们配置了 macOS `launchd` 服务，你可以用以下 npm 命令一键管理：
   - **安装并启动后台服务**：
     ```bash
     npm run service:install
     ```
   - **查看服务运行状态**：
     ```bash
     npm run service:status
     ```
   - **查看实时日志**（排查问题）：
     ```bash
     npm run service:log
     ```
   - **重启服务**（如果修改了代码或配置）：
     ```bash
     npm run service:restart
     ```
   - **停止与卸载服务**：
     ```bash
     npm run service:stop
     npm run service:uninstall
     ```

### 🎈 如何在 Office 中启用

1. 确保后台服务已启动（可以访问 [https://localhost:30030/taskpane.html](https://localhost:30030/taskpane.html) 验证）。
2. 重启你的 Word、Excel 或 PowerPoint。
3. 在上方 Ribbon 菜单栏中，点击**“开始”**（或**“插入”**） -> **“加载项”**（或**“我的加载项”**）。
4. 找到 **“AI 助手”** 并点击添加。你会在 Ribbon 栏最右侧看到一个漂亮的 AI 助手图标。
5. 点击图标，即可在右侧展开 AI 助手侧边栏。

### ⚙️ LLM 供应商配置指南

点击侧边栏顶部的 **“设置”** 齿轮图标，配置你的模型服务：

| 供应商 | 接口 API Base 地址 (API URL) | API Key | 推荐模型 |
| :--- | :--- | :--- | :--- |
| **DeepSeek** | `https://api.deepseek.com/v1` | 填入你的 DeepSeek API Key | `deepseek-chat` |
| **OpenAI** | `https://api.openai.com/v1` | 填入你的 OpenAI API Key | `gpt-4o` / `gpt-4o-mini` |
| **Claude** | `https://api.anthropic.com/v1` | 填入你的 Anthropic API Key | `claude-3-5-sonnet-latest` |
| **Gemini** | `https://generativelanguage.googleapis.com/v1beta/openai` | 填入你的 Google AI Studio Key | `gemini-1.5-pro` / `gemini-1.5-flash` |
| **Ollama** | `http://localhost:11434/v1` | 任意字符（如 `ollama`） | 填入本地运行的模型（如 `llama3`） |

### ⚠️ 宿主功能边界与限制说明

由于微软 Office JavaScript API 的底层设计差异，不同软件有以下限制：

- **📝 Word (文档)**：
  - **读取**：完美支持读取选中文本、段落。
  - **写入**：支持在光标处插入内容或原地替换当前选中文字。
- **📊 Excel (电子表格)**：
  - **读取**：支持读取选中的单元格区域（自动转化为 CSV 和 HTML 表格文本发送给 AI，保持行列结构）。
  - **写入**：将 AI 生成的内容一键写回当前选中单元格或当前活动位置。
- **📺 PowerPoint (幻灯片)**：
  - **读取**：支持读取当前选中的文本框内的文字。
  - **写入限制**：由于 PPT JS API 暂不支持精细的光标段落操作，当点击“插入至光标处”时，插件会**新建一张幻灯片**并在其中添加文本框，或者在当前幻灯片中插入新的文本框，无法原地替换或直接插入到既有文本框的光标处。

---

## 🗄️ 机柜部署图生成器 (Cabinet Diagram Generator)

### 项目概述

本项目是一个基于 Python 开发的自动化机柜部署图生成工具，能够读取 CSV 格式的设备清单数据，自动生成符合 Draw.io（diagrams.net）格式的机柜部署可视化图表。

### 核心特性

- **精确 U 位对齐**：设备精确对齐到 U 位网格，一目了然。
- **可视化网格**：每个 U 位都有可见的网格线，便于验证设备位置。

### 使用方法

```bash
uv run python -m src.main generate input/cmdb.csv --output output/cabinet_diagram.drawio
```

---

## 📊 toptab

### 使用方法

执行以下命令，生成 Draw.io 文件或 CSV 文件：

```bash 
uv run toptab convert
```