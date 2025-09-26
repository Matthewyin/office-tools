from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Dict, List, Tuple

from .models import Device, Topology

DEVICE_WIDTH = 160
DEVICE_HEIGHT = 80
DEVICE_H_SPACING = 40
DEVICE_V_SPACING = 80
REGION_PADDING = 60
REGION_HEADER_HEIGHT = 40
CHILD_REGION_V_SPACING = 80
ROOT_REGION_V_SPACING = 120
MIN_REGION_WIDTH = 320
MIN_REGION_HEIGHT = 220


@dataclass(slots=True)
class RegionLayout:
    width: int
    height: int
    device_positions: Dict[str, Tuple[int, int]] = field(default_factory=dict)
    child_positions: Dict[str, Tuple[int, int]] = field(default_factory=dict)


@dataclass(slots=True)
class LayoutResult:
    region_geometries: Dict[str, Tuple[int, int, int, int]]
    device_geometries: Dict[str, Tuple[str, int, int, int, int]]  # device key -> (region, x, y, w, h)


class LayoutEngine:
    """Compute simple layout coordinates for regions and devices."""

    def __init__(self, topology: Topology) -> None:
        self.topology = topology
        self.region_devices = self._group_devices()
        self.cache: Dict[str, RegionLayout] = {}

    def compute(self) -> LayoutResult:
        region_geometries: Dict[str, Tuple[int, int, int, int]] = {}
        device_geometries: Dict[str, Tuple[str, int, int, int, int]] = {}

        root_regions = [name for name, region in self.topology.regions.items() if not region.parent_name]
        root_regions.sort()

        y_cursor = 0
        for name in root_regions:
            layout = self._measure_region(name)
            self._assign_absolute(
                name,
                x=0,
                y=y_cursor,
                layout=layout,
                region_geometries=region_geometries,
                device_geometries=device_geometries,
            )
            y_cursor += layout.height + ROOT_REGION_V_SPACING

        return LayoutResult(region_geometries=region_geometries, device_geometries=device_geometries)

    def _assign_absolute(
        self,
        region_name: str,
        x: int,
        y: int,
        layout: RegionLayout,
        region_geometries: Dict[str, Tuple[int, int, int, int]],
        device_geometries: Dict[str, Tuple[str, int, int, int, int]],
    ) -> None:
        region_geometries[region_name] = (x, y, layout.width, layout.height)

        for device_key, (rel_x, rel_y) in layout.device_positions.items():
            device_geometries[device_key] = (
                region_name,
                x + rel_x,
                y + rel_y,
                DEVICE_WIDTH,
                DEVICE_HEIGHT,
            )

        for child_name, (rel_x, rel_y) in layout.child_positions.items():
            child_layout = self._measure_region(child_name)
            self._assign_absolute(
                child_name,
                x + rel_x,
                y + rel_y,
                child_layout,
                region_geometries,
                device_geometries,
            )

    def _measure_region(self, name: str) -> RegionLayout:
        if name in self.cache:
            return self.cache[name]

        region = self.topology.regions.get(name)
        if region is None:
            layout = RegionLayout(width=MIN_REGION_WIDTH, height=MIN_REGION_HEIGHT)
            self.cache[name] = layout
            return layout

        devices = self.region_devices.get(name, [])
        device_positions: Dict[str, Tuple[int, int]] = {}
        device_area_width = 0
        device_area_height = 0

        if devices:
            columns = min(4, max(1, round(math.sqrt(len(devices)))))
            columns = min(columns, len(devices))
            rows = math.ceil(len(devices) / columns)
            device_area_width = columns * DEVICE_WIDTH + (columns - 1) * DEVICE_H_SPACING
            device_area_height = rows * DEVICE_HEIGHT + (rows - 1) * DEVICE_V_SPACING
            for idx, device_key in enumerate(devices):
                row = idx // columns
                col = idx % columns
                x = REGION_PADDING + col * (DEVICE_WIDTH + DEVICE_H_SPACING)
                y = REGION_HEADER_HEIGHT + REGION_PADDING + row * (DEVICE_HEIGHT + DEVICE_V_SPACING)
                device_positions[device_key] = (x, y)
        else:
            device_area_width = 0
            device_area_height = 0

        child_positions: Dict[str, Tuple[int, int]] = {}
        child_width = 0
        child_height_total = 0
        y_cursor = REGION_HEADER_HEIGHT + REGION_PADDING + (device_area_height if device_area_height else 0)
        if devices:
            y_cursor += REGION_PADDING

        for idx, child_name in enumerate(sorted(region.children)):
            child_layout = self._measure_region(child_name)
            child_positions[child_name] = (REGION_PADDING, y_cursor)
            y_cursor += child_layout.height + CHILD_REGION_V_SPACING
            child_width = max(child_width, child_layout.width)
            child_height_total += child_layout.height

        total_width = max(device_area_width, child_width, MIN_REGION_WIDTH - 2 * REGION_PADDING)
        total_height = REGION_HEADER_HEIGHT + 2 * REGION_PADDING + device_area_height
        if devices and region.children:
            total_height += REGION_PADDING
        if region.children:
            total_height += child_height_total + max(len(region.children) - 1, 0) * CHILD_REGION_V_SPACING

        layout = RegionLayout(
            width=max(total_width + 2 * REGION_PADDING, MIN_REGION_WIDTH),
            height=max(total_height, MIN_REGION_HEIGHT),
            device_positions=device_positions,
            child_positions=child_positions,
        )
        self.cache[name] = layout
        return layout

    def _group_devices(self) -> Dict[str, List[str]]:
        groups: Dict[str, List[str]] = {}
        for key, device in self.topology.devices.items():
            region_name = device.region or device.parent_region
            if not region_name:
                region_name = "Unassigned"
                if region_name not in self.topology.regions:
                    self.topology.ensure_region(region_name)
            groups.setdefault(region_name, []).append(key)
        for device_keys in groups.values():
            device_keys.sort()
        return groups
