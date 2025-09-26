from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List

FIELD_NORMALIZATION = {
    "设备名": "device_name",
    "管理地址": "management_address",
    "父区域": "parent_region",
    "所属区域": "region",
    "设备型号": "device_model",
    "设备类型": "device_type",
    "机柜": "cabinet",
    "机柜/U位": "cabinet",  # legacy support
    "U位": "u_position",
    "Port-Channel号": "port_channel",
    "物理接口": "physical_interface",
    "所属VRF": "vrf",
    "所属VLAN": "vlan",
    "接口IP": "interface_ip",
    "互联用途": "usage",
    "线缆类型": "cable_type",
    "带宽": "bandwidth",
    "备注": "remark",
    "序号": "sequence",
}


@dataclass(slots=True)
class Column:
    name: str
    role: str  # "src", "dst", or "link"
    field: str  # canonical field name


class CsvSchema:
    """Describe CSV columns and retain the original ordering."""

    def __init__(self, columns: List[Column]):
        self.columns = columns

    @property
    def headers(self) -> List[str]:
        return [column.name for column in self.columns]

    def to_mapping(self) -> Dict[str, Column]:
        return {column.name: column for column in self.columns}

    @classmethod
    def from_header(cls, header: Iterable[str]) -> "CsvSchema":
        columns: List[Column] = []
        for raw_name in header:
            role, field_name = _parse_column(raw_name)
            columns.append(Column(name=raw_name, role=role, field=field_name))
        return cls(columns)

    @classmethod
    def from_template(cls, path: Path) -> "CsvSchema":
        import csv

        with path.open("r", encoding="utf-8-sig") as fh:
            reader = csv.reader(fh)
            header = next(reader)
        return cls.from_header(header)


def _parse_column(column_name: str) -> tuple[str, str]:
    """Infer the logical role (src/dst/link) and canonical field name."""

    stripped = column_name.strip()
    if stripped.startswith("源-"):
        role = "src"
        key = stripped[2:]
    elif stripped.startswith("目标-"):
        role = "dst"
        key = stripped[3:]
    else:
        role = "link"
        key = stripped

    field = FIELD_NORMALIZATION.get(key)
    if not field:
        field = key.strip().replace("/", "_").replace("-", "_")
    return role, field
