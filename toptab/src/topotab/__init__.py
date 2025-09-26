"""Topology conversion toolkit for CSV and draw.io files."""

from importlib import import_module
from typing import Any

__all__ = ["app", "convert_drawio_to_csv"]


def __getattr__(name: str) -> Any:
    if name == "app":
        module = import_module("topotab.cli")
        return getattr(module, "app")
    elif name == "convert_drawio_to_csv":
        module = import_module("topotab.convert")
        return getattr(module, "convert_drawio_to_csv")
    raise AttributeError(name)
