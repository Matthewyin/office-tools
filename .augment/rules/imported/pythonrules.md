---
type: "always_apply"
---

# 现代 Python 开发规范 (v2.1)

为确保代码质量、提升开发效率、实现高效团队协作，并拥抱现代 Python 生态，所有 Python 项目开发必须严格遵循以下规范。

### **1. 项**目设置与环境管理 (Project Setup & Environment Management)

#### 1.1. 版本控制 (Version Control)

- **强制使用 Git**：所有项目代码必须使用 Git 进行版本控制，并托管于远程仓库（如 GitHub, GitLab）。
- **`.gitignore` 文件**：必须配置详尽的 `.gitignore` 文件，以忽略不必要的文件，例如：
  - 虚拟环境目录 (`.venv/`, `venv/`)
  - 敏感配置文件 (`.env`)
  - Python 缓存文件 (`__pycache__/`, `.pyc`)
  - IDE 和系统配置文件 (`.idea/`, `.vscode/`, `.DS_Store`)
  - 测试与构建产物 (`.pytest_cache/`, `build/`, `dist/`, `*.egg-info`)

#### 1.2. 虚拟环境 (Virtual Environments)

- **强制使用虚拟环境**：必须为每个项目创建独立的 Python 虚拟环境，以实现项目依赖的完全隔离。

- **推荐工具**：

  - **`uv` (新一代推荐)**：一个用 Rust 编写的极速 Python 包安装器和解析器。它兼容 `pip` 的工作流程，但速度要快得多，并内置了虚拟环境管理功能。
  - **`venv` (标准内置)**：Python 内置的 `venv` 模块是创建虚拟环境的标准方式。

  ```
  # 使用 uv 创建并激活虚拟环境 (推荐)
  uv venv
  source .venv/bin/activate
  
  # 使用 venv 创建并激活虚拟环境 (传统)
  python -m venv .venv
  source .venv/bin/activate
  ```

#### 1.3. 依赖管理 (Dependency Management)

- **核心标准 `pyproject.toml`**：项目依赖管理**必须**采用 `pyproject.toml` 文件。这统一了项目元数据、构建需求和依赖项，是现代 Python 项目的基石。推荐使用 `Poetry` 或 `PDM` 等现代工具进行管理，它们会自动维护 `pyproject.toml`。
- **传统方案 `requirements.txt`**：对于非常简单的项目或需要兼容旧环境的场景，可使用 `requirements.txt`。
  - **精确导出**：必须使用 `uv pip freeze > requirements.txt` 或 `pip freeze > requirements.txt` 命令导出精确依赖列表。
  - **分层管理**：可将依赖分为 `requirements.txt` (生产) 和 `requirements-dev.txt` (开发)。
  - **安装依赖**：新环境必须使用 `uv pip install -r requirements.txt` 或 `pip install -r requirements.txt` 进行安装。

### 2. 代码规范与质量 (Code Style & Quality)

#### 2.1. 代码风格 (Code Style)

