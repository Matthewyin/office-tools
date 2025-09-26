from __future__ import annotations

from pathlib import Path
from typing import List, Optional

import typer
from rich.console import Console
from rich.table import Table

from .csv_io import CsvTopologyReader, CsvTopologyWriter
from .drawio_io import DrawioTopologyReader, DrawioTopologyWriter
from .schema import CsvSchema

app = typer.Typer(help="CSV and draw.io topology converter")
console = Console()

BASE_DIR = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = BASE_DIR / "input"
DEFAULT_OUTPUT = BASE_DIR / "output"
DEFAULT_TMP = BASE_DIR / "tmp"
DEFAULT_CSV_TEMPLATE = BASE_DIR / "tamp" / "csvtamp.csv"


@app.command()
def run() -> None:
    console.print("[bold cyan]Topology converter[/bold cyan]")

    input_path = _prompt_path("Input file or directory", DEFAULT_INPUT)
    output_path = _prompt_path("Output directory", DEFAULT_OUTPUT)
    template_input = typer.prompt(
        "draw.io template path (optional)",
        default="",
    ).strip()
    template_path = Path(template_input).expanduser() if template_input else None

    if template_path and not template_path.exists():
        console.print(f"[yellow]Template {template_path} not found, falling back to default layout[/yellow]")
        template_path = None

    csv_template_input = typer.prompt(
        "CSV template path", default=str(DEFAULT_CSV_TEMPLATE)
    ).strip()
    csv_template_path = Path(csv_template_input).expanduser()

    files = _collect_files(input_path)
    if not files:
        console.print(f"[red]No convertible files found in {input_path}[/red]")
        raise typer.Exit(code=1)

    if not output_path.exists():
        output_path.mkdir(parents=True, exist_ok=True)

    tmp_csv_path = DEFAULT_TMP / "csvtmp.csv"
    tmp_csv_path.parent.mkdir(parents=True, exist_ok=True)

    summary_rows = []

    for file_path in files:
        try:
            if file_path.suffix.lower() == ".csv":
                result = _handle_csv_to_drawio(
                    csv_path=file_path,
                    output_dir=output_path,
                    template_path=template_path,
                )
            else:
                result = _handle_drawio_to_csv(
                    drawio_path=file_path,
                    output_dir=output_path,
                    tmp_csv_path=tmp_csv_path,
                    csv_template=csv_template_path,
                )
            summary_rows.append(result)
        except Exception as exc:  # pylint: disable=broad-except
            console.print(f"[red]Converting {file_path} failed with error: {exc}[/red]")

    if summary_rows:
        _print_summary(summary_rows)


def _prompt_path(prompt_text: str, default: Path) -> Path:
    user_input = typer.prompt(prompt_text, default=str(default)).strip()
    path = Path(user_input).expanduser()

    if not path.is_absolute() and not path.exists():
        base_dir = default if default.is_dir() else default.parent
        if base_dir.exists():
            candidate = (base_dir / path).resolve()
            if candidate.exists():
                return candidate
    return path


def _collect_files(path: Path) -> List[Path]:
    if path.is_file():
        if path.suffix.lower() not in {".csv", ".drawio"}:
            return []
        return [path]
    if not path.exists():
        console.print(f"[red]Path {path} not found[/red]")
        return []
    files = [
        p
        for p in path.iterdir()
        if p.suffix.lower() in {".csv", ".drawio"} and p.is_file()
    ]
    files.sort()
    return files


def _handle_csv_to_drawio(
    csv_path: Path,
    output_dir: Path,
    template_path: Optional[Path],
) -> tuple[str, str, str]:
    schema = CsvSchema.from_template(csv_path)
    reader = CsvTopologyReader(schema)
    topology = reader.read(csv_path)

    writer = DrawioTopologyWriter(topology)
    output_file = output_dir / f"{csv_path.stem}.drawio"
    writer.write(output_file, template=template_path)
    console.print(f"[green]Generated[/green] {output_file}")
    return (csv_path.name, "CSV->draw.io", str(output_file))


def _handle_drawio_to_csv(
    drawio_path: Path,
    output_dir: Path,
    tmp_csv_path: Path,
    csv_template: Path,
) -> tuple[str, str, str]:
    reader = DrawioTopologyReader()
    topology = reader.read(drawio_path)

    if not csv_template.exists():
        raise FileNotFoundError(f"CSV template {csv_template} not found")

    schema = CsvSchema.from_template(csv_template)
    writer = CsvTopologyWriter(schema)

    writer.write(tmp_csv_path, topology.links)
    final_output = output_dir / f"{drawio_path.stem}.csv"
    if final_output != tmp_csv_path:
        writer.write(final_output, topology.links)
    console.print(f"[green]Generated[/green] {final_output}, temporary file {tmp_csv_path}")
    return (drawio_path.name, "draw.io->CSV", str(final_output))


def _print_summary(rows: List[tuple[str, str, str]]) -> None:
    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("Source")
    table.add_column("Type")
    table.add_column("Output")
    for row in rows:
        table.add_row(*row)
    console.print(table)


if __name__ == "__main__":
    app()
