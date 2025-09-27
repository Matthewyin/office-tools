"""
通用格式检测和处理模块

提供智能的CSV格式检测、动态配置生成和通用数据转换功能
"""

import re
import logging
from dataclasses import dataclass, field
from typing import Dict, List, Set, Optional, Tuple, Any
from pathlib import Path
import chardet
import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class FieldInfo:
    """字段信息"""
    column: str          # 原始列名
    field: str           # 标准化字段名
    category: str        # 字段分类
    is_required: bool = False
    confidence: float = 1.0


@dataclass
class ColumnPattern:
    """列模式信息"""
    source_fields: Dict[str, List[FieldInfo]] = field(default_factory=lambda: {
        'region': [], 'device': [], 'location': [], 'port': [], 'link': []
    })
    target_fields: Dict[str, List[FieldInfo]] = field(default_factory=lambda: {
        'region': [], 'device': [], 'location': [], 'port': [], 'link': []
    })
    link_fields: List[FieldInfo] = field(default_factory=list)


@dataclass
class FormatInfo:
    """格式信息"""
    format_type: str
    confidence: float
    column_pattern: ColumnPattern
    total_columns: int
    source_columns: int
    target_columns: int
    link_columns: int


class UniversalFormatDetector:
    """通用格式检测器"""
    
    def __init__(self):
        self.config = self._load_detection_config()
    
    def _load_detection_config(self) -> Dict[str, Any]:
        """加载检测配置"""
        return {
            "source_prefixes": ["源-", "src-", "source-", "from-"],
            "target_prefixes": ["目标-", "dst-", "target-", "to-", "dest-"],
            "field_categories": {
                "region": {
                    "keywords": ["区域", "区", "域", "机房", "数据中心", "园区", "region", "zone"],
                    "hierarchy_keywords": ["父", "上级", "parent", "主", "所属", "直接"]
                },
                "device": {
                    "keywords": ["设备", "device", "主机", "host", "节点", "node", "名", "name", "型号", "model", "类型", "type"],
                    "attributes": ["地址", "address", "ip", "管理"]
                },
                "location": {
                    "keywords": ["机柜", "cabinet", "rack", "U位", "位置", "location"]
                },
                "port": {
                    "keywords": ["接口", "interface", "端口", "port", "通道", "channel", "vlan", "vrf", "ip"]
                },
                "link": {
                    "keywords": ["用途", "purpose", "类型", "type", "带宽", "bandwidth", "线缆", "cable", "备注", "remark", "说明", "序号"]
                }
            },
            "confidence_thresholds": {
                "high": 0.9,
                "medium": 0.7,
                "low": 0.5
            }
        }
    
    def detect_csv_format(self, columns: List[str]) -> FormatInfo:
        """
        检测CSV格式信息
        
        Args:
            columns: CSV列名列表
            
        Returns:
            FormatInfo: 格式检测结果
        """
        logger.info(f"开始检测CSV格式，共 {len(columns)} 列")
        
        # 检测列模式
        column_pattern = self._detect_column_pattern(columns)
        
        # 计算置信度
        confidence = self._calculate_confidence(column_pattern, len(columns))
        
        # 确定格式类型
        format_type = self._determine_format_type(column_pattern, confidence)
        
        format_info = FormatInfo(
            format_type=format_type,
            confidence=confidence,
            column_pattern=column_pattern,
            total_columns=len(columns),
            source_columns=sum(len(fields) for fields in column_pattern.source_fields.values()),
            target_columns=sum(len(fields) for fields in column_pattern.target_fields.values()),
            link_columns=len(column_pattern.link_fields)
        )
        
        logger.info(f"格式检测完成: {format_type} (置信度: {confidence:.2f})")
        logger.info(f"源端字段: {format_info.source_columns}, 目标端字段: {format_info.target_columns}, 链路字段: {format_info.link_columns}")
        
        return format_info
    
    def _detect_column_pattern(self, columns: List[str]) -> ColumnPattern:
        """检测列名模式"""
        pattern = ColumnPattern()
        
        for column in columns:
            column_lower = column.lower()
            field_info = None
            
            # 检测源端字段
            for prefix in self.config["source_prefixes"]:
                if column.startswith(prefix):
                    field_name = column[len(prefix):]
                    category = self._classify_field(field_name)
                    field_info = FieldInfo(
                        column=column,
                        field=field_name,
                        category=category,
                        is_required=self._is_required_field(field_name, category),
                        confidence=self._calculate_field_confidence(field_name, category)
                    )
                    # 只有非链路字段才添加到source_fields
                    if category != 'link':
                        pattern.source_fields[category].append(field_info)
                    else:
                        pattern.link_fields.append(field_info)
                    break
            
            # 检测目标端字段
            if field_info is None:
                for prefix in self.config["target_prefixes"]:
                    if column.startswith(prefix):
                        field_name = column[len(prefix):]
                        category = self._classify_field(field_name)
                        field_info = FieldInfo(
                            column=column,
                            field=field_name,
                            category=category,
                            is_required=self._is_required_field(field_name, category),
                            confidence=self._calculate_field_confidence(field_name, category)
                        )
                        # 只有非链路字段才添加到target_fields
                        if category != 'link':
                            pattern.target_fields[category].append(field_info)
                        else:
                            pattern.link_fields.append(field_info)
                        break

            # 检测链路字段
            if field_info is None:
                category = self._classify_field(column)
                field_info = FieldInfo(
                    column=column,
                    field=column,
                    category='link',
                    is_required=False,
                    confidence=self._calculate_field_confidence(column, 'link')
                )
                pattern.link_fields.append(field_info)
        
        return pattern
    
    def _classify_field(self, field_name: str) -> str:
        """智能分类字段"""
        field_lower = field_name.lower()
        
        # 检查各个分类的关键词
        for category, config in self.config["field_categories"].items():
            keywords = config.get("keywords", [])
            if category == "device":
                keywords.extend(config.get("attributes", []))
            
            for keyword in keywords:
                if keyword in field_lower:
                    return category
        
        # 特殊处理序号字段
        if any(keyword in field_lower for keyword in ["序号", "number", "seq", "index"]):
            return "sequence"
        
        # 默认为链路字段
        return "link"
    
    def _is_required_field(self, field_name: str, category: str) -> bool:
        """判断是否为必需字段"""
        field_lower = field_name.lower()
        
        # 设备名是必需的
        if category == "device" and any(keyword in field_lower for keyword in ["名", "name"]):
            return True
        
        # 其他字段暂时都不是必需的
        return False
    
    def _calculate_field_confidence(self, field_name: str, category: str) -> float:
        """计算字段置信度"""
        field_lower = field_name.lower()
        
        if category in self.config["field_categories"]:
            keywords = self.config["field_categories"][category].get("keywords", [])
            if category == "device":
                keywords.extend(self.config["field_categories"][category].get("attributes", []))
            
            # 精确匹配得分更高
            for keyword in keywords:
                if keyword == field_lower:
                    return 1.0
                elif keyword in field_lower:
                    return 0.8
        
        return 0.5
    
    def _calculate_confidence(self, pattern: ColumnPattern, total_columns: int) -> float:
        """计算整体置信度"""
        source_count = sum(len(fields) for fields in pattern.source_fields.values())
        target_count = sum(len(fields) for fields in pattern.target_fields.values())
        link_count = len(pattern.link_fields)
        
        # 基础分数：有源端和目标端字段
        base_score = 0.0
        if source_count > 0 and target_count > 0:
            base_score = 0.6
        elif source_count > 0 or target_count > 0:
            base_score = 0.3
        
        # 对称性加分：源端和目标端字段数量相近
        if source_count > 0 and target_count > 0:
            symmetry_score = 1.0 - abs(source_count - target_count) / max(source_count, target_count)
            base_score += symmetry_score * 0.2
        
        # 覆盖率加分：识别的字段占总字段的比例
        recognized_count = source_count + target_count + link_count
        coverage_score = recognized_count / total_columns if total_columns > 0 else 0
        base_score += coverage_score * 0.2
        
        return min(base_score, 1.0)
    
    def _determine_format_type(self, pattern: ColumnPattern, confidence: float) -> str:
        """确定格式类型"""
        if confidence >= self.config["confidence_thresholds"]["high"]:
            return "network_topology_standard"
        elif confidence >= self.config["confidence_thresholds"]["medium"]:
            return "network_topology_compatible"
        elif confidence >= self.config["confidence_thresholds"]["low"]:
            return "network_topology_basic"
        else:
            return "unknown"