- **PEP 8 规范**：所有 Python 代码必须严格遵循 [PEP 8](https://peps.python.org/pep-0008/) 规范。
- **自动化工具链 `Ruff`**：**强烈推荐**使用 `Ruff` 作为主要的代码检查和格式化工具。它集成了 `Flake8` (Linter), `isort` (import 排序), `Black` (格式化) 等多种工具的功能，速度极快且配置简单。
  - 在 `pyproject.toml` 中配置 `Ruff`，统一团队风格。
  - **行长度**：推荐将最大行长度设置为 `88` (Black 默认) 或 `120`，团队内保持统一。

#### 2.2. 类型提示 (Type Hinting)

- **强制使用类型提示**：所有新代码中的函数签名（参数和返回值）和关键变量声明，都**必须**包含类型提示（Type Hints, [PEP 484](https://peps.python.org/pep-0484/)）。

- **静态类型检查**：应在 CI/CD 流程中集成 `Mypy` 或使用 `Ruff` 内置的类型检查功能，对代码进行静态分析，及早发现类型错误。

  ```
  def greet(name: str) -> str:
      return f"Hello, {name}"
  
  user_id: int = 101
  ```

#### 2.3. 代码注释与文档 (Code Comments & Documentation)

- **详尽注释**：对复杂的业务逻辑、算法或非直观的操作，必须编写清晰的中文注释。
- **标准文档字符串 (Docstring)**：每个模块、类和函数都必须包含文档字符串。推荐遵循 [Google Python Style Guide](https://www.google.com/search?q=https://github.com/google/styleguide/blob/gh-pages/pyguide.md%2338-comments-and-docstrings) 或 NumPy 风格。
- **项目文档**：复杂项目建议使用 `Sphinx` 或 `MkDocs` 自动生成项目文档网站。

### 3. 配置与数据管理 (Configuration & Data Management)

#### 3.1. 目录结构 (Directory Structure)

- **自动化创建**：程序必须内置检查机制，在启动时自动检测并创建所有必要的目录。

- **推荐结构**:

  ```
  project_root/
  ├── .venv/                   # 虚拟环境
  ├── .git/                    # Git 目录
  ├── src/                     # 主要源代码目录 (推荐)
  │   └── my_project/
  │       ├── __init__.py
  │       └── ...
  ├── tests/                   # 测试代码
  ├── data/                    # 数据文件
  │   ├── raw/                 # 原始输入数据
  │   └── processed/           # 处理后的输出数据
  ├── logs/                    # 日志文件
  ├── docs/                    # 项目文档
  ├── .env                     # 环境变量文件 (绝不提交到 Git)
  ├── .gitignore               # Git 忽略配置
  ├── pyproject.toml           # 项目配置文件 (首选)
  ├── README.md                # 项目说明文件
  ```

#### 3.2. 配置管理 (Configuration Management)

- **禁止硬编码**：严禁在代码中硬编码任何可变参数。
- **分离敏感信息**：使用 `python-dotenv` 库管理 `.env` 文件中的环境变量。`.env` 必须加入 `.gitignore`。
- **统一加载**：必须提供一个统一的配置模块或类，负责加载和提供所有配置参数。

#### 3.3. 文件 I/O (File I/O)

- **使用 `pathlib`**：推荐使用 `pathlib` 模块处理文件路径。
- **明确路径**：所有文件读写应基于项目根目录构建绝对路径或使用相对路径。

### 4. 健壮性与可靠性 (Robustness & Reliability)

#### 4.1. 日志管理 (Logging)

- **使用 `logging` 模块**：必须使用 Python 内置的 `logging` 模块，禁止使用 `print()`。
- **结构化日志**：推荐使用结构化日志（如 JSON 格式），可使用 `structlog` 等库。
- **详尽内容与合理分级**：日志必须包含时间戳、级别、模块名等信息。错误日志必须含完整堆栈跟踪。

#### 4.2. 错误处理 (Error Handling)

- **精准捕获**：必须捕获具体的异常类型，严禁使用裸露的 `except:`。
- **上下文管理**：优先使用 `with` 语句处理需要关闭的资源。
- **优雅退出**：对于不可恢复的错误，记录日志后，应通过 `sys.exit(1)` 退出程序。

#### 4.3. 测试 (Testing)

- **强制编写单元测试**：核心业务逻辑必须有单元测试覆盖。推荐使用 `pytest`。
- **测试覆盖率**：建议使用 `pytest-cov` 插件监控测试覆盖率（如目标 >80%）。
- **测试独立性**：测试用例应保持独立，不依赖于其他测试。

### 5. 架构与设计 (Architecture & Design)

#### 5.1. 模块化与可重用性 (Modularity & Reusability)

- **单一职责原则**：函数和类应遵循单一职责原则。
- **避免循环导入**：精心设计模块依赖关系，避免循环导入。
- **清晰的接口**：编写通用性强、接口清晰的代码。

#### 5.2. 输出简洁性 (Output Conciseness)

- **面向目标输出**：代码的返回结果或控制台输出应简洁明确。
- **禁止冗余信息**：避免在程序化输出中包含不必要的解释性文字。

### 6. 自动化 (Automation)

#### 6.1. 持续集成/持续部署 (CI/CD)

- **建立 CI 流水线**：强烈建议使用 GitHub Actions, GitLab CI 等工具。
- **自动化检查**：CI 流水线应至少包含：代码格式化与检查 (`Ruff`)、静态类型检查 (`Mypy`/`Ruff`)、运行测试 (`pytest`)。