"""连接关系CSV输出器"""

import csv
from pathlib import Path
from typing import List, Dict, Any, Optional
import logging

from .models import ConnectionRelationship
from .connection_config import ConnectionConfigManager

logger = logging.getLogger(__name__)


class ConnectionCSVWriter:
    """连接关系CSV输出器"""
    
    def __init__(self, config_manager: Optional[ConnectionConfigManager] = None):
        """
        初始化CSV输出器
        
        Args:
            config_manager: 配置管理器，如果为None则创建默认实例
        """
        self.config_manager = config_manager or ConnectionConfigManager()
        self.config = self.config_manager.get_config()
    
    def write_connections_to_csv(self, 
                                connections: List[ConnectionRelationship], 
                                output_path: str,
                                encoding: str = "utf-8-sig") -> None:
        """
        将连接关系写入CSV文件
        
        Args:
            connections: 连接关系列表
            output_path: 输出文件路径
            encoding: 文件编码
        """
        try:
            # 获取CSV列顺序
            columns = self.config_manager.get_csv_columns()
            if not columns:
                logger.warning("配置文件中未定义CSV列顺序，使用默认顺序")
                columns = self._get_default_columns()
            
            # 确保输出目录存在
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            
            # 写入CSV文件
            with open(output_file, 'w', newline='', encoding=encoding) as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=columns)
                
                # 写入表头
                writer.writeheader()
                
                # 写入数据行
                for i, connection in enumerate(connections, 1):
                    try:
                        record = connection.to_csv_record(self.config)
                        
                        # 添加序号
                        if '序号' in columns and '序号' not in record:
                            record['序号'] = str(i)
                        
                        # 确保所有列都有值
                        for column in columns:
                            if column not in record:
                                record[column] = ''
                        
                        writer.writerow(record)
                        
                    except Exception as e:
                        logger.error(f"写入第 {i} 条连接关系时出错: {e}")
                        continue
            
            logger.info(f"成功写入 {len(connections)} 条连接关系到 {output_path}")
            
        except Exception as e:
            logger.error(f"写入CSV文件失败: {e}")
            raise
    
    def write_multiple_encodings(self, 
                                connections: List[ConnectionRelationship], 
                                base_output_path: str) -> Dict[str, str]:
        """
        生成多种编码的CSV文件
        
        Args:
            connections: 连接关系列表
            base_output_path: 基础输出路径（不含扩展名）
            
        Returns:
            生成的文件路径字典
        """
        output_files = {}
        
        try:
            base_path = Path(base_output_path)
            base_name = base_path.stem
            base_dir = base_path.parent
            
            # UTF-8 BOM版本（适合现代Excel）
            utf8_path = base_dir / f"{base_name}.csv"
            self.write_connections_to_csv(connections, str(utf8_path), "utf-8-sig")
            output_files['utf8_bom'] = str(utf8_path)
            
            # GBK版本（适合传统中文Windows Excel）
            gbk_path = base_dir / f"{base_name}.gbk.csv"
            self.write_connections_to_csv(connections, str(gbk_path), "gbk")
            output_files['gbk'] = str(gbk_path)
            
            logger.info(f"成功生成多编码CSV文件: {list(output_files.values())}")
            return output_files
            
        except Exception as e:
            logger.error(f"生成多编码CSV文件失败: {e}")
            raise
    
    def _get_default_columns(self) -> List[str]:
        """
        获取默认的CSV列顺序
        
        Returns:
            默认列顺序列表
        """
        return [
            "序号",
            "源-父区域", "源-所属区域", "源-设备名", "源-设备型号", "源-设备类型",
            "源-管理地址", "源-机柜", "源-U位",
            "源-Port-Channel号", "源-物理接口", "源-所属VRF", "源-所属VLAN", "源-接口IP",
            "互联用途", "线缆类型", "带宽", "备注",
            "目标-接口IP", "目标-所属VLAN", "目标-所属VRF", "目标-物理接口", "目标-Port-Channel号",
            "目标-U位", "目标-机柜", "目标-设备类型", "目标-设备型号", "目标-设备名",
            "目标-所属区域", "目标-父区域", "目标-管理地址"
        ]
    
    def generate_summary_report(self, connections: List[ConnectionRelationship]) -> Dict[str, Any]:
        """
        生成连接关系汇总报告
        
        Args:
            connections: 连接关系列表
            
        Returns:
            汇总报告字典
        """
        report = {
            'total_connections': len(connections),
            'devices': set(),
            'device_types': {},
            'regions': set(),
            'connection_types': {}
        }
        
        for connection in connections:
            # 统计设备
            source_device = connection.source_node.get('device_name', '')
            target_device = connection.target_node.get('device_name', '')
            if source_device:
                report['devices'].add(source_device)
            if target_device:
                report['devices'].add(target_device)
            
            # 统计设备类型
            source_type = connection.source_node.get('device_type', '未知')
            target_type = connection.target_node.get('device_type', '未知')
            report['device_types'][source_type] = report['device_types'].get(source_type, 0) + 1
            report['device_types'][target_type] = report['device_types'].get(target_type, 0) + 1
            
            # 统计区域
            source_region = connection.source_region.get('region', '')
            target_region = connection.target_region.get('region', '')
            if source_region:
                report['regions'].add(source_region)
            if target_region:
                report['regions'].add(target_region)
            
            # 统计连接类型
            usage = connection.link.get('usage', '未知')
            report['connection_types'][usage] = report['connection_types'].get(usage, 0) + 1
        
        # 转换集合为列表以便JSON序列化
        report['devices'] = list(report['devices'])
        report['regions'] = list(report['regions'])
        report['unique_devices'] = len(report['devices'])
        report['unique_regions'] = len(report['regions'])
        
        return report
    
    def print_summary(self, connections: List[ConnectionRelationship]) -> None:
        """
        打印连接关系汇总信息
        
        Args:
            connections: 连接关系列表
        """
        report = self.generate_summary_report(connections)
        
        print(f"\n📊 连接关系汇总报告")
        print(f"{'='*50}")
        print(f"总连接数: {report['total_connections']}")
        print(f"涉及设备: {report['unique_devices']} 个")
        print(f"涉及区域: {report['unique_regions']} 个")
        
        if report['device_types']:
            print(f"\n设备类型分布:")
            for device_type, count in sorted(report['device_types'].items()):
                print(f"  {device_type}: {count}")
        
        if report['connection_types']:
            print(f"\n连接类型分布:")
            for conn_type, count in sorted(report['connection_types'].items()):
                print(f"  {conn_type}: {count}")
        
        if report['devices']:
            print(f"\n前10个设备:")
            for device in sorted(report['devices'])[:10]:
                print(f"  - {device}")
            if len(report['devices']) > 10:
                print(f"  ... 还有 {len(report['devices']) - 10} 个设备")
        
        print(f"{'='*50}")


