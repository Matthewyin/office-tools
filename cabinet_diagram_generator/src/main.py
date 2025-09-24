"""
机柜部署图生成工具主程序

提供命令行接口和主要功能入口。
"""

import click
import sys
from pathlib import Path
from typing import Optional
from loguru import logger

from .csv_processor import CSVProcessor
from .layout_engine import LayoutEngine
from .drawio_generator import DrawioGenerator
from .config import (
    DEFAULT_DIAGRAM_CONFIG, DEFAULT_LAYOUT_CONFIG, 
    DEFAULT_CSV_CONFIG, DEFAULT_APP_CONFIG
)
from .utils import setup_logging, ensure_directory, CabinetDiagramException


class CabinetDiagramGenerator:
    """机柜部署图生成器主类"""
    
    def __init__(self):
        """初始化生成器"""
        self.csv_processor = CSVProcessor(DEFAULT_CSV_CONFIG)
        self.layout_engine = LayoutEngine(DEFAULT_LAYOUT_CONFIG)
        self.drawio_generator = DrawioGenerator(DEFAULT_DIAGRAM_CONFIG)
        
        # 设置日志
        setup_logging(
            log_level=DEFAULT_APP_CONFIG.日志级别,
            log_file=DEFAULT_APP_CONFIG.日志文件,
            log_format=DEFAULT_APP_CONFIG.日志格式
        )
    
    def generate_diagram(self, csv_file: str, output_file: Optional[str] = None,
                        encoding: Optional[str] = None) -> str:
        """
        生成机柜部署图的完整流程
        
        Args:
            csv_file: CSV文件路径
            output_file: 输出文件路径
            encoding: 文件编码
            
        Returns:
            输出文件路径
        """
        try:
            logger.info(f"开始处理CSV文件: {csv_file}")
            
            # 1. 处理CSV文件
            devices = self.csv_processor.process_file(csv_file, encoding)
            if not devices:
                raise CabinetDiagramException("没有有效的设备数据")
            
            # 打印处理摘要
            summary = self.csv_processor.get_processing_summary()
            logger.info(f"CSV处理完成: {summary}")
            
            # 2. 创建布局
            layout = self.layout_engine.create_layout(devices)
            
            # 3. 优化布局
            optimized_layout = self.layout_engine.optimize_layout(layout)
            
            # 打印布局报告
            layout_report = self.layout_engine.get_layout_report(optimized_layout)
            logger.info(f"布局创建完成: {layout_report}")
            
            # 4. 生成Draw.io图形
            output_path = self.drawio_generator.generate_diagram(optimized_layout, output_file)
            
            logger.info(f"机柜部署图生成成功: {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"生成机柜部署图失败: {e}")
            raise


@click.command()
@click.argument('csv_file', type=click.Path(exists=True, path_type=Path))
@click.option('--output', '-o', type=click.Path(path_type=Path), 
              help='输出文件路径（可选）')
@click.option('--encoding', '-e', type=str, 
              help='CSV文件编码（默认自动检测）')
@click.option('--log-level', type=click.Choice(['DEBUG', 'INFO', 'WARNING', 'ERROR']),
              default='INFO', help='日志级别')
@click.option('--verbose', '-v', is_flag=True, help='详细输出')
@click.version_option(version='0.1.0', prog_name='机柜部署图生成工具')
def main(csv_file: Path, output: Optional[Path], encoding: Optional[str], 
         log_level: str, verbose: bool):
    """
    机柜部署图生成工具
    
    从CSV文件读取设备信息，自动生成机柜部署图的draw.io文件。
    
    CSV_FILE: 包含设备信息的CSV文件路径
    """
    try:
        # 设置日志级别
        if verbose:
            log_level = 'DEBUG'
        
        # 重新设置日志
        setup_logging(log_level=log_level)
        
        # 显示欢迎信息
        click.echo(f"🏢 {DEFAULT_APP_CONFIG.应用名称} v{DEFAULT_APP_CONFIG.版本}")
        click.echo(f"📁 输入文件: {csv_file}")
        
        # 创建生成器
        generator = CabinetDiagramGenerator()
        
        # 生成图形
        output_path = generator.generate_diagram(
            str(csv_file), 
            str(output) if output else None,
            encoding
        )
        
        # 显示成功信息
        click.echo(f"✅ 生成成功!")
        click.echo(f"📄 输出文件: {output_path}")
        
        # 显示统计信息
        summary = generator.csv_processor.get_processing_summary()
        click.echo(f"📊 处理统计:")
        click.echo(f"   - 设备数量: {summary['文件信息']['处理设备数']}")
        click.echo(f"   - 机房数量: {summary.get('统计信息', {}).get('机房数量', 0)}")
        click.echo(f"   - 机柜数量: {summary.get('统计信息', {}).get('机柜数量', 0)}")
        
        layout_report = generator.layout_engine.get_layout_report()
        if layout_report and '基本信息' in layout_report:
            click.echo(f"   - 调整次数: {layout_report['基本信息']['调整次数']}")
        
    except CabinetDiagramException as e:
        click.echo(f"❌ 错误: {e}", err=True)
        sys.exit(1)
    except Exception as e:
        click.echo(f"💥 未知错误: {e}", err=True)
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


@click.group()
def cli():
    """机柜部署图生成工具命令行界面"""
    pass


@cli.command()
@click.argument('csv_file', type=click.Path(exists=True, path_type=Path))
@click.option('--encoding', '-e', type=str, help='文件编码')
def validate(csv_file: Path, encoding: Optional[str]):
    """验证CSV文件格式和数据"""
    try:
        click.echo(f"🔍 验证CSV文件: {csv_file}")
        
        processor = CSVProcessor()
        df = processor.load_csv(str(csv_file), encoding)
        
        # 检测格式
        format_type = processor.detect_format(df)
        click.echo(f"📋 检测到格式: {format_type}")
        
        # 验证数据
        errors = processor.validate_data(df)
        
        if not errors:
            click.echo("✅ 数据验证通过!")
            
            # 显示摘要
            summary = processor.get_processing_summary()
            click.echo(f"📊 文件信息:")
            click.echo(f"   - 数据行数: {summary['文件信息']['原始行数']}")
            click.echo(f"   - 格式类型: {summary['文件信息']['格式类型']}")
            
        else:
            click.echo(f"❌ 发现 {len(errors)} 个错误:")
            for i, error in enumerate(errors[:10], 1):
                click.echo(f"   {i}. {error}")
            
            if len(errors) > 10:
                click.echo(f"   ... 还有 {len(errors) - 10} 个错误")
            
            sys.exit(1)
            
    except Exception as e:
        click.echo(f"❌ 验证失败: {e}", err=True)
        sys.exit(1)


@cli.command()
def info():
    """显示工具信息和配置"""
    click.echo(f"🏢 {DEFAULT_APP_CONFIG.应用名称}")
    click.echo(f"📦 版本: {DEFAULT_APP_CONFIG.版本}")
    click.echo(f"👥 作者: {DEFAULT_APP_CONFIG.作者}")
    click.echo()
    
    click.echo("⚙️  配置信息:")
    click.echo(f"   - 可用U位范围: U{DEFAULT_LAYOUT_CONFIG.可用起始U位}-U{DEFAULT_LAYOUT_CONFIG.可用结束U位}")
    click.echo(f"   - 设备间隔: {DEFAULT_LAYOUT_CONFIG.设备间隔}U")
    click.echo(f"   - 冲突解决策略: {DEFAULT_LAYOUT_CONFIG.冲突解决策略.value}")
    click.echo(f"   - 机柜尺寸: {DEFAULT_DIAGRAM_CONFIG.机柜宽度}x{DEFAULT_DIAGRAM_CONFIG.机柜高度}")
    click.echo(f"   - 显示模式: {DEFAULT_DIAGRAM_CONFIG.显示模式.value}")


@cli.command()
@click.argument('csv_file', type=click.Path(exists=True, path_type=Path))
@click.option('--encoding', '-e', type=str, help='文件编码')
def preview(csv_file: Path, encoding: Optional[str]):
    """预览CSV文件内容和处理结果"""
    try:
        click.echo(f"👀 预览CSV文件: {csv_file}")
        
        processor = CSVProcessor()
        devices = processor.process_file(str(csv_file), encoding)
        
        # 显示处理摘要
        summary = processor.get_processing_summary()
        click.echo(f"📊 处理摘要: {summary}")
        
        # 显示前几个设备
        click.echo(f"\n📋 设备列表 (前10个):")
        for i, device in enumerate(devices[:10], 1):
            click.echo(f"   {i}. {device.资产编号} - {device.设备名} ({device.型号}) "
                      f"- {device.full_location} U{device.U位}-U{device.end_position}")
        
        if len(devices) > 10:
            click.echo(f"   ... 还有 {len(devices) - 10} 个设备")
            
    except Exception as e:
        click.echo(f"❌ 预览失败: {e}", err=True)
        sys.exit(1)


# 添加子命令到主命令组
cli.add_command(main, name='generate')

if __name__ == '__main__':
    cli()
