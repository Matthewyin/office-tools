"""
数据模型定义

包含机柜部署图生成工具的核心数据模型类。
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from enum import Enum


class DevicePurpose(Enum):
    """设备用途枚举"""
    WEB_SERVICE = "Web服务"
    DATABASE = "数据库"
    STORAGE = "存储"
    NETWORK_CORE = "网络核心"
    NETWORK_ACCESS = "网络接入"
    APPLICATION = "应用服务"
    SECURITY = "安全防护"
    LOAD_BALANCER = "负载均衡"
    BACKUP = "备份"
    MONITORING = "监控"
    MANAGEMENT = "管理设备"
    CACHE = "缓存服务"
    POWER = "电源设备"
    OTHER = "其他"


class ConflictType(Enum):
    """冲突类型枚举"""
    POSITION_OVERLAP = "位置重叠"
    SPACE_OVERFLOW = "空间越界"
    SPACING_INSUFFICIENT = "间隔不足"
    INVALID_POSITION = "无效位置"


@dataclass
class Device:
    """设备数据模型"""
    资产编号: str
    区域: str
    子区: str
    设备用途: str
    设备名: str
    型号: str
    设备高度: int  # 标准化为整数U位
    机房: str
    机柜: str
    U位: int  # 标准化为整数位置
    厂商: str
    
    # 可选字段
    备注: str = ""
    
    def __post_init__(self):
        """数据验证和标准化"""
        if self.设备高度 <= 0:
            raise ValueError(f"设备高度必须大于0，当前值: {self.设备高度}")
        if self.U位 <= 0:
            raise ValueError(f"U位必须大于0，当前值: {self.U位}")
    
    @property
    def end_position(self) -> int:
        """设备结束位置"""
        return self.U位 + self.设备高度 - 1
    
    @property
    def full_location(self) -> str:
        """完整位置信息"""
        return f"{self.机房}-{self.机柜}"
    
    @property
    def display_name(self) -> str:
        """显示名称（用于图形显示）"""
        return f"{self.设备名}\n{self.型号}\n({self.厂商})"
    
    @property
    def simple_display_name(self) -> str:
        """简洁显示名称"""
        return f"{self.设备名}\n{self.型号}"
    
    @property
    def location_info(self) -> str:
        """位置信息"""
        return f"{self.区域}/{self.子区}"
    
    @property
    def position_range(self) -> str:
        """位置范围描述"""
        if self.设备高度 == 1:
            return f"U{self.U位}"
        else:
            return f"U{self.U位}-U{self.end_position}"
    
    def overlaps_with(self, other: 'Device') -> bool:
        """检查是否与其他设备重叠"""
        if self.full_location != other.full_location:
            return False
        return not (self.end_position < other.U位 or other.end_position < self.U位)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "资产编号": self.资产编号,
            "区域": self.区域,
            "子区": self.子区,
            "设备用途": self.设备用途,
            "设备名": self.设备名,
            "型号": self.型号,
            "设备高度": self.设备高度,
            "机房": self.机房,
            "机柜": self.机柜,
            "U位": self.U位,
            "厂商": self.厂商,
            "备注": self.备注
        }


@dataclass
class ConflictInfo:
    """冲突信息"""
    conflict_type: ConflictType
    device1: Device
    device2: Optional[Device] = None
    description: str = ""
    suggested_position: Optional[int] = None
    
    def __str__(self) -> str:
        if self.device2:
            return f"{self.conflict_type.value}: {self.device1.资产编号} 与 {self.device2.资产编号} - {self.description}"
        else:
            return f"{self.conflict_type.value}: {self.device1.资产编号} - {self.description}"


@dataclass
class AdjustmentRecord:
    """调整记录"""
    device: Device
    original_position: int
    new_position: int
    reason: str
    timestamp: str = ""
    
    def __str__(self) -> str:
        return f"{self.device.资产编号}: U{self.original_position} → U{self.new_position} ({self.reason})"


@dataclass
class Cabinet:
    """机柜数据模型"""
    机房: str
    机柜: str
    区域: str = ""
    子区: str = ""
    设备列表: List[Device] = field(default_factory=list)
    占用状态: List[bool] = field(default_factory=lambda: [False] * 37)  # U3-U39
    
    # 配置参数
    可用起始U位: int = 3
    可用结束U位: int = 39
    
    def __post_init__(self):
        """初始化后处理"""
        # 如果有设备列表，自动设置区域信息
        if self.设备列表 and not self.区域:
            first_device = self.设备列表[0]
            self.区域 = first_device.区域
            self.子区 = first_device.子区
    
    @property
    def full_id(self) -> str:
        """完整机柜标识"""
        return f"{self.机房}-{self.机柜}"
    
    @property
    def location_info(self) -> str:
        """位置信息"""
        if self.区域 and self.子区:
            return f"{self.区域}/{self.子区}"
        return ""
    
    @property
    def available_space(self) -> int:
        """可用空间（U位数）"""
        return sum(1 for occupied in self.占用状态 if not occupied)
    
    @property
    def utilization_rate(self) -> float:
        """利用率（百分比）"""
        total_space = len(self.占用状态)
        used_space = sum(1 for occupied in self.占用状态 if occupied)
        return (used_space / total_space) * 100 if total_space > 0 else 0.0
    
    def add_device(self, device: Device) -> bool:
        """添加设备到机柜"""
        if device.full_location != self.full_id:
            return False
        
        if device not in self.设备列表:
            self.设备列表.append(device)
            self._update_occupation_status()
            
            # 更新区域信息
            if not self.区域:
                self.区域 = device.区域
                self.子区 = device.子区
        
        return True
    
    def remove_device(self, device_id: str) -> bool:
        """移除设备"""
        for i, device in enumerate(self.设备列表):
            if device.资产编号 == device_id:
                del self.设备列表[i]
                self._update_occupation_status()
                return True
        return False
    
    def get_device_by_id(self, device_id: str) -> Optional[Device]:
        """根据ID获取设备"""
        for device in self.设备列表:
            if device.资产编号 == device_id:
                return device
        return None
    
    def get_devices_by_purpose(self, purpose: str) -> List[Device]:
        """根据用途获取设备"""
        return [device for device in self.设备列表 if device.设备用途 == purpose]
    
    def is_position_available(self, start_u: int, height: int, spacing: int = 1) -> bool:
        """检查位置是否可用（包含间隔检查）"""
        # 检查范围是否在可用区域内
        if start_u < self.可用起始U位 or start_u + height - 1 > self.可用结束U位:
            return False
        
        # 转换为数组索引（U3对应索引0）
        start_idx = start_u - self.可用起始U位
        end_idx = start_idx + height - 1
        
        # 检查设备位置是否被占用
        for i in range(start_idx, end_idx + 1):
            if i >= len(self.占用状态) or self.占用状态[i]:
                return False
        
        # 检查上方间隔
        if start_idx > 0 and spacing > 0:
            for i in range(max(0, start_idx - spacing), start_idx):
                if i < len(self.占用状态) and self.占用状态[i]:
                    return False
        
        # 检查下方间隔
        if end_idx < len(self.占用状态) - 1 and spacing > 0:
            for i in range(end_idx + 1, min(len(self.占用状态), end_idx + 1 + spacing)):
                if self.占用状态[i]:
                    return False
        
        return True
    
    def find_available_position(self, height: int, preferred_position: Optional[int] = None, spacing: int = 1) -> Optional[int]:
        """寻找可用位置"""
        # 首先尝试首选位置
        if preferred_position and self.is_position_available(preferred_position, height, spacing):
            return preferred_position
        
        # 向上搜索
        if preferred_position:
            for pos in range(preferred_position + 1, self.可用结束U位 - height + 2):
                if self.is_position_available(pos, height, spacing):
                    return pos
        
        # 向下搜索
        if preferred_position:
            for pos in range(preferred_position - 1, self.可用起始U位 - 1, -1):
                if self.is_position_available(pos, height, spacing):
                    return pos
        
        # 全范围搜索
        for pos in range(self.可用起始U位, self.可用结束U位 - height + 2):
            if self.is_position_available(pos, height, spacing):
                return pos
        
        return None
    
    def check_conflicts(self) -> List[ConflictInfo]:
        """检查设备冲突"""
        conflicts = []
        
        for i, device1 in enumerate(self.设备列表):
            # 检查位置是否越界
            if device1.U位 < self.可用起始U位 or device1.end_position > self.可用结束U位:
                conflicts.append(ConflictInfo(
                    conflict_type=ConflictType.SPACE_OVERFLOW,
                    device1=device1,
                    description=f"设备位置 {device1.position_range} 超出可用范围 U{self.可用起始U位}-U{self.可用结束U位}"
                ))
            
            # 检查与其他设备的重叠
            for j, device2 in enumerate(self.设备列表[i+1:], i+1):
                if device1.overlaps_with(device2):
                    conflicts.append(ConflictInfo(
                        conflict_type=ConflictType.POSITION_OVERLAP,
                        device1=device1,
                        device2=device2,
                        description=f"位置重叠: {device1.position_range} 与 {device2.position_range}"
                    ))
        
        return conflicts
    
    def _update_occupation_status(self):
        """更新占用状态"""
        # 重置占用状态
        self.占用状态 = [False] * (self.可用结束U位 - self.可用起始U位 + 1)
        
        # 标记已占用位置
        for device in self.设备列表:
            start_idx = device.U位 - self.可用起始U位
            end_idx = start_idx + device.设备高度 - 1
            
            for i in range(max(0, start_idx), min(len(self.占用状态), end_idx + 1)):
                if 0 <= i < len(self.占用状态):
                    self.占用状态[i] = True
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "机房": self.机房,
            "机柜": self.机柜,
            "区域": self.区域,
            "子区": self.子区,
            "设备数量": len(self.设备列表),
            "可用空间": self.available_space,
            "利用率": round(self.utilization_rate, 2),
            "设备列表": [device.to_dict() for device in self.设备列表]
        }


@dataclass
class Layout:
    """布局数据模型"""
    机柜字典: Dict[str, Cabinet] = field(default_factory=dict)
    布局报告: List[str] = field(default_factory=list)
    冲突列表: List[ConflictInfo] = field(default_factory=list)
    调整记录: List[AdjustmentRecord] = field(default_factory=list)

    @property
    def total_cabinets(self) -> int:
        """机柜总数"""
        return len(self.机柜字典)

    @property
    def total_devices(self) -> int:
        """设备总数"""
        return sum(len(cabinet.设备列表) for cabinet in self.机柜字典.values())

    @property
    def rooms(self) -> List[str]:
        """获取所有机房列表"""
        rooms = set()
        for cabinet in self.机柜字典.values():
            rooms.add(cabinet.机房)
        return sorted(list(rooms))

    @property
    def areas(self) -> List[str]:
        """获取所有区域列表"""
        areas = set()
        for cabinet in self.机柜字典.values():
            if cabinet.区域:
                areas.add(cabinet.区域)
        return sorted(list(areas))

    def add_cabinet(self, cabinet: Cabinet) -> None:
        """添加机柜"""
        self.机柜字典[cabinet.full_id] = cabinet

    def get_cabinet(self, cabinet_id: str) -> Optional[Cabinet]:
        """获取机柜"""
        return self.机柜字典.get(cabinet_id)

    def get_cabinets_by_room(self, room: str) -> List[Cabinet]:
        """根据机房获取机柜列表"""
        return [cabinet for cabinet in self.机柜字典.values() if cabinet.机房 == room]

    def get_cabinets_by_area(self, area: str) -> List[Cabinet]:
        """根据区域获取机柜列表"""
        return [cabinet for cabinet in self.机柜字典.values() if cabinet.区域 == area]

    def get_devices_by_purpose(self, purpose: str) -> List[Device]:
        """根据用途获取所有设备"""
        devices = []
        for cabinet in self.机柜字典.values():
            devices.extend(cabinet.get_devices_by_purpose(purpose))
        return devices

    def get_utilization_summary(self) -> Dict[str, float]:
        """获取利用率摘要"""
        if not self.机柜字典:
            return {}

        summary = {}

        # 总体利用率
        total_space = sum(len(cabinet.占用状态) for cabinet in self.机柜字典.values())
        used_space = sum(sum(cabinet.占用状态) for cabinet in self.机柜字典.values())
        summary["总体利用率"] = (used_space / total_space * 100) if total_space > 0 else 0.0

        # 按机房统计
        for room in self.rooms:
            cabinets = self.get_cabinets_by_room(room)
            room_total = sum(len(cabinet.占用状态) for cabinet in cabinets)
            room_used = sum(sum(cabinet.占用状态) for cabinet in cabinets)
            summary[f"{room}利用率"] = (room_used / room_total * 100) if room_total > 0 else 0.0

        return summary

    def validate_layout(self) -> bool:
        """验证布局有效性"""
        self.冲突列表.clear()

        for cabinet in self.机柜字典.values():
            conflicts = cabinet.check_conflicts()
            self.冲突列表.extend(conflicts)

        return len(self.冲突列表) == 0

    def add_adjustment_record(self, record: AdjustmentRecord) -> None:
        """添加调整记录"""
        self.调整记录.append(record)

    def add_report_message(self, message: str) -> None:
        """添加报告信息"""
        self.布局报告.append(message)

    def get_layout_statistics(self) -> Dict[str, Any]:
        """获取布局统计信息"""
        stats = {
            "机柜总数": self.total_cabinets,
            "设备总数": self.total_devices,
            "机房数量": len(self.rooms),
            "区域数量": len(self.areas),
            "冲突数量": len(self.冲突列表),
            "调整次数": len(self.调整记录),
            "利用率统计": self.get_utilization_summary()
        }

        # 设备用途统计
        purpose_count = {}
        for cabinet in self.机柜字典.values():
            for device in cabinet.设备列表:
                purpose = device.设备用途
                purpose_count[purpose] = purpose_count.get(purpose, 0) + 1
        stats["设备用途统计"] = purpose_count

        return stats

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "统计信息": self.get_layout_statistics(),
            "机柜信息": {cabinet_id: cabinet.to_dict() for cabinet_id, cabinet in self.机柜字典.items()},
            "冲突列表": [str(conflict) for conflict in self.冲突列表],
            "调整记录": [str(record) for record in self.调整记录],
            "布局报告": self.布局报告
        }
