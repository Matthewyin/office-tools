#!/usr/bin/env python3
"""
将标准draw.io文件转换为CSV格式的网络拓扑数据

使用方法:
    python -m topotab.convert input.drawio output.csv
    或
    from topotab.convert import convert_drawio_to_csv
    convert_drawio_to_csv(input_path, output_path)
"""

import sys
import argparse
from pathlib import Path
from typing import List

from .drawio_io import DrawioTopologyReader
from .csv_io import CsvTopologyWriter
from .schema import CsvSchema
from .models import Link


def convert_drawio_to_csv(
    input_path: Path,
    output_path: Path,
    template_path: Path = None,
    encoding: str = "universal",
    use_generic: bool = True,
    verbose: bool = True
) -> List[Link]:
    """
    将draw.io文件转换为CSV格式
    
    Args:
        input_path: 输入的draw.io文件路径
        output_path: 输出的CSV文件路径
        template_path: CSV模板文件路径
        encoding: 输出编码格式 (universal/utf-8-bom/gbk/utf-8)
        use_generic: 是否使用通用读取器读取标准draw.io文件
        verbose: 是否显示详细信息
    
    Returns:
        转换后的链路列表
    """
    if template_path is None:
        # 默认模板路径
        base_dir = Path(__file__).resolve().parents[2]
        template_path = base_dir / "tmp" / "csvtmp.csv"
    
    if not input_path.exists():
        raise FileNotFoundError(f"输入文件不存在: {input_path}")

    # 如果输出路径是目录，自动生成同名文件
    if output_path.is_dir():
        output_path = output_path / f"{input_path.stem}.csv"
        if verbose:
            print(f"输出目录检测到，自动生成文件名: {output_path}")

    # 确保输出目录存在
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if not template_path.exists():
        raise FileNotFoundError(f"模板文件不存在: {template_path}")
    
    if verbose:
        print(f"正在读取draw.io文件: {input_path}")
    
    # 读取draw.io文件
    reader = DrawioTopologyReader()
    if use_generic:
        topology = reader.read_generic(input_path)
    else:
        topology = reader.read(input_path)
    
    if verbose:
        print(f"成功读取 {len(topology.devices)} 个设备, {len(topology.links)} 条链路")
    
    # 显示设备列表
    if verbose and topology.devices:
        print("\n识别的设备:")
        for i, name in enumerate(topology.devices.keys(), 1):
            print(f"  {i}. {name}")
    
    # 过滤有效链路（非自连接）
    # 自连接的判断：设备名和管理地址都相同才算自连接
    # 如果管理地址不同，即使设备名相同也不算自连接（可能是同型号不同设备）
    valid_links = [link for link in topology.links
                  if not (link.src.device_name == link.dst.device_name and
                         link.src.management_address == link.dst.management_address)]
    
    if verbose and len(valid_links) < len(topology.links):
        print(f"\n过滤了 {len(topology.links) - len(valid_links)} 条自连接")
    
    if verbose:
        print(f"有效链路: {len(valid_links)} 条")
    
    # 写入CSV
    if verbose:
        print(f"\n正在写入CSV文件: {output_path}")
        print(f"使用编码: {encoding}")

    schema = CsvSchema.from_template(template_path)
    writer = CsvTopologyWriter(schema)

    if encoding == 'universal':
        # 通用兼容模式：同时生成Mac和Windows兼容版本
        writer.write_for_excel_universal(output_path, valid_links)
    elif encoding == 'utf-8-bom':
        # Excel兼容的UTF-8 BOM格式
        writer.write_for_excel(output_path, valid_links)
    elif encoding == 'gbk':
        # GBK编码（中文Windows Excel）
        writer_gbk = CsvTopologyWriter(schema, encoding='gbk')
        writer_gbk.write(output_path, valid_links)
    else:
        # 标准UTF-8（无BOM）
        writer_utf8 = CsvTopologyWriter(schema, encoding='utf-8')
        writer_utf8.write(output_path, valid_links)
    
    if verbose:
        print(f"✅ 转换完成！生成了包含 {len(valid_links)} 条链路记录的CSV文件")
        
        if valid_links:
            print("\n前5条链路示例:")
            for i, link in enumerate(valid_links[:5], 1):
                print(f"  {i}. {link.src.device_name} -> {link.dst.device_name}")
    
    return valid_links


def main():
    """命令行入口点"""
    parser = argparse.ArgumentParser(description='将draw.io文件转换为CSV格式')
    parser.add_argument('input_file', help='输入的draw.io文件路径')
    parser.add_argument('output_file', help='输出的CSV文件路径')
    parser.add_argument('--template', default=None, help='CSV模板文件路径')
    parser.add_argument('--encoding', choices=['universal', 'utf-8-bom', 'gbk', 'utf-8'],
                       default='universal', help='输出编码格式 (默认: universal，同时生成Mac和Windows兼容版本)')
    parser.add_argument('--generic', action='store_true', default=True,
                       help='使用通用读取器读取标准draw.io文件 (默认: True)')
    parser.add_argument('--structured', action='store_true',
                       help='使用结构化读取器读取我们工具生成的draw.io文件')
    
    args = parser.parse_args()
    
    input_path = Path(args.input_file)
    output_path = Path(args.output_file)
    template_path = Path(args.template) if args.template else None
    
    use_generic = not args.structured  # 如果指定了structured，则不使用generic
    
    try:
        convert_drawio_to_csv(
            input_path=input_path,
            output_path=output_path,
            template_path=template_path,
            encoding=args.encoding,
            use_generic=use_generic,
            verbose=True
        )
        
    except Exception as e:
        print(f"❌ 转换失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
