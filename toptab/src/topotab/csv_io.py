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

        # 为Excel兼容性添加BOM
        if self.encoding.lower() == "utf-8":
            with path.open("wb") as fh:
                # 写入UTF-8 BOM
                fh.write(b'\xef\xbb\xbf')

            # 然后以追加模式写入CSV内容
            with path.open("a", encoding=self.encoding, newline="") as fh:
                writer = csv.DictWriter(fh, fieldnames=self.schema.headers)
                writer.writeheader()
                for link in links:
                    writer.writerow(self._link_to_row(link))
        else:
            # 非UTF-8编码的正常处理
            with path.open("w", encoding=self.encoding, newline="") as fh:
                writer = csv.DictWriter(fh, fieldnames=self.schema.headers)
                writer.writeheader()
                for link in links:
                    writer.writerow(self._link_to_row(link))

    def write_for_excel(self, path: Path, links: Iterable[Link]) -> None:
        """专门为Excel优化的写入方法，Mac和Windows Excel都能正确显示中文"""
        path.parent.mkdir(parents=True, exist_ok=True)

        # 使用UTF-8 BOM + 特殊处理确保跨平台兼容
        with path.open("wb") as fh:
            # 写入UTF-8 BOM，这是关键
            fh.write(b'\xef\xbb\xbf')

        # 以追加模式写入CSV内容，使用特殊的CSV方言
        with path.open("a", encoding="utf-8", newline="") as fh:
            # 使用Excel兼容的CSV方言
            writer = csv.DictWriter(
                fh,
                fieldnames=self.schema.headers,
                dialect='excel',  # 使用Excel方言
                quoting=csv.QUOTE_ALL  # 所有字段都加引号，提高兼容性
            )
            writer.writeheader()
            for link in links:
                writer.writerow(self._link_to_row(link))

    def write_for_excel_universal(self, path: Path, links: Iterable[Link]) -> None:
        """通用Excel兼容方法，同时生成UTF-8 BOM和GBK两个版本"""
        # 生成UTF-8 BOM版本（主要文件）
        self.write_for_excel(path, links)

        # 生成GBK版本作为备选（添加_gbk后缀）
        gbk_path = path.with_suffix('.gbk.csv')
        gbk_writer = CsvTopologyWriter(self.schema, encoding='gbk')
        gbk_writer.write(gbk_path, links)

        print(f"已生成两个版本:")
        print(f"  主文件 (UTF-8 BOM): {path}")
        print(f"  备选文件 (GBK): {gbk_path}")
        print(f"建议:")
        print(f"  - Mac Excel: 使用 {path.name}")
        print(f"  - Windows Excel: 优先尝试 {path.name}，如有乱码则使用 {gbk_path.name}")

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
