#!/usr/bin/env python

"""
Office转PDF工具实用函数模块

提供文件处理、路径操作等实用功能。

作者: Matthew Yin
日期: 2025-01-29
"""

import logging
import os
import shutil
from pathlib import Path
from typing import Generator, List, Optional, Tuple


def get_file_size_mb(file_path: Path) -> float:
    """
    获取文件大小（MB）

    Args:
        file_path: 文件路径

    Returns:
        float: 文件大小（MB）
    """
    try:
        size_bytes = file_path.stat().st_size
        return size_bytes / (1024 * 1024)
    except OSError:
        return 0.0


def format_file_size(size_bytes: int) -> str:
    """
    格式化文件大小显示

    Args:
        size_bytes: 文件大小（字节）

    Returns:
        str: 格式化的文件大小字符串
    """
    for unit in ["B", "KB", "MB", "GB"]:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} TB"


def find_office_files(
    directory: Path, recursive: bool = False, extensions: Optional[List[str]] = None
) -> Generator[Path, None, None]:
    """
    查找目录中的Office文件

    Args:
        directory: 搜索目录
        recursive: 是否递归搜索
        extensions: 支持的扩展名列表

    Yields:
        Path: Office文件路径
    """
    if extensions is None:
        extensions = [".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt"]

    # 转换为小写以便比较
    extensions = [ext.lower() for ext in extensions]

    pattern = "**/*" if recursive else "*"

    for file_path in directory.glob(pattern):
        if file_path.is_file():
            # 检查扩展名
            if file_path.suffix.lower() in extensions:
                # 跳过临时文件
                if not file_path.name.startswith("~$"):
                    yield file_path


def validate_input_path(input_path: str) -> Tuple[bool, str, Optional[Path]]:
    """
    验证输入路径

    Args:
        input_path: 输入路径字符串

    Returns:
        Tuple[bool, str, Optional[Path]]: (是否有效, 错误信息, 路径对象)
    """
    try:
        path = Path(input_path).resolve()

        if not path.exists():
            return False, f"路径不存在: {input_path}", None

        if not (path.is_file() or path.is_dir()):
            return False, f"路径既不是文件也不是目录: {input_path}", None

        return True, "", path

    except Exception as e:
        return False, f"路径解析错误: {e}", None


def ensure_output_directory(output_dir: Optional[str], input_path: Path) -> Path:
    """
    确保输出目录存在

    Args:
        output_dir: 指定的输出目录
        input_path: 输入文件/目录路径

    Returns:
        Path: 输出目录路径
    """
    if output_dir:
        output_path = Path(output_dir)
    else:
        # 如果输入是文件，使用文件所在目录
        # 如果输入是目录，使用该目录
        output_path = input_path.parent if input_path.is_file() else input_path

    # 创建目录
    output_path.mkdir(parents=True, exist_ok=True)

    return output_path


def check_disk_space(path: Path, required_mb: float = 100.0) -> bool:
    """
    检查磁盘空间是否足够

    Args:
        path: 检查路径
        required_mb: 需要的空间（MB）

    Returns:
        bool: 空间是否足够
    """
    try:
        stat = shutil.disk_usage(path)
        free_mb = stat.free / (1024 * 1024)
        return free_mb >= required_mb
    except OSError:
        return True  # 无法检查时假设空间足够


def backup_existing_file(file_path: Path) -> Optional[Path]:
    """
    备份已存在的文件

    Args:
        file_path: 要备份的文件路径

    Returns:
        Optional[Path]: 备份文件路径，如果备份失败则返回None
    """
    if not file_path.exists():
        return None

    # 生成备份文件名
    backup_path = file_path.with_suffix(f"{file_path.suffix}.backup")
    counter = 1

    while backup_path.exists():
        backup_path = file_path.with_suffix(f"{file_path.suffix}.backup.{counter}")
        counter += 1

    try:
        shutil.copy2(file_path, backup_path)
        return backup_path
    except OSError as e:
        logging.error(f"备份文件失败: {e}")
        return None


def clean_temp_files(directory: Path) -> int:
    """
    清理临时文件

    Args:
        directory: 要清理的目录

    Returns:
        int: 清理的文件数量
    """
    temp_patterns = ["~$*", ".tmp", "*.tmp", ".temp", "*.temp"]
    cleaned_count = 0

    for pattern in temp_patterns:
        for temp_file in directory.glob(pattern):
            try:
                if temp_file.is_file():
                    temp_file.unlink()
                    cleaned_count += 1
                    logging.debug(f"删除临时文件: {temp_file}")
            except OSError as e:
                logging.warning(f"无法删除临时文件 {temp_file}: {e}")

    return cleaned_count


def get_relative_path(file_path: Path, base_path: Path) -> str:
    """
    获取相对路径

    Args:
        file_path: 文件路径
        base_path: 基准路径

    Returns:
        str: 相对路径字符串
    """
    try:
        return str(file_path.relative_to(base_path))
    except ValueError:
        # 如果无法计算相对路径，返回绝对路径
        return str(file_path)


def create_progress_bar(current: int, total: int, width: int = 50) -> str:
    """
    创建进度条字符串

    Args:
        current: 当前进度
        total: 总数
        width: 进度条宽度

    Returns:
        str: 进度条字符串
    """
    if total == 0:
        return "[" + "=" * width + "] 100%"

    progress = current / total
    filled_width = int(width * progress)
    bar = "=" * filled_width + "-" * (width - filled_width)
    percentage = int(progress * 100)

    return f"[{bar}] {percentage}% ({current}/{total})"


def log_system_info(logger: logging.Logger) -> None:
    """
    记录系统信息

    Args:
        logger: 日志记录器
    """
    import platform
    import sys

    logger.info("=== 系统信息 ===")
    logger.info(f"操作系统: {platform.system()} {platform.release()}")
    logger.info(f"Python版本: {sys.version}")
    logger.info(f"当前工作目录: {os.getcwd()}")

    # 检查LibreOffice
    libreoffice_cmd = None
    for cmd in ["libreoffice", "soffice"]:
        if shutil.which(cmd):
            libreoffice_cmd = cmd
            break

    if libreoffice_cmd:
        logger.info(f"LibreOffice命令: {libreoffice_cmd}")
    else:
        logger.warning("未找到LibreOffice")

    logger.info("================")
