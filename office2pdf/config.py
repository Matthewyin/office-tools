#!/usr/bin/env python

"""
Office转PDF工具配置模块

管理转换器的配置参数和环境变量。

作者: Matthew Yin
日期: 2025-01-29
"""

import os
from pathlib import Path
from typing import Dict, List, Optional

from dotenv import load_dotenv


class Config:
    """配置管理类"""

    def __init__(self) -> None:
        """初始化配置"""
        # 加载环境变量
        self._load_env()

        # 默认配置
        self._setup_defaults()

    def _load_env(self) -> None:
        """加载环境变量文件"""
        # 查找.env文件
        env_paths = [Path(".env"), Path("../.env"), Path("../../.env")]

        for env_path in env_paths:
            if env_path.exists():
                load_dotenv(env_path)
                break

    def _setup_defaults(self) -> None:
        """设置默认配置"""
        # 支持的文件扩展名
        self.SUPPORTED_EXTENSIONS: List[str] = [
            ".docx",
            ".doc",  # Word文档
            ".xlsx",
            ".xls",  # Excel表格
            ".pptx",
            ".ppt",  # PowerPoint演示文稿
        ]

        # LibreOffice命令候选列表
        self.LIBREOFFICE_COMMANDS: List[str] = [
            "libreoffice",
            "soffice",
            "/Applications/LibreOffice.app/Contents/MacOS/soffice",  # macOS
            "/usr/bin/libreoffice",  # Linux
            "C:\\Program Files\\LibreOffice\\program\\soffice.exe",  # Windows
        ]

        # 转换超时时间（秒）
        self.CONVERSION_TIMEOUT: int = int(os.getenv("CONVERSION_TIMEOUT", "300"))

        # 默认输出目录
        self.DEFAULT_OUTPUT_DIR: Optional[str] = os.getenv("DEFAULT_OUTPUT_DIR")

        # 日志配置
        self.LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
        self.LOG_DIR: str = os.getenv("LOG_DIR", "logs")

        # 文件处理配置
        self.SKIP_TEMP_FILES: bool = (
            os.getenv("SKIP_TEMP_FILES", "true").lower() == "true"
        )
        self.OVERWRITE_EXISTING: bool = (
            os.getenv("OVERWRITE_EXISTING", "false").lower() == "true"
        )

        # 批处理配置
        self.MAX_CONCURRENT_CONVERSIONS: int = int(
            os.getenv("MAX_CONCURRENT_CONVERSIONS", "1")
        )

        # 质量设置
        self.PDF_QUALITY: str = os.getenv(
            "PDF_QUALITY", "default"
        )  # low, default, high

    def get_libreoffice_command(self) -> Optional[str]:
        """
        获取可用的LibreOffice命令

        Returns:
            str: 可用的LibreOffice命令路径，如果未找到则返回None
        """
        import shutil

        for cmd in self.LIBREOFFICE_COMMANDS:
            if shutil.which(cmd) or Path(cmd).exists():
                return cmd

        return None

    def is_supported_file(self, file_path: Path) -> bool:
        """
        检查文件是否为支持的格式

        Args:
            file_path: 文件路径

        Returns:
            bool: 是否支持
        """
        return file_path.suffix.lower() in self.SUPPORTED_EXTENSIONS

    def should_skip_file(self, file_path: Path) -> bool:
        """
        检查是否应该跳过文件

        Args:
            file_path: 文件路径

        Returns:
            bool: 是否应该跳过
        """
        # 跳过临时文件
        if self.SKIP_TEMP_FILES and file_path.name.startswith("~$"):
            return True

        # 跳过隐藏文件
        if file_path.name.startswith("."):
            return True

        return False

    def get_pdf_conversion_options(self) -> List[str]:
        """
        获取PDF转换选项

        Returns:
            List[str]: LibreOffice转换选项
        """
        options = ["--convert-to", "pdf"]

        # 根据质量设置添加选项
        if self.PDF_QUALITY == "high":
            options.extend(["--export-pdf-quality", "100"])
        elif self.PDF_QUALITY == "low":
            options.extend(["--export-pdf-quality", "50"])

        return options

    def create_directories(self) -> None:
        """创建必要的目录"""
        # 创建日志目录
        log_dir = Path(self.LOG_DIR)
        log_dir.mkdir(parents=True, exist_ok=True)

        # 创建默认输出目录
        if self.DEFAULT_OUTPUT_DIR:
            output_dir = Path(self.DEFAULT_OUTPUT_DIR)
            output_dir.mkdir(parents=True, exist_ok=True)

    def validate_config(self) -> Dict[str, bool]:
        """
        验证配置

        Returns:
            Dict[str, bool]: 验证结果
        """
        results = {}

        # 检查LibreOffice
        results["libreoffice_available"] = self.get_libreoffice_command() is not None

        # 检查目录权限
        try:
            log_dir = Path(self.LOG_DIR)
            log_dir.mkdir(parents=True, exist_ok=True)
            results["log_dir_writable"] = True
        except PermissionError:
            results["log_dir_writable"] = False

        # 检查输出目录
        if self.DEFAULT_OUTPUT_DIR:
            try:
                output_dir = Path(self.DEFAULT_OUTPUT_DIR)
                output_dir.mkdir(parents=True, exist_ok=True)
                results["output_dir_writable"] = True
            except PermissionError:
                results["output_dir_writable"] = False
        else:
            results["output_dir_writable"] = True

        return results


# 全局配置实例
config = Config()
