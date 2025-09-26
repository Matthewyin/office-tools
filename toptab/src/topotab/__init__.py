"""Topology conversion toolkit for CSV and draw.io files."""

from importlib import import_module
from typing import Any

__all__ = ["app"]


def __getattr__(name: str) -> Any:
    if name == "app":
        module = import_module("topotab.cli")
        return getattr(module, "app")
    raise AttributeError(name)
