from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional


@dataclass(slots=True)
class Endpoint:
    """Network endpoint information for one side of a link."""

    device_name: str = ""
    management_address: str = ""
    parent_region: str = ""
    region: str = ""
    device_model: str = ""
    device_type: str = ""
    cabinet: str = ""
    u_position: str = ""
    port_channel: str = ""
    physical_interface: str = ""
    vrf: str = ""
    vlan: str = ""
    interface_ip: str = ""


@dataclass(slots=True)
class Link:
    """A bidirectional network link connecting two endpoints."""

    sequence: str = ""
    src: Endpoint = field(default_factory=Endpoint)
    dst: Endpoint = field(default_factory=Endpoint)
    usage: str = ""
    cable_type: str = ""
    bandwidth: str = ""
    remark: str = ""
    extra: Dict[str, str] = field(default_factory=dict)


@dataclass(slots=True)
class Device:
    """Unique device representation derived from CSV endpoints."""

    device_name: str
    management_address: str
    parent_region: str = ""
    region: str = ""
    device_model: str = ""
    device_type: str = ""
    cabinet: str = ""
    u_position: str = ""

    def update_from_endpoint(self, endpoint: Endpoint) -> None:
        """Fill gaps with data available on the endpoint."""

        for attr in (
            "parent_region",
            "region",
            "device_model",
            "device_type",
            "cabinet",
            "u_position",
        ):
            value = getattr(self, attr)
            endpoint_value = getattr(endpoint, attr)
            if not value and endpoint_value:
                setattr(self, attr, endpoint_value)


@dataclass(slots=True)
class Region:
    """Hierarchy node used to group devices inside the topology."""

    name: str
    parent_name: str = ""
    id: str = ""
    children: List[str] = field(default_factory=list)


@dataclass(slots=True)
class ConnectionRelationship:
    """A single connection relationship between two network endpoints."""

    # 源端信息
    source_region: Dict[str, str] = field(default_factory=dict)  # parent_region, region
    source_node: Dict[str, str] = field(default_factory=dict)    # device_name, device_model, etc.
    source_port: Dict[str, str] = field(default_factory=dict)    # port_channel, physical_interface, etc.

    # 目标端信息
    target_region: Dict[str, str] = field(default_factory=dict)  # parent_region, region
    target_node: Dict[str, str] = field(default_factory=dict)    # device_name, device_model, etc.
    target_port: Dict[str, str] = field(default_factory=dict)    # port_channel, physical_interface, etc.

    # 链路信息
    link: Dict[str, str] = field(default_factory=dict)          # sequence, usage, cable_type, etc.

    def to_csv_record(self, config: Dict[str, Any]) -> Dict[str, str]:
        """根据配置文件生成CSV记录"""
        record = {}

        # 处理源端信息
        for category in ['region', 'node', 'port']:
            source_data = getattr(self, f'source_{category}')
            if category in config['connection_metadata']['source']:
                for field_name, field_config in config['connection_metadata']['source'][category].items():
                    csv_column = field_config['csv_column']
                    value = source_data.get(field_name, field_config.get('default', ''))
                    record[csv_column] = value

        # 处理目标端信息
        for category in ['region', 'node', 'port']:
            target_data = getattr(self, f'target_{category}')
            if category in config['connection_metadata']['target']:
                for field_name, field_config in config['connection_metadata']['target'][category].items():
                    csv_column = field_config['csv_column']
                    value = target_data.get(field_name, field_config.get('default', ''))
                    record[csv_column] = value

        # 处理链路信息
        if 'link' in config['connection_metadata']:
            for field_name, field_config in config['connection_metadata']['link'].items():
                csv_column = field_config['csv_column']
                value = self.link.get(field_name, field_config.get('default', ''))
                record[csv_column] = value

        return record


@dataclass(slots=True)
class Topology:
    """Unified in-memory representation of the entire topology."""

    regions: Dict[str, Region] = field(default_factory=dict)
    devices: Dict[str, Device] = field(default_factory=dict)
    links: List[Link] = field(default_factory=list)
    connections: List[ConnectionRelationship] = field(default_factory=list)  # 新增连接关系列表

    def device_key(self, name: str, management_address: str) -> str:
        name = name.strip()
        management_address = management_address.strip()
        return f"{name}__{management_address}" if management_address else name

    def ensure_region(self, name: str, parent_name: str = "") -> Region:
        key = name.strip()
        if not key:
            raise ValueError("Region name cannot be empty")

        region = self.regions.get(key)
        parent_name = parent_name.strip()
        if region is None:
            region = Region(name=key, parent_name=parent_name)
            self.regions[key] = region
        else:
            if parent_name and region.parent_name != parent_name:
                region.parent_name = parent_name

        if parent_name:
            parent = self.regions.get(parent_name)
            if parent and region.name not in parent.children:
                parent.children.append(region.name)
        return region


    def rebuild_region_tree(self) -> None:
        for region in self.regions.values():
            region.children.clear()
        for region in self.regions.values():
            if region.parent_name:
                parent = self.regions.get(region.parent_name.strip())
                if parent and region.name not in parent.children:
                    parent.children.append(region.name)

    def ensure_device(self, endpoint: Endpoint) -> Device:
        key = self.device_key(endpoint.device_name, endpoint.management_address)
        if key not in self.devices:
            device = Device(
                device_name=endpoint.device_name.strip(),
                management_address=endpoint.management_address.strip(),
                parent_region=endpoint.parent_region.strip(),
                region=endpoint.region.strip(),
                device_model=endpoint.device_model.strip(),
                device_type=endpoint.device_type.strip(),
                cabinet=endpoint.cabinet.strip(),
                u_position=endpoint.u_position.strip(),
            )
            self.devices[key] = device
        else:
            self.devices[key].update_from_endpoint(endpoint)
        return self.devices[key]
