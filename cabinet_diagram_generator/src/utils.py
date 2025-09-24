"""
工具函数模块

包含数据处理、格式转换、验证等通用工具函数。
"""

import re
import os
import sys
from pathlib import Path
from typing import Union, Optional, List, Dict, Any, Tuple
from datetime import datetime
import pandas as pd
from loguru import logger


class CabinetDiagramException(Exception):
    """机柜图生成工具基础异常类"""
    pass


class DataValidationError(CabinetDiagramException):
    """数据验证错误"""
    pass


class FileFormatError(CabinetDiagramException):
    """文件格式错误"""
    pass


class LayoutError(CabinetDiagramException):
    """布局错误"""
    pass


class ConfigurationError(CabinetDiagramException):
    """配置错误"""
    pass


def setup_logging(log_level: str = "INFO", log_file: Optional[str] = None, 
                  log_format: Optional[str] = None) -> None:
    """
    设置日志系统
    
    Args:
        log_level: 日志级别
        log_file: 日志文件路径
        log_format: 日志格式
    """
    # 移除默认处理器
    logger.remove()
    
    # 设置默认格式
    if log_format is None:
        log_format = "{time:YYYY-MM-DD HH:mm:ss} | {level} | {name}:{function}:{line} - {message}"
    
    # 添加控制台处理器
    logger.add(
        sys.stderr,
        level=log_level,
        format=log_format,
        colorize=True
    )
    
    # 添加文件处理器
    if log_file:
        # 确保日志目录存在
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        
        logger.add(
            log_file,
            level=log_level,
            format=log_format,
            rotation="1 day",
            retention="30 days",
            compression="zip"
        )


def ensure_directory(path: Union[str, Path]) -> Path:
    """
    确保目录存在，如果不存在则创建
    
    Args:
        path: 目录路径
        
    Returns:
        Path对象
    """
    path_obj = Path(path)
    path_obj.mkdir(parents=True, exist_ok=True)
    return path_obj


def parse_u_position(u_str: str) -> int:
    """
    解析U位字符串，提取数字部分
    
    Args:
        u_str: U位字符串，如 "U5", "5U", "5"
        
    Returns:
        U位数字
        
    Raises:
        DataValidationError: 无法解析U位格式
    """
    if not u_str:
        raise DataValidationError("U位不能为空")
    
    # 移除空格并转换为大写
    u_str = str(u_str).strip().upper()
    
    # 使用正则表达式提取数字
    match = re.search(r'(\d+)', u_str)
    if not match:
        raise DataValidationError(f"无法解析U位格式: {u_str}")
    
    u_position = int(match.group(1))
    if u_position <= 0:
        raise DataValidationError(f"U位必须大于0: {u_position}")
    
    return u_position


def parse_device_height(height_str: str) -> int:
    """
    解析设备高度字符串，提取数字部分
    
    Args:
        height_str: 设备高度字符串，如 "2U", "U2", "2"
        
    Returns:
        设备高度数字
        
    Raises:
        DataValidationError: 无法解析设备高度格式
    """
    if not height_str:
        raise DataValidationError("设备高度不能为空")
    
    # 移除空格并转换为大写
    height_str = str(height_str).strip().upper()
    
    # 使用正则表达式提取数字
    match = re.search(r'(\d+)', height_str)
    if not match:
        raise DataValidationError(f"无法解析设备高度格式: {height_str}")
    
    height = int(match.group(1))
    if height <= 0:
        raise DataValidationError(f"设备高度必须大于0: {height}")
    
    return height


def validate_csv_file(file_path: Union[str, Path]) -> bool:
    """
    验证CSV文件是否存在且可读
    
    Args:
        file_path: CSV文件路径
        
    Returns:
        是否有效
        
    Raises:
        FileFormatError: 文件不存在或不可读
    """
    path_obj = Path(file_path)
    
    if not path_obj.exists():
        raise FileFormatError(f"文件不存在: {file_path}")
    
    if not path_obj.is_file():
        raise FileFormatError(f"路径不是文件: {file_path}")
    
    if not path_obj.suffix.lower() in ['.csv', '.txt']:
        raise FileFormatError(f"文件格式不支持: {path_obj.suffix}")
    
    try:
        with open(path_obj, 'r', encoding='utf-8') as f:
            f.read(1)  # 尝试读取一个字符
    except UnicodeDecodeError:
        try:
            with open(path_obj, 'r', encoding='gbk') as f:
                f.read(1)
        except UnicodeDecodeError:
            raise FileFormatError(f"文件编码不支持，请使用UTF-8或GBK编码: {file_path}")
    except Exception as e:
        raise FileFormatError(f"文件读取失败: {e}")
    
    return True


def detect_csv_format(df: pd.DataFrame) -> str:
    """
    检测CSV文件格式（新格式或旧格式）
    
    Args:
        df: pandas DataFrame
        
    Returns:
        格式类型: "new", "old", "unknown"
    """
    columns = set(df.columns)
    
    # 新格式必需字段
    new_format_fields = {"资产编号", "区域", "子区", "设备用途", "设备名", "型号", "设备高度", "机房", "机柜", "U位", "厂商"}
    
    # 旧格式必需字段
    old_format_fields = {"序号", "设备名", "型号", "设备高度", "类型", "机柜号", "U位"}
    
    # 检查新格式
    if new_format_fields.issubset(columns):
        return "new"
    
    # 检查旧格式
    if old_format_fields.issubset(columns):
        return "old"
    
    return "unknown"


