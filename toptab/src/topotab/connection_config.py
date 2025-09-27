"""连接关系配置管理器"""

import json
from pathlib import Path
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class ConnectionConfigManager:
    """连接关系配置管理器"""
    
    def __init__(self, config_path: Optional[Path] = None):
        """
        初始化连接关系配置管理器
        
        Args:
            config_path: 配置文件路径，如果为None则使用默认路径
        """
        if config_path is None:
            # 默认配置文件路径
            project_root = Path(__file__).parent.parent.parent
            self.config_path = project_root / "config" / "connection_metadata.json"
        else:
            self.config_path = Path(config_path)
        
        self.config: Optional[Dict[str, Any]] = None
        self._load_config()
    
    def _load_config(self) -> None:
        """加载配置文件"""
        try:
            if not self.config_path.exists():
                logger.warning(f"连接关系配置文件不存在: {self.config_path}")
                self._create_default_config()
                return
            
            with open(self.config_path, 'r', encoding='utf-8') as f:
                self.config = json.load(f)
            
            logger.info(f"成功加载连接关系配置文件: {self.config_path}")
            
        except Exception as e:
            logger.error(f"加载连接关系配置文件失败: {e}")
            self._create_default_config()
    
    def _create_default_config(self) -> None:
        """创建默认配置"""
        self.config = {
            "version": "1.0",
            "description": "默认网络拓扑连接关系元数据配置",
            "connection_metadata": {
                "source": {
                    "region": {
                        "parent_region": {
                            "name": "父区域",
                            "csv_column": "源-父区域",
                            "required": False,
                            "default": ""
                        },
                        "region": {
                            "name": "所属区域",
                            "csv_column": "源-所属区域",
                            "required": False,
                            "default": ""
                        }
                    },
                    "node": {
                        "device_name": {
                            "name": "设备名",
                            "csv_column": "源-设备名",
                            "required": True
                        },
                        "device_model": {
                            "name": "设备型号",
                            "csv_column": "源-设备型号",
                            "required": False,
                            "default": ""
                        }
                    },
                    "port": {
                        "physical_interface": {
                            "name": "物理接口",
                            "csv_column": "源-物理接口",
                            "required": False,
                            "default": ""
                        }
                    }
                },
                "target": {
                    "region": {
                        "parent_region": {
                            "name": "父区域",
                            "csv_column": "目标-父区域",
                            "required": False,
                            "default": ""
                        },
                        "region": {
                            "name": "所属区域",
                            "csv_column": "目标-所属区域",
                            "required": False,
                            "default": ""
                        }
                    },
                    "node": {
                        "device_name": {
                            "name": "设备名",
                            "csv_column": "目标-设备名",
                            "required": True
                        },
                        "device_model": {
                            "name": "设备型号",
                            "csv_column": "目标-设备型号",
                            "required": False,
                            "default": ""
                        }
                    },
                    "port": {
                        "physical_interface": {
                            "name": "物理接口",
                            "csv_column": "目标-物理接口",
                            "required": False,
                            "default": ""
                        }
                    }
                },
                "link": {
                    "usage": {
                        "name": "互联用途",
                        "csv_column": "互联用途",
                        "required": False,
                        "default": ""
                    }
                }
            },
            "parsing_rules": {
                "node_formats": [
                    {
                        "name": "设备名_div_设备型号",
                        "pattern": "^([^<]+)<div>([^<]+)</div>$",
                        "fields": ["device_name", "device_model"],
                        "priority": 1
                    }
                ],
                "port_keywords": {
                    "port_channel": ["port-channel", "portchannel", "pc号"],
                    "physical_interface": ["物理接口", "interface", "接口"]
                }
            },
            "csv_output": {
                "column_order": [
                    "源-设备名", "源-设备型号", "源-物理接口",
                    "互联用途",
                    "目标-物理接口", "目标-设备型号", "目标-设备名"
                ]
            }
        }
        
        # 保存默认配置
        self.save_config()
    
    def save_config(self) -> None:
        """保存配置文件"""
        try:
            # 确保配置目录存在
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(self.config_path, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, ensure_ascii=False, indent=2)
            
            logger.info(f"成功保存连接关系配置文件: {self.config_path}")
            
        except Exception as e:
            logger.error(f"保存连接关系配置文件失败: {e}")
    
    def get_config(self) -> Dict[str, Any]:
        """获取完整配置"""
        return self.config or {}
    
    def get_connection_metadata(self) -> Dict[str, Any]:
        """获取连接关系元数据配置"""
        return self.get_config().get('connection_metadata', {})
    
    def get_parsing_rules(self) -> Dict[str, Any]:
        """获取解析规则"""
        return self.get_config().get('parsing_rules', {})
    
    def get_csv_columns(self) -> list[str]:
        """获取CSV列顺序"""
        return self.get_config().get('csv_output', {}).get('column_order', [])
    
    def get_node_formats(self) -> list[Dict[str, Any]]:
        """获取节点解析格式"""
        return self.get_parsing_rules().get('node_formats', [])
    
    def get_port_keywords(self) -> Dict[str, list[str]]:
        """获取端口关键词"""
        return self.get_parsing_rules().get('port_keywords', {})
