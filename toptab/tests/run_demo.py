from pathlib import Path

from topotab.csv_io import CsvTopologyReader, CsvTopologyWriter
from topotab.drawio_io import DrawioTopologyReader, DrawioTopologyWriter
from topotab.schema import CsvSchema

BASE_DIR = Path(__file__).resolve().parents[1]
TEMPLATE = BASE_DIR / "tamp" / "csvtamp.csv"
SAMPLE_CSV = BASE_DIR / "examples" / "sample_topology.csv"
GENERATED_DRAWIO = BASE_DIR / "examples" / "sample_topology.drawio"
ROUNDTRIP_CSV = BASE_DIR / "examples" / "sample_roundtrip.csv"


def main() -> None:
    schema = CsvSchema.from_template(TEMPLATE)

    reader = CsvTopologyReader(schema)
    topology = reader.read(SAMPLE_CSV)
    print(f"Loaded {len(topology.devices)} devices, {len(topology.links)} links from CSV")

    drawio_writer = DrawioTopologyWriter(topology)
    drawio_writer.write(GENERATED_DRAWIO)
    print(f"Saved draw.io diagram to {GENERATED_DRAWIO}")

    drawio_reader = DrawioTopologyReader()
    topology_from_drawio = drawio_reader.read(GENERATED_DRAWIO)
    print(
        "Read back from draw.io: "
        f"{len(topology_from_drawio.devices)} devices, {len(topology_from_drawio.links)} links"
    )

    csv_writer = CsvTopologyWriter(schema)
    csv_writer.write(ROUNDTRIP_CSV, topology_from_drawio.links)
    print(f"Wrote CSV exported from draw.io to {ROUNDTRIP_CSV}")


if __name__ == "__main__":
    main()
