#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
多格式文件转PDF工具 - GUI界面

提供图形用户界面，方便用户进行文件转换操作。

作者: Matthew Yin
日期: 2025-07-30
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
import threading
import queue
import datetime
from pathlib import Path
from typing import List, Optional
import sys
import os

from .converter import UniversalConverter


class ConverterGUI:
    """转换器GUI界面"""
    
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("多格式文件转PDF工具 v2.0")
        self.root.geometry("800x600")
        
        # 设置图标（如果有的话）
        try:
            # 可以添加应用图标
            pass
        except:
            pass
        
        # 初始化变量
        self.converter = None
        self.conversion_queue = queue.Queue()
        self.is_converting = False
        
        # 创建界面
        self._create_widgets()
        self._setup_layout()
        
        # 启动队列检查
        self._check_queue()
    
    def _create_widgets(self):
        """创建界面组件"""
        # 主框架
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # 文件选择区域
        file_frame = ttk.LabelFrame(main_frame, text="文件选择", padding="10")
        file_frame.grid(row=0, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        
        # 输入文件/目录
        ttk.Label(file_frame, text="输入:").grid(row=0, column=0, sticky=tk.W, pady=(0, 5))
        
        input_frame = ttk.Frame(file_frame)
        input_frame.grid(row=1, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(0, 10))
        
        self.input_var = tk.StringVar()
        self.input_entry = ttk.Entry(input_frame, textvariable=self.input_var, width=60)
        self.input_entry.grid(row=0, column=0, sticky=(tk.W, tk.E), padx=(0, 5))
        
        ttk.Button(input_frame, text="选择文件", command=self._select_files).grid(row=0, column=1, padx=(0, 5))
        ttk.Button(input_frame, text="选择目录", command=self._select_directory).grid(row=0, column=2)
        
        # 输出目录
        ttk.Label(file_frame, text="输出目录:").grid(row=2, column=0, sticky=tk.W, pady=(0, 5))
        
        output_frame = ttk.Frame(file_frame)
        output_frame.grid(row=3, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(0, 10))
        
        self.output_var = tk.StringVar()
        self.output_entry = ttk.Entry(output_frame, textvariable=self.output_var, width=60)
        self.output_entry.grid(row=0, column=0, sticky=(tk.W, tk.E), padx=(0, 5))
        
        ttk.Button(output_frame, text="选择目录", command=self._select_output_directory).grid(row=0, column=1)
        
        # 配置输入框自动扩展
        input_frame.columnconfigure(0, weight=1)
        output_frame.columnconfigure(0, weight=1)
        file_frame.columnconfigure(0, weight=1)
        
        # 选项区域
        options_frame = ttk.LabelFrame(main_frame, text="转换选项", padding="10")
        options_frame.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        
        # 递归选项
        self.recursive_var = tk.BooleanVar()
        ttk.Checkbutton(options_frame, text="递归处理子目录", variable=self.recursive_var).grid(row=0, column=0, sticky=tk.W, pady=(0, 5))
        
        # 并发线程数
        ttk.Label(options_frame, text="并发线程数:").grid(row=1, column=0, sticky=tk.W, pady=(0, 5))
        self.workers_var = tk.IntVar(value=2)
        workers_spinbox = ttk.Spinbox(options_frame, from_=1, to=8, textvariable=self.workers_var, width=10)
        workers_spinbox.grid(row=1, column=1, sticky=tk.W, padx=(10, 0), pady=(0, 5))
        
        # 控制按钮
        button_frame = ttk.Frame(main_frame)
        button_frame.grid(row=2, column=0, columnspan=2, pady=(0, 10))
        
        self.convert_button = ttk.Button(button_frame, text="开始转换", command=self._start_conversion)
        self.convert_button.grid(row=0, column=0, padx=(0, 10))
        
        self.stop_button = ttk.Button(button_frame, text="停止转换", command=self._stop_conversion, state=tk.DISABLED)
        self.stop_button.grid(row=0, column=1, padx=(0, 10))
        
        ttk.Button(button_frame, text="清空日志", command=self._clear_log).grid(row=0, column=2)
        
        # 进度条
        self.progress_var = tk.StringVar(value="就绪")
        ttk.Label(main_frame, textvariable=self.progress_var).grid(row=3, column=0, sticky=tk.W, pady=(0, 5))
        
        self.progress_bar = ttk.Progressbar(main_frame, mode='indeterminate')
        self.progress_bar.grid(row=4, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        
        # 日志区域
        log_frame = ttk.LabelFrame(main_frame, text="转换日志", padding="10")
        log_frame.grid(row=5, column=0, columnspan=2, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(0, 10))
        
        self.log_text = scrolledtext.ScrolledText(log_frame, height=15, width=80)
        self.log_text.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # 配置网格权重
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(0, weight=1)
        main_frame.rowconfigure(5, weight=1)
        log_frame.columnconfigure(0, weight=1)
        log_frame.rowconfigure(0, weight=1)
    
    def _setup_layout(self):
        """设置布局"""
        # 支持的文件格式提示
        formats_text = "支持格式: Office文件(.docx, .xlsx, .pptx等), 文本文件(.txt), Markdown文件(.md), Draw.io文件(.drawio)"
        ttk.Label(self.root, text=formats_text, font=('TkDefaultFont', 8)).grid(row=1, column=0, pady=5)
    
    def _select_files(self):
        """选择文件"""
        try:
            # 首先尝试不带文件类型的简单版本
            files = filedialog.askopenfilenames(
                title="选择要转换的文件",
                parent=self.root
            )

            if files:
                self.input_var.set(";".join(files))
                self._log_message(f"已选择 {len(files)} 个文件")
                return

        except Exception as e:
            self._log_message(f"文件选择失败: {e}", "WARNING")

        # 如果简单版本失败，尝试带文件类型的版本
        try:
            # 使用更安全的文件类型格式
            filetypes = [
                ("Office文件", "*.docx *.doc *.xlsx *.xls *.pptx *.ppt"),
                ("文本文件", "*.txt"),
                ("Markdown文件", "*.md *.markdown"),
                ("Draw.io文件", "*.drawio *.dio"),
                ("所有文件", "*.*")
            ]

            files = filedialog.askopenfilenames(
                title="选择要转换的文件",
                filetypes=filetypes,
                parent=self.root
            )

            if files:
                self.input_var.set(";".join(files))
                self._log_message(f"已选择 {len(files)} 个文件")

        except Exception as e2:
            self._log_message(f"无法打开文件选择对话框: {e2}", "ERROR")
            messagebox.showinfo("提示", "文件选择对话框不可用，请手动在输入框中输入文件路径\n多个文件用分号(;)分隔")
    
    def _select_directory(self):
        """选择目录"""
        try:
            directory = filedialog.askdirectory(title="选择包含文件的目录")
            if directory:
                self.input_var.set(directory)
        except Exception as e:
            self._log_message(f"目录选择对话框错误: {e}", "ERROR")
            messagebox.showerror("错误", "无法打开目录选择对话框，请手动输入目录路径")

    def _select_output_directory(self):
        """选择输出目录"""
        try:
            directory = filedialog.askdirectory(title="选择输出目录")
            if directory:
                self.output_var.set(directory)
        except Exception as e:
            self._log_message(f"输出目录选择对话框错误: {e}", "ERROR")
            messagebox.showerror("错误", "无法打开目录选择对话框，请手动输入目录路径")
    
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
    
    def _start_conversion(self):
        """开始转换"""
        input_path = self.input_var.get().strip()
        if not input_path:
            messagebox.showerror("错误", "请选择输入文件或目录")
            return
        
        # 检查输入路径
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
    """GUI主函数"""
    app = ConverterGUI()
    app.run()


if __name__ == "__main__":
    main()
