# Office工具集 (Office Tools)

本项目是一个办公自动化与辅助工具集，包含以下实用工具：

1. [🤖 Office AI 助手 (Sidebar)](#-office-ai-助手-sidebar)：基于 Office Web Add-ins 的多功能 AI 侧边栏助手，支持 Word/Excel/PowerPoint，本地前后端运行。
2. [🗄️ 机柜部署图生成器 (Cabinet Diagram Generator)](#️-机柜部署图生成器-cabinet-diagram-generator)：基于 Python 自动将 CSV 数据生成 Draw.io 机柜图。
3. [📊 toptab](#-toptab)：Draw.io 图表与 CSV 格式转换工具。

---

## 🤖 Office AI 助手 (Sidebar)

这是一个基于 Office Web Add-ins 技术开发的多功能 AI 侧边栏助手，同时支持 **Word**、**Excel** 和 **PowerPoint** 三大微软 Office 宿主应用。它允许你直接在 Office 内部与各类大语言模型（LLM）进行流式对话，并可直接读取选中的文档、表格、幻灯片内容，或一键将 AI 生成的结果写回文档。

当前默认使用本地前后端：前端运行在 `https://localhost:30030`，本地 Agent API 运行在 `http://127.0.0.1:30031`。

### ✨ 核心特性

- **三宿主一体化**：一个插件包同时支持 Word、Excel 和 PowerPoint，交互与样式高度统一。
- **本地 Agent API**：前端通过 `/api/*` 代理访问本地后端，便于后续接入网页搜索、Skills 和 MCP Gateway。
- **自定义 LLM API**：支持接入 OpenAI、DeepSeek、Claude、Gemini、Ollama 等任何兼容 OpenAI API 规范的 LLM 供应商，输入您自己的 API Key 即可。
- **流式响应 (SSE)**：AI 回复支持打字机流式输出，极致响应体验。
- **深度上下文关联**：支持一键获取文档/幻灯片中所选的文字，或 Excel 中选中的单元格数据（自动转为表格和 CSV 格式提供给 AI）。
- **一键回写/改写**：支持将 AI 生成的回复、改写结果一键“插入至光标处”或“替换选中内容”。

### 🛠️ 本地运行与 Sideload 步骤 (macOS)

当前插件默认加载本地地址，需要先启动本地前端和后端：

1. **安装前端依赖**：
   ```bash
   cd sidebar
   npm install
   cd ..
   ```

2. **启动本地前后端**：
   ```bash
   npm run local
   ```
   这会同时启动：
   - 前端：`https://localhost:30030`
   - 后端：`http://127.0.0.1:30031`

3. **一键 Sideload 载入插件**：
   ```bash
   npm run sideload
   ```
   这会自动将配置了本地地址的 `manifest.xml` 复制到 macOS Office 对应的 WEF 目录中。

4. **在 Office 中启用**：
   - 重启你的 Word、Excel 或 PowerPoint。
   - 在上方 Ribbon 菜单栏中，点击**“开始”**（或**“插入”**） -> **“加载项”**（或**“我的加载项”**）。
   - 找到 **“AI 助手”** 并点击添加。你会在 Ribbon 栏最右侧看到一个漂亮的 AI 助手图标。
   - 点击图标，即可在右侧展开 AI 助手侧边栏。

### 🧩 本地 Agent API

本地后端位于 `agent-server/`，当前已提供基础接口：

- `GET /api/health`：健康检查。
- `POST /api/search`：网页搜索接口骨架。默认 `SEARCH_PROVIDER=mock`，只返回连通性结果。

如需配置真实搜索，请在 `agent-server/.env.local` 中设置：

```bash
PORT=30031
HOST=127.0.0.1
SEARCH_PROVIDER=brave
BRAVE_SEARCH_API_KEY=你的 Key
```

### ⚙️ LLM 供应商配置指南

点击侧边栏顶部的 **“设置”** 齿轮图标，配置你的模型服务：

| 供应商 | 接口 API Base 地址 (API URL) | API Key | 推荐模型 |
| :--- | :--- | :--- | :--- |
| **DeepSeek** | `https://api.deepseek.com/v1` | 填入你的 DeepSeek API Key | `deepseek-chat` |
| **OpenAI** | `https://api.openai.com/v1` | 填入你的 OpenAI API Key | `gpt-4o` / `gpt-4o-mini` |
| **Claude** | `https://api.anthropic.com/v1` | 填入你的 Anthropic API Key | `claude-3-5-sonnet-latest` |
| **Gemini** | `https://generativelanguage.googleapis.com/v1beta/openai` | 填入你的 Google AI Studio Key | `gemini-1.5-pro` / `gemini-1.5-flash` |
| **Ollama** | `http://localhost:11434/v1` | 任意字符（如 `ollama`） | 填入本地运行的模型（如 `llama3`） |

> [!NOTE]
> [!NOTE]
> LLM 配置当前仍保存在本机浏览器 `localStorage`。网页搜索等工具类密钥应放在 `agent-server/.env.local`，不要写入前端。

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

本项目是一个基于 Python 开发的自动化机柜部署图生成工具，能够读取 CSV 格式设备清单，自动生成符合 Draw.io 格式的部署可视化图表。

### 使用方法

```bash
uv run python -m src.main generate input/cmdb.csv --output output/cabinet_diagram.drawio
```

---

## 📊 toptab

### 使用方法

执行以下命令，进行转换：

```bash 
uv run toptab convert
```