class ConnectionCSVReader:
    """连接关系CSV读取器"""
    
    def __init__(self, config_manager: Optional[ConnectionConfigManager] = None):
        """
        初始化CSV读取器
        
        Args:
            config_manager: 配置管理器，如果为None则创建默认实例
        """
        self.config_manager = config_manager or ConnectionConfigManager()
        self.config = self.config_manager.get_config()
    
    def read_connections_from_csv(self, csv_path: str, encoding: str = "utf-8-sig") -> List[ConnectionRelationship]:
        """
        从CSV文件读取连接关系
        
        Args:
            csv_path: CSV文件路径
            encoding: 文件编码
            
        Returns:
            连接关系列表
        """
        connections = []
        
        try:
            with open(csv_path, 'r', encoding=encoding) as csvfile:
                reader = csv.DictReader(csvfile)
                
                for row_num, row in enumerate(reader, 1):
                    try:
                        connection = self._csv_record_to_connection(row)
                        connections.append(connection)
                    except Exception as e:
                        logger.error(f"读取第 {row_num} 行时出错: {e}")
                        continue
            
            logger.info(f"成功从 {csv_path} 读取 {len(connections)} 条连接关系")
            return connections
            
        except Exception as e:
            logger.error(f"读取CSV文件失败: {e}")
            return []
    
    def _csv_record_to_connection(self, record: Dict[str, str]) -> ConnectionRelationship:
        """
        将CSV记录转换为连接关系对象
        
        Args:
            record: CSV记录字典
            
        Returns:
            连接关系对象
        """
        connection = ConnectionRelationship()
        
        # 根据配置文件反向映射
        metadata = self.config_manager.get_connection_metadata()
        
        # 处理源端信息
        for category in ['region', 'node', 'port']:
            if category in metadata.get('source', {}):
                category_data = {}
                for field_name, field_config in metadata['source'][category].items():
                    csv_column = field_config['csv_column']
                    value = record.get(csv_column, field_config.get('default', ''))
                    category_data[field_name] = value
                setattr(connection, f'source_{category}', category_data)
        
        # 处理目标端信息
        for category in ['region', 'node', 'port']:
            if category in metadata.get('target', {}):
                category_data = {}
                for field_name, field_config in metadata['target'][category].items():
                    csv_column = field_config['csv_column']
                    value = record.get(csv_column, field_config.get('default', ''))
                    category_data[field_name] = value
                setattr(connection, f'target_{category}', category_data)
        
        # 处理链路信息
        if 'link' in metadata:
            link_data = {}
            for field_name, field_config in metadata['link'].items():
                csv_column = field_config['csv_column']
                value = record.get(csv_column, field_config.get('default', ''))
                link_data[field_name] = value
            connection.link = link_data
        
        return connection
