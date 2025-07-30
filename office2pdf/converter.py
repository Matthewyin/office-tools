#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
多格式文件转PDF工具

支持Office文件、文本文件、Markdown文件等多种格式转换为PDF。
使用LibreOffice守护进程模式和并发处理来提升转换速度。

支持格式：
- Office文件: .docx, .doc, .xlsx, .xls, .pptx, .ppt
- 文本文件: .txt
- Markdown文件: .md
- Draw.io文件: .drawio (需要额外配置)

作者: Matthew Yin
日期: 2025-07-30
"""

import os
import sys
import subprocess
import logging
import argparse
import shutil
import time
import threading
import queue
import socket
from pathlib import Path
from typing import List, Optional, Union, Dict, Any
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

# PDF生成相关导入
try:
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False

try:
    import markdown
    MARKDOWN_AVAILABLE = True
except ImportError:
    MARKDOWN_AVAILABLE = False


class UniversalConverter:
    """通用文件转PDF转换器"""
    
    # 支持的文件扩展名
    OFFICE_EXTENSIONS = {'.docx', '.xlsx', '.pptx', '.doc', '.xls', '.ppt'}
    TEXT_EXTENSIONS = {'.txt'}
    MARKDOWN_EXTENSIONS = {'.md', '.markdown'}
    DRAWIO_EXTENSIONS = {'.drawio', '.dio'}
    
    ALL_EXTENSIONS = OFFICE_EXTENSIONS | TEXT_EXTENSIONS | MARKDOWN_EXTENSIONS | DRAWIO_EXTENSIONS
    
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
        self._check_dependencies()
        self.daemon_process = None
        self.daemon_port = 2002
        
    def _setup_logger(self) -> logging.Logger:
        """设置日志配置"""
        log_dir = Path("logs")
        log_dir.mkdir(exist_ok=True)
        
        log_file = log_dir / f"converter_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file, encoding='utf-8'),
                logging.StreamHandler()
            ]
        )
        
        return logging.getLogger(__name__)
    
    def _check_dependencies(self) -> None:
        """检查依赖"""
        # 检查LibreOffice
        libreoffice_commands = ['libreoffice', 'soffice']
        self.libreoffice_cmd = None
        
        for cmd in libreoffice_commands:
            if shutil.which(cmd):
                self.libreoffice_cmd = cmd
                self.logger.info(f"找到LibreOffice命令: {cmd}")
                break
        
        if not self.libreoffice_cmd:
            self.logger.warning("LibreOffice未安装，Office文件转换将不可用")
        
        # 检查其他依赖
        if not REPORTLAB_AVAILABLE:
            self.logger.warning("ReportLab未安装，文本文件转换将不可用")
        
        if not MARKDOWN_AVAILABLE:
            self.logger.warning("Markdown/WeasyPrint未安装，Markdown文件转换将不可用")
    
    def _is_supported_file(self, file_path: Path) -> bool:
        """检查文件是否支持"""
        return file_path.suffix.lower() in self.ALL_EXTENSIONS
    
    def _get_output_path(self, input_file: Path) -> Path:
        """获取输出PDF文件路径"""
        if self.output_dir:
            self.output_dir.mkdir(parents=True, exist_ok=True)
            return self.output_dir / f"{input_file.stem}.pdf"
        else:
            return input_file.parent / f"{input_file.stem}.pdf"
    
    def _convert_office_file(self, input_file: Path, output_file: Path) -> bool:
        """转换Office文件"""
        if not self.libreoffice_cmd:
            self.logger.error("LibreOffice不可用，无法转换Office文件")
            return False
        
        try:
            # 尝试使用守护进程模式
            if self._convert_with_daemon(input_file, output_file):
                return True
            
            # 回退到标准模式
            return self._convert_with_standard_mode(input_file, output_file)
            
        except Exception as e:
            self.logger.error(f"Office文件转换失败: {e}")
            return False
    
    def _convert_with_daemon(self, input_file: Path, output_file: Path) -> bool:
        """使用守护进程模式转换"""
        try:
            if not self._ensure_daemon_running():
                return False
            
            cmd = [
                self.libreoffice_cmd,
                '--headless',
                '--convert-to', 'pdf',
                '--outdir', str(output_file.parent),
                str(input_file)
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300
            )
            
            return result.returncode == 0 and output_file.exists()
            
        except Exception:
            return False
    
    def _convert_with_standard_mode(self, input_file: Path, output_file: Path) -> bool:
        """使用标准模式转换"""
        try:
            cmd = [
                self.libreoffice_cmd,
                '--headless',
                '--convert-to', 'pdf',
                '--outdir', str(output_file.parent),
                str(input_file)
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300
            )
            
            return result.returncode == 0 and output_file.exists()
            
        except Exception as e:
            self.logger.error(f"标准模式转换失败: {e}")
            return False
    
    def _ensure_daemon_running(self) -> bool:
        """确保守护进程运行"""
        try:
            # 检查端口是否已被占用
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            result = sock.connect_ex(('127.0.0.1', self.daemon_port))
            sock.close()
            
            if result == 0:
                return True
            
            # 启动守护进程
            cmd = [
                self.libreoffice_cmd,
                '--headless',
                '--invisible',
                '--nodefault',
                '--nolockcheck',
                '--nologo',
                '--norestore',
                f'--accept=socket,host=127.0.0.1,port={self.daemon_port};urp;StarOffice.ServiceManager'
            ]
            
            self.daemon_process = subprocess.Popen(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            
            # 等待守护进程启动
            time.sleep(3)
            return True
            
        except Exception:
            return False
    
    def _convert_text_file(self, input_file: Path, output_file: Path) -> bool:
        """转换文本文件"""
        if not REPORTLAB_AVAILABLE:
            self.logger.error("ReportLab不可用，无法转换文本文件")
            return False
        
        try:
            # 读取文本内容
            with open(input_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # 创建PDF文档
            doc = SimpleDocTemplate(str(output_file), pagesize=A4)
            styles = getSampleStyleSheet()
            story = []
            
            # 添加标题
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=16,
                spaceAfter=30,
            )
            story.append(Paragraph(f"文档: {input_file.name}", title_style))
            story.append(Spacer(1, 12))
            
            # 添加内容
            content_style = ParagraphStyle(
                'CustomContent',
                parent=styles['Normal'],
                fontSize=10,
                fontName='Helvetica',
            )
            
            # 处理换行
            for line in content.split('\n'):
                if line.strip():
                    story.append(Paragraph(line, content_style))
                else:
                    story.append(Spacer(1, 6))
            
            # 生成PDF
            doc.build(story)
            return output_file.exists()
            
        except Exception as e:
            self.logger.error(f"文本文件转换失败: {e}")
            return False

    def _convert_markdown_file(self, input_file: Path, output_file: Path) -> bool:
        """转换Markdown文件"""
        if not MARKDOWN_AVAILABLE or not REPORTLAB_AVAILABLE:
            self.logger.error("Markdown/ReportLab不可用，无法转换Markdown文件")
            return False

        try:
            # 读取Markdown内容
            with open(input_file, 'r', encoding='utf-8') as f:
                md_content = f.read()

            # 转换为HTML
            md = markdown.Markdown(extensions=['extra'])
            html_content = md.convert(md_content)

            # 使用ReportLab创建PDF（简化版本）
            doc = SimpleDocTemplate(str(output_file), pagesize=A4)
            styles = getSampleStyleSheet()
            story = []

            # 添加标题
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=16,
                spaceAfter=30,
            )
            story.append(Paragraph(f"Markdown文档: {input_file.name}", title_style))
            story.append(Spacer(1, 12))

            # 简单处理Markdown内容（移除HTML标签）
            import re
            # 移除HTML标签，保留文本内容
            clean_content = re.sub(r'<[^>]+>', '', html_content)
            # 处理特殊字符
            clean_content = clean_content.replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&')

            # 添加内容
            content_style = ParagraphStyle(
                'CustomContent',
                parent=styles['Normal'],
                fontSize=10,
                fontName='Helvetica',
            )

            # 处理换行
            for line in clean_content.split('\n'):
                if line.strip():
                    story.append(Paragraph(line, content_style))
                else:
                    story.append(Spacer(1, 6))

            # 生成PDF
            doc.build(story)
            return output_file.exists()

        except Exception as e:
            self.logger.error(f"Markdown文件转换失败: {e}")
            return False

    def _convert_drawio_file(self, input_file: Path, output_file: Path) -> bool:
        """转换Draw.io文件"""
        try:
            # 检查是否安装了draw.io desktop
            drawio_commands = [
                '/Applications/draw.io.app/Contents/MacOS/draw.io',
                'drawio',
                'draw.io'
            ]

            drawio_cmd = None
            for cmd in drawio_commands:
                if shutil.which(cmd) or Path(cmd).exists():
                    drawio_cmd = cmd
                    break

            if not drawio_cmd:
                self.logger.error("Draw.io未安装，无法转换.drawio文件")
                self.logger.info("请安装Draw.io Desktop: https://github.com/jgraph/drawio-desktop")
                return False

            # 使用draw.io命令行导出PDF
            cmd = [
                drawio_cmd,
                '--export',
                '--format', 'pdf',
                '--output', str(output_file),
                str(input_file)
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60
            )

            if result.returncode == 0 and output_file.exists():
                return True
            else:
                self.logger.error(f"Draw.io转换失败: {result.stderr}")
                return False

        except Exception as e:
            self.logger.error(f"Draw.io文件转换失败: {e}")
            return False

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
            self.logger.error(f"支持的格式: {', '.join(self.ALL_EXTENSIONS)}")
            return False

        # 获取输出路径
        output_path = self._get_output_path(input_path)

        self.logger.info(f"开始转换: {input_path.name} -> {output_path.name}")

        # 根据文件类型选择转换方法
        file_ext = input_path.suffix.lower()

        if file_ext in self.OFFICE_EXTENSIONS:
            success = self._convert_office_file(input_path, output_path)
        elif file_ext in self.TEXT_EXTENSIONS:
            success = self._convert_text_file(input_path, output_path)
        elif file_ext in self.MARKDOWN_EXTENSIONS:
            success = self._convert_markdown_file(input_path, output_path)
        elif file_ext in self.DRAWIO_EXTENSIONS:
            success = self._convert_drawio_file(input_path, output_path)
        else:
            self.logger.error(f"未知的文件类型: {file_ext}")
            return False

        if success:
            self.logger.info(f"转换成功: {output_path}")
            return True
        else:
            self.logger.error(f"转换失败: {input_path.name}")
            return False

    def convert_directory(self, directory: Union[str, Path], recursive: bool = False) -> Dict[str, int]:
        """
        批量转换目录中的文件

        Args:
            directory: 目录路径
            recursive: 是否递归处理子目录

        Returns:
            Dict[str, int]: 转换统计信息
        """
        from .utils import find_office_files

        dir_path = Path(directory)
        if not dir_path.exists() or not dir_path.is_dir():
            self.logger.error(f"目录不存在: {dir_path}")
            return {'total': 0, 'success': 0, 'failed': 0}

        # 扩展文件发现功能以支持新格式
        files = list(self._find_supported_files(dir_path, recursive))

        if not files:
            self.logger.warning(f"目录中没有找到支持的文件: {dir_path}")
            return {'total': 0, 'success': 0, 'failed': 0}

        self.logger.info(f"找到 {len(files)} 个文件待转换")

        # 并发转换
        success_count = 0
        failed_count = 0

        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_file = {
                executor.submit(self.convert_file, file_path): file_path
                for file_path in files
            }

            for future in as_completed(future_to_file):
                file_path = future_to_file[future]
                try:
                    if future.result():
                        success_count += 1
                    else:
                        failed_count += 1
                except Exception as e:
                    self.logger.error(f"转换文件 {file_path} 时发生异常: {e}")
                    failed_count += 1

        stats = {
            'total': len(files),
            'success': success_count,
            'failed': failed_count
        }

        self.logger.info(f"批量转换完成: 总计 {stats['total']}, 成功 {stats['success']}, 失败 {stats['failed']}")
        return stats

    def _find_supported_files(self, directory: Path, recursive: bool = False):
        """查找支持的文件"""
        pattern = "**/*" if recursive else "*"

        for file_path in directory.glob(pattern):
            if file_path.is_file():
                # 检查扩展名
                if file_path.suffix.lower() in self.ALL_EXTENSIONS:
                    # 跳过临时文件
                    if not file_path.name.startswith('~$'):
                        yield file_path

    def cleanup(self) -> None:
        """清理资源"""
        if self.daemon_process:
            try:
                self.daemon_process.terminate()
                self.daemon_process.wait(timeout=5)
            except Exception:
                try:
                    self.daemon_process.kill()
                except Exception:
                    pass
            finally:
                self.daemon_process = None


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='多格式文件转PDF工具')
    parser.add_argument('input_path', help='输入文件或目录路径')
    parser.add_argument('-o', '--output', help='输出目录')
    parser.add_argument('-r', '--recursive', action='store_true', help='递归处理子目录')
    parser.add_argument('-w', '--workers', type=int, default=2, help='并发线程数')
    parser.add_argument('--sequential', action='store_true', help='使用顺序模式（禁用并发）')

    args = parser.parse_args()

    # 设置并发数
    max_workers = 1 if args.sequential else args.workers

    try:
        # 创建转换器
        converter = UniversalConverter(output_dir=args.output, max_workers=max_workers)

        input_path = Path(args.input_path)

        if input_path.is_file():
            # 转换单个文件
            success = converter.convert_file(input_path)
            sys.exit(0 if success else 1)
        elif input_path.is_dir():
            # 转换目录
            stats = converter.convert_directory(input_path, recursive=args.recursive)
            sys.exit(0 if stats['failed'] == 0 else 1)
        else:
            print(f"错误: 输入路径不存在: {input_path}")
            sys.exit(1)

    except KeyboardInterrupt:
        print("\n用户中断操作")
        sys.exit(1)
    except Exception as e:
        print(f"程序执行错误: {e}")
        sys.exit(1)
    finally:
        if 'converter' in locals():
            converter.cleanup()


if __name__ == "__main__":
    main()
