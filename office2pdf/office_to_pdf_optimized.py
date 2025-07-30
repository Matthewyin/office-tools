#!/usr/bin/env python

"""
Office文件转PDF工具 - 性能优化版本

使用LibreOffice守护进程模式和并发处理来提升转换速度。

作者: Matthew Yin
日期: 2025-01-29
"""

import argparse
import logging
import queue
import shutil
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Union


class OptimizedOfficeConverter:
    """优化版Office文件转PDF转换器"""

    SUPPORTED_EXTENSIONS = {".docx", ".xlsx", ".pptx", ".doc", ".xls", ".ppt"}

    def __init__(self, output_dir: Optional[str] = None, max_workers: int = 2) -> None:
        """
        初始化转换器

        Args:
            output_dir: 输出目录
            max_workers: 最大并发工作线程数
        """
        self.output_dir = Path(output_dir) if output_dir else None
        self.max_workers = max_workers
        self.logger = self._setup_logger()
        self._check_libreoffice()
        self.daemon_process = None
        self.daemon_port = 2002

    def _setup_logger(self) -> logging.Logger:
        """设置日志配置"""
        log_dir = Path("logs")
        log_dir.mkdir(exist_ok=True)

        log_file = (
            log_dir
            / f"office_converter_opt_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
        )

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

        raise RuntimeError("LibreOffice未安装")

    def start_daemon(self) -> bool:
        """启动LibreOffice守护进程"""
        try:
            # 检查端口是否已被占用
            import socket

            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            result = sock.connect_ex(("127.0.0.1", self.daemon_port))
            sock.close()

            if result == 0:
                self.logger.info(f"LibreOffice守护进程已在端口{self.daemon_port}运行")
                return True

            # 启动守护进程
            cmd = [
                self.libreoffice_cmd,
                "--headless",
                "--invisible",
                "--nodefault",
                "--nolockcheck",
                "--nologo",
                "--norestore",
                f"--accept=socket,host=127.0.0.1,port={self.daemon_port};urp;StarOffice.ServiceManager",
            ]

            self.logger.info("启动LibreOffice守护进程...")
            self.daemon_process = subprocess.Popen(
                cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )

            # 等待守护进程启动
            for _i in range(10):
                time.sleep(1)
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                result = sock.connect_ex(("127.0.0.1", self.daemon_port))
                sock.close()
                if result == 0:
                    self.logger.info("LibreOffice守护进程启动成功")
                    return True

            self.logger.error("LibreOffice守护进程启动超时")
            return False

        except Exception as e:
            self.logger.error(f"启动LibreOffice守护进程失败: {e}")
            return False

    def stop_daemon(self) -> None:
        """停止LibreOffice守护进程"""
        if self.daemon_process:
            try:
                self.daemon_process.terminate()
                self.daemon_process.wait(timeout=5)
                self.logger.info("LibreOffice守护进程已停止")
            except subprocess.TimeoutExpired:
                self.daemon_process.kill()
                self.logger.warning("强制终止LibreOffice守护进程")
            except Exception as e:
                self.logger.error(f"停止守护进程时出错: {e}")

    def _convert_with_daemon(self, input_file: Path) -> bool:
        """使用守护进程转换文件"""
        output_path = self._get_output_path(input_file)

        try:
            # 使用uno连接到守护进程进行转换
            cmd = [
                self.libreoffice_cmd,
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                str(output_path.parent),
                str(input_file),
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60,  # 减少超时时间
            )

            if result.returncode == 0 and output_path.exists():
                return True
            else:
                self.logger.error(f"转换失败: {result.stderr}")
                return False

        except Exception as e:
            self.logger.error(f"转换过程中发生错误: {e}")
            return False

    def _get_output_path(self, input_file: Path) -> Path:
        """获取输出PDF文件路径"""
        if self.output_dir:
            self.output_dir.mkdir(parents=True, exist_ok=True)
            return self.output_dir / f"{input_file.stem}.pdf"
        else:
            return input_file.parent / f"{input_file.stem}.pdf"

    def convert_file(self, input_file: Union[str, Path]) -> bool:
        """转换单个文件"""
        input_path = Path(input_file)

        if not input_path.exists():
            self.logger.error(f"输入文件不存在: {input_path}")
            return False

        if input_path.suffix.lower() not in self.SUPPORTED_EXTENSIONS:
            self.logger.error(f"不支持的文件格式: {input_path.suffix}")
            return False

        start_time = time.time()
        success = self._convert_with_daemon(input_path)
        end_time = time.time()

        if success:
            self.logger.info(
                f"转换成功: {input_path.name} (耗时: {end_time - start_time:.2f}秒)"
            )
        else:
            self.logger.error(f"转换失败: {input_path.name}")

        return success

    def _convert_worker(self, file_queue: queue.Queue, results: Dict) -> None:
        """工作线程函数"""
        while True:
            try:
                file_path = file_queue.get_nowait()
                thread_id = threading.current_thread().ident
                self.logger.debug(f"线程{thread_id}开始处理: {file_path.name}")

                if self.convert_file(file_path):
                    results["success"] += 1
                else:
                    results["failed"] += 1

                file_queue.task_done()

            except queue.Empty:
                break
            except Exception as e:
                self.logger.error(f"工作线程错误: {e}")
                results["failed"] += 1
                file_queue.task_done()

    def convert_directory_concurrent(
        self, input_dir: Union[str, Path], recursive: bool = False
    ) -> Dict:
        """并发转换目录中的文件"""
        input_path = Path(input_dir)

        if not input_path.exists() or not input_path.is_dir():
            self.logger.error(f"输入目录不存在: {input_path}")
            return {"success": 0, "failed": 0, "skipped": 0}

        # 查找Office文件
        pattern = "**/*" if recursive else "*"
        office_files = []

        for ext in self.SUPPORTED_EXTENSIONS:
            office_files.extend(input_path.glob(f"{pattern}{ext}"))
            office_files.extend(input_path.glob(f"{pattern}{ext.upper()}"))

        # 过滤临时文件
        office_files = [f for f in office_files if not f.name.startswith("~$")]

        if not office_files:
            self.logger.warning(f"未找到支持的Office文件: {input_path}")
            return {"success": 0, "failed": 0, "skipped": 0}

        self.logger.info(
            f"找到 {len(office_files)} 个Office文件，使用 {self.max_workers} 个线程并发处理"
        )

        # 启动守护进程
        if not self.start_daemon():
            self.logger.error("无法启动LibreOffice守护进程，回退到单线程模式")
            return self.convert_directory_sequential(input_dir, recursive)

        try:
            # 使用线程池进行并发转换
            results = {"success": 0, "failed": 0, "skipped": 0}

            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                future_to_file = {
                    executor.submit(self.convert_file, file_path): file_path
                    for file_path in office_files
                }

                for future in as_completed(future_to_file):
                    file_path = future_to_file[future]
                    try:
                        success = future.result()
                        if success:
                            results["success"] += 1
                        else:
                            results["failed"] += 1
                    except Exception as e:
                        self.logger.error(f"处理文件 {file_path} 时出错: {e}")
                        results["failed"] += 1

            self.logger.info(
                f"并发转换完成 - 成功: {results['success']}, 失败: {results['failed']}"
            )
            return results

        finally:
            self.stop_daemon()

    def convert_directory_sequential(
        self, input_dir: Union[str, Path], recursive: bool = False
    ) -> Dict:
        """顺序转换目录中的文件（回退方案）"""
        input_path = Path(input_dir)

        pattern = "**/*" if recursive else "*"
        office_files = []

        for ext in self.SUPPORTED_EXTENSIONS:
            office_files.extend(input_path.glob(f"{pattern}{ext}"))
            office_files.extend(input_path.glob(f"{pattern}{ext.upper()}"))

        office_files = [f for f in office_files if not f.name.startswith("~$")]

        if not office_files:
            return {"success": 0, "failed": 0, "skipped": 0}

        results = {"success": 0, "failed": 0, "skipped": 0}

        for file_path in office_files:
            if self.convert_file(file_path):
                results["success"] += 1
            else:
                results["failed"] += 1

        return results


def main() -> None:
    """主函数"""
    parser = argparse.ArgumentParser(description="Office文件转PDF工具 - 优化版本")

    parser.add_argument("input_path", help="输入文件或目录路径")
    parser.add_argument("-o", "--output", help="输出目录")
    parser.add_argument("-r", "--recursive", action="store_true", help="递归处理子目录")
    parser.add_argument(
        "-w", "--workers", type=int, default=2, help="并发工作线程数 (默认: 2)"
    )
    parser.add_argument("--sequential", action="store_true", help="使用顺序处理模式")

    args = parser.parse_args()

    try:
        converter = OptimizedOfficeConverter(
            output_dir=args.output, max_workers=args.workers
        )

        input_path = Path(args.input_path)

        if input_path.is_file():
            success = converter.convert_file(input_path)
            sys.exit(0 if success else 1)
        elif input_path.is_dir():
            if args.sequential:
                stats = converter.convert_directory_sequential(
                    input_path, args.recursive
                )
            else:
                stats = converter.convert_directory_concurrent(
                    input_path, args.recursive
                )
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