class DynamicConfigGenerator:
    """动态配置生成器"""

    def generate_config(self, format_info: FormatInfo) -> Dict[str, Any]:
        """
        根据检测到的格式信息生成动态配置

        Args:
            format_info: 格式检测结果

        Returns:
            动态生成的配置字典
        """
        logger.info(f"开始生成动态配置，格式类型: {format_info.format_type}")

        config = {
            "version": "dynamic-1.0",
            "description": f"动态生成的配置 - {format_info.format_type}",
            "format_info": {
                "type": format_info.format_type,
                "confidence": format_info.confidence,
                "total_columns": format_info.total_columns,
                "source_columns": format_info.source_columns,
                "target_columns": format_info.target_columns,
                "link_columns": format_info.link_columns
            },
            "connection_metadata": {
                "source": self._generate_endpoint_config(format_info.column_pattern.source_fields),
                "target": self._generate_endpoint_config(format_info.column_pattern.target_fields),
                "link": self._generate_link_config(format_info.column_pattern.link_fields)
            },
            "csv_output": {
                "column_order": self._generate_column_order(format_info),
                "encoding_options": {
                    "utf8_bom": "UTF-8 BOM格式，适合现代Excel",
                    "gbk": "GBK编码，适合传统中文Windows Excel",
                    "universal": "同时生成UTF-8 BOM和GBK版本"
                }
            },
            "validation": {
                "required_fields": self._identify_required_fields(format_info),
                "optional_fields": self._identify_optional_fields(format_info)
            }
        }

        logger.info("动态配置生成完成")
        return config

    def _generate_endpoint_config(self, fields_by_category: Dict[str, List[FieldInfo]]) -> Dict[str, Any]:
        """生成端点配置"""
        endpoint_config = {}

        for category, fields in fields_by_category.items():
            if not fields:
                continue

            endpoint_config[category] = {}
            for field_info in fields:
                field_key = self._normalize_field_name(field_info.field)
                endpoint_config[category][field_key] = {
                    "name": field_info.field,
                    "csv_column": field_info.column,
                    "required": field_info.is_required,
                    "default": "",
                    "confidence": field_info.confidence,
                    "description": f"自动检测的{category}字段"
                }

        return endpoint_config

    def _generate_link_config(self, link_fields: List[FieldInfo]) -> Dict[str, Any]:
        """生成链路配置"""
        link_config = {}

        for field_info in link_fields:
            field_key = self._normalize_field_name(field_info.field)
            link_config[field_key] = {
                "name": field_info.field,
                "csv_column": field_info.column,
                "required": field_info.is_required,
                "default": "",
                "confidence": field_info.confidence,
                "description": f"自动检测的链路字段"
            }

        return link_config

    def _normalize_field_name(self, field_name: str) -> str:
        """标准化字段名"""
        # 移除特殊字符，转换为下划线格式
        normalized = re.sub(r'[^\w\u4e00-\u9fff]', '_', field_name)
        normalized = re.sub(r'_+', '_', normalized)
        normalized = normalized.strip('_')
        return normalized or "unknown_field"

    def _generate_column_order(self, format_info: FormatInfo) -> List[str]:
        """生成列顺序"""
        columns = []

        # 添加序号列（如果存在）
        for field_info in format_info.column_pattern.link_fields:
            if any(keyword in field_info.field.lower() for keyword in ["序号", "number", "seq"]):
                columns.append(field_info.column)
                break

        # 添加源端字段
        for category in ['region', 'device', 'location', 'port']:
            for field_info in format_info.column_pattern.source_fields.get(category, []):
                columns.append(field_info.column)

        # 添加链路字段
        for field_info in format_info.column_pattern.link_fields:
            if field_info.column not in columns:
                columns.append(field_info.column)

        # 添加目标端字段
        for category in ['region', 'device', 'location', 'port']:
            for field_info in format_info.column_pattern.target_fields.get(category, []):
                columns.append(field_info.column)

        return columns

    def _identify_required_fields(self, format_info: FormatInfo) -> List[str]:
        """识别必需字段"""
        required_fields = []

        # 收集所有标记为必需的字段
        for category_fields in format_info.column_pattern.source_fields.values():
            for field_info in category_fields:
                if field_info.is_required:
                    required_fields.append(field_info.column)

        for category_fields in format_info.column_pattern.target_fields.values():
            for field_info in category_fields:
                if field_info.is_required:
                    required_fields.append(field_info.column)

        return required_fields

    def _identify_optional_fields(self, format_info: FormatInfo) -> List[str]:
        """识别可选字段"""
        optional_fields = []

        # 收集所有非必需字段
        for category_fields in format_info.column_pattern.source_fields.values():
            for field_info in category_fields:
                if not field_info.is_required:
                    optional_fields.append(field_info.column)

        for category_fields in format_info.column_pattern.target_fields.values():
            for field_info in category_fields:
                if not field_info.is_required:
                    optional_fields.append(field_info.column)

        for field_info in format_info.column_pattern.link_fields:
            optional_fields.append(field_info.column)

        return optional_fields


class EncodingDetector:
    """编码检测器"""

    @staticmethod
    def detect_encoding(file_path: str) -> str:
        """
        检测文件编码

        Args:
            file_path: 文件路径

        Returns:
            检测到的编码格式
        """
        try:
            with open(file_path, 'rb') as f:
                raw_data = f.read(10000)  # 读取前10KB用于检测

            result = chardet.detect(raw_data)
            encoding = result['encoding']
            confidence = result['confidence']

            logger.info(f"检测到编码: {encoding} (置信度: {confidence:.2f})")

            # 处理常见的编码别名
            if encoding and encoding.lower().startswith('utf-8'):
                return 'utf-8-sig'  # 支持BOM
            elif encoding and encoding.lower() in ['gb2312', 'gbk', 'gb18030']:
                return 'gbk'
            elif encoding:
                return encoding
            else:
                # 默认尝试UTF-8
                logger.warning("无法检测编码，使用默认UTF-8")
                return 'utf-8-sig'

        except Exception as e:
            logger.error(f"编码检测失败: {e}")
            return 'utf-8-sig'