def standardize_device_purpose(purpose: str) -> str:
    """
    标准化设备用途名称
    
    Args:
        purpose: 原始设备用途
        
    Returns:
        标准化后的设备用途
    """
    if not purpose:
        return "其他"
    
    purpose = str(purpose).strip()
    
    # 用途映射表
    purpose_mapping = {
        # Web服务相关
        "web": "Web服务",
        "web服务": "Web服务",
        "web服务器": "Web服务",
        "应用服务器": "应用服务",
        "app": "应用服务",
        "应用": "应用服务",
        
        # 数据库相关
        "db": "数据库",
        "database": "数据库",
        "数据库": "数据库",
        "数据库服务器": "数据库",
        
        # 存储相关
        "storage": "存储",
        "存储": "存储",
        "存储服务器": "存储",
        "san": "存储",
        "nas": "存储",
        
        # 网络相关
        "network": "网络核心",
        "网络": "网络核心",
        "交换机": "网络接入",
        "switch": "网络接入",
        "路由器": "网络核心",
        "router": "网络核心",
        
        # 安全相关
        "security": "安全防护",
        "安全": "安全防护",
        "防火墙": "安全防护",
        "firewall": "安全防护",
        
        # 负载均衡
        "lb": "负载均衡",
        "负载均衡": "负载均衡",
        "load balancer": "负载均衡",
        
        # 备份相关
        "backup": "备份",
        "备份": "备份",
        "备份服务器": "备份",
        
        # 监控相关
        "monitor": "监控",
        "监控": "监控",
        "监控服务器": "监控",
        
        # 管理设备
        "management": "管理设备",
        "管理": "管理设备",
        "kvm": "管理设备",
        
        # 缓存服务
        "cache": "缓存服务",
        "缓存": "缓存服务",
        "redis": "缓存服务",
        
        # 电源设备
        "power": "电源设备",
        "电源": "电源设备",
        "ups": "电源设备",
        "pdu": "电源设备"
    }
    
    # 转换为小写进行匹配
    purpose_lower = purpose.lower()
    
    # 精确匹配
    if purpose_lower in purpose_mapping:
        return purpose_mapping[purpose_lower]
    
    # 模糊匹配
    for key, value in purpose_mapping.items():
        if key in purpose_lower or purpose_lower in key:
            return value
    
    return purpose if purpose else "其他"


def generate_timestamp() -> str:
    """
    生成时间戳字符串
    
    Returns:
        格式化的时间戳
    """
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def format_file_size(size_bytes: int) -> str:
    """
    格式化文件大小
    
    Args:
        size_bytes: 字节数
        
    Returns:
        格式化的文件大小字符串
    """
    if size_bytes == 0:
        return "0B"
    
    size_names = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    while size_bytes >= 1024 and i < len(size_names) - 1:
        size_bytes /= 1024.0
        i += 1
    
    return f"{size_bytes:.1f}{size_names[i]}"


def validate_device_data(device_data: Dict[str, Any]) -> List[str]:
    """
    验证设备数据的有效性
    
    Args:
        device_data: 设备数据字典
        
    Returns:
        错误信息列表
    """
    errors = []
    
    # 检查必需字段
    required_fields = ["资产编号", "设备名", "型号", "设备高度", "机柜", "U位"]
    for field in required_fields:
        if field not in device_data or not device_data[field]:
            errors.append(f"缺少必需字段: {field}")
    
    # 验证数据类型和范围
    try:
        if "设备高度" in device_data:
            height = parse_device_height(str(device_data["设备高度"]))
            if height > 40:  # 一般设备不会超过10U
                errors.append(f"设备高度异常: {height}U")
    except DataValidationError as e:
        errors.append(str(e))
    
    try:
        if "U位" in device_data:
            u_pos = parse_u_position(str(device_data["U位"]))
            if u_pos > 42:  # 标准机柜最大42U
                errors.append(f"U位超出范围: U{u_pos}")
    except DataValidationError as e:
        errors.append(str(e))
    
    return errors


def create_output_filename(prefix: str = "cabinet_diagram", 
                          suffix: str = "drawio",
                          include_timestamp: bool = True) -> str:
    """
    创建输出文件名
    
    Args:
        prefix: 文件名前缀
        suffix: 文件扩展名
        include_timestamp: 是否包含时间戳
        
    Returns:
        文件名
    """
    if include_timestamp:
        timestamp = generate_timestamp()
        return f"{prefix}_{timestamp}.{suffix}"
    else:
        return f"{prefix}.{suffix}"


def safe_get_value(data: Dict[str, Any], key: str, default: Any = None) -> Any:
    """
    安全获取字典值
    
    Args:
        data: 数据字典
        key: 键名
        default: 默认值
        
    Returns:
        值或默认值
    """
    value = data.get(key, default)
    if value is None or (isinstance(value, str) and value.strip() == ""):
        return default
    return value
