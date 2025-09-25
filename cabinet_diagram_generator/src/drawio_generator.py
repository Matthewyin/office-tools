"""
Draw.io XML生成模块

负责生成draw.io格式的机柜部署图XML文件。
"""

import xml.etree.ElementTree as ET
from typing import List, Dict, Optional, Tuple
from pathlib import Path
import base64
import urllib.parse
from loguru import logger

from .models import Layout, Cabinet, Device
from .config import DiagramConfig, DEFAULT_DIAGRAM_CONFIG
from .utils import ensure_directory, create_output_filename


class DrawioGenerator:
    """Draw.io XML生成器类"""
    
    def __init__(self, config: Optional[DiagramConfig] = None):
        """
        初始化生成器
        
        Args:
            config: 图形配置对象
        """
        self.config = config or DEFAULT_DIAGRAM_CONFIG
        self.current_id = 1
        
    def generate_diagram(self, layout: Layout, output_path: Optional[str] = None) -> str:
        """
        生成机柜部署图（每个机房一个sheet页）

        Args:
            layout: 布局对象
            output_path: 输出文件路径，如果为None则自动生成

        Returns:
            输出文件路径
        """
        logger.info(f"开始生成Draw.io图形，机柜数: {layout.total_cabinets}")

        # 创建XML根元素
        root = self._create_root_element()

        # 按机房分组机柜
        rooms = self._group_cabinets_by_room(layout)

        logger.info(f"发现 {len(rooms)} 个机房: {list(rooms.keys())}")

        # 为每个机房创建单独的sheet页
        for room_name, cabinets in rooms.items():
            logger.info(f"为机房 '{room_name}' 创建sheet页，包含 {len(cabinets)} 个机柜")

            # 创建机房的diagram元素
            diagram = self._create_diagram_element(room_name)
            root.append(diagram)

            # 创建图形内容
            graph, root_cell = self._create_graph_element()
            diagram.append(graph)

            # 生成该机房的机柜
            self._generate_room_sheet(root_cell, room_name, cabinets)

        # 生成输出文件
        if output_path is None:
            output_path = create_output_filename("cabinet_diagram", "drawio")

        output_file = Path(output_path)
        ensure_directory(output_file.parent)

        # 写入XML文件
        tree = ET.ElementTree(root)
        ET.indent(tree, space="  ", level=0)
        tree.write(output_file, encoding='utf-8', xml_declaration=True)

        logger.info(f"Draw.io图形生成完成: {output_file}")
        return str(output_file)
    
    def _create_root_element(self) -> ET.Element:
        """创建XML根元素"""
        root = ET.Element("mxfile")
        root.set("host", "app.diagrams.net")
        root.set("modified", "2024-01-01T00:00:00.000Z")
        root.set("agent", "Cabinet Diagram Generator")
        root.set("version", "22.1.11")
        root.set("etag", "cabinet-diagram")
        root.set("type", "device")
        return root
    
    def _create_diagram_element(self, name: str = "机柜部署图") -> ET.Element:
        """创建图形元素"""
        diagram = ET.Element("diagram")
        diagram.set("id", self._get_next_id())
        diagram.set("name", name)
        return diagram
    
    def _create_graph_element(self) -> Tuple[ET.Element, ET.Element]:
        """创建图形内容元素"""
        graph = ET.Element("mxGraphModel")
        graph.set("dx", "1426")
        graph.set("dy", "827")
        graph.set("grid", "1")
        graph.set("gridSize", "10")
        graph.set("guides", "1")
        graph.set("tooltips", "1")
        graph.set("connect", "1")
        graph.set("arrows", "1")
        graph.set("fold", "1")
        graph.set("page", "1")
        graph.set("pageScale", "1")
        graph.set("pageWidth", "827")
        graph.set("pageHeight", "1169")
        graph.set("math", "0")
        graph.set("shadow", "0")

        # 创建根节点
        root_cell = ET.SubElement(graph, "root")

        # 添加默认的两个单元格
        cell0 = ET.SubElement(root_cell, "mxCell")
        cell0.set("id", "0")

        cell1 = ET.SubElement(root_cell, "mxCell")
        cell1.set("id", "1")
        cell1.set("parent", "0")

        return graph, root_cell
    
    def _group_cabinets_by_room(self, layout: Layout) -> Dict[str, List[Cabinet]]:
        """按机房分组机柜"""
        rooms = {}
        for cabinet in layout.机柜字典.values():
            room = cabinet.机房
            if room not in rooms:
                rooms[room] = []
            rooms[room].append(cabinet)
        
        # 按机柜号排序
        for room_cabinets in rooms.values():
            room_cabinets.sort(key=lambda c: c.机柜)
        
        return rooms
    
    def _calculate_total_dimensions(self, rooms: Dict[str, List[Cabinet]]) -> Tuple[int, int]:
        """计算总体尺寸"""
        total_width = 0
        max_height = 0
        
        for cabinets in rooms.values():
            room_width = len(cabinets) * (self.config.机柜宽度 + self.config.机柜间距)
            total_width += room_width + self.config.机房间距
            max_height = max(max_height, self.config.机柜高度 + 100)  # 加上标题高度
        
        return total_width, max_height
    
    def _generate_room(self, parent: ET.Element, room_name: str, 
                      cabinets: List[Cabinet], start_x: int, start_y: int) -> int:
        """
        生成机房
        
        Args:
            parent: 父XML元素
            room_name: 机房名称
            cabinets: 机柜列表
            start_x: 起始X坐标
            start_y: 起始Y坐标
            
        Returns:
            机房宽度
        """
        # 计算机房尺寸
        room_width = len(cabinets) * (self.config.机柜宽度 + self.config.机柜间距) - self.config.机柜间距
        room_height = self.config.机柜高度 + 80  # 加上标题空间
        
        # 生成机房标题
        if self.config.显示机房标题:
            # 机房标题位置需要考虑机柜标题的新位置，进一步上移
            # 机柜框顶端Y坐标就是start_y
            # 机房标题位置：机柜标题上方再留出空间
            room_title_y = start_y - 70  # 机柜标题30 + 间距10 + 机房标题高度30
            self._create_room_title(parent, room_name, start_x, room_title_y, room_width)
        
        # 生成机柜
        current_x = start_x
        for cabinet in cabinets:
            self._generate_cabinet(parent, cabinet, current_x, start_y)
            current_x += self.config.机柜宽度 + self.config.机柜间距
        
        return room_width
    
    def _create_room_title(self, parent: ET.Element, title: str, 
                          x: int, y: int, width: int) -> None:
        """创建机房标题"""
        cell = ET.SubElement(parent, "mxCell")
        cell.set("id", self._get_next_id())
        cell.set("value", title)
        cell.set("style", f"text;html=1;strokeColor=none;fillColor=none;"
                         f"align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;"
                         f"fontSize={self.config.机房标题字体大小};"
                         f"fontColor={self.config.机房标题颜色};fontStyle=1")
        cell.set("vertex", "1")
        cell.set("parent", "1")
        
        geometry = ET.SubElement(cell, "mxGeometry")
        geometry.set("x", str(x))
        geometry.set("y", str(y))
        geometry.set("width", str(width))
        geometry.set("height", "30")
        geometry.set("as", "geometry")

    def _generate_room_sheet(self, parent: ET.Element, room_name: str,
                            cabinets: List[Cabinet]) -> None:
        """
        为单个机房生成sheet页内容

        Args:
            parent: 父XML元素
            room_name: 机房名称
            cabinets: 机柜列表
        """
        # 计算机柜布局
        start_x = 50
        start_y = 50
        current_x = start_x

        # 生成机房标题（可选）
        if self.config.显示机房标题:
            room_width = len(cabinets) * (self.config.机柜宽度 + self.config.机柜间距) - self.config.机柜间距
            # 机房标题位置需要考虑机柜标题的新位置，进一步上移
            # 机柜框顶端Y坐标就是start_y
            # 机房标题位置：机柜标题上方再留出空间
            room_title_y = start_y - 70  # 机柜标题30 + 间距10 + 机房标题高度30
            self._create_room_title(parent, f"机房 {room_name}", start_x, room_title_y, room_width)

        # 生成所有机柜
        for cabinet in cabinets:
            self._generate_cabinet(parent, cabinet, current_x, start_y)
            current_x += self.config.机柜宽度 + self.config.机柜间距

    def _generate_cabinet(self, parent: ET.Element, cabinet: Cabinet,
                         x: int, y: int) -> None:
        """
        生成机柜（网格化视图）

        Args:
            parent: 父XML元素
            cabinet: 机柜对象
            x: X坐标
            y: Y坐标
        """
        # 创建机柜背景框架（白色）
        self._create_cabinet_background(parent, cabinet, x, y)

        # 创建U位网格
        self._create_u_grid(parent, x, y)

        # 创建U位标尺
        if self.config.显示U位标尺:
            self._create_u_ruler(parent, x, y)

        # 创建设备（覆盖在U位网格上）
        for device in cabinet.设备列表:
            self._create_device(parent, device, x, y)

        # 创建机柜标题（只显示机柜编号，不显示区域信息）
        cabinet_title = f"{cabinet.机柜}"

        # 计算机柜标题位置：机柜标题底端与机柜黑色框顶端保持10像素间距
        # 机柜框顶端Y坐标 = U42顶部 = y - 20
        # 机柜标题位置：机柜框顶端上方，标题高度20像素 + 间距10像素
        u42_top_y = y + self.config.机柜高度 - (42 * self.config.U位高度) - self.config.U位高度
        cabinet_title_y = u42_top_y - 30  # 标题高度20 + 间距10

        self._create_cabinet_title(parent, cabinet_title, x, cabinet_title_y)
    
    def _create_cabinet_background(self, parent: ET.Element, cabinet: Cabinet,
                                  x: int, y: int) -> None:
        """创建机柜背景框架"""
        # 机柜背景框应该完全覆盖U1到U42的范围
        # 根据U位网格计算逻辑：
        # U42: u_bottom_y = y + 840 - (42 * 20) = y, u_top_y = y - 20
        # U1: u_bottom_y = y + 840 - (1 * 20) = y + 820, u_top_y = y + 800
        # 所以机柜框应该从U42顶部(y-20)开始，到U1底部(y+820)结束

        u42_top_y = y + self.config.机柜高度 - (42 * self.config.U位高度) - self.config.U位高度
        u1_bottom_y = y + self.config.机柜高度 - (1 * self.config.U位高度) + self.config.U位高度

        cabinet_bg_y = u42_top_y
        cabinet_bg_height = u1_bottom_y - u42_top_y

        cell = ET.SubElement(parent, "mxCell")
        cell.set("id", self._get_next_id())
        cell.set("value", "")
        cell.set("style", f"rounded=0;whiteSpace=wrap;html=1;"
                         f"fillColor=#FFFFFF;"  # 白色背景
                         f"strokeColor={self.config.边框颜色};strokeWidth=2")
        cell.set("vertex", "1")
        cell.set("parent", "1")

        geometry = ET.SubElement(cell, "mxGeometry")
        geometry.set("x", str(x))
        geometry.set("y", str(cabinet_bg_y))  # 从U42顶部开始
        geometry.set("width", str(self.config.机柜宽度))
        geometry.set("height", str(cabinet_bg_height))  # 精确的高度
        geometry.set("as", "geometry")

    def _create_u_grid(self, parent: ET.Element, x: int, y: int) -> None:
        """创建U位网格"""
        for u in range(1, 43):  # U1到U42
            # 计算U位的Y坐标（底部边界）
            u_bottom_y = y + self.config.机柜高度 - (u * self.config.U位高度)
            u_top_y = u_bottom_y - self.config.U位高度

            # 创建U位网格单元
            cell = ET.SubElement(parent, "mxCell")
            cell.set("id", self._get_next_id())
            cell.set("value", "")
            cell.set("style", f"rounded=0;whiteSpace=wrap;html=1;"
                             f"strokeColor=#CCCCCC;"  # 浅灰色边框
                             f"fillColor=none;strokeWidth=1")  # 无填充
            cell.set("vertex", "1")
            cell.set("parent", "1")

            geometry = ET.SubElement(cell, "mxGeometry")
            geometry.set("x", str(x))
            geometry.set("y", str(u_top_y))
            geometry.set("width", str(self.config.机柜宽度))
            geometry.set("height", str(self.config.U位高度))
            geometry.set("as", "geometry")
    
    def _create_u_ruler(self, parent: ET.Element, x: int, y: int) -> None:
        """创建U位标尺"""
        ruler_x = x - 30
        
        for u in range(1, 43):  # U1到U42
            # u_y 表示U位的底部边界Y坐标
            u_y = y + self.config.机柜高度 - (u * self.config.U位高度)

            # 创建U位标签
            cell = ET.SubElement(parent, "mxCell")
            cell.set("id", self._get_next_id())
            cell.set("value", f"U{u}")
            cell.set("style", f"text;html=1;strokeColor=none;fillColor=none;"
                             f"align=right;verticalAlign=bottom;whiteSpace=wrap;rounded=0;"
                             f"fontSize=8;fontColor={self.config.文字颜色}")
            cell.set("vertex", "1")
            cell.set("parent", "1")

            geometry = ET.SubElement(cell, "mxGeometry")
            geometry.set("x", str(ruler_x))
            # 标签底部对齐到U位的底部边界，这样标签就代表该U位的底部边界线
            geometry.set("y", str(u_y - self.config.U位高度))
            geometry.set("width", "25")
            geometry.set("height", str(self.config.U位高度))
            geometry.set("as", "geometry")
    
    def _create_device(self, parent: ET.Element, device: Device,
                      cabinet_x: int, cabinet_y: int) -> None:
        """创建设备（覆盖在U位网格上）"""
        # 设备X坐标：与机柜边界对齐，无内边距
        device_x = cabinet_x

        # 计算设备Y坐标，使设备精确覆盖U位网格
        device_start_u = device.U位  # 设备起始U位
        device_end_u = device.U位 + device.设备高度 - 1  # 设备结束U位

        # 设备顶部Y坐标 = 结束U位的顶部边界
        device_top_y = cabinet_y + self.config.机柜高度 - ((device_end_u + 1) * self.config.U位高度)
        device_y = device_top_y

        # 设备尺寸：完全覆盖U位网格
        device_width = self.config.机柜宽度  # 与机柜同宽
        device_height = device.设备高度 * self.config.U位高度  # 精确覆盖U位

        # 使用统一的设备颜色
        device_color = "#FFFFCC"  # 浅黄色
        
        # 创建设备显示文本
        if self.config.显示模式.value == "详细":
            device_text = device.display_name
        else:
            device_text = device.simple_display_name
        
        if self.config.显示资产编号:
            device_text = f"{device.资产编号}\n{device_text}"
        
        # 创建设备单元格（覆盖在U位网格上）
        cell = ET.SubElement(parent, "mxCell")
        cell.set("id", self._get_next_id())
        cell.set("value", device_text)
        cell.set("style", f"rounded=0;whiteSpace=wrap;html=1;"  # 方角，与网格对齐
                         f"fillColor={device_color};"  # 统一浅黄色
                         f"strokeColor=#000000;"  # 黑色边框，更清晰
                         f"strokeWidth=1;"
                         f"fontSize={self.config.字体大小};"
                         f"fontColor=#000000;"  # 黑色文字
                         f"align=center;verticalAlign=middle")
        cell.set("vertex", "1")
        cell.set("parent", "1")

        geometry = ET.SubElement(cell, "mxGeometry")
        geometry.set("x", str(device_x))
        geometry.set("y", str(device_y))
        geometry.set("width", str(device_width))
        geometry.set("height", str(device_height))
        geometry.set("as", "geometry")
    
    def _create_cabinet_title(self, parent: ET.Element, title: str, 
                             x: int, y: int) -> None:
        """创建机柜标题"""
        cell = ET.SubElement(parent, "mxCell")
        cell.set("id", self._get_next_id())
        cell.set("value", title)
        cell.set("style", f"text;html=1;strokeColor=none;fillColor=none;"
                         f"align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;"
                         f"fontSize={self.config.字体大小};"
                         f"fontColor={self.config.文字颜色};fontStyle=1")
        cell.set("vertex", "1")
        cell.set("parent", "1")
        
        geometry = ET.SubElement(cell, "mxGeometry")
        geometry.set("x", str(x))
        geometry.set("y", str(y))
        geometry.set("width", str(self.config.机柜宽度))
        geometry.set("height", "20")
        geometry.set("as", "geometry")
    
    def _get_next_id(self) -> str:
        """获取下一个ID"""
        id_str = str(self.current_id)
        self.current_id += 1
        return id_str
