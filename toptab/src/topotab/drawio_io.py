from __future__ import annotations

import datetime as dt
import html
from collections import defaultdict
from pathlib import Path
from typing import Dict, Optional
import xml.etree.ElementTree as ET

from .layout import LayoutEngine
from .models import Device, Endpoint, Link, Topology

DEFAULT_REGION_STYLE = (
    "swimlane;fontStyle=1;align=center;verticalAlign=top;horizontal=1;"
    "startSize=40;collapsible=0;marginBottom=0;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=18;"
)
DEFAULT_DEVICE_STYLE = (
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=16;"
)
DEFAULT_EDGE_STYLE = (
    "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;"
    "html=1;strokeColor=#000000;orthogonal=1;endArrow=classic;endFill=1;"
)


class IdGenerator:
    def __init__(self, start: int = 2) -> None:
        self.counter = start

    def new(self, prefix: str = "id") -> str:
        value = f"{prefix}_{self.counter}"
        self.counter += 1
        return value


class DrawioDocument:
    """Minimal draw.io XML document helper."""

    def __init__(
        self,
        tree: ET.ElementTree,
        mxfile: ET.Element,
        diagram: ET.Element,
        graph_model: ET.Element,
        root: ET.Element,
        layer_id: str,
    ) -> None:
        self.tree = tree
        self.mxfile = mxfile
        self.diagram = diagram
        self.graph_model = graph_model
        self.root = root
        self.layer_id = layer_id
        self.id_gen = IdGenerator(self._find_max_numeric_id())
        self._edge_multiplicity: Dict[tuple[str, str], int] = defaultdict(int)

    @classmethod
    def from_template(cls, template: Optional[Path]) -> "DrawioDocument":
        if template and template.exists():
            tree = ET.parse(template)
            mxfile = tree.getroot()
            diagram = tree.find("diagram")
            if diagram is not None:
                graph_model = diagram.find("mxGraphModel")
                if graph_model is not None:
                    root = graph_model.find("root")
                    if root is not None:
                        cls._reset_root(root)
                        layer_id = cls._ensure_layer(root)
                        return cls(
                            tree=tree,
                            mxfile=mxfile,
                            diagram=diagram,
                            graph_model=graph_model,
                            root=root,
                            layer_id=layer_id,
                        )
        return cls._create_blank()

    @classmethod
    def _create_blank(cls) -> "DrawioDocument":
        mxfile = ET.Element(
            "mxfile",
            {
                "host": "app.diagrams.net",
                "modified": dt.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                "agent": "Codex",
                "version": "1.0",
            },
        )
        diagram = ET.SubElement(mxfile, "diagram", {"id": "topology", "name": "Topology"})
        graph_model = ET.SubElement(
            diagram,
            "mxGraphModel",
            {
                "dx": "1000",
                "dy": "1000",
                "grid": "1",
                "gridSize": "10",
                "guides": "1",
                "tooltips": "1",
                "connect": "1",
                "arrows": "1",
                "fold": "1",
                "page": "1",
                "pageScale": "1",
                "pageWidth": "1654",
                "pageHeight": "2339",
                "math": "0",
                "shadow": "0",
            },
        )
        root = ET.SubElement(graph_model, "root")
        ET.SubElement(root, "mxCell", {"id": "0"})
        layer_id = "1"
        ET.SubElement(root, "mxCell", {"id": layer_id, "parent": "0"})
        tree = ET.ElementTree(mxfile)
        return cls(
            tree=tree,
            mxfile=mxfile,
            diagram=diagram,
            graph_model=graph_model,
            root=root,
            layer_id=layer_id,
        )

    @staticmethod
    def _reset_root(root: ET.Element) -> None:
        for cell in list(root):
            cell_id = cell.attrib.get("id")
            if cell_id not in {"0", "1"}:
                root.remove(cell)

    @staticmethod
    def _ensure_layer(root: ET.Element) -> str:
        layer = root.find("mxCell[@id='1']")
        if layer is None:
            layer = ET.SubElement(root, "mxCell", {"id": "1", "parent": "0"})
        return layer.attrib["id"]

    def _find_max_numeric_id(self) -> int:
        max_id = 2
        for cell in self.root.findall("mxCell"):
            cell_id = cell.attrib.get("id", "")
            if "_" in cell_id:
                try:
                    number = int(cell_id.split("_")[-1])
                    max_id = max(max_id, number + 1)
                except ValueError:
                    continue
        return max_id

    def add_region(
        self,
        name: str,
        parent_id: str,
        x: float,
        y: float,
        width: float,
        height: float,
        parent_region: str,
        style: str = DEFAULT_REGION_STYLE,
    ) -> str:
        cell_id = self.id_gen.new("region")
        cell = ET.SubElement(
            self.root,
            "mxCell",
            {
                "id": cell_id,
                "value": html.escape(name),
                "style": style,
                "vertex": "1",
                "parent": parent_id,
                "data_type": "region",
                "data_name": name,
                "data_parent_name": parent_region,
            },
        )
        ET.SubElement(
            cell,
            "mxGeometry",
            {
                "x": str(int(round(x))),
                "y": str(int(round(y))),
                "width": str(int(round(width))),
                "height": str(int(round(height))),
                "as": "geometry",
            },
        )
        return cell_id

    def add_device(
        self,
        device: Device,
        parent_id: str,
        x: float,
        y: float,
        width: float,
        height: float,
        style: str = DEFAULT_DEVICE_STYLE,
    ) -> str:
        cell_id = self.id_gen.new("device")
        label = self._render_device_label(device)
        attributes = {
            "id": cell_id,
            "value": label,
            "style": style,
            "vertex": "1",
            "parent": parent_id,
            "data_type": "device",
            "data_device_name": device.device_name,
            "data_management_address": device.management_address,
            "data_region": device.region,
            "data_parent_region": device.parent_region,
            "data_device_model": device.device_model,
            "data_device_type": device.device_type,
            "data_cabinet": device.cabinet,
            "data_u_position": device.u_position,
        }
        cell = ET.SubElement(self.root, "mxCell", attributes)
        ET.SubElement(
            cell,
            "mxGeometry",
            {
                "x": str(int(round(x))),
                "y": str(int(round(y))),
                "width": str(int(round(width))),
                "height": str(int(round(height))),
                "as": "geometry",
            },
        )
        return cell_id

    def add_link(
        self,
        link: Link,
        source_id: str,
        target_id: str,
        style: str = DEFAULT_EDGE_STYLE,
    ) -> str:
        cell_id = self.id_gen.new("edge")
        attributes = {
            "id": cell_id,
            "edge": "1",
            "parent": self.layer_id,
            "source": source_id,
            "target": target_id,
            "style": style,
            "value": "",
            "data_type": "link",
            "data_sequence": link.sequence,
            "data_usage": link.usage,
            "data_cable_type": link.cable_type,
            "data_bandwidth": link.bandwidth,
            "data_remark": link.remark,
            "data_src_device_name": link.src.device_name,
            "data_src_management_address": link.src.management_address,
            "data_src_parent_region": link.src.parent_region,
            "data_src_region": link.src.region,
            "data_src_device_model": link.src.device_model,
            "data_src_device_type": link.src.device_type,
            "data_src_cabinet": link.src.cabinet,
            "data_src_u_position": link.src.u_position,
            "data_src_port_channel": link.src.port_channel,
            "data_src_physical_interface": link.src.physical_interface,
            "data_src_vrf": link.src.vrf,
            "data_src_vlan": link.src.vlan,
            "data_src_interface_ip": link.src.interface_ip,
            "data_dst_device_name": link.dst.device_name,
            "data_dst_management_address": link.dst.management_address,
            "data_dst_parent_region": link.dst.parent_region,
            "data_dst_region": link.dst.region,
            "data_dst_device_model": link.dst.device_model,
            "data_dst_device_type": link.dst.device_type,
            "data_dst_cabinet": link.dst.cabinet,
            "data_dst_u_position": link.dst.u_position,
            "data_dst_port_channel": link.dst.port_channel,
            "data_dst_physical_interface": link.dst.physical_interface,
            "data_dst_vrf": link.dst.vrf,
            "data_dst_vlan": link.dst.vlan,
            "data_dst_interface_ip": link.dst.interface_ip,
        }

        # 边的主标签保持为空，使用分离的端点标签
        # attributes["value"] = ""  # 已经在上面设置为空字符串

        for key, value in link.extra.items():
            if value:
                safe_key = key.replace(" ", "_")
                attributes[f"data_extra_{safe_key}"] = value
        cell = ET.SubElement(self.root, "mxCell", attributes)
        geometry = ET.SubElement(cell, "mxGeometry", {"relative": "1", "as": "geometry"})
        offset = self._next_edge_offset(source_id, target_id)
        if offset:
            points = ET.SubElement(geometry, "Array", {"as": "points"})
            ET.SubElement(points, "mxPoint", {"x": str(offset), "y": "0"})
        ET.SubElement(geometry, "mxPoint", {"x": "0", "y": "0", "as": "targetPoint"})

        # 添加源端标签（靠近源节点）
        src_label = self._build_simple_endpoint_text(link.src)
        if src_label:
            self._add_edge_text_label(cell_id, src_label, x_offset=-0.8, source=True)

        # 添加目标端标签（靠近目标节点）
        dst_label = self._build_simple_endpoint_text(link.dst)
        if dst_label:
            self._add_edge_text_label(cell_id, dst_label, x_offset=0.8, source=False)

        return cell_id

    def write(self, path: Path) -> None:
        self.mxfile.set("modified", dt.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"))
        path.parent.mkdir(parents=True, exist_ok=True)
        self.tree.write(path, encoding="utf-8", xml_declaration=True)

    @staticmethod
    def _render_device_label(device: Device) -> str:
        name = html.escape(device.device_name or "Unnamed device")
        management = html.escape((device.management_address or "").strip())
        if management:
            return f"<div><b>{name}</b><br/>{management}</div>"
        return f"<div><b>{name}</b></div>"

    def _next_edge_offset(self, source_id: str, target_id: str) -> float:
        key = tuple(sorted((source_id, target_id)))
        index = self._edge_multiplicity[key]
        self._edge_multiplicity[key] += 1
        if index == 0:
            return 0.0
        direction = -1 if index % 2 else 1
        step = (index + 1) // 2
        return direction * step * 80.0

    def _add_edge_endpoint_label(self, edge_id: str, text: str, x_offset: float, align: str, *, source: bool) -> None:
        if not text:
            return
        label_id = self.id_gen.new("edgeLabel")
        # 为源和目标标签使用不同的背景色来区分
        bg_color = "#e1f5fe" if source else "#fff3e0"
        style = (
            f"edgeLabel;html=1;align={align};verticalAlign=top;resizable=0;"
            f"points=[];fontSize=10;fontColor=#000000;"
            f"labelBackgroundColor={bg_color};strokeColor=#cccccc;rounded=1;"
        )
        cell = ET.SubElement(
            self.root,
            "mxCell",
            {
                "id": label_id,
                "value": text,
                "style": style,
                "vertex": "1",
                "connectable": "0",
                "parent": edge_id,
            },
        )
        geometry = ET.SubElement(
            cell,
            "mxGeometry",
            {
                "x": str(x_offset),
                "y": "-0.5",
                "relative": "1",
                "as": "geometry",
            },
        )
        # 调整偏移量，让标签更靠近对应的节点
        offset_x = -100 if source else 100
        offset_y = -40
        ET.SubElement(geometry, "mxPoint", {"x": str(offset_x), "y": str(offset_y), "as": "offset"})

    def _build_simple_endpoint_text(self, endpoint: Endpoint) -> str:
        """构建简洁的端点文本信息，每个字段分行显示"""
        parts = []

        if endpoint.port_channel:
            parts.append(f"PC{endpoint.port_channel}")
        if endpoint.physical_interface:
            parts.append(endpoint.physical_interface)
        if endpoint.vrf:
            parts.append(f"VRF:{endpoint.vrf}")
        if endpoint.vlan:
            parts.append(f"VLAN:{endpoint.vlan}")
        if endpoint.interface_ip:
            parts.append(endpoint.interface_ip)

        if not parts:
            return ""

        # 使用<br/>分行显示
        return "<br/>".join(parts)

    def _add_edge_text_label(self, edge_id: str, text: str, x_offset: float, *, source: bool) -> None:
        """添加边的文本标签"""
        if not text:
            return
        label_id = self.id_gen.new("edgeLabel")

        # 使用简洁的样式，确保标签能正确跟随边
        style = (
            f"edgeLabel;html=1;align=center;verticalAlign=middle;resizable=0;"
            f"points=[];fontSize=10;fontColor=#000000;"
            f"labelBackgroundColor=#ffffff;strokeColor=#cccccc;rounded=1;"
        )

        cell = ET.SubElement(
            self.root,
            "mxCell",
            {
                "id": label_id,
                "value": text,
                "style": style,
                "vertex": "1",
                "connectable": "0",
                "parent": edge_id,
            },
        )

        geometry = ET.SubElement(
            cell,
            "mxGeometry",
            {
                "x": str(x_offset),
                "y": "0",
                "relative": "1",
                "as": "geometry",
            },
        )

        # 使用简单的偏移，让标签更好地跟随边
        offset_x = -20 if source else 20
        offset_y = -15
        ET.SubElement(geometry, "mxPoint", {"x": str(offset_x), "y": str(offset_y), "as": "offset"})

    def _build_endpoint_info(self, endpoint: Endpoint, label: str) -> str:
        """构建端点信息，用于边的主标签"""
        lines: list[str] = []

        # 添加端点标识
        lines.append(f"<b>{label}</b>")

        if endpoint.port_channel:
            lines.append(f"Port-Channel {endpoint.port_channel}")
        if endpoint.physical_interface:
            lines.append(f"Interface {endpoint.physical_interface}")
        if endpoint.vrf:
            lines.append(f"VRF {endpoint.vrf}")
        if endpoint.vlan:
            lines.append(f"VLAN {endpoint.vlan}")
        if endpoint.interface_ip:
            lines.append(f"IP {endpoint.interface_ip}")

        if len(lines) <= 1:  # 只有标识行，没有实际内容
            return ""

        escaped = [html.escape(item) if not item.startswith("<b>") and not item.endswith("</b>") else item for item in lines]
        return "<br/>".join(escaped)

    def _build_endpoint_label(self, endpoint: Endpoint, is_source: bool = True) -> str:
        lines: list[str] = []

        # 添加源/目标标识
        prefix = "源端:" if is_source else "目标端:"
        lines.append(f"<b>{prefix}</b>")

        if endpoint.port_channel:
            lines.append(f"Port-Channel {endpoint.port_channel}")
        if endpoint.physical_interface:
            lines.append(f"Interface {endpoint.physical_interface}")
        if endpoint.vrf:
            lines.append(f"VRF {endpoint.vrf}")
        if endpoint.vlan:
            lines.append(f"VLAN {endpoint.vlan}")
        if endpoint.interface_ip:
            lines.append(f"IP {endpoint.interface_ip}")

        if len(lines) <= 1:  # 只有标识行，没有实际内容
            return ""

        escaped = [html.escape(item) if not item.startswith("<b>") and not item.endswith("</b>") else item for item in lines]
        return "<div>" + "<br/>".join(escaped) + "</div>"


class DrawioTopologyWriter:
    """Render topology objects into draw.io format."""

    def __init__(self, topology: Topology) -> None:
        self.topology = topology

    def write(self, path: Path, template: Optional[Path] = None) -> None:
        document = DrawioDocument.from_template(template)
        layout = LayoutEngine(self.topology).compute()

        region_ids: Dict[str, str] = {}
        remaining = set(self.topology.regions.keys())
        safety = 0
        while remaining and safety < 1000:
            safety += 1
            progressed = False
            for name in list(remaining):
                region = self.topology.regions[name]
                parent_name = region.parent_name.strip()
                if parent_name and parent_name in self.topology.regions and parent_name not in region_ids:
                    continue
                geometry = layout.region_geometries.get(name, (0, 0, 400, 300))
                abs_x, abs_y, width, height = geometry
                if parent_name:
                    parent_geometry = layout.region_geometries.get(parent_name, (0, 0, 0, 0))
                    rel_x = abs_x - parent_geometry[0]
                    rel_y = abs_y - parent_geometry[1]
                    parent_id = region_ids.get(parent_name, document.layer_id)
                else:
                    rel_x = abs_x
                    rel_y = abs_y
                    parent_id = document.layer_id
                region_id = document.add_region(
                    name=region.name,
                    parent_id=parent_id,
                    x=rel_x,
                    y=rel_y,
                    width=width,
                    height=height,
                    parent_region=region.parent_name,
                )
                region.id = region_id
                region_ids[name] = region_id
                remaining.remove(name)
                progressed = True
            if not progressed:
                # fallback: place remaining regions at origin under root
                name = remaining.pop()
                region = self.topology.regions[name]
                abs_x, abs_y, width, height = layout.region_geometries.get(name, (0, 0, 400, 300))
                region_id = document.add_region(
                    name=region.name,
                    parent_id=document.layer_id,
                    x=abs_x,
                    y=abs_y,
                    width=width,
                    height=height,
                    parent_region=region.parent_name,
                )
                region.id = region_id
                region_ids[name] = region_id
        if safety >= 1000:
            raise RuntimeError("Region hierarchy resolution exceeded safety limit")

        device_ids: Dict[str, str] = {}
        for device_key, geometry in layout.device_geometries.items():
            region_name, abs_x, abs_y, width, height = geometry
            region_offset = layout.region_geometries.get(region_name, (0, 0, 0, 0))
            rel_x = abs_x - region_offset[0]
            rel_y = abs_y - region_offset[1]
            device = self.topology.devices[device_key]
            parent_id = region_ids.get(region_name, document.layer_id)
            device_id = document.add_device(
                device=device,
                parent_id=parent_id,
                x=rel_x,
                y=rel_y,
                width=width,
                height=height,
            )
            device_ids[device_key] = device_id

        for link in self.topology.links:
            src_key = self.topology.device_key(link.src.device_name, link.src.management_address)
            dst_key = self.topology.device_key(link.dst.device_name, link.dst.management_address)
            source_id = device_ids.get(src_key)
            target_id = device_ids.get(dst_key)
            if not source_id or not target_id:
                continue
            document.add_link(link, source_id, target_id)

        document.write(path)


class DrawioTopologyReader:
    """Convert draw.io documents back into topology objects."""

    def read(self, path: Path) -> Topology:
        """读取我们工具生成的draw.io文件"""
        return self._read_structured(path)

    def read_generic(self, path: Path) -> Topology:
        """读取标准的draw.io文件，尝试推断设备和连接"""
        tree = ET.parse(path)
        diagram = tree.find("diagram")
        if diagram is None:
            raise ValueError("Invalid draw.io file: missing diagram element")
        graph_model = diagram.find("mxGraphModel")
        if graph_model is None:
            raise ValueError("Invalid draw.io file: missing mxGraphModel")
        root = graph_model.find("root")
        if root is None:
            raise ValueError("Invalid draw.io file: missing root element")

        # 检查是否有data_*属性，如果有则使用结构化读取
        has_data_attributes = any(
            any(attr.startswith('data_') for attr in cell.attrib.keys())
            for cell in root.findall("mxCell")
        )

        if has_data_attributes:
            return self._read_structured_data(tree, root)
        else:
            return self._read_generic_fallback(root)

    def _read_structured_data(self, tree: ET.ElementTree, root: ET.Element) -> Topology:
        """读取包含data_*属性的结构化draw.io文件"""
        topology = Topology()
        devices: Dict[str, Device] = {}
        device_cells: Dict[str, ET.Element] = {}

        # 第一遍：识别设备
        for cell in root.findall("mxCell"):
            cell_id = cell.attrib.get("id", "")
            data_type = cell.attrib.get("data_type", "")

            # 跳过根节点和非设备元素
            if cell_id in ["0", "1"] or data_type != "device":
                continue

            # 从data_*属性中提取设备信息
            device_name = cell.attrib.get("data_device_name", "")
            management_address = cell.attrib.get("data_management_address", "")
            region = cell.attrib.get("data_region", "")
            parent_region = cell.attrib.get("data_parent_region", "")
            device_model = cell.attrib.get("data_device_model", "")
            device_type = cell.attrib.get("data_device_type", "")
            cabinet = cell.attrib.get("data_cabinet", "")
            u_position = cell.attrib.get("data_u_position", "")

            if device_name:
                device = Device(
                    device_name=device_name,
                    management_address=management_address,
                    region=region,
                    parent_region=parent_region,
                    device_model=device_model,
                    device_type=device_type,
                    cabinet=cabinet,
                    u_position=u_position
                )

                device_key = f"{device_name}__{management_address}"  # 使用设备名+管理地址作为唯一键（与topology.device_key()一致）
                devices[device_key] = device
                device_cells[cell_id] = cell

        # 第二遍：识别链路
        links = []
        for cell in root.findall("mxCell"):
            data_type = cell.attrib.get("data_type", "")

            if data_type != "link":
                continue

            # 从data_*属性中提取链路信息
            src_device_name = cell.attrib.get("data_src_device_name", "")
            src_management_address = cell.attrib.get("data_src_management_address", "")
            dst_device_name = cell.attrib.get("data_dst_device_name", "")
            dst_management_address = cell.attrib.get("data_dst_management_address", "")

            src_device_key = f"{src_device_name}__{src_management_address}"
            dst_device_key = f"{dst_device_name}__{dst_management_address}"

            if src_device_key in devices and dst_device_key in devices:
                # 创建源端点
                src_endpoint = Endpoint(
                    device_name=src_device_name,
                    management_address=src_management_address,
                    parent_region=cell.attrib.get("data_src_parent_region", ""),
                    region=cell.attrib.get("data_src_region", ""),
                    device_model=cell.attrib.get("data_src_device_model", ""),
                    device_type=cell.attrib.get("data_src_device_type", ""),
                    cabinet=cell.attrib.get("data_src_cabinet", ""),
                    u_position=cell.attrib.get("data_src_u_position", ""),
                    port_channel=cell.attrib.get("data_src_port_channel", ""),
                    physical_interface=cell.attrib.get("data_src_physical_interface", ""),
                    vrf=cell.attrib.get("data_src_vrf", ""),
                    vlan=cell.attrib.get("data_src_vlan", ""),
                    interface_ip=cell.attrib.get("data_src_interface_ip", "")
                )

                # 创建目标端点
                dst_endpoint = Endpoint(
                    device_name=dst_device_name,
                    management_address=dst_management_address,
                    parent_region=cell.attrib.get("data_dst_parent_region", ""),
                    region=cell.attrib.get("data_dst_region", ""),
                    device_model=cell.attrib.get("data_dst_device_model", ""),
                    device_type=cell.attrib.get("data_dst_device_type", ""),
                    cabinet=cell.attrib.get("data_dst_cabinet", ""),
                    u_position=cell.attrib.get("data_dst_u_position", ""),
                    port_channel=cell.attrib.get("data_dst_port_channel", ""),
                    physical_interface=cell.attrib.get("data_dst_physical_interface", ""),
                    vrf=cell.attrib.get("data_dst_vrf", ""),
                    vlan=cell.attrib.get("data_dst_vlan", ""),
                    interface_ip=cell.attrib.get("data_dst_interface_ip", "")
                )

                # 创建链路
                link = Link(
                    sequence=cell.attrib.get("data_sequence", ""),
                    src=src_endpoint,
                    dst=dst_endpoint,
                    usage=cell.attrib.get("data_usage", ""),
                    cable_type=cell.attrib.get("data_cable_type", ""),
                    bandwidth=cell.attrib.get("data_bandwidth", ""),
                    remark=cell.attrib.get("data_remark", "")
                )
                links.append(link)

        # 添加设备到拓扑
        for device in devices.values():
            key = topology.device_key(device.device_name, device.management_address)
            topology.devices[key] = device

        # 添加链路到拓扑
        topology.links.extend(links)

        return topology

    def _parse_device_info(self, html_value: str) -> tuple[str, str]:
        """解析设备信息，从HTML格式的value中提取设备名和管理地址"""
        import re

        # 移除HTML标签，但保留换行
        # 将<br/>转换为换行符
        clean_value = html_value.replace('<br/>', '\n').replace('<br>', '\n')
        # 移除其他HTML标签
        clean_value = re.sub(r'<[^>]+>', '', clean_value)
        # 清理HTML实体
        clean_value = clean_value.replace('&nbsp;', ' ').strip()

        lines = [line.strip() for line in clean_value.split('\n') if line.strip()]

        if len(lines) >= 2:
            device_name = lines[0]
            management_address = lines[1]
            return device_name, management_address
        elif len(lines) == 1:
            # 如果只有一行，尝试其他分隔符
            line = lines[0]
            if '@' in line:
                parts = line.split('@', 1)
                return parts[0].strip(), parts[1].strip()
            elif '|' in line:
                parts = line.split('|', 1)
                return parts[0].strip(), parts[1].strip()
            else:
                return line, ""
        else:
            return "", ""

    def _parse_device_info_enhanced(self, html_value: str) -> tuple[str, str, str]:
        """
        增强的设备信息解析，返回 (设备名, 管理地址, 设备型号)
        支持多种格式：
        1. <div><b>设备名</b><br/>管理地址</div>  (结构化格式)
        2. <div>设备名</div>设备型号  (标准draw.io格式)
        3. 设备名@管理地址  (简单格式)
        4. 设备名|设备型号  (分隔符格式)
        """
        import re

        if not html_value:
            return "", "", ""

        # 检测格式1: 结构化格式（包含<b>和<br/>）
        if '<b>' in html_value and '<br/>' in html_value:
            device_name, management_address = self._parse_device_info(html_value)
            return device_name, management_address, ""

        # 检测格式2: 标准draw.io格式（<div>设备名</div>设备型号 或 <div>设备名</div><div>设备型号</div>）
        elif '<div>' in html_value and '</div>' in html_value:
            # 解码HTML实体
            decoded_value = html_value.replace('&lt;', '<').replace('&gt;', '>').replace('&nbsp;', ' ')

            # 提取第一个div中的设备名
            first_div_match = re.search(r'<div[^>]*>(.*?)</div>', decoded_value)
            if first_div_match:
                device_name_raw = first_div_match.group(1).strip()
                # 清理设备名中的HTML标签
                device_name = re.sub(r'<[^>]+>', '', device_name_raw).strip()

                # 提取第一个div后的内容
                remaining = decoded_value[first_div_match.end():].strip()

                # 检查是否有第二个div（格式B: <div>设备名</div><div>设备型号</div>）
                second_div_match = re.search(r'<div[^>]*>(.*?)</div>', remaining)
                if second_div_match:
                    # 格式B: 从第二个div中提取设备型号
                    device_model_raw = second_div_match.group(1).strip()
                    device_model = re.sub(r'<[^>]+>', '', device_model_raw).strip()
                else:
                    # 格式A: 直接使用剩余内容作为设备型号
                    device_model = remaining if remaining else ""

                return device_name, "", device_model
            else:
                # 如果div解析失败，回退到原始逻辑
                device_name, management_address = self._parse_device_info(html_value)
                return device_name, management_address, ""

        # 检测格式3和4: 分隔符格式
        else:
            device_name, management_address = self._parse_device_info(html_value)
            # 如果management_address看起来像设备型号，则调整
            if management_address and self._looks_like_device_model(management_address):
                return device_name, "", management_address
            else:
                return device_name, management_address, ""

    def _looks_like_device_model(self, text: str) -> bool:
        """判断文本是否看起来像设备型号"""
        import re

        if not text:
            return False

        # 设备型号通常包含：
        # 1. 大写字母开头
        # 2. 包含数字
        # 3. 可能包含连字符
        # 4. 长度适中（3-20字符）

        if len(text) < 3 or len(text) > 20:
            return False

        # 检查是否以大写字母开头且包含数字
        if re.match(r'^[A-Z].*\d', text):
            return True

        # 检查是否符合常见设备型号模式
        model_patterns = [
            r'^[A-Z]{2,4}\d+',  # 如 CE8865, USG6635
            r'^[A-Z]\d+',       # 如 S5755
            r'^[A-Z]{2,4}\d+\-', # 如 CE8865-4C
        ]

        for pattern in model_patterns:
            if re.match(pattern, text):
                return True

        return False



    def _detect_edge_direction(self, edge_cell) -> str:
        """
        检测边的方向
        返回: "forward", "reverse", "bidirectional", "none"
        """
        import re

        style = edge_cell.attrib.get("style", "")

        # 检查是否有起始箭头（且不是none）
        has_start_arrow = False
        if "startArrow" in style:
            start_arrow_match = re.search(r'startArrow=([^;]+)', style)
            if start_arrow_match:
                start_arrow_value = start_arrow_match.group(1)
                has_start_arrow = start_arrow_value != "none"

        # 检查是否有结束箭头（且不是none）
        has_end_arrow = False
        if "endArrow" in style:
            end_arrow_match = re.search(r'endArrow=([^;]+)', style)
            if end_arrow_match:
                end_arrow_value = end_arrow_match.group(1)
                has_end_arrow = end_arrow_value != "none"

        # 判断方向
        if has_end_arrow and not has_start_arrow:
            return "forward"      # source → target
        elif has_start_arrow and not has_end_arrow:
            return "reverse"      # source ← target (需要交换)
        elif has_start_arrow and has_end_arrow:
            return "bidirectional"  # source ←→ target
        else:
            return "none"         # 无方向指示

    def _adjust_endpoints_by_direction(self, direction: str, source_endpoint: Endpoint, target_endpoint: Endpoint) -> tuple[Endpoint, Endpoint]:
        """
        根据检测到的方向调整端点
        """
        if direction == "reverse":
            # 箭头指向source，所以实际上target是源，source是目标
            return target_endpoint, source_endpoint
        else:
            # forward, bidirectional, none 都保持原方向
            return source_endpoint, target_endpoint

    def _extract_region_hierarchy(self, root) -> dict:
        """
        提取区域层次结构
        返回: {区域ID: {"name": 区域名, "parent": 父区域ID, "children": [子区域ID列表]}}
        """
        regions = {}

        # 查找所有swimlane元素
        for cell in root.iter("mxCell"):
            style = cell.attrib.get("style", "")
            if "swimlane" in style:
                region_id = cell.attrib.get("id")
                region_name = cell.attrib.get("value", "")
                parent_id = cell.attrib.get("parent")

                if region_id and region_name:
                    regions[region_id] = {
                        "name": region_name,
                        "parent": parent_id,
                        "children": []
                    }

        # 建立父子关系
        for region_id, region_info in regions.items():
            parent_id = region_info["parent"]
            if parent_id and parent_id in regions:
                regions[parent_id]["children"].append(region_id)

        return regions

    def _find_device_region(self, device_cell_id: str, regions: dict, root) -> tuple[str, str]:
        """
        查找设备所在的区域
        返回: (所属区域名, 父区域名)
        """
        # 查找设备的parent链
        current_id = device_cell_id
        region_chain = []

        # 向上遍历parent链，收集所有区域
        for cell in root.iter("mxCell"):
            if cell.attrib.get("id") == current_id:
                parent_id = cell.attrib.get("parent")
                while parent_id:
                    if parent_id in regions:
                        region_chain.append(parent_id)

                    # 查找parent的parent
                    parent_cell = None
                    for c in root.iter("mxCell"):
                        if c.attrib.get("id") == parent_id:
                            parent_cell = c
                            break

                    if parent_cell:
                        parent_id = parent_cell.attrib.get("parent")
                    else:
                        break
                break

        # 从区域链中提取所属区域和父区域
        if len(region_chain) >= 2:
            # 最近的区域是所属区域，上一级是父区域
            region_name = regions[region_chain[0]]["name"]
            parent_region_name = regions[region_chain[1]]["name"]
            return region_name, parent_region_name
        elif len(region_chain) == 1:
            # 只有一级区域
            region_name = regions[region_chain[0]]["name"]
            return region_name, ""
        else:
            # 没有找到区域
            return "", ""



    def _parse_edge_labels(self, edge_cell) -> tuple[dict, dict]:
        """解析边标签，提取源端口和目标端口信息"""
        src_port_info = {}
        dst_port_info = {}

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
                    # 负偏移通常是源标签，正偏移是目标标签
                    if x_offset <= 0:  # 源标签（包括居中的情况）
                        src_port_info = self._parse_port_info(label_text)
                    else:  # 目标标签
                        dst_port_info = self._parse_port_info(label_text)

        return src_port_info, dst_port_info

    def _parse_port_info(self, label_text: str) -> dict:
        """解析端口信息文本，支持多种格式"""
        import re

        info = {}
        if not label_text:
            return info

        # 移除HTML标签和实体
        clean_text = re.sub(r'<[^>]+>', '', label_text)
        clean_text = clean_text.replace('&nbsp;', ' ').replace('&lt;', '<').replace('&gt;', '>')
        lines = [line.strip() for line in clean_text.split('\n') if line.strip()]

        for line in lines:
            line_lower = line.lower()

            # 提取Port-Channel信息（支持多种写法）
            if any(keyword in line_lower for keyword in ['port-channel', 'portchannel', 'pc号', '端口通道']):
                value = self._extract_value(line)
                if value:
                    info['port_channel'] = value

            # 提取物理接口信息（支持多种写法）
            elif any(keyword in line_lower for keyword in ['物理接口', 'interface', '接口', 'port']):
                # 排除IP接口的情况
                if 'ip' not in line_lower:
                    value = self._extract_value(line)
                    if value:
                        info['physical_interface'] = value

            # 提取VRF信息
            elif 'vrf' in line_lower:
                value = self._extract_value(line)
                if value:
                    info['vrf'] = value

            # 提取VLAN信息
            elif 'vlan' in line_lower:
                value = self._extract_value(line)
                if value:
                    info['vlan'] = value

            # 提取IP地址信息（支持多种写法）
            elif any(keyword in line_lower for keyword in ['ip', '地址']) and any(keyword in line_lower for keyword in ['接口', 'interface']):
                value = self._extract_value(line)
                if value and self._is_valid_ip_format(value):
                    info['interface_ip'] = value

        return info

    def _is_valid_ip_format(self, value: str) -> bool:
        """简单验证IP地址格式"""
        import re
        # 简单的IP格式检查，支持IPv4
        ip_pattern = r'^(\d{1,3}\.){3}\d{1,3}$'
        return bool(re.match(ip_pattern, value.strip()))

    def _extract_value(self, line: str) -> str:
        """从标签行中提取值，支持多种格式"""
        if not line:
            return ""

        line = line.strip()

        # 尝试多种分隔符
        for separator in ['：', ':', '=', '-', '|']:
            if separator in line:
                parts = line.split(separator, 1)
                if len(parts) == 2 and parts[1].strip():
                    return parts[1].strip()

        # 如果没有分隔符，尝试提取最后一个词（可能是值）
        words = line.split()
        if len(words) > 1:
            # 检查最后一个词是否像是一个值（包含数字、点、字母等）
            last_word = words[-1]
            if any(c.isdigit() or c in './-_' for c in last_word):
                return last_word

        return ""

    def _read_generic_fallback(self, root: ET.Element) -> Topology:
        """读取标准draw.io文件的回退方法（原来的逻辑）"""
        topology = Topology()
        devices: Dict[str, Device] = {}
        device_cells: Dict[str, ET.Element] = {}

        # 提取区域层次结构
        regions = self._extract_region_hierarchy(root)

        # 第一遍：识别设备（矩形节点）
        for cell in root.findall("mxCell"):
            cell_id = cell.attrib.get("id", "")
            value = cell.attrib.get("value", "").strip()
            style = cell.attrib.get("style", "")

            # 跳过根节点和边
            if cell_id in ["0", "1"] or cell.attrib.get("edge") == "1":
                continue

            # 识别设备：有value且style包含矩形相关属性
            if (value and
                ("rounded=1" in style or "whiteSpace=wrap" in style or "vertex" in cell.attrib) and
                "swimlane" not in style):  # 排除区域

                # 使用增强的设备信息解析
                device_name, management_address, device_model = self._parse_device_info_enhanced(value)

                if device_name:
                    # 提取设备所在的区域信息
                    region, parent_region = self._find_device_region(cell_id, regions, root)

                    device = Device(
                        device_name=device_name,
                        management_address=management_address,
                        region=region,              # 从draw.io区域结构中提取
                        parent_region=parent_region, # 从draw.io区域结构中提取
                        device_model=device_model,  # 从draw.io中实际提取的设备型号
                        device_type="",             # 不进行推断，留空
                        cabinet="",
                        u_position=""
                    )

                    # 使用与topology.device_key()一致的键格式
                    # 处理管理地址为空的情况，保持与topology.device_key()方法一致
                    device_key = f"{device_name}__{management_address}" if management_address else device_name
                    devices[device_key] = device
                    device_cells[cell_id] = cell

        # 第二遍：识别连接（边）
        links = []
        for cell in root.findall("mxCell"):
            if cell.attrib.get("edge") == "1":
                source_id = cell.attrib.get("source", "")
                target_id = cell.attrib.get("target", "")

                # 查找源和目标设备
                source_device = None
                target_device = None
                source_device_name = None
                target_device_name = None

                # 查找源设备
                source_device_name = None
                source_management_address = None
                source_device = None
                if source_id in device_cells:
                    source_cell = device_cells[source_id]
                    source_device_name, source_management_address, _ = self._parse_device_info_enhanced(source_cell.attrib.get("value", ""))
                    # 使用与设备创建时一致的键格式
                    source_device_key = f"{source_device_name}__{source_management_address}" if source_management_address else source_device_name
                    source_device = devices.get(source_device_key)

                # 查找目标设备
                target_device_name = None
                target_management_address = None
                target_device = None
                if target_id in device_cells:
                    target_cell = device_cells[target_id]
                    target_device_name, target_management_address, _ = self._parse_device_info_enhanced(target_cell.attrib.get("value", ""))
                    # 使用与设备创建时一致的键格式
                    target_device_key = f"{target_device_name}__{target_management_address}" if target_management_address else target_device_name
                    target_device = devices.get(target_device_key)

                if (source_device and target_device and source_device_name and target_device_name and
                    not (source_device_name == target_device_name and
                         source_management_address == target_management_address)):  # 精确的自连接过滤

                    # 解析边标签获取端口信息
                    src_port_info, dst_port_info = self._parse_edge_labels(cell)

                    # 创建初始端点 - 使用解析出的设备名和管理地址，以及边标签中的端口信息
                    initial_src_endpoint = Endpoint(
                        device_name=source_device_name,
                        management_address=source_management_address or "",
                        parent_region=source_device.parent_region if source_device else "",
                        region=source_device.region if source_device else "",
                        device_model=source_device.device_model if source_device else "",
                        device_type=source_device.device_type if source_device else "",  # 不推断，留空
                        cabinet=source_device.cabinet if source_device else "",
                        u_position=source_device.u_position if source_device else "",
                        port_channel=src_port_info.get("port_channel", ""),
                        physical_interface=src_port_info.get("physical_interface", ""),
                        vrf=src_port_info.get("vrf", ""),
                        vlan=src_port_info.get("vlan", ""),
                        interface_ip=src_port_info.get("interface_ip", "")
                    )

                    initial_dst_endpoint = Endpoint(
                        device_name=target_device_name,
                        management_address=target_management_address or "",
                        parent_region=target_device.parent_region if target_device else "",
                        region=target_device.region if target_device else "",
                        device_model=target_device.device_model if target_device else "",
                        device_type=target_device.device_type if target_device else "",  # 不推断，留空
                        cabinet=target_device.cabinet if target_device else "",
                        u_position=target_device.u_position if target_device else "",
                        port_channel=dst_port_info.get("port_channel", ""),
                        physical_interface=dst_port_info.get("physical_interface", ""),
                        vrf=dst_port_info.get("vrf", ""),
                        vlan=dst_port_info.get("vlan", ""),
                        interface_ip=dst_port_info.get("interface_ip", "")
                    )

                    # 检测边的方向并调整端点顺序
                    direction = self._detect_edge_direction(cell)
                    src_endpoint, dst_endpoint = self._adjust_endpoints_by_direction(
                        direction, initial_src_endpoint, initial_dst_endpoint
                    )

                    # 创建链路
                    link = Link(
                        sequence="",  # 不自动生成序号，留空
                        src=src_endpoint,
                        dst=dst_endpoint,
                        usage="",     # 不推断互联用途，留空
                        cable_type="",
                        bandwidth="",
                        remark=""
                    )

                    links.append(link)

        # 添加设备到拓扑
        for device in devices.values():
            key = topology.device_key(device.device_name, device.management_address)
            topology.devices[key] = device

        # 添加链路到拓扑（不进行排序，保持原始顺序）
        topology.links.extend(links)

        return topology

    def _read_structured(self, path: Path) -> Topology:
        tree = ET.parse(path)
        diagram = tree.find("diagram")
        if diagram is None:
            raise ValueError("Invalid draw.io file: missing diagram element")
        graph_model = diagram.find("mxGraphModel")
        if graph_model is None:
            raise ValueError("Invalid draw.io file: missing mxGraphModel")
        root = graph_model.find("root")
        if root is None:
            raise ValueError("Invalid draw.io file: missing root element")

        topology = Topology()
        devices: Dict[str, Device] = {}
        regions: Dict[str, str] = {}

        for cell in root.findall("mxCell"):
            if cell.attrib.get("data_type") == "region":
                name = cell.attrib.get("data_name", cell.attrib.get("value", ""))
                parent_name = cell.attrib.get("data_parent_name", "")
                topology.ensure_region(name, parent_name)
                regions[cell.attrib["id"]] = name

        for cell in root.findall("mxCell"):
            if cell.attrib.get("data_type") == "device":
                device = Device(
                    device_name=cell.attrib.get("data_device_name", ""),
                    management_address=cell.attrib.get("data_management_address", ""),
                    parent_region=cell.attrib.get("data_parent_region", ""),
                    region=cell.attrib.get("data_region", ""),
                    device_model=cell.attrib.get("data_device_model", ""),
                    device_type=cell.attrib.get("data_device_type", ""),
                    cabinet=cell.attrib.get("data_cabinet", ""),
                    u_position=cell.attrib.get("data_u_position", ""),
                )
                if device.region:
                    topology.ensure_region(device.region, device.parent_region)
                if device.parent_region and device.parent_region not in topology.regions:
                    topology.ensure_region(device.parent_region)
                key = topology.device_key(device.device_name, device.management_address)
                topology.devices[key] = device
                devices[cell.attrib["id"]] = device

        for cell in root.findall("mxCell"):
            if cell.attrib.get("data_type") != "link":
                continue
            src_device = devices.get(cell.attrib.get("source", ""))
            dst_device = devices.get(cell.attrib.get("target", ""))
            if not src_device or not dst_device:
                continue
            link = Link()
            link.sequence = cell.attrib.get("data_sequence", "")
            link.usage = cell.attrib.get("data_usage", "")
            link.cable_type = cell.attrib.get("data_cable_type", "")
            link.bandwidth = cell.attrib.get("data_bandwidth", "")
            link.remark = cell.attrib.get("data_remark", "")

            link.src = _endpoint_from_attrs(cell, prefix="data_src_", fallback_device=src_device)
            link.dst = _endpoint_from_attrs(cell, prefix="data_dst_", fallback_device=dst_device)

            for key, value in cell.attrib.items():
                if key.startswith("data_extra_"):
                    link.extra[key[len("data_extra_"):]] = value

            topology.links.append(link)

        topology.rebuild_region_tree()
        return topology


def _endpoint_from_attrs(cell: ET.Element, prefix: str, fallback_device: Device) -> Endpoint:
    endpoint = Endpoint()
    endpoint.device_name = cell.attrib.get(f"{prefix}device_name", fallback_device.device_name)
    endpoint.management_address = cell.attrib.get(f"{prefix}management_address", fallback_device.management_address)
    endpoint.parent_region = cell.attrib.get(f"{prefix}parent_region", fallback_device.parent_region)
    endpoint.region = cell.attrib.get(f"{prefix}region", fallback_device.region)
    endpoint.device_model = cell.attrib.get(f"{prefix}device_model", fallback_device.device_model)
    endpoint.device_type = cell.attrib.get(f"{prefix}device_type", fallback_device.device_type)
    endpoint.cabinet = cell.attrib.get(f"{prefix}cabinet", fallback_device.cabinet)
    endpoint.u_position = cell.attrib.get(f"{prefix}u_position", fallback_device.u_position)
    endpoint.port_channel = cell.attrib.get(f"{prefix}port_channel", "")
    endpoint.physical_interface = cell.attrib.get(f"{prefix}physical_interface", "")
    endpoint.vrf = cell.attrib.get(f"{prefix}vrf", "")
    endpoint.vlan = cell.attrib.get(f"{prefix}vlan", "")
    endpoint.interface_ip = cell.attrib.get(f"{prefix}interface_ip", "")
    return endpoint
