#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
多格式文件转PDF工具 - GUI启动脚本

提供稳定兼容的图形用户界面，支持文件选择按钮和手动路径输入。
针对macOS文件对话框兼容性进行了优化，确保跨平台稳定运行。

作者: Matthew Yin
日期: 2025-07-30
"""

import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext, filedialog
import threading
import queue
import datetime
from pathlib import Path
from typing import List, Optional
import sys
import os

# 添加项目路径到Python路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

try:
    from office2pdf.converter import UniversalConverter
except ImportError as e:
    print(f"导入错误: {e}")
    print("请确保已安装所有依赖包:")
    print("  pip install -e .")
    sys.exit(1)


class ConverterGUI:
    """转换器GUI界面"""
    
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("多格式文件转PDF工具 v2.0")
        self.root.geometry("700x500")
        
        # 初始化变量
        self.converter = None
        self.conversion_queue = queue.Queue()
        self.is_converting = False
        
        # 创建界面
        self._create_widgets()
        
        # 启动队列检查
        self._check_queue()
    
    def _create_widgets(self):
        """创建界面组件"""
        # 主框架
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # 标题
        title_label = ttk.Label(main_frame, text="多格式文件转PDF工具 v2.0", font=('TkDefaultFont', 16, 'bold'))
        title_label.pack(pady=(0, 10))
        
        # 支持格式说明
        formats_text = "支持格式: Office文件(.docx, .xlsx, .pptx等), 文本文件(.txt), Markdown文件(.md), Draw.io文件(.drawio)"
        formats_label = ttk.Label(main_frame, text=formats_text, font=('TkDefaultFont', 8))
        formats_label.pack(pady=(0, 15))
        
        # 输入区域
        input_frame = ttk.LabelFrame(main_frame, text="选择文件或目录", padding="10")
        input_frame.pack(fill=tk.X, pady=(0, 10))

        # 路径输入和按钮区域
        path_frame = ttk.Frame(input_frame)
        path_frame.pack(fill=tk.X, pady=(0, 5))

        ttk.Label(path_frame, text="选择的文件/目录:").pack(anchor=tk.W, pady=(0, 5))

        # 路径输入框和按钮
        entry_button_frame = ttk.Frame(path_frame)
        entry_button_frame.pack(fill=tk.X)

        self.input_var = tk.StringVar()
        input_entry = ttk.Entry(entry_button_frame, textvariable=self.input_var)
        input_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))

        # 选择按钮
        ttk.Button(entry_button_frame, text="选择文件", command=self._select_files, width=12).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(entry_button_frame, text="选择目录", command=self._select_directory, width=12).pack(side=tk.LEFT)

        # 示例和说明
        help_frame = ttk.Frame(input_frame)
        help_frame.pack(fill=tk.X, pady=(5, 0))

        example_text = "提示: 可以选择单个/多个文件，或选择包含文件的目录"
        ttk.Label(help_frame, text=example_text, font=('TkDefaultFont', 8), foreground='gray').pack(anchor=tk.W)
        
        # 输出目录
        output_frame = ttk.LabelFrame(main_frame, text="输出目录（可选）", padding="10")
        output_frame.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Label(output_frame, text="输出目录（留空则在源文件同目录生成PDF）:").pack(anchor=tk.W, pady=(0, 5))
        
        self.output_var = tk.StringVar()
        output_entry = ttk.Entry(output_frame, textvariable=self.output_var, width=80)
        output_entry.pack(fill=tk.X)
        
        # 选项区域
        options_frame = ttk.LabelFrame(main_frame, text="转换选项", padding="10")
        options_frame.pack(fill=tk.X, pady=(0, 10))
        
        options_inner = ttk.Frame(options_frame)
        options_inner.pack(fill=tk.X)
        
        # 递归选项
        self.recursive_var = tk.BooleanVar()
        ttk.Checkbutton(options_inner, text="递归处理子目录", variable=self.recursive_var).pack(side=tk.LEFT, padx=(0, 20))
        
        # 并发线程数
        ttk.Label(options_inner, text="并发线程数:").pack(side=tk.LEFT, padx=(0, 5))
        self.workers_var = tk.IntVar(value=2)
        workers_spinbox = ttk.Spinbox(options_inner, from_=1, to=8, textvariable=self.workers_var, width=5)
        workers_spinbox.pack(side=tk.LEFT)
        
        # 控制按钮
        button_frame = ttk.Frame(main_frame)
        button_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.convert_button = ttk.Button(button_frame, text="开始转换", command=self._start_conversion)
        self.convert_button.pack(side=tk.LEFT, padx=(0, 10))
        
        self.stop_button = ttk.Button(button_frame, text="停止转换", command=self._stop_conversion, state=tk.DISABLED)
        self.stop_button.pack(side=tk.LEFT, padx=(0, 10))
        
        ttk.Button(button_frame, text="清空日志", command=self._clear_log).pack(side=tk.LEFT)
        
        # 进度显示
        self.progress_var = tk.StringVar(value="就绪")
        ttk.Label(main_frame, textvariable=self.progress_var).pack(anchor=tk.W, pady=(0, 5))
        
        self.progress_bar = ttk.Progressbar(main_frame, mode='indeterminate')
        self.progress_bar.pack(fill=tk.X, pady=(0, 10))
        
        # 日志区域
        log_frame = ttk.LabelFrame(main_frame, text="转换日志", padding="10")
        log_frame.pack(fill=tk.BOTH, expand=True)
        
        self.log_text = scrolledtext.ScrolledText(log_frame, height=12, width=80)
        self.log_text.pack(fill=tk.BOTH, expand=True)
        
        # 添加初始提示
        self._log_message("欢迎使用多格式文件转PDF工具 v2.0")
        self._log_message("请点击'选择文件'或'选择目录'按钮，然后点击'开始转换'")

    def _select_files(self):
        """安全的文件选择方法"""
        try:
            # 使用最简单的文件选择，避免filetypes参数
            files = filedialog.askopenfilenames(
                title="选择要转换的文件",
                parent=self.root
            )

            if files:
                # 将文件路径用分号连接
                file_paths = ";".join(files)
                self.input_var.set(file_paths)
                self._log_message(f"已选择 {len(files)} 个文件")

                # 显示选择的文件
                for i, file_path in enumerate(files[:3]):  # 只显示前3个
                    self._log_message(f"  {i+1}. {Path(file_path).name}")
                if len(files) > 3:
                    self._log_message(f"  ... 还有 {len(files)-3} 个文件")

        except Exception as e:
            self._log_message(f"文件选择失败: {e}", "ERROR")
            # 提供手动输入的提示
            self._log_message("请手动输入文件路径，多个文件用分号(;)分隔", "INFO")

    def _select_directory(self):
        """安全的目录选择方法"""
        try:
            directory = filedialog.askdirectory(
                title="选择包含文件的目录",
                parent=self.root
            )

            if directory:
                self.input_var.set(directory)
                self._log_message(f"已选择目录: {Path(directory).name}")

                # 预览目录中的支持文件
                self._preview_directory_files(Path(directory))

        except Exception as e:
            self._log_message(f"目录选择失败: {e}", "ERROR")
            # 提供手动输入的提示
            self._log_message("请手动输入目录路径", "INFO")

    def _preview_directory_files(self, directory: Path):
        """预览目录中的支持文件"""
        try:
            supported_extensions = {'.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt',
                                   '.txt', '.md', '.markdown', '.drawio', '.dio'}

            # 查找支持的文件
            supported_files = []
            for file_path in directory.iterdir():
                if file_path.is_file() and file_path.suffix.lower() in supported_extensions:
                    if not file_path.name.startswith('~$'):  # 跳过临时文件
                        supported_files.append(file_path)

            if supported_files:
                self._log_message(f"目录中找到 {len(supported_files)} 个支持的文件:")
                for i, file_path in enumerate(supported_files[:5]):  # 只显示前5个
                    self._log_message(f"  {i+1}. {file_path.name}")
                if len(supported_files) > 5:
                    self._log_message(f"  ... 还有 {len(supported_files)-5} 个文件")
            else:
                self._log_message("目录中没有找到支持的文件", "WARNING")
                self._log_message("支持的格式: .docx, .xlsx, .pptx, .txt, .md, .drawio", "INFO")

        except Exception as e:
            self._log_message(f"预览目录文件失败: {e}", "WARNING")
    
    def _log_message(self, message: str, level: str = "INFO"):
        """添加日志消息"""
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        log_entry = f"[{timestamp}] {level}: {message}\n"
        
        self.log_text.insert(tk.END, log_entry)
        self.log_text.see(tk.END)
        self.root.update_idletasks()
    
    def _clear_log(self):
        """清空日志"""
        self.log_text.delete(1.0, tk.END)
        self._log_message("日志已清空")
    
    def _start_conversion(self):
        """开始转换"""
        input_path = self.input_var.get().strip()
        if not input_path:
            messagebox.showerror("错误", "请输入文件路径或目录路径")
            return
        
        # 解析输入路径
        paths = []
        if ";" in input_path:
            # 多个文件
            paths = [Path(p.strip()) for p in input_path.split(";") if p.strip()]
        else:
            # 单个文件或目录
            paths = [Path(input_path)]
        
        # 验证路径
        for path in paths:
            if not path.exists():
                messagebox.showerror("错误", f"路径不存在: {path}")
                return
        
        # 设置输出目录
        output_dir = self.output_var.get().strip() or None
        
        # 禁用开始按钮，启用停止按钮
        self.convert_button.config(state=tk.DISABLED)
        self.stop_button.config(state=tk.NORMAL)
        self.is_converting = True
        
        # 启动进度条
        self.progress_bar.start()
        self.progress_var.set("转换中...")
        
        self._log_message("开始转换任务...")
        
        # 在后台线程中执行转换
        thread = threading.Thread(
            target=self._conversion_worker,
            args=(paths, output_dir, self.recursive_var.get(), self.workers_var.get())
        )
        thread.daemon = True
        thread.start()
    
    def _conversion_worker(self, paths: List[Path], output_dir: Optional[str], recursive: bool, workers: int):
        """转换工作线程"""
        try:
            # 创建转换器
            self.converter = UniversalConverter(output_dir=output_dir, max_workers=workers)
            
            total_success = 0
            total_failed = 0
            
            for path in paths:
                if not self.is_converting:
                    break
                
                if path.is_file():
                    # 转换单个文件
                    self.conversion_queue.put(("log", f"转换文件: {path.name}"))
                    success = self.converter.convert_file(path)
                    if success:
                        total_success += 1
                        self.conversion_queue.put(("log", f"✅ 转换成功: {path.name}"))
                    else:
                        total_failed += 1
                        self.conversion_queue.put(("log", f"❌ 转换失败: {path.name}"))
                
                elif path.is_dir():
                    # 转换目录
                    self.conversion_queue.put(("log", f"扫描目录: {path}"))
                    stats = self.converter.convert_directory(path, recursive=recursive)
                    total_success += stats['success']
                    total_failed += stats['failed']
                    self.conversion_queue.put(("log", f"目录转换完成: 成功 {stats['success']}, 失败 {stats['failed']}"))
            
            # 转换完成
            if self.is_converting:
                self.conversion_queue.put(("complete", f"转换完成! 总计: 成功 {total_success}, 失败 {total_failed}"))
            else:
                self.conversion_queue.put(("complete", "转换已停止"))
                
        except Exception as e:
            self.conversion_queue.put(("error", f"转换过程中发生错误: {e}"))
        finally:
            if self.converter:
                self.converter.cleanup()
    
    def _stop_conversion(self):
        """停止转换"""
        self.is_converting = False
        self._log_message("正在停止转换...", "WARNING")
    
    def _check_queue(self):
        """检查消息队列"""
        try:
            while True:
                msg_type, message = self.conversion_queue.get_nowait()
                
                if msg_type == "log":
                    self._log_message(message)
                elif msg_type == "complete":
                    self._log_message(message, "SUCCESS")
                    self._conversion_finished()
                elif msg_type == "error":
                    self._log_message(message, "ERROR")
                    self._conversion_finished()
                    
        except queue.Empty:
            pass
        
        # 继续检查队列
        self.root.after(100, self._check_queue)
    
    def _conversion_finished(self):
        """转换完成处理"""
        self.is_converting = False
        self.convert_button.config(state=tk.NORMAL)
        self.stop_button.config(state=tk.DISABLED)
        self.progress_bar.stop()
        self.progress_var.set("就绪")
    
    def run(self):
        """运行GUI"""
        self.root.mainloop()


def main():
    """主函数"""
    try:
        app = ConverterGUI()
        app.run()
    except Exception as e:
        print(f"GUI启动失败: {e}")
        print("请尝试使用命令行版本:")
        print("  python -m office2pdf.converter")


if __name__ == "__main__":
    main()
