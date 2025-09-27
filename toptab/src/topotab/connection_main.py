"""连接关系转换主程序"""

import argparse
import logging
import sys
from pathlib import Path
from typing import Optional

from .connection_config import ConnectionConfigManager
from .connection_parser import ConnectionParser
from .connection_csv import ConnectionCSVWriter

# 默认目录设置
BASE_DIR = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = BASE_DIR / "input"
DEFAULT_OUTPUT = BASE_DIR / "output"

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)


def convert_drawio_to_csv(input_file: str,
                         output_file: Optional[str] = None,
                         config_file: Optional[str] = None,
                         multiple_encodings: bool = True) -> None:
    """
    将draw.io文件转换为CSV文件

    Args:
        input_file: 输入的draw.io文件路径
        output_file: 输出的CSV文件路径，如果为None则自动生成
        config_file: 配置文件路径，如果为None则使用默认配置
        multiple_encodings: 是否生成多种编码的文件
    """
    try:
        # 处理输入文件路径
        input_path = Path(input_file)

        # 如果输入路径不是绝对路径，尝试在默认输入目录中查找
        if not input_path.is_absolute():
            if not input_path.exists():
                default_input_path = DEFAULT_INPUT / input_file
                if default_input_path.exists():
                    input_path = default_input_path
                    logger.info(f"在默认输入目录中找到文件: {input_path}")

        # 验证输入文件
        if not input_path.exists():
            logger.error(f"输入文件不存在: {input_file}")
            logger.info(f"提示：可以将文件放在默认输入目录 {DEFAULT_INPUT}")
            return

        if not input_path.suffix.lower() == '.drawio':
            logger.warning(f"输入文件不是.drawio格式: {input_file}")

        # 初始化配置管理器
        config_manager = ConnectionConfigManager(config_file)
        logger.info(f"使用配置文件: {config_manager.config_path}")

        # 初始化解析器
        parser = ConnectionParser(config_manager)

        # 解析draw.io文件
        logger.info(f"开始解析draw.io文件: {input_path}")
        connections = parser.parse_drawio_file(str(input_path))

        if not connections:
            logger.warning("未找到任何连接关系")
            return

        # 生成输出文件路径
        if output_file is None:
            # 默认输出到output目录
            output_file = DEFAULT_OUTPUT / f"{input_path.stem}_connections.csv"
            logger.info(f"使用默认输出目录: {output_file}")
        else:
            output_file = Path(output_file)
            # 如果输出路径不是绝对路径，放在默认输出目录
            if not output_file.is_absolute():
                output_file = DEFAULT_OUTPUT / output_file

        # 确保输出目录存在
        output_file.parent.mkdir(parents=True, exist_ok=True)

        # 初始化CSV输出器
        csv_writer = ConnectionCSVWriter(config_manager)

        # 输出CSV文件
        if multiple_encodings:
            logger.info("生成多编码CSV文件...")
            output_files = csv_writer.write_multiple_encodings(connections, str(output_file.with_suffix('')))

            print(f"\n✅ 转换完成！生成了以下文件:")
            for encoding, file_path in output_files.items():
                print(f"  📄 {encoding.upper()}: {file_path}")
        else:
            logger.info("生成单一编码CSV文件...")
            csv_writer.write_connections_to_csv(connections, str(output_file))
            print(f"\n✅ 转换完成！生成文件: {output_file}")

        # 打印汇总信息
        csv_writer.print_summary(connections)

    except Exception as e:
        logger.error(f"转换过程中发生错误: {e}")
        raise


def main():
    """主程序入口"""
    parser = argparse.ArgumentParser(
        description="将draw.io网络拓扑图转换为连接关系CSV文件",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  # 基本转换
  uv run python -m topotab input.drawio

  # 指定输出文件
  uv run python -m topotab input.drawio -o output.csv

  # 使用自定义配置文件
  uv run python -m topotab input.drawio -c custom_config.json

  # 只生成UTF-8编码文件
  uv run python -m topotab input.drawio --single-encoding
        """
    )
    
    parser.add_argument(
        'input_file',
        help='输入的draw.io文件路径'
    )
    
    parser.add_argument(
        '-o', '--output',
        help='输出的CSV文件路径（可选，默认自动生成）'
    )
    
    parser.add_argument(
        '-c', '--config',
        help='配置文件路径（可选，默认使用内置配置）'
    )
    
    parser.add_argument(
        '--single-encoding',
        action='store_true',
        help='只生成UTF-8编码的CSV文件（默认生成多种编码）'
    )
    
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='显示详细日志信息'
    )
    
    args = parser.parse_args()
    
    # 设置日志级别
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    try:
        convert_drawio_to_csv(
            input_file=args.input_file,
            output_file=args.output,
            config_file=args.config,
            multiple_encodings=not args.single_encoding
        )
    except Exception as e:
        logger.error(f"程序执行失败: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
