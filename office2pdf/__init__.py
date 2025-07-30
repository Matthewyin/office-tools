#!/usr/bin/env python

"""
Office转PDF工具包

一个功能完整的Python工具包，用于将Microsoft Office文件转换为PDF格式。

主要模块:
- office_to_pdf: 核心转换器
- config: 配置管理
- utils: 实用工具函数

作者: Matthew Yin
日期: 2025-01-29
版本: 1.0.0
"""

from .config import config
from .office_to_pdf import OfficeConverter
from .utils import (
    ensure_output_directory,
    find_office_files,
    format_file_size,
    get_file_size_mb,
    validate_input_path,
)

__version__ = "1.0.0"
__author__ = "Matthew Yin"
__email__ = "2738550@qq.com"

__all__ = [
    "OfficeConverter",
    "config",
    "find_office_files",
    "validate_input_path",
    "ensure_output_directory",
    "get_file_size_mb",
    "format_file_size",
]
