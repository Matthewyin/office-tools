"""
通用CSV读取器

支持自动编码检测、格式检测、动态配置生成和数据转换
"""

import logging
import pandas as pd
from dataclasses import dataclass, field
from typing import List, Tuple, Dict, Any, Optional
from pathlib import Path

from .universal_format import UniversalFormatDetector, DynamicConfigGenerator, EncodingDetector, FormatInfo
from .models import ConnectionRelationship

logger = logging.getLogger(__name__)


@dataclass
class ValidationResult:
    """验证结果"""
    is_valid: bool = True
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


class UniversalCSVReader:
    """通用CSV读取器"""
    
    def __init__(self):
        self.format_detector = UniversalFormatDetector()
        self.config_generator = DynamicConfigGenerator()
        self.encoding_detector = EncodingDetector()
    
    def read_csv_to_connections(self, csv_path: str) -> Tuple[List[ConnectionRelationship], FormatInfo]:
        """
        通用CSV读取方法
        
        Args:
            csv_path: CSV文件路径
            
        Returns:
            (连接关系列表, 格式信息)
        """
        logger.info(f"开始读取CSV文件: {csv_path}")
        
        # 1. 自动检测编码
        encoding = self.encoding_detector.detect_encoding(csv_path)
        logger.info(f"检测到文件编码: {encoding}")
        
        # 2. 读取CSV文件
        try:
            df = pd.read_csv(csv_path, encoding=encoding)
            logger.info(f"成功读取CSV文件，共 {len(df)} 行数据，{len(df.columns)} 列")
        except Exception as e:
            logger.error(f"读取CSV文件失败: {e}")
            # 尝试其他编码
            for fallback_encoding in ['utf-8-sig', 'gbk', 'utf-8']:
                if fallback_encoding != encoding:
                    try:
                        df = pd.read_csv(csv_path, encoding=fallback_encoding)
                        logger.info(f"使用备用编码 {fallback_encoding} 成功读取文件")
                        encoding = fallback_encoding
                        break
                    except:
                        continue
            else:
                raise Exception(f"无法读取CSV文件，尝试的编码: {encoding}")
        
        # 3. 检测格式
        format_info = self.format_detector.detect_csv_format(df.columns.tolist())
        logger.info(f"检测到格式类型: {format_info.format_type} (置信度: {format_info.confidence:.2f})")
        
        # 4. 生成动态配置
        dynamic_config = self.config_generator.generate_config(format_info)
        
        # 5. 验证格式
        validation_result = self._validate_format(df, format_info)
        if not validation_result.is_valid:
            logger.error(f"格式验证失败: {validation_result.errors}")
            raise Exception(f"CSV格式验证失败: {'; '.join(validation_result.errors)}")
        
        if validation_result.warnings:
            logger.warning(f"格式验证警告: {validation_result.warnings}")
        
        # 6. 转换数据
        connections = []
        skipped_count = 0
        
        for index, row in df.iterrows():
            try:
                # 检查是否为空行
                if self._is_empty_row(row):
                    skipped_count += 1
                    continue
                
                connection = self._row_to_connection(row, dynamic_config)
                connections.append(connection)
                
            except Exception as e:
                logger.error(f"第 {index+1} 行转换失败: {e}")
                skipped_count += 1
                continue
        
        logger.info(f"成功转换 {len(connections)} 条连接关系，跳过 {skipped_count} 行")
        return connections, format_info
    
    def _validate_format(self, df: pd.DataFrame, format_info: FormatInfo) -> ValidationResult:
        """验证CSV格式"""
        result = ValidationResult()
        
        # 检查基本格式要求
        if format_info.confidence < 0.5:
            result.errors.append(f"格式置信度过低: {format_info.confidence:.2f}")
        
        # 检查是否有源端和目标端字段
        if format_info.source_columns == 0:
            result.errors.append("未检测到源端字段")
        
        if format_info.target_columns == 0:
            result.errors.append("未检测到目标端字段")
        
        # 检查数据完整性
        empty_rows = 0
        for index, row in df.iterrows():
            if self._is_empty_row(row):
                empty_rows += 1
        
        if empty_rows > 0:
            result.warnings.append(f"检测到 {empty_rows} 行空数据")
        
        # 检查必需字段
        required_device_fields = []
        for category_fields in format_info.column_pattern.source_fields.values():
            for field_info in category_fields:
                if field_info.is_required:
                    required_device_fields.append(field_info.column)
        
        for category_fields in format_info.column_pattern.target_fields.values():
            for field_info in category_fields:
                if field_info.is_required:
                    required_device_fields.append(field_info.column)
        
        missing_required = [field for field in required_device_fields if field not in df.columns]
        if missing_required:
            result.errors.append(f"缺少必需字段: {missing_required}")
        
        result.is_valid = len(result.errors) == 0
        return result
    
    def _is_empty_row(self, row: pd.Series) -> bool:
        """检查是否为空行"""
        # 检查所有值是否都为空或NaN
        for value in row.values:
            if pd.notna(value) and str(value).strip():
                return False
        return True
    
    def _row_to_connection(self, row: pd.Series, config: Dict[str, Any]) -> ConnectionRelationship:
        """将CSV行转换为连接关系"""
        connection = ConnectionRelationship()
        
        # 处理源端信息
        source_config = config['connection_metadata']['source']
        for category, fields in source_config.items():
            category_data = {}
            for field_name, field_config in fields.items():
                csv_column = field_config['csv_column']
                value = str(row.get(csv_column, field_config.get('default', ''))).strip()
                category_data[field_name] = value

            # 设置到ConnectionRelationship的对应属性
            if category == 'region':
                connection.source_region = category_data
            elif category == 'device' or category == 'node':
                connection.source_node = category_data
            elif category == 'location':
                # 合并到source_node中
                connection.source_node.update(category_data)
            elif category == 'port':
                connection.source_port = category_data
        
        # 处理目标端信息
        target_config = config['connection_metadata']['target']
        for category, fields in target_config.items():
            category_data = {}
            for field_name, field_config in fields.items():
                csv_column = field_config['csv_column']
                value = str(row.get(csv_column, field_config.get('default', ''))).strip()
                category_data[field_name] = value

            # 设置到ConnectionRelationship的对应属性
            if category == 'region':
                connection.target_region = category_data
            elif category == 'device' or category == 'node':
                connection.target_node = category_data
            elif category == 'location':
                # 合并到target_node中
                connection.target_node.update(category_data)
            elif category == 'port':
                connection.target_port = category_data
        
        # 处理链路信息
        link_config = config['connection_metadata']['link']
        link_data = {}
        for field_name, field_config in link_config.items():
            csv_column = field_config['csv_column']
            value = str(row.get(csv_column, field_config.get('default', ''))).strip()
            link_data[field_name] = value

        connection.link = link_data
        
        return connection
