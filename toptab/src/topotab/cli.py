#!/usr/bin/env python3
"""
Topotab CLI - 网络拓扑转换工具命令行接口
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# 启用readline支持（用于行编辑功能）
try:
    import readline
    # 启用Tab补全和历史记录
    readline.parse_and_bind("tab: complete")
except ImportError:
    # Windows上可能没有readline，但不影响基本功能
    pass
from typing import List, Optional

from .csv_io import CsvTopologyReader, CsvTopologyWriter
from .drawio_io import DrawioTopologyReader, DrawioTopologyWriter
from .schema import CsvSchema

BASE_DIR = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = BASE_DIR / "input"
DEFAULT_OUTPUT = BASE_DIR / "output"
DEFAULT_TMP = BASE_DIR / "tmp"
DEFAULT_CSV_TEMPLATE = BASE_DIR / "tmp" / "csvtmp.csv"


def convert_command(args):
    """将draw.io文件转换为CSV格式 (支持标准draw.io文件)"""

    input_path = Path(args.input_file)
    output_path = Path(args.output_file)
    template_path = Path(args.template)

    if not input_path.exists():
        print(f"错误: 输入文件不存在: {input_path}")
        sys.exit(1)

    # 如果输出路径是目录，自动生成同名文件
    if output_path.is_dir():
        output_path = output_path / f"{input_path.stem}.csv"
        print(f"输出目录检测到，自动生成文件名: {output_path}")

    # 确保输出目录存在
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if not template_path.exists():
        print(f"错误: 模板文件不存在: {template_path}")
        sys.exit(1)

    try:
        print(f"正在读取draw.io文件: {input_path}")

        # 读取draw.io文件
        reader = DrawioTopologyReader()
        topology = reader.read_generic(input_path)  # 使用通用读取器，自动检测文件格式

        print(f"成功读取 {len(topology.devices)} 个设备, {len(topology.links)} 条链路")

        # 显示设备列表
        if topology.devices:
            print("\n识别的设备:")
            for i, name in enumerate(topology.devices.keys(), 1):
                print(f"  {i}. {name}")

        # 过滤有效链路（非自连接）
        # 自连接的判断：设备名和管理地址都相同才算自连接
        valid_links = [link for link in topology.links
                      if not (link.src.device_name == link.dst.device_name and
                             link.src.management_address == link.dst.management_address)]

        if len(valid_links) < len(topology.links):
            print(f"\n过滤了 {len(topology.links) - len(valid_links)} 条自连接")

        print(f"有效链路: {len(valid_links)} 条")

        # 写入CSV
        print(f"\n正在写入CSV文件: {output_path}")
        print(f"使用编码: {args.encoding}")

        schema = CsvSchema.from_template(template_path)
        writer = CsvTopologyWriter(schema)

        if args.encoding == 'universal':
            # 通用兼容模式：同时生成Mac和Windows兼容版本
            writer.write_for_excel_universal(output_path, valid_links)
        elif args.encoding == 'utf-8-bom':
            # Excel兼容的UTF-8 BOM格式
            writer.write_for_excel(output_path, valid_links)
        elif args.encoding == 'gbk':
            # GBK编码（中文Windows Excel）
            writer_gbk = CsvTopologyWriter(schema, encoding='gbk')
            writer_gbk.write(output_path, valid_links)
        else:
            # 标准UTF-8（无BOM）
            writer_utf8 = CsvTopologyWriter(schema, encoding='utf-8')
            writer_utf8.write(output_path, valid_links)

        print(f"✅ 转换完成！生成了包含 {len(valid_links)} 条链路记录的CSV文件")

        if valid_links:
            print("\n前5条链路示例:")
            for i, link in enumerate(valid_links[:5], 1):
                print(f"  {i}. {link.src.device_name} -> {link.dst.device_name}")

    except Exception as e:
        print(f"❌ 转换失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


def interactive_convert():
    """交互式转换模式"""
    print("网络拓扑转换工具")
    print("================")

    # 询问输入文件
    default_input = DEFAULT_INPUT
    input_str = input(f"输入文件或目录路径 (默认: {default_input}): ").strip()

    if input_str:
        input_path = Path(input_str).expanduser()
        # 如果是相对路径且不存在，尝试在默认输入目录中查找
        if not input_path.is_absolute() and not input_path.exists():
            candidate_path = default_input / input_str
            if candidate_path.exists():
                input_path = candidate_path
                print(f"使用默认输入目录中的文件: {input_path}")
    else:
        input_path = default_input

    # 询问输出目录
    default_output = DEFAULT_OUTPUT
    output_str = input(f"输出目录路径 (默认: {default_output}): ").strip()

    if output_str:
        output_path = Path(output_str).expanduser()
        # 如果是相对路径，相对于当前工作目录
        if not output_path.is_absolute():
            output_path = Path.cwd() / output_str
    else:
        output_path = default_output

    # 询问模板文件
    default_template = DEFAULT_CSV_TEMPLATE
    template_str = input(f"CSV模板文件路径 (默认: {default_template}): ").strip()

    if template_str:
        template_path = Path(template_str).expanduser()
        # 如果是相对路径且不存在，尝试在默认模板目录中查找
        if not template_path.is_absolute() and not template_path.exists():
            candidate_path = DEFAULT_TMP / template_str
            if candidate_path.exists():
                template_path = candidate_path
                print(f"使用默认模板目录中的文件: {template_path}")
    else:
        template_path = default_template

    # 询问编码格式
    print("\n编码格式选项:")
    print("1. universal (推荐) - 同时生成UTF-8 BOM和GBK版本，确保Mac和Windows Excel兼容")
    print("2. utf-8-bom - UTF-8 BOM格式，适合现代Excel")
    print("3. gbk - GBK编码，适合传统中文Windows Excel")
    print("4. utf-8 - 标准UTF-8，适合程序处理")
    encoding_choice = input("选择编码格式 (1-4, 默认: 1): ").strip()
    encoding_map = {"1": "universal", "2": "utf-8-bom", "3": "gbk", "4": "utf-8"}
    encoding = encoding_map.get(encoding_choice, "universal")

    print(f"\n开始转换...")
    print(f"输入路径: {input_path}")
    print(f"输出路径: {output_path}")
    print(f"模板文件: {template_path}")
    print(f"编码格式: {encoding}")
    print("-" * 50)

    # 处理文件转换
    if input_path.is_file():
        # 单个文件转换
        if input_path.suffix.lower() == ".drawio":
            output_file = output_path / f"{input_path.stem}.csv"
            _handle_drawio_to_csv(input_path, output_file, template_path, encoding, True)  # 默认使用通用读取器
        elif input_path.suffix.lower() == ".csv":
            output_file = output_path / f"{input_path.stem}.drawio"
            _handle_csv_to_drawio(input_path, output_file, template_path)
        else:
            print(f"不支持的文件格式: {input_path.suffix}")
            print("支持的格式: .drawio (转换为CSV), .csv (转换为draw.io)")
    elif input_path.is_dir():
        # 目录批量转换
        drawio_files = list(input_path.glob("*.drawio"))
        csv_files = list(input_path.glob("*.csv"))

        if not drawio_files and not csv_files:
            print(f"在 {input_path} 中未找到 .drawio 或 .csv 文件")
            return

        output_path.mkdir(parents=True, exist_ok=True)

        # 处理 draw.io 文件
        for drawio_file in drawio_files:
            output_file = output_path / f"{drawio_file.stem}.csv"
            try:
                _handle_drawio_to_csv(drawio_file, output_file, template_path, encoding, True)  # 默认使用通用读取器
            except Exception as e:
                print(f"转换 {drawio_file} 失败: {e}")

        # 处理 CSV 文件
        for csv_file in csv_files:
            output_file = output_path / f"{csv_file.stem}.drawio"
            try:
                _handle_csv_to_drawio(csv_file, output_file, template_path)
            except Exception as e:
                print(f"转换 {csv_file} 失败: {e}")
    else:
        print(f"输入路径不存在: {input_path}")


def _handle_drawio_to_csv(drawio_path, output_file, template_path, encoding, use_generic):
    """处理单个drawio文件转换"""
    from .convert import convert_drawio_to_csv

    try:
        links = convert_drawio_to_csv(
            input_path=drawio_path,
            output_path=output_file,
            template_path=template_path,
            encoding=encoding,
            use_generic=use_generic,
            verbose=True
        )
        print(f"✅ 成功转换: {drawio_path.name} -> {output_file.name} ({len(links)} 条链路)")
    except Exception as e:
        print(f"❌ 转换失败: {drawio_path.name} - {e}")
        raise


def _handle_csv_to_drawio(csv_path, output_file, template_path):
    """处理单个CSV文件转换为draw.io"""
    from .csv_io import CsvTopologyReader
    from .drawio_io import DrawioTopologyWriter
    from .schema import CsvSchema

    try:
        print(f"正在读取CSV文件: {csv_path}")

        # 读取CSV文件
        schema = CsvSchema.from_template(template_path)
        reader = CsvTopologyReader(schema)
        topology = reader.read(csv_path)

        print(f"成功读取 {len(topology.devices)} 个设备, {len(topology.links)} 条链路")

        # 写入draw.io文件
        print(f"正在写入draw.io文件: {output_file}")
        writer = DrawioTopologyWriter(topology)
        writer.write(output_file)

        print(f"✅ 成功转换: {csv_path.name} -> {output_file.name} ({len(topology.devices)} 个设备, {len(topology.links)} 条链路)")
    except Exception as e:
        print(f"❌ 转换失败: {csv_path.name} - {e}")
        raise


def main():
    """主函数 - 解析命令行参数并执行相应命令"""
    parser = argparse.ArgumentParser(description='CSV and draw.io topology converter')
    subparsers = parser.add_subparsers(dest='command', help='可用命令')

    # convert 子命令
    convert_parser = subparsers.add_parser('convert', help='将draw.io文件转换为CSV格式')
    convert_parser.add_argument('input_file', nargs='?', help='输入的draw.io文件路径（可选，不提供则进入交互模式）')
    convert_parser.add_argument('output_file', nargs='?', help='输出的CSV文件路径（可选）')
    convert_parser.add_argument('--template', default='tmp/csvtmp.csv', help='CSV模板文件路径')
    convert_parser.add_argument('--encoding', default='universal',
                               choices=['universal', 'utf-8-bom', 'gbk', 'utf-8'],
                               help='输出编码格式')

    args = parser.parse_args()

    if args.command == 'convert':
        if args.input_file is None or args.output_file is None:
            # 进入交互模式
            interactive_convert()
        else:
            # 使用命令行参数
            convert_command(args)
    else:
        parser.print_help()


# 为了保持兼容性，创建一个 app 对象
class SimpleApp:
    def __call__(self):
        main()

app = SimpleApp()


if __name__ == "__main__":
    main()
