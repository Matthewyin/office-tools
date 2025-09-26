from __future__ import annotations

import csv
from pathlib import Path
from typing import Iterable, List

from .models import Endpoint, Link, Topology
from .schema import CsvSchema


class CsvTopologyReader:
    """Load topology data from CSV files."""

    def __init__(self, schema: CsvSchema) -> None:
        self.schema = schema
        self.column_map = schema.to_mapping()

    def read(self, path: Path) -> Topology:
        topology = Topology()
        with path.open("r", encoding="utf-8-sig", newline="") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                link = self._row_to_link(row)
                topology.links.append(link)

                if link.src.region:
                    topology.ensure_region(link.src.region, link.src.parent_region)
                if link.src.parent_region:
                    topology.ensure_region(link.src.parent_region)

                if link.dst.region:
                    topology.ensure_region(link.dst.region, link.dst.parent_region)
                if link.dst.parent_region:
                    topology.ensure_region(link.dst.parent_region)

                topology.ensure_device(link.src)
                topology.ensure_device(link.dst)
        topology.rebuild_region_tree()
        return topology

    def _row_to_link(self, row: dict[str, str]) -> Link:
        link = Link()
        src = link.src
        dst = link.dst

        for column in self.schema.columns:
            raw_value = row.get(column.name, "")
            value = raw_value.strip() if raw_value else ""
            if column.role == "src":
                if hasattr(src, column.field):
                    setattr(src, column.field, value)
                elif value:
                    link.extra[f"src.{column.field}"] = value
            elif column.role == "dst":
                if hasattr(dst, column.field):
                    setattr(dst, column.field, value)
                elif value:
                    link.extra[f"dst.{column.field}"] = value
            else:
                if hasattr(link, column.field):
                    setattr(link, column.field, value)
                elif value:
                    link.extra[column.field] = value
        return link


class CsvTopologyWriter:
    """Persist topology data into CSV following the provided schema."""

    def __init__(self, schema: CsvSchema, encoding: str = "utf-8") -> None:
        self.schema = schema
        self.encoding = encoding

    def write(self, path: Path, links: Iterable[Link]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding=self.encoding, newline="") as fh:
            writer = csv.DictWriter(fh, fieldnames=self.schema.headers)
            writer.writeheader()
            for link in links:
                writer.writerow(self._link_to_row(link))

    def _link_to_row(self, link: Link) -> dict[str, str]:
        row: dict[str, str] = {}
        for column in self.schema.columns:
            if column.role == "src":
                value = getattr(link.src, column.field, "")
                if not value:
                    value = link.extra.get(f"src.{column.field}", "")
            elif column.role == "dst":
                value = getattr(link.dst, column.field, "")
                if not value:
                    value = link.extra.get(f"dst.{column.field}", "")
            else:
                value = getattr(link, column.field, "") or link.extra.get(column.field, "")
            row[column.name] = value or ""
        return row
