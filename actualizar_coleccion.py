"""Actualiza toda la colección: organización básica + enriquecimiento Scryfall."""

import subprocess
import sys
from pathlib import Path

BASE = Path(__file__).parent


def main() -> None:
    scripts = [
        BASE / "organizar_coleccion.py",
        BASE / "enriquecer_coleccion.py",
    ]
    for script in scripts:
        print(f"\n{'=' * 60}\nEjecutando {script.name}...\n{'=' * 60}")
        result = subprocess.run([sys.executable, str(script)], check=False)
        if result.returncode != 0:
            print(f"Error en {script.name} (codigo {result.returncode})")
            sys.exit(result.returncode)
    print("\nColeccion actualizada por completo.")


if __name__ == "__main__":
    main()
