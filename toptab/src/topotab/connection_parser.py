"""连接关系解析器"""

import re
import xml.etree.ElementTree as ET
from typing import Dict, List, Any, Optional, Tuple
import logging

from .models import ConnectionRelationship
from .connection_config import ConnectionConfigManager

logger = logging.getLogger(__name__)


class ConnectionParser:
    """连接关系解析器"""
    
    def __init__(self, config_manager: Optional[ConnectionConfigManager] = None):
        """
        初始化连接关系解析器
        
        Args:
            config_manager: 配置管理器，如果为None则创建默认实例
        """
        self.config_manager = config_manager or ConnectionConfigManager()
        self.config = self.config_manager.get_config()
        self.parsing_rules = self.config_manager.get_parsing_rules()
    
    def parse_drawio_file(self, file_path: str) -> List[ConnectionRelationship]:
        """
        解析draw.io文件，提取连接关系
        
        Args:
            file_path: draw.io文件路径
            
        Returns:
            连接关系列表
        """
        try:
            tree = ET.parse(file_path)
            root = tree.getroot()
            
            # 第一遍：收集所有设备节点信息
            device_nodes = self._collect_device_nodes(root)
            
            # 第二遍：解析连接关系
            connections = self._parse_connections(root, device_nodes)
            
            logger.info(f"成功解析 {len(connections)} 条连接关系")
            return connections
            
        except Exception as e:
            logger.error(f"解析draw.io文件失败: {e}")
            return []
    
    def _collect_device_nodes(self, root: ET.Element) -> Dict[str, Dict[str, str]]:
        """
        收集所有设备节点信息
        
        Args:
            root: XML根元素
            
        Returns:
            设备节点字典，键为节点ID，值为设备信息
        """
        device_nodes = {}
        
        for cell in root.findall(".//mxCell"):
            # 跳过边元素
            if cell.attrib.get("edge") == "1":
                continue
            
            # 跳过没有value的元素
            value = cell.attrib.get("value", "").strip()
            if not value:
                continue
            
            cell_id = cell.attrib.get("id", "")
            if not cell_id:
                continue
            
            # 解析设备信息
            device_info = self._parse_device_info(value)
            if device_info.get('device_name'):
                # 解析区域信息
                region_info = self._parse_region_info(cell, root)
                device_info.update(region_info)
                
                device_nodes[cell_id] = device_info
        
        logger.info(f"收集到 {len(device_nodes)} 个设备节点")
        return device_nodes
    
    def _parse_device_info(self, value: str) -> Dict[str, str]:
        """
        解析设备信息
        
        Args:
            value: 设备节点的value属性
            
        Returns:
            设备信息字典
        """
        device_info = {}
        
        # 清理HTML标签
        clean_value = re.sub(r'<[^>]+>', '\n', value)
        clean_value = clean_value.replace('&nbsp;', ' ').replace('&lt;', '<').replace('&gt;', '>')
        
        # 尝试各种解析格式
        node_formats = self.config_manager.get_node_formats()
        for format_config in sorted(node_formats, key=lambda x: x.get('priority', 999)):
            pattern = format_config.get('pattern', '')
            fields = format_config.get('fields', [])
            
            if pattern and fields:
                match = re.match(pattern, clean_value.strip())
                if match:
                    for i, field in enumerate(fields):
                        if i < len(match.groups()):
                            device_info[field] = match.group(i + 1).strip()
                    break
        
        # 如果没有匹配到任何格式，使用原始值作为设备名
        if not device_info.get('device_name'):
            device_info['device_name'] = clean_value.strip()
        
        return device_info
    
    def _parse_region_info(self, cell: ET.Element, root: ET.Element) -> Dict[str, str]:
        """
        解析区域信息
        
        Args:
            cell: 设备节点元素
            root: XML根元素
            
        Returns:
            区域信息字典
        """
        region_info = {'parent_region': '', 'region': ''}
        
        # 查找父级容器
        parent_id = cell.attrib.get("parent", "")
        if parent_id:
            parent_cell = root.find(f".//mxCell[@id='{parent_id}']")
            if parent_cell is not None:
                parent_value = parent_cell.attrib.get("value", "").strip()
                if parent_value:
                    # 清理HTML标签
                    clean_parent_value = re.sub(r'<[^>]+>', '', parent_value)
                    region_info['region'] = clean_parent_value
                    
                    # 查找祖父级容器
                    grandparent_id = parent_cell.attrib.get("parent", "")
                    if grandparent_id:
                        grandparent_cell = root.find(f".//mxCell[@id='{grandparent_id}']")
                        if grandparent_cell is not None:
                            grandparent_value = grandparent_cell.attrib.get("value", "").strip()
                            if grandparent_value:
                                clean_grandparent_value = re.sub(r'<[^>]+>', '', grandparent_value)
                                region_info['parent_region'] = clean_grandparent_value
        
        return region_info
    
    def _parse_connections(self, root: ET.Element, device_nodes: Dict[str, Dict[str, str]]) -> List[ConnectionRelationship]:
        """
        解析连接关系
        
        Args:
            root: XML根元素
            device_nodes: 设备节点字典
            
        Returns:
            连接关系列表
        """
        connections = []
        
        for cell in root.findall(".//mxCell"):
            # 只处理边元素
            if cell.attrib.get("edge") != "1":
                continue
            
            source_id = cell.attrib.get("source", "")
            target_id = cell.attrib.get("target", "")
            
            # 检查源和目标设备是否存在
            if source_id not in device_nodes or target_id not in device_nodes:
                continue
            
            source_device = device_nodes[source_id]
            target_device = device_nodes[target_id]
            
            # 避免自连接
            if (source_device.get('device_name') == target_device.get('device_name') and
                source_device.get('management_address', '') == target_device.get('management_address', '')):
                continue
            
            # 解析端口信息
            source_port, target_port = self._parse_edge_labels(cell)
            
            # 创建连接关系
            connection = ConnectionRelationship()
            
            # 填充源端信息
            connection.source_region = {
                'parent_region': source_device.get('parent_region', ''),
                'region': source_device.get('region', '')
            }
            connection.source_node = {
                'device_name': source_device.get('device_name', ''),
                'device_model': source_device.get('device_model', ''),
                'device_type': source_device.get('device_type', ''),
                'management_address': source_device.get('management_address', ''),
                'cabinet': source_device.get('cabinet', ''),
                'u_position': source_device.get('u_position', '')
            }
            connection.source_port = source_port
            
            # 填充目标端信息
            connection.target_region = {
                'parent_region': target_device.get('parent_region', ''),
                'region': target_device.get('region', '')
            }
            connection.target_node = {
                'device_name': target_device.get('device_name', ''),
                'device_model': target_device.get('device_model', ''),
                'device_type': target_device.get('device_type', ''),
                'management_address': target_device.get('management_address', ''),
                'cabinet': target_device.get('cabinet', ''),
                'u_position': target_device.get('u_position', '')
            }
            connection.target_port = target_port
            
            # 填充链路信息
            connection.link = {
                'sequence': '',
                'usage': '',
                'cable_type': '',
                'bandwidth': '',
                'remarks': ''
            }
            
            connections.append(connection)
        
        return connections
    
    def _parse_edge_labels(self, edge_cell: ET.Element) -> Tuple[Dict[str, str], Dict[str, str]]:
        """
        解析边标签，提取源端口和目标端口信息
        
        Args:
            edge_cell: 边元素
            
        Returns:
            (源端口信息, 目标端口信息)
        """
        source_port = {}
        target_port = {}
        
        # 查找边的所有子元素，寻找edgeLabel
        for child in edge_cell:
            if (child.tag == "mxCell" and
                child.attrib.get("style", "").find("edgeLabel") != -1):
                
                label_text = child.attrib.get("value", "")
                if not label_text:
                    continue
                
                # 获取标签的几何位置信息
                geometry = child.find("mxGeometry")
                if geometry is not None:
                    x_offset = float(geometry.attrib.get("x", "0"))
                    
                    # 根据位置判断是源标签还是目标标签
                    if x_offset <= 0:  # 源标签
                        source_port = self._parse_port_info(label_text)
                    else:  # 目标标签
                        target_port = self._parse_port_info(label_text)
        
        return source_port, target_port
    
    def _parse_port_info(self, label_text: str) -> Dict[str, str]:
        """
        解析端口信息文本
        
        Args:
            label_text: 标签文本
            
        Returns:
            端口信息字典
        """
        port_info = {}
        
        if not label_text:
            return port_info
        
        # 清理HTML标签
        clean_text = re.sub(r'<[^>]+>', '', label_text)
        clean_text = clean_text.replace('&nbsp;', ' ').replace('&lt;', '<').replace('&gt;', '>')
        lines = [line.strip() for line in clean_text.split('\n') if line.strip()]
        
        port_keywords = self.config_manager.get_port_keywords()
        
        for line in lines:
            line_lower = line.lower()
            
            # 检查各种端口关键词
            for port_type, keywords in port_keywords.items():
                if any(keyword in line_lower for keyword in keywords):
                    # 提取值
                    value = self._extract_value(line)
                    if value:
                        port_info[port_type] = value
                    break
        
        return port_info
    
    def _extract_value(self, text: str) -> str:
        """
        从文本中提取值
        
        Args:
            text: 输入文本
            
        Returns:
            提取的值
        """
        # 尝试提取冒号后的值
        if ':' in text:
            return text.split(':', 1)[1].strip()
        
        # 尝试提取等号后的值
        if '=' in text:
            return text.split('=', 1)[1].strip()
        
        # 尝试提取数字和字母组合
        match = re.search(r'([a-zA-Z0-9/\-\.]+)', text)
        if match:
            return match.group(1)
        
        return text.strip()
