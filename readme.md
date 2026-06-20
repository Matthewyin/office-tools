# Office工具集 (Office Tools)

本项目是一个办公自动化与辅助工具集，包含以下实用工具：

1. [🤖 Office 助手 (Sidebar)](#-office-助手-sidebar)：基于 Office Web Add-ins 的多功能 AI 侧边栏助手，支持 Word/Excel/PowerPoint，本地前后端运行。
2. [🗄️ 机柜部署图生成器 (Cabinet Diagram Generator)](#️-机柜部署图生成器-cabinet-diagram-generator)：基于 Python 自动将 CSV 数据生成 Draw.io 机柜图。
3. [📊 toptab](#-toptab)：Draw.io 图表与 CSV 格式转换工具。

---

## 🤖 Office 助手 (Sidebar)

这是一个基于 Office Web Add-ins 技术开发的多功能 AI 侧边栏助手，同时支持 **Word**、**Excel** 和 **PowerPoint** 三大微软 Office 宿主应用。它允许你直接在 Office 内部与各类大语言模型（LLM）进行流式对话，并可直接读取选中的文档、表格、幻灯片内容，或一键将 AI 生成的结果写回文档。

当前默认使用本地前后端：前端运行在 `https://localhost:30030`，本地 Agent API 运行在 `http://127.0.0.1:30031`。

### ✨ 核心特性

- **三宿主一体化**：一个插件包同时支持 Word、Excel 和 PowerPoint，交互与样式高度统一。
- **本地 Agent API**：前端通过 `/api/*` 代理访问本地后端，便于后续接入网页搜索、Skills 和 MCP Gateway。
- **本地 LLM 代理**：LLM API Key 放在本地后端 `.env.local`，前端只选择模型，不直接保存密钥。
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
   - 找到 **“Office 助手”** 并点击添加。你会在 Ribbon 栏最右侧看到一个漂亮的 Office 助手图标。
   - 点击图标，即可在右侧展开 Office 助手侧边栏。

### 🧩 本地 Agent API

本地后端位于 `agent-server/`，当前已提供基础接口：

- `GET /api/health`：健康检查，返回后端状态、搜索 Provider 和已注册工具。
- `GET /api/tools`：查看已注册工具。
- `POST /api/tools/call`：统一工具调用入口，推荐使用。
- `POST /api/tools/search`：搜索工具兼容入口，等价于调用 `web_search`。
- `POST /api/chat/with-tools`：聊天工具准备入口，后端判断是否需要工具并返回标准化 `toolEvidence`。
- `GET /api/context?conversationId=...`：读取本地内存中的会话工具上下文。
- `DELETE /api/context?conversationId=...`：清空指定会话的本地工具上下文。
- `POST /api/search`：旧搜索接口，保留兼容。

所有 JSON 响应都会带 `requestId`。错误格式统一为：

```json
{
  "ok": false,
  "requestId": "req_xxx",
  "error": {
    "code": "ERROR_CODE",
    "message": "错误说明"
  }
}
```

搜索工具标准名为 `web_search`，请求示例：

```bash
curl -k -s https://localhost:30030/api/tools/call \
  -H 'Content-Type: application/json' \
  -d '{"tool":"web_search","input":{"query":"OpenAI news","maxResults":3,"includeAnswer":"basic"}}'
```

聊天工具准备接口不会调用 LLM，只返回前端可交给 LLM 的证据，并按 `conversationId` 写入本地内存上下文：

```bash
curl -k -s https://localhost:30030/api/chat/with-tools \
  -H 'Content-Type: application/json' \
  -d '{"conversationId":"demo","input":"搜索 OpenAI 最新消息","options":{"webSearchEnabled":true,"maxResults":3}}'
```

返回中的 `toolEvidence` 用于 UI 展示来源，`answerInput.evidenceText` 用于拼入 LLM 提示词。

本地上下文当前只保存在后端内存中，用于记录同一会话的搜索证据和工具调用历史。刷新 Office 加载项后仍可恢复；重启 `agent-server` 后会清空。

后端工具链路验证：

```bash
npm run verify:backend
```

该命令会验证健康检查、工具注册、统一错误格式、搜索触发、上下文读取和上下文清空。默认通过 `https://localhost:30030/api/*` 验证前端代理和本地后端；如需直连后端，可设置 `OFFICE_AGENT_BASE_URL=http://127.0.0.1:30031`。

如需配置真实搜索，请在项目根目录或 `agent-server/.env.local` 中设置：

```bash
PORT=30031
HOST=127.0.0.1
TAVILY_API_KEY=你的 Tavily Key
TOOL_TIMEOUT_MS=30000
SEARCH_MAX_RESULTS=5
LLM_API_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=你的 LLM Key
LLM_MODEL=gpt-4o-mini
LLM_TIMEOUT_MS=180000
```

如果未设置 `SEARCH_PROVIDER`，且存在 `TAVILY_API_KEY`，后端会默认使用 Tavily。也可以显式设置 `SEARCH_PROVIDER=tavily`。

### ⚙️ LLM 供应商配置指南

LLM 密钥由本地后端保存。你可以直接在 Office 助手设置页新增多个模型配置；点击保存后，后端会写入 `agent-server/.env.local` 的 `LLM_PROFILES_JSON` 和 `LLM_SELECTED_PROFILE_ID`，不会把 API Key 写入前端 localStorage。

常见 OpenAI-compatible 配置：

| 供应商 | `LLM_API_BASE_URL` | `LLM_API_KEY` | 推荐 `LLM_MODEL` |
| :--- | :--- | :--- | :--- |
| **DeepSeek** | `https://api.deepseek.com/v1` | DeepSeek API Key | `deepseek-chat` |
| **OpenAI** | `https://api.openai.com/v1` | OpenAI API Key | `gpt-4o` / `gpt-4o-mini` |
| **Gemini** | `https://generativelanguage.googleapis.com/v1beta/openai` | Google AI Studio Key | `gemini-1.5-pro` / `gemini-1.5-flash` |
| **Ollama** | `http://localhost:11434/v1` | 任意字符 | 本地模型名，如 `llama3` |

> [!NOTE]
> 浏览器前端不能直接写系统环境变量；这里是通过本地后端接口写入项目内的 `agent-server/.env.local`，并立即更新当前后端进程内存配置。

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
