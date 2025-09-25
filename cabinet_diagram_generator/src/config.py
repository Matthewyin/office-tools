"""
配置管理模块

包含项目的各种配置类和默认设置。
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from enum import Enum


class DisplayMode(Enum):
    """显示模式枚举"""
    SIMPLE = "简洁"
    DETAILED = "详细"


class ConflictResolutionStrategy(Enum):
    """冲突解决策略枚举"""
    UPWARD_FIRST = "向上优先"
    DOWNWARD_FIRST = "向下优先"
    NEAREST_FIRST = "最近优先"
    MANUAL = "手动处理"


@dataclass
class DiagramConfig:
    """图形配置类"""
    
    # 尺寸配置
    机柜宽度: int = 200
    机柜高度: int = 840  # 42U × 20像素 = 840像素，确保完整包含42U
    U位高度: int = 20
    机柜间距: int = 100
    机房间距: int = 300
    设备内边距: int = 20
    
    # 颜色配置
    设备颜色映射: Dict[str, str] = field(default_factory=lambda: {
        "Web服务": "#FFE6CC",
        "数据库": "#E1D5E7",
        "存储": "#D5E8D4",
        "网络核心": "#F8CECC",
        "网络接入": "#FFCCCC",
        "应用服务": "#FFF2CC",
        "安全防护": "#FFCCCC",
        "负载均衡": "#E6F3FF",
        "备份": "#F0F8E6",
        "监控": "#FFF0E6",
        "管理设备": "#F5F5F5",
        "缓存服务": "#E6F7FF",
        "电源设备": "#FFF5E6",
        "其他": "#E6E6E6"
    })
    
    机柜颜色: str = "#E6E6E6"
    文字颜色: str = "#000000"
    边框颜色: str = "#000000"
    区域标识颜色: str = "#4472C4"
    机房标题颜色: str = "#2F5597"
    
    # 字体配置
    字体大小: int = 12
    字体族: str = "Arial"
    粗体: bool = False
    机房标题字体大小: int = 16
    
    # 显示配置
    显示厂商信息: bool = True
    显示资产编号: bool = False
    显示区域信息: bool = True
    显示模式: DisplayMode = DisplayMode.SIMPLE
    显示U位标尺: bool = True
    显示机房标题: bool = True
    
    # 图形质量配置
    抗锯齿: bool = True
    高质量渲染: bool = True
    
    def get_device_color(self, device_purpose: str) -> str:
        """获取设备颜色"""
        return self.设备颜色映射.get(device_purpose, self.设备颜色映射["其他"])
    
    def update_color_mapping(self, purpose: str, color: str) -> None:
        """更新颜色映射"""
        self.设备颜色映射[purpose] = color
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "尺寸配置": {
                "机柜宽度": self.机柜宽度,
                "机柜高度": self.机柜高度,
                "U位高度": self.U位高度,
                "机柜间距": self.机柜间距,
                "机房间距": self.机房间距,
                "设备内边距": self.设备内边距
            },
            "颜色配置": {
                "设备颜色映射": self.设备颜色映射,
                "机柜颜色": self.机柜颜色,
                "文字颜色": self.文字颜色,
                "边框颜色": self.边框颜色,
                "区域标识颜色": self.区域标识颜色,
                "机房标题颜色": self.机房标题颜色
            },
            "字体配置": {
                "字体大小": self.字体大小,
                "字体族": self.字体族,
                "粗体": self.粗体,
                "机房标题字体大小": self.机房标题字体大小
            },
            "显示配置": {
                "显示厂商信息": self.显示厂商信息,
                "显示资产编号": self.显示资产编号,
                "显示区域信息": self.显示区域信息,
                "显示模式": self.显示模式.value,
                "显示U位标尺": self.显示U位标尺,
                "显示机房标题": self.显示机房标题
            }
        }


@dataclass
class LayoutConfig:
    """布局配置类"""
    
    # 空间配置
    可用起始U位: int = 3
    可用结束U位: int = 39
    设备间隔: int = 1
    
    # 算法配置
    冲突解决策略: ConflictResolutionStrategy = ConflictResolutionStrategy.UPWARD_FIRST
    自动优化: bool = False  # 禁用自动优化，保持用户指定的U位
    允许调整: bool = True   # 仅在有冲突时才调整
    最大调整次数: int = 100
    
    # 验证配置
    严格模式: bool = False
    允许超出范围: bool = False
    强制间隔: bool = True
    
    # 性能配置
    并行处理: bool = True
    批处理大小: int = 50
    
    def get_available_positions(self) -> range:
        """获取可用位置范围"""
        return range(self.可用起始U位, self.可用结束U位 + 1)
    
    def get_available_space(self) -> int:
        """获取可用空间大小"""
        return self.可用结束U位 - self.可用起始U位 + 1
    
    def validate_position(self, position: int, height: int) -> bool:
        """验证位置是否在有效范围内"""
        return (self.可用起始U位 <= position <= self.可用结束U位 and
                position + height - 1 <= self.可用结束U位)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "空间配置": {
                "可用起始U位": self.可用起始U位,
                "可用结束U位": self.可用结束U位,
                "设备间隔": self.设备间隔,
                "可用空间": self.get_available_space()
            },
            "算法配置": {
                "冲突解决策略": self.冲突解决策略.value,
                "自动优化": self.自动优化,
                "允许调整": self.允许调整,
                "最大调整次数": self.最大调整次数
            },
            "验证配置": {
                "严格模式": self.严格模式,
                "允许超出范围": self.允许超出范围,
                "强制间隔": self.强制间隔
            },
            "性能配置": {
                "并行处理": self.并行处理,
                "批处理大小": self.批处理大小
            }
        }


@dataclass
class CSVConfig:
    """CSV配置类"""
    
    # 字段映射配置
    新格式字段映射: Dict[str, str] = field(default_factory=lambda: {
        "资产编号": "资产编号",
        "区域": "区域",
        "子区": "子区",
        "设备用途": "设备用途",
        "设备名": "设备名",
        "型号": "型号",
        "设备高度": "设备高度",
        "机房": "机房",
        "机柜": "机柜",
        "U位": "U位",
        "厂商": "厂商"
    })
    
    旧格式字段映射: Dict[str, str] = field(default_factory=lambda: {
        "序号": "资产编号",
        "设备名": "设备名",
        "型号": "型号",
        "设备高度": "设备高度",
        "类型": "设备用途",
        "机柜号": "机柜",
        "U位": "U位"
    })
    
    # 默认值配置
    默认值: Dict[str, str] = field(default_factory=lambda: {
        "区域": "默认区域",
        "子区": "默认子区",
        "机房": "默认机房",
        "厂商": "未知厂商"
    })
    
    # 验证配置
    必需字段: List[str] = field(default_factory=lambda: [
        "资产编号", "设备名", "型号", "设备高度", "机柜", "U位"
    ])
    
    # 格式配置
    编码: str = "utf-8"
    分隔符: str = ","
    跳过空行: bool = True
    自动检测格式: bool = True
    
    def get_field_mapping(self, format_type: str) -> Dict[str, str]:
        """获取字段映射"""
        if format_type == "new":
            return self.新格式字段映射
        elif format_type == "old":
            return self.旧格式字段映射
        else:
            return {}
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "字段映射": {
                "新格式": self.新格式字段映射,
                "旧格式": self.旧格式字段映射
            },
            "默认值": self.默认值,
            "验证配置": {
                "必需字段": self.必需字段
            },
            "格式配置": {
                "编码": self.编码,
                "分隔符": self.分隔符,
                "跳过空行": self.跳过空行,
                "自动检测格式": self.自动检测格式
            }
        }


@dataclass
class ApplicationConfig:
    """应用程序配置类"""
    
    # 基本信息
    应用名称: str = "机柜部署图生成工具"
    版本: str = "0.1.0"
    作者: str = "Cabinet Diagram Generator Team"
    
    # 日志配置
    日志级别: str = "INFO"
    日志文件: str = "logs/cabinet_diagram.log"
    日志格式: str = "{time:YYYY-MM-DD HH:mm:ss} | {level} | {name}:{function}:{line} - {message}"
    日志轮转: bool = True
    日志保留天数: int = 30
    
    # 输出配置
    默认输出目录: str = "output"
    输出文件前缀: str = "cabinet_diagram"
    输出文件格式: str = "drawio"
    自动创建目录: bool = True
    
    # 性能配置
    最大文件大小: int = 100 * 1024 * 1024  # 100MB
    最大设备数量: int = 10000
    超时时间: int = 300  # 5分钟
    
    # 调试配置
    调试模式: bool = False
    详细输出: bool = False
    保存中间结果: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "基本信息": {
                "应用名称": self.应用名称,
                "版本": self.版本,
                "作者": self.作者
            },
            "日志配置": {
                "日志级别": self.日志级别,
                "日志文件": self.日志文件,
                "日志格式": self.日志格式,
                "日志轮转": self.日志轮转,
                "日志保留天数": self.日志保留天数
            },
            "输出配置": {
                "默认输出目录": self.默认输出目录,
                "输出文件前缀": self.输出文件前缀,
                "输出文件格式": self.输出文件格式,
                "自动创建目录": self.自动创建目录
            },
            "性能配置": {
                "最大文件大小": self.最大文件大小,
                "最大设备数量": self.最大设备数量,
                "超时时间": self.超时时间
            },
            "调试配置": {
                "调试模式": self.调试模式,
                "详细输出": self.详细输出,
                "保存中间结果": self.保存中间结果
            }
        }


# 默认配置实例
DEFAULT_DIAGRAM_CONFIG = DiagramConfig()
DEFAULT_LAYOUT_CONFIG = LayoutConfig()
DEFAULT_CSV_CONFIG = CSVConfig()
DEFAULT_APP_CONFIG = ApplicationConfig()
