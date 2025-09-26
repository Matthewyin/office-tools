"""
配置管理模块

负责加载、验证和管理字段映射配置文件。
"""

import yaml
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from loguru import logger
import difflib


@dataclass
class FieldMappingConfig:
    """字段映射配置类"""
    name: str
    description: str
    required_fields: List[str]
    field_mapping: Dict[str, str]
    enabled: bool = True


@dataclass
class ConfigData:
    """完整配置数据类"""
    field_mappings: Dict[str, FieldMappingConfig]
    default_values: Dict[str, str]
    required_internal_fields: List[str]
    optional_internal_fields: List[str]
    priority_order: List[str]
    match_threshold: float
    fuzzy_matching: bool
    similarity_threshold: float
    auto_calculate_height: bool
    skip_empty_rows: bool
    skip_invalid_rows: bool


class ConfigManager:
    """配置管理器"""
    
    def __init__(self, config_path: Optional[Path] = None):
        """
        初始化配置管理器
        
        Args:
            config_path: 配置文件路径，如果为None则使用默认路径
        """
        if config_path is None:
            # 默认配置文件路径
            self.config_path = Path(__file__).parent.parent / "config" / "field_mapping.yaml"
        else:
            self.config_path = Path(config_path)
        
        self.config_data: Optional[ConfigData] = None
        self._load_config()
    
    def _load_config(self) -> None:
        """加载配置文件"""
        try:
            if not self.config_path.exists():
                logger.warning(f"配置文件不存在: {self.config_path}")
                self._create_default_config()
                return
            
            with open(self.config_path, 'r', encoding='utf-8') as f:
                raw_config = yaml.safe_load(f)
            
            self.config_data = self._parse_config(raw_config)
            logger.info(f"成功加载配置文件: {self.config_path}")
            
        except Exception as e:
            logger.error(f"加载配置文件失败: {e}")
            self._create_default_config()
    
    def _parse_config(self, raw_config: Dict[str, Any]) -> ConfigData:
        """解析配置数据"""
        # 解析字段映射
        field_mappings = {}
        for format_id, format_config in raw_config.get('field_mappings', {}).items():
            if format_config.get('enabled', True):  # 默认启用
                field_mappings[format_id] = FieldMappingConfig(
                    name=format_config.get('name', format_id),
                    description=format_config.get('description', ''),
                    required_fields=format_config.get('required_fields', []),
                    field_mapping=format_config.get('field_mapping', {}),
                    enabled=format_config.get('enabled', True)
                )
        
        # 解析其他配置
        validation = raw_config.get('validation', {})
        detection = raw_config.get('detection', {})
        processing = raw_config.get('processing', {})
        
        return ConfigData(
            field_mappings=field_mappings,
            default_values=raw_config.get('default_values', {}),
            required_internal_fields=validation.get('required_internal_fields', []),
            optional_internal_fields=validation.get('optional_internal_fields', []),
            priority_order=detection.get('priority_order', []),
            match_threshold=detection.get('match_threshold', 0.8),
            fuzzy_matching=detection.get('fuzzy_matching', True),
            similarity_threshold=detection.get('similarity_threshold', 0.8),
            auto_calculate_height=processing.get('auto_calculate_height', True),
            skip_empty_rows=processing.get('skip_empty_rows', True),
            skip_invalid_rows=processing.get('skip_invalid_rows', True)
        )
    
    def _create_default_config(self) -> None:
        """创建默认配置"""
        logger.info("使用默认配置")
        # 创建最基本的配置
        self.config_data = ConfigData(
            field_mappings={
                'default': FieldMappingConfig(
                    name="默认格式",
                    description="默认字段映射",
                    required_fields=["机房", "机柜", "U位"],
                    field_mapping={
                        "资产编号": "资产编号",
                        "设备名": "设备名",
                        "机房": "机房",
                        "机柜": "机柜",
                        "U位": "U位"
                    }
                )
            },
            default_values={"机房": "默认机房", "厂商": "未知厂商"},
            required_internal_fields=["机房", "机柜", "U位"],
            optional_internal_fields=["资产编号", "设备名", "型号", "设备高度"],
            priority_order=["default"],
            match_threshold=0.8,
            fuzzy_matching=True,
            similarity_threshold=0.8,
            auto_calculate_height=True,
            skip_empty_rows=True,
            skip_invalid_rows=True
        )
    
    def detect_format(self, columns: List[str]) -> Tuple[Optional[str], float]:
        """
        检测CSV格式
        
        Args:
            columns: CSV文件的列名列表
            
        Returns:
            (格式ID, 匹配度)
        """
        if not self.config_data:
            return None, 0.0
        
        best_format = None
        best_score = 0.0
        
        # 按优先级顺序检测
        for format_id in self.config_data.priority_order:
            if format_id not in self.config_data.field_mappings:
                continue
            
            format_config = self.config_data.field_mappings[format_id]
            score = self._calculate_match_score(columns, format_config)
            
            logger.debug(f"格式 {format_id} 匹配度: {score:.2f}")
            
            if score > best_score and score >= self.config_data.match_threshold:
                best_format = format_id
                best_score = score
        
        # 如果没有找到匹配的格式，尝试所有格式
        if best_format is None:
            for format_id, format_config in self.config_data.field_mappings.items():
                if format_id in self.config_data.priority_order:
                    continue  # 已经检测过了
                
                score = self._calculate_match_score(columns, format_config)
                if score > best_score:
                    best_format = format_id
                    best_score = score
        
        logger.info(f"检测到格式: {best_format} (匹配度: {best_score:.2f})")
        return best_format, best_score
    
    def _calculate_match_score(self, columns: List[str], format_config: FieldMappingConfig) -> float:
        """计算匹配分数"""
        if not format_config.required_fields:
            return 0.0
        
        columns_set = set(columns)
        required_set = set(format_config.required_fields)
        
        # 精确匹配
        exact_matches = len(required_set.intersection(columns_set))
        exact_score = exact_matches / len(required_set)
        
        # 如果启用模糊匹配
        if self.config_data.fuzzy_matching and exact_score < 1.0:
            fuzzy_matches = 0
            for required_field in required_set:
                if required_field not in columns_set:
                    # 寻找最相似的字段
                    best_match = difflib.get_close_matches(
                        required_field, columns, n=1, 
                        cutoff=self.config_data.similarity_threshold
                    )
                    if best_match:
                        fuzzy_matches += 1
            
            fuzzy_score = (exact_matches + fuzzy_matches) / len(required_set)
            return max(exact_score, fuzzy_score * 0.9)  # 模糊匹配稍微降权
        
        return exact_score
    
    def get_field_mapping(self, format_id: str) -> Dict[str, str]:
        """获取字段映射"""
        if not self.config_data or format_id not in self.config_data.field_mappings:
            return {}
        
        return self.config_data.field_mappings[format_id].field_mapping
    
    def get_default_values(self) -> Dict[str, str]:
        """获取默认值"""
        if not self.config_data:
            return {}
        
        return self.config_data.default_values
    
    def get_required_internal_fields(self) -> List[str]:
        """获取必需的内部字段"""
        if not self.config_data:
            return []
        
        return self.config_data.required_internal_fields
    
    def list_available_formats(self) -> Dict[str, str]:
        """列出可用的格式"""
        if not self.config_data:
            return {}
        
        return {
            format_id: config.name 
            for format_id, config in self.config_data.field_mappings.items()
        }
    
    def reload_config(self) -> bool:
        """重新加载配置"""
        try:
            self._load_config()
            return True
        except Exception as e:
            logger.error(f"重新加载配置失败: {e}")
            return False


# 全局配置管理器实例
config_manager = ConfigManager()
