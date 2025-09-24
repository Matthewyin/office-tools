"""
布局引擎模块

负责机柜设备的智能布局和冲突解决。
"""

from typing import List, Dict, Optional, Tuple
from datetime import datetime
from loguru import logger

from .models import Device, Cabinet, Layout, ConflictInfo, AdjustmentRecord, ConflictType
from .config import LayoutConfig, DEFAULT_LAYOUT_CONFIG
from .utils import LayoutError


class LayoutEngine:
    """布局引擎类"""
    
    def __init__(self, config: Optional[LayoutConfig] = None):
        """
        初始化布局引擎
        
        Args:
            config: 布局配置对象
        """
        self.config = config or DEFAULT_LAYOUT_CONFIG
        self.layout: Optional[Layout] = None
        self.adjustment_count = 0
        
    def create_layout(self, devices: List[Device]) -> Layout:
        """
        创建布局
        
        Args:
            devices: 设备列表
            
        Returns:
            Layout对象
        """
        logger.info(f"开始创建布局，共 {len(devices)} 个设备")
        
        # 创建新的布局对象
        self.layout = Layout()
        self.adjustment_count = 0
        
        # 按机柜分组设备
        cabinet_groups = self._group_devices_by_cabinet(devices)
        
        # 为每个机柜创建布局
        for cabinet_id, cabinet_devices in cabinet_groups.items():
            logger.info(f"处理机柜 {cabinet_id}，设备数量: {len(cabinet_devices)}")
            cabinet = self._create_cabinet_layout(cabinet_id, cabinet_devices)
            self.layout.add_cabinet(cabinet)
        
        # 验证整体布局
        is_valid = self.layout.validate_layout()
        
        logger.info(f"布局创建完成，机柜数: {self.layout.total_cabinets}，"
                   f"设备数: {self.layout.total_devices}，"
                   f"调整次数: {self.adjustment_count}，"
                   f"布局有效: {is_valid}")
        
        return self.layout
    
    def _group_devices_by_cabinet(self, devices: List[Device]) -> Dict[str, List[Device]]:
        """
        按机柜分组设备
        
        Args:
            devices: 设备列表
            
        Returns:
            机柜ID到设备列表的映射
        """
        cabinet_groups = {}
        
        for device in devices:
            cabinet_id = device.full_location
            if cabinet_id not in cabinet_groups:
                cabinet_groups[cabinet_id] = []
            cabinet_groups[cabinet_id].append(device)
        
        return cabinet_groups
    
    def _create_cabinet_layout(self, cabinet_id: str, devices: List[Device]) -> Cabinet:
        """
        创建单个机柜的布局
        
        Args:
            cabinet_id: 机柜ID
            devices: 设备列表
            
        Returns:
            Cabinet对象
        """
        # 解析机柜ID
        parts = cabinet_id.split('-', 1)
        if len(parts) != 2:
            raise LayoutError(f"无效的机柜ID格式: {cabinet_id}")
        
        机房, 机柜 = parts
        
        # 创建机柜对象
        cabinet = Cabinet(
            机房=机房,
            机柜=机柜,
            可用起始U位=self.config.可用起始U位,
            可用结束U位=self.config.可用结束U位
        )
        
        # 按U位排序设备（优先处理指定位置的设备）
        sorted_devices = sorted(devices, key=lambda d: d.U位)
        
        # 处理每个设备
        for device in sorted_devices:
            success = self._place_device_in_cabinet(cabinet, device)
            if not success:
                logger.warning(f"设备 {device.资产编号} 无法放置在机柜 {cabinet_id}")
        
        return cabinet
    
    def _place_device_in_cabinet(self, cabinet: Cabinet, device: Device) -> bool:
        """
        在机柜中放置设备
        
        Args:
            cabinet: 机柜对象
            device: 设备对象
            
        Returns:
            是否成功放置
        """
        original_position = device.U位
        
        # 检查原始位置是否可用
        if cabinet.is_position_available(device.U位, device.设备高度, self.config.设备间隔):
            # 直接放置
            cabinet.add_device(device)
            return True
        
        # 原始位置不可用，需要调整
        if not self.config.允许调整:
            logger.warning(f"设备 {device.资产编号} 位置冲突且不允许调整")
            return False
        
        # 寻找新位置
        new_position = self._find_alternative_position(cabinet, device)
        
        if new_position is None:
            logger.error(f"设备 {device.资产编号} 无法找到合适位置")
            return False
        
        # 调整设备位置
        device.U位 = new_position
        cabinet.add_device(device)
        
        # 记录调整
        adjustment = AdjustmentRecord(
            device=device,
            original_position=original_position,
            new_position=new_position,
            reason=f"原位置U{original_position}冲突，使用{self.config.冲突解决策略.value}策略",
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        )
        
        if self.layout:
            self.layout.add_adjustment_record(adjustment)
        
        self.adjustment_count += 1
        logger.info(f"设备 {device.资产编号} 位置调整: U{original_position} → U{new_position}")
        
        return True
    
    def _find_alternative_position(self, cabinet: Cabinet, device: Device) -> Optional[int]:
        """
        为设备寻找替代位置
        
        Args:
            cabinet: 机柜对象
            device: 设备对象
            
        Returns:
            新的U位位置，如果找不到则返回None
        """
        preferred_position = device.U位
        
        # 根据策略搜索
        if self.config.冲突解决策略 == self.config.冲突解决策略.UPWARD_FIRST:
            return self._search_upward_first(cabinet, device, preferred_position)
        elif self.config.冲突解决策略 == self.config.冲突解决策略.DOWNWARD_FIRST:
            return self._search_downward_first(cabinet, device, preferred_position)
        elif self.config.冲突解决策略 == self.config.冲突解决策略.NEAREST_FIRST:
            return self._search_nearest_first(cabinet, device, preferred_position)
        else:
            # 默认使用向上优先策略
            return self._search_upward_first(cabinet, device, preferred_position)
    
    def _search_upward_first(self, cabinet: Cabinet, device: Device, preferred_position: int) -> Optional[int]:
        """
        向上优先搜索策略
        
        Args:
            cabinet: 机柜对象
            device: 设备对象
            preferred_position: 首选位置
            
        Returns:
            新位置或None
        """
        # 向上搜索
        for pos in range(preferred_position + 1, cabinet.可用结束U位 - device.设备高度 + 2):
            if cabinet.is_position_available(pos, device.设备高度, self.config.设备间隔):
                return pos
        
        # 向下搜索
        for pos in range(preferred_position - 1, cabinet.可用起始U位 - 1, -1):
            if cabinet.is_position_available(pos, device.设备高度, self.config.设备间隔):
                return pos
        
        return None
    
    def _search_downward_first(self, cabinet: Cabinet, device: Device, preferred_position: int) -> Optional[int]:
        """
        向下优先搜索策略
        
        Args:
            cabinet: 机柜对象
            device: 设备对象
            preferred_position: 首选位置
            
        Returns:
            新位置或None
        """
        # 向下搜索
        for pos in range(preferred_position - 1, cabinet.可用起始U位 - 1, -1):
            if cabinet.is_position_available(pos, device.设备高度, self.config.设备间隔):
                return pos
        
        # 向上搜索
        for pos in range(preferred_position + 1, cabinet.可用结束U位 - device.设备高度 + 2):
            if cabinet.is_position_available(pos, device.设备高度, self.config.设备间隔):
                return pos
        
        return None
    
    def _search_nearest_first(self, cabinet: Cabinet, device: Device, preferred_position: int) -> Optional[int]:
        """
        最近优先搜索策略
        
        Args:
            cabinet: 机柜对象
            device: 设备对象
            preferred_position: 首选位置
            
        Returns:
            新位置或None
        """
        max_distance = max(
            preferred_position - cabinet.可用起始U位,
            cabinet.可用结束U位 - preferred_position
        )
        
        for distance in range(1, max_distance + 1):
            # 检查上方位置
            up_pos = preferred_position + distance
            if (up_pos <= cabinet.可用结束U位 - device.设备高度 + 1 and
                cabinet.is_position_available(up_pos, device.设备高度, self.config.设备间隔)):
                return up_pos
            
            # 检查下方位置
            down_pos = preferred_position - distance
            if (down_pos >= cabinet.可用起始U位 and
                cabinet.is_position_available(down_pos, device.设备高度, self.config.设备间隔)):
                return down_pos
        
        return None
    
    def optimize_layout(self, layout: Optional[Layout] = None) -> Layout:
        """
        优化布局
        
        Args:
            layout: 要优化的布局，如果为None则使用当前布局
            
        Returns:
            优化后的布局
        """
        if layout is None:
            layout = self.layout
        
        if layout is None:
            raise LayoutError("没有可用的布局进行优化")
        
        if not self.config.自动优化:
            logger.info("自动优化已禁用")
            return layout
        
        logger.info("开始布局优化")
        
        optimization_count = 0
        
        for cabinet in layout.机柜字典.values():
            # 检查是否需要优化
            if self._needs_optimization(cabinet):
                optimized = self._optimize_cabinet(cabinet)
                if optimized:
                    optimization_count += 1
        
        logger.info(f"布局优化完成，优化了 {optimization_count} 个机柜")
        return layout
    
    def _needs_optimization(self, cabinet: Cabinet) -> bool:
        """
        检查机柜是否需要优化
        
        Args:
            cabinet: 机柜对象
            
        Returns:
            是否需要优化
        """
        # 检查是否有大的空隙
        devices = sorted(cabinet.设备列表, key=lambda d: d.U位)
        
        for i in range(len(devices) - 1):
            current_device = devices[i]
            next_device = devices[i + 1]
            
            gap = next_device.U位 - current_device.end_position - 1
            if gap > self.config.设备间隔 + 2:  # 如果间隙过大
                return True
        
        return False
    
    def _optimize_cabinet(self, cabinet: Cabinet) -> bool:
        """
        优化单个机柜的布局
        
        Args:
            cabinet: 机柜对象
            
        Returns:
            是否进行了优化
        """
        # 简单的紧凑化策略：将设备向下移动以减少空隙
        devices = sorted(cabinet.设备列表, key=lambda d: d.U位)
        optimized = False
        
        # 重新计算占用状态
        cabinet.占用状态 = [False] * (cabinet.可用结束U位 - cabinet.可用起始U位 + 1)
        
        for device in devices:
            # 尝试将设备向下移动
            new_position = cabinet.find_available_position(
                device.设备高度, 
                cabinet.可用起始U位, 
                self.config.设备间隔
            )
            
            if new_position and new_position < device.U位:
                # 记录调整
                adjustment = AdjustmentRecord(
                    device=device,
                    original_position=device.U位,
                    new_position=new_position,
                    reason="布局优化：紧凑化",
                    timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                )
                
                device.U位 = new_position
                optimized = True
                
                if self.layout:
                    self.layout.add_adjustment_record(adjustment)
            
            # 更新占用状态
            start_idx = device.U位 - cabinet.可用起始U位
            end_idx = start_idx + device.设备高度 - 1
            for i in range(max(0, start_idx), min(len(cabinet.占用状态), end_idx + 1)):
                cabinet.占用状态[i] = True
        
        return optimized
    
    def get_layout_report(self, layout: Optional[Layout] = None) -> Dict[str, any]:
        """
        生成布局报告
        
        Args:
            layout: 布局对象，如果为None则使用当前布局
            
        Returns:
            布局报告字典
        """
        if layout is None:
            layout = self.layout
        
        if layout is None:
            return {"错误": "没有可用的布局"}
        
        report = {
            "基本信息": {
                "机柜总数": layout.total_cabinets,
                "设备总数": layout.total_devices,
                "机房数量": len(layout.rooms),
                "调整次数": len(layout.调整记录)
            },
            "利用率统计": layout.get_utilization_summary(),
            "冲突信息": {
                "冲突数量": len(layout.冲突列表),
                "冲突详情": [str(conflict) for conflict in layout.冲突列表[:5]]
            },
            "调整记录": [str(record) for record in layout.调整记录[-10:]]  # 最近10次调整
        }
        
        return report
