#!/usr/bin/env python

"""
Office文件转PDF工具

支持将Word(.docx)、Excel(.xlsx)、PowerPoint(.pptx)文件转换为PDF格式。
使用LibreOffice的headless模式进行转换，确保跨平台兼容性。

作者: Matthew Yin
日期: 2025-01-29
"""

import argparse
import logging
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, Union


class OfficeConverter:
    """Office文件转PDF转换器"""

    # 支持的文件扩展名
    SUPPORTED_EXTENSIONS = {".docx", ".xlsx", ".pptx", ".doc", ".xls", ".ppt"}

    def __init__(self, output_dir: Optional[str] = None) -> None:
        """
        初始化转换器

        Args:
            output_dir: 输出目录，如果为None则在源文件同目录下创建
        """
        self.output_dir = Path(output_dir) if output_dir else None
        self.logger = self._setup_logger()
        self._check_libreoffice()

    def _setup_logger(self) -> logging.Logger:
        """设置日志配置"""
        # 创建logs目录
        log_dir = Path("logs")
        log_dir.mkdir(exist_ok=True)

        # 配置日志文件名
        log_file = (
            log_dir / f"office_converter_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
        )

        # 配置日志格式
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s - %(levelname)s - %(message)s",
            handlers=[
                logging.FileHandler(log_file, encoding="utf-8"),
                logging.StreamHandler(),
            ],
        )

        return logging.getLogger(__name__)

    def _check_libreoffice(self) -> None:
        """检查LibreOffice是否已安装"""
        libreoffice_commands = ["libreoffice", "soffice"]

        for cmd in libreoffice_commands:
            if shutil.which(cmd):
                self.libreoffice_cmd = cmd
                self.logger.info(f"找到LibreOffice命令: {cmd}")
                return

        self.logger.error("未找到LibreOffice安装。请安装LibreOffice以使用此工具。")
        self.logger.error("安装方法:")
        self.logger.error("  macOS: brew install --cask libreoffice")
        self.logger.error("  Ubuntu: sudo apt-get install libreoffice")
        self.logger.error("  Windows: 从官网下载安装 https://www.libreoffice.org/")
        raise RuntimeError("LibreOffice未安装")

    def _is_supported_file(self, file_path: Path) -> bool:
        """检查文件是否为支持的Office格式"""
        return file_path.suffix.lower() in self.SUPPORTED_EXTENSIONS

    def _get_output_path(self, input_file: Path) -> Path:
        """获取输出PDF文件路径"""
        if self.output_dir:
            # 确保输出目录存在
            self.output_dir.mkdir(parents=True, exist_ok=True)
            return self.output_dir / f"{input_file.stem}.pdf"
        else:
            return input_file.parent / f"{input_file.stem}.pdf"

    def convert_file(self, input_file: Union[str, Path]) -> bool:
        """
        转换单个文件为PDF

        Args:
            input_file: 输入文件路径

        Returns:
            bool: 转换是否成功
        """
        input_path = Path(input_file)

        # 检查输入文件
        if not input_path.exists():
            self.logger.error(f"输入文件不存在: {input_path}")
            return False

        if not self._is_supported_file(input_path):
            self.logger.error(f"不支持的文件格式: {input_path.suffix}")
            self.logger.error(f"支持的格式: {', '.join(self.SUPPORTED_EXTENSIONS)}")
            return False

        # 获取输出路径
        output_path = self._get_output_path(input_path)

        try:
            # 构建LibreOffice命令
            cmd = [
                self.libreoffice_cmd,
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                str(output_path.parent),
                str(input_path),
            ]

            self.logger.info(f"开始转换: {input_path.name} -> {output_path.name}")

            # 执行转换
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300,  # 5分钟超时
            )

            if result.returncode == 0:
                if output_path.exists():
                    self.logger.info(f"转换成功: {output_path}")
                    return True
                else:
                    self.logger.error(
                        f"转换命令执行成功但未找到输出文件: {output_path}"
                    )
                    return False
            else:
                self.logger.error(f"转换失败: {result.stderr}")
                return False

        except subprocess.TimeoutExpired:
            self.logger.error(f"转换超时: {input_path}")
            return False
        except Exception as e:
            self.logger.error(f"转换过程中发生错误: {e}")
            return False

    def convert_directory(
        self, input_dir: Union[str, Path], recursive: bool = False
    ) -> dict:
        """
        转换目录中的所有Office文件

        Args:
            input_dir: 输入目录路径
            recursive: 是否递归处理子目录

        Returns:
            dict: 转换结果统计
        """
        input_path = Path(input_dir)

        if not input_path.exists() or not input_path.is_dir():
            self.logger.error(f"输入目录不存在或不是目录: {input_path}")
            return {"success": 0, "failed": 0, "skipped": 0}

        # 查找Office文件
        pattern = "**/*" if recursive else "*"
        office_files = []

        for ext in self.SUPPORTED_EXTENSIONS:
            office_files.extend(input_path.glob(f"{pattern}{ext}"))
            office_files.extend(input_path.glob(f"{pattern}{ext.upper()}"))

        if not office_files:
            self.logger.warning(f"在目录中未找到支持的Office文件: {input_path}")
            return {"success": 0, "failed": 0, "skipped": 0}

        # 转换统计
        stats = {"success": 0, "failed": 0, "skipped": 0}

        self.logger.info(f"找到 {len(office_files)} 个Office文件")

        for file_path in office_files:
            # 跳过临时文件
            if file_path.name.startswith("~$"):
                self.logger.debug(f"跳过临时文件: {file_path}")
                stats["skipped"] += 1
                continue

            if self.convert_file(file_path):
                stats["success"] += 1
            else:
                stats["failed"] += 1

        self.logger.info(
            f"转换完成 - 成功: {stats['success']}, 失败: {stats['failed']}, 跳过: {stats['skipped']}"
        )
        return stats


def main() -> None:
    """主函数"""
    parser = argparse.ArgumentParser(
        description="Office文件转PDF工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  %(prog)s file.docx                    # 转换单个文件
  %(prog)s /path/to/files               # 转换目录中的所有Office文件
  %(prog)s /path/to/files -r            # 递归转换子目录
  %(prog)s file.xlsx -o /output/dir     # 指定输出目录
        """,
    )

    parser.add_argument("input_path", help="输入文件或目录路径")

    parser.add_argument("-o", "--output", help="输出目录（可选，默认为源文件同目录）")

    parser.add_argument("-r", "--recursive", action="store_true", help="递归处理子目录")

    args = parser.parse_args()

    try:
        # 创建转换器
        converter = OfficeConverter(output_dir=args.output)

        input_path = Path(args.input_path)

        if input_path.is_file():
            # 转换单个文件
            success = converter.convert_file(input_path)
            sys.exit(0 if success else 1)
        elif input_path.is_dir():
            # 转换目录
            stats = converter.convert_directory(input_path, recursive=args.recursive)
            sys.exit(0 if stats["failed"] == 0 else 1)
        else:
            print(f"错误: 输入路径不存在: {input_path}")
            sys.exit(1)

    except KeyboardInterrupt:
        print("\n用户中断操作")
        sys.exit(1)
    except Exception as e:
        print(f"程序执行错误: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
