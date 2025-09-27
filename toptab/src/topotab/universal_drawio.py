"""
通用drawio写入器

将ConnectionRelationship列表转换为drawio文件，保持多连接支持
"""

import logging
from typing import List, Dict, Set, Tuple, Optional
from pathlib import Path
from dataclasses import dataclass, field

from .universal_format import FormatInfo
from .models import ConnectionRelationship, Device, Link, Endpoint
from .drawio_io import DrawioDocument

logger = logging.getLogger(__name__)


@dataclass
class RegionInfo:
    """区域信息"""
    name: str
    is_parent: bool = False
    children: Set[str] = field(default_factory=set)
    parent: Optional[str] = None
    devices: Set[str] = field(default_factory=set)


@dataclass
class DeviceInfo:
    """设备信息"""
    name: str
    model: str = ""
    device_type: str = ""
    region: str = ""
    parent_region: str = ""
    cabinet: str = ""
    u_position: str = ""
    management_address: str = ""


class UniversalDrawioWriter:
    """通用drawio写入器"""
    
    def __init__(self):
        self.regions: Dict[str, RegionInfo] = {}
        self.devices: Dict[str, DeviceInfo] = {}
        self.region_ids: Dict[str, str] = {}
        self.device_ids: Dict[str, str] = {}
    
    def write_connections_to_drawio(self, 
                                   connections: List[ConnectionRelationship], 
                                   output_path: str,
                                   format_info: FormatInfo) -> None:
        """
        通用drawio写入方法
        
        Args:
            connections: 连接关系列表
            output_path: 输出文件路径
            format_info: 格式信息
        """
        logger.info(f"开始生成drawio文件: {output_path}")
        logger.info(f"连接关系数量: {len(connections)}")
        
        # 重置状态
        self.regions.clear()
        self.devices.clear()
        self.region_ids.clear()
        self.device_ids.clear()
        
        # 1. 提取区域结构
        self._extract_regions(connections)
        logger.info(f"检测到 {len(self.regions)} 个区域")
        
        # 2. 提取设备信息
        self._extract_devices(connections)
        logger.info(f"检测到 {len(self.devices)} 个设备")
        
        # 3. 创建drawio文档
        document = DrawioDocument.from_template(None)
        
        # 4. 生成区域框
        self._create_regions(document)
        
        # 5. 生成设备节点
        self._create_devices(document)
        
        # 6. 生成连接线（保持一对一映射）
        self._create_connections(document, connections)
        
        # 7. 写入文件
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        document.write(output_file)
        logger.info(f"成功生成drawio文件: {output_path}")
    
    def _extract_regions(self, connections: List[ConnectionRelationship]) -> None:
        """提取区域结构（内容无关）"""
        for conn in connections:
            # 处理源端区域
            self._process_endpoint_regions(conn.source_region)
            # 处理目标端区域
            self._process_endpoint_regions(conn.target_region)
        
        # 建立父子关系
        self._establish_region_hierarchy()
    
    def _process_endpoint_regions(self, region_data: Dict[str, str]) -> None:
        """处理端点的区域信息"""
        for field_name, region_name in region_data.items():
            if region_name and region_name.strip():
                region_name = region_name.strip()
                is_parent = 'parent' in field_name.lower() or '父' in field_name

                if region_name not in self.regions:
                    self.regions[region_name] = RegionInfo(name=region_name, is_parent=is_parent)
                elif is_parent:
                    self.regions[region_name].is_parent = True
    
    def _establish_region_hierarchy(self) -> None:
        """建立区域层级关系"""
        # 根据名称相似性和层级关系建立父子关系
        for region_name, region_info in self.regions.items():
            if not region_info.is_parent:
                # 查找可能的父区域
                for parent_name, parent_info in self.regions.items():
                    if parent_info.is_parent and parent_name != region_name:
                        # 简单的层级判断：如果子区域名包含在父区域相关的连接中
                        region_info.parent = parent_name
                        parent_info.children.add(region_name)
                        break
    
    def _extract_devices(self, connections: List[ConnectionRelationship]) -> None:
        """提取设备信息（内容无关）"""
        for conn in connections:
            # 处理源端设备
            self._process_endpoint_device(conn.source_node, conn.source_region)
            # 处理目标端设备
            self._process_endpoint_device(conn.target_node, conn.target_region)
    
    def _process_endpoint_device(self, node_data: Dict[str, str], region_data: Dict[str, str]) -> None:
        """处理端点的设备信息"""
        # 查找设备名称
        device_name = None
        for field_name, value in node_data.items():
            if ('名' in field_name or 'name' in field_name.lower()) and value and value.strip():
                device_name = value.strip()
                break

        if not device_name:
            return

        if device_name not in self.devices:
            # 查找设备型号
            device_model = ''
            for field_name, value in node_data.items():
                if ('型号' in field_name or 'model' in field_name.lower()) and value:
                    device_model = value.strip()
                    break

            # 查找设备类型
            device_type = ''
            for field_name, value in node_data.items():
                if ('类型' in field_name or 'type' in field_name.lower()) and value:
                    device_type = value.strip()
                    break

            # 查找区域信息
            region = ''
            parent_region = ''
            for field_name, value in region_data.items():
                if value and value.strip():
                    if 'parent' in field_name.lower() or '父' in field_name:
                        parent_region = value.strip()
                    else:
                        region = value.strip()

            self.devices[device_name] = DeviceInfo(
                name=device_name,
                model=device_model,
                device_type=device_type,
                region=region,
                parent_region=parent_region,
                cabinet='',
                u_position='',
                management_address=''
            )

            # 将设备添加到对应区域
            if region and region in self.regions:
                self.regions[region].devices.add(device_name)
    
    def _create_regions(self, document: DrawioDocument) -> None:
        """创建区域框"""
        # 首先创建父区域
        parent_regions = [r for r in self.regions.values() if r.is_parent]
        child_regions = [r for r in self.regions.values() if not r.is_parent]
        
        y_offset = 50
        
        # 创建父区域
        for parent_region in parent_regions:
            # 计算父区域大小（基于子区域数量）
            child_count = len(parent_region.children)
            width = max(800, child_count * 300 + 100)
            height = max(400, 300)
            
            region_id = document.add_region(
                name=parent_region.name,
                parent_id=document.layer_id,
                x=50,
                y=y_offset,
                width=width,
                height=height,
                parent_region=""
            )
            self.region_ids[parent_region.name] = region_id
            
            # 在父区域内创建子区域
            child_x = 80
            child_y = y_offset + 50
            
            for child_name in parent_region.children:
                if child_name in self.regions:
                    child_region = self.regions[child_name]
                    device_count = len(child_region.devices)
                    child_width = max(200, device_count * 120 + 50)
                    child_height = max(150, 200)
                    
                    child_id = document.add_region(
                        name=child_region.name,
                        parent_id=region_id,
                        x=child_x,
                        y=child_y,
                        width=child_width,
                        height=child_height,
                        parent_region=parent_region.name
                    )
                    self.region_ids[child_region.name] = child_id
                    
                    child_x += child_width + 30
            
            y_offset += height + 50
        
        # 创建独立的子区域（没有父区域的）
        for child_region in child_regions:
            if not child_region.parent:
                device_count = len(child_region.devices)
                width = max(300, device_count * 120 + 50)
                height = max(200, 250)
                
                region_id = document.add_region(
                    name=child_region.name,
                    parent_id=document.layer_id,
                    x=50,
                    y=y_offset,
                    width=width,
                    height=height,
                    parent_region=""
                )
                self.region_ids[child_region.name] = region_id
                y_offset += height + 50
    
    def _create_devices(self, document: DrawioDocument) -> None:
        """创建设备节点"""
        for device_name, device_info in self.devices.items():
            # 确定设备位置
            region_name = device_info.region
            if region_name and region_name in self.region_ids:
                # 在区域内放置设备
                region_devices = list(self.regions[region_name].devices)
                device_index = region_devices.index(device_name) if device_name in region_devices else 0
                
                # 计算设备在区域内的位置
                devices_per_row = 3
                row = device_index // devices_per_row
                col = device_index % devices_per_row
                
                # 获取区域边界（这里简化处理，实际应该从document获取）
                base_x = 100 + col * 120
                base_y = 150 + row * 80
                
                if region_name in self.regions and self.regions[region_name].parent:
                    # 子区域内的设备
                    base_x += 80
                    base_y += 50
            else:
                # 独立设备
                base_x = 100
                base_y = 100
            
            # 创建Device对象
            device = Device(
                device_name=device_name,
                management_address=device_info.management_address,
                parent_region=device_info.parent_region,
                region=device_info.region,
                device_model=device_info.model,
                device_type=device_info.device_type,
                cabinet=device_info.cabinet,
                u_position=device_info.u_position
            )

            # 确定父区域ID
            parent_id = document.layer_id
            if device_info.region and device_info.region in self.region_ids:
                parent_id = self.region_ids[device_info.region]

            device_id = document.add_device(
                device=device,
                parent_id=parent_id,
                x=base_x,
                y=base_y,
                width=100,
                height=60
            )
            self.device_ids[device_name] = device_id
    
    def _create_connections(self, document: DrawioDocument, connections: List[ConnectionRelationship]) -> None:
        """创建连接线（保持一对一映射）"""
        logger.info(f"开始创建 {len(connections)} 条连接线")
        
        for i, conn in enumerate(connections, 1):
            try:
                # 获取源端和目标端设备名称
                source_device = ''
                for field_name, value in conn.source_node.items():
                    if ('名' in field_name or 'name' in field_name.lower()) and value:
                        source_device = value.strip()
                        break

                target_device = ''
                for field_name, value in conn.target_node.items():
                    if ('名' in field_name or 'name' in field_name.lower()) and value:
                        target_device = value.strip()
                        break
                
                if not source_device or not target_device:
                    logger.warning(f"第 {i} 条连接缺少设备名称，跳过")
                    continue
                
                if source_device not in self.device_ids or target_device not in self.device_ids:
                    logger.warning(f"第 {i} 条连接的设备未找到: {source_device} -> {target_device}")
                    continue
                
                source_id = self.device_ids[source_device]
                target_id = self.device_ids[target_device]
                
                # 构建连接标签
                label_parts = []
                
                # 源端信息
                source_parts = []
                for field_name, value in conn.source_port.items():
                    if value and value.strip():
                        if 'interface' in field_name.lower() or '接口' in field_name:
                            source_parts.append(value.strip())
                        elif 'vlan' in field_name.lower():
                            source_parts.append(f"VLAN:{value.strip()}")
                if source_parts:
                    label_parts.append(" ".join(source_parts))

                # 链路信息
                link_parts = []
                for field_name, value in conn.link.items():
                    if value and value.strip():
                        if '用途' in field_name or 'purpose' in field_name.lower():
                            link_parts.append(value.strip())
                        elif '线缆' in field_name or 'cable' in field_name.lower():
                            link_parts.append(value.strip())
                        elif '带宽' in field_name or 'bandwidth' in field_name.lower():
                            link_parts.append(value.strip())
                if link_parts:
                    label_parts.append(" ".join(link_parts))

                # 创建源端点
                source_endpoint = Endpoint()
                for field_name, value in conn.source_node.items():
                    if ('名' in field_name or 'name' in field_name.lower()) and value:
                        source_endpoint.device_name = value.strip()
                    elif ('型号' in field_name or 'model' in field_name.lower()) and value:
                        source_endpoint.device_model = value.strip()
                    elif ('类型' in field_name or 'type' in field_name.lower()) and value:
                        source_endpoint.device_type = value.strip()
                    elif ('地址' in field_name or 'address' in field_name.lower()) and value:
                        source_endpoint.management_address = value.strip()

                for field_name, value in conn.source_region.items():
                    if value and value.strip():
                        if 'parent' in field_name.lower() or '父' in field_name:
                            source_endpoint.parent_region = value.strip()
                        else:
                            source_endpoint.region = value.strip()

                for field_name, value in conn.source_port.items():
                    if value and value.strip():
                        if 'interface' in field_name.lower() or '接口' in field_name:
                            source_endpoint.physical_interface = value.strip()
                        elif 'vlan' in field_name.lower():
                            source_endpoint.vlan = value.strip()
                        elif 'channel' in field_name.lower() or '通道' in field_name:
                            source_endpoint.port_channel = value.strip()
                        elif 'ip' in field_name.lower():
                            source_endpoint.interface_ip = value.strip()

                # 创建目标端点
                target_endpoint = Endpoint()
                for field_name, value in conn.target_node.items():
                    if ('名' in field_name or 'name' in field_name.lower()) and value:
                        target_endpoint.device_name = value.strip()
                    elif ('型号' in field_name or 'model' in field_name.lower()) and value:
                        target_endpoint.device_model = value.strip()
                    elif ('类型' in field_name or 'type' in field_name.lower()) and value:
                        target_endpoint.device_type = value.strip()
                    elif ('地址' in field_name or 'address' in field_name.lower()) and value:
                        target_endpoint.management_address = value.strip()

                for field_name, value in conn.target_region.items():
                    if value and value.strip():
                        if 'parent' in field_name.lower() or '父' in field_name:
                            target_endpoint.parent_region = value.strip()
                        else:
                            target_endpoint.region = value.strip()

                for field_name, value in conn.target_port.items():
                    if value and value.strip():
                        if 'interface' in field_name.lower() or '接口' in field_name:
                            target_endpoint.physical_interface = value.strip()
                        elif 'vlan' in field_name.lower():
                            target_endpoint.vlan = value.strip()
                        elif 'channel' in field_name.lower() or '通道' in field_name:
                            target_endpoint.port_channel = value.strip()
                        elif 'ip' in field_name.lower():
                            target_endpoint.interface_ip = value.strip()

                # 创建链路对象
                link = Link(
                    src=source_endpoint,
                    dst=target_endpoint
                )

                # 设置链路属性
                for field_name, value in conn.link.items():
                    if value and value.strip():
                        if '序号' in field_name or 'number' in field_name.lower():
                            link.sequence = value.strip()
                        elif '用途' in field_name or 'purpose' in field_name.lower():
                            link.usage = value.strip()
                        elif '线缆' in field_name or 'cable' in field_name.lower():
                            link.cable_type = value.strip()
                        elif '带宽' in field_name or 'bandwidth' in field_name.lower():
                            link.bandwidth = value.strip()
                        elif '备注' in field_name or 'remark' in field_name.lower():
                            link.remark = value.strip()

                # 创建连接线
                document.add_link(
                    link=link,
                    source_id=source_id,
                    target_id=target_id
                )
                
            except Exception as e:
                logger.error(f"创建第 {i} 条连接失败: {e}")
                continue
        
        logger.info("连接线创建完成")
