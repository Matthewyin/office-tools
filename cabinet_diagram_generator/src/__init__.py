"""
机柜部署图生成工具

一个用于自动生成机柜部署图的Python工具包。
"""

from .main import CabinetDiagramGenerator
from .csv_processor import CSVProcessor
from .layout_engine import LayoutEngine
from .drawio_generator import DrawioGenerator
from .models import Device, Cabinet, Layout, ConflictInfo, AdjustmentRecord
from .config import (
    DiagramConfig, LayoutConfig, CSVConfig, ApplicationConfig,
    DEFAULT_DIAGRAM_CONFIG, DEFAULT_LAYOUT_CONFIG,
    DEFAULT_CSV_CONFIG, DEFAULT_APP_CONFIG
)
from .utils import (
    setup_logging, ensure_directory, parse_u_position,
    parse_device_height, standardize_device_purpose,
    CabinetDiagramException, DataValidationError,
    FileFormatError, LayoutError, ConfigurationError
)

__version__ = "0.1.0"
__author__ = "Cabinet Diagram Generator Team"
__email__ = "support@example.com"

__all__ = [
    # 主要类
    "CabinetDiagramGenerator",
    "CSVProcessor",
    "LayoutEngine",
    "DrawioGenerator",

    # 数据模型
    "Device",
    "Cabinet",
    "Layout",
    "ConflictInfo",
    "AdjustmentRecord",

    # 配置类
    "DiagramConfig",
    "LayoutConfig",
    "CSVConfig",
    "ApplicationConfig",
    "DEFAULT_DIAGRAM_CONFIG",
    "DEFAULT_LAYOUT_CONFIG",
    "DEFAULT_CSV_CONFIG",
    "DEFAULT_APP_CONFIG",

    # 工具函数
    "setup_logging",
    "ensure_directory",
    "parse_u_position",
    "parse_device_height",
    "standardize_device_purpose",

    # 异常类
    "CabinetDiagramException",
    "DataValidationError",
    "FileFormatError",
    "LayoutError",
    "ConfigurationError",
]
