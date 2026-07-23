"""Organiza la colección de Magic exportada desde ManaBox en varios CSV."""

import csv
import os
from collections import defaultdict

INPUT = os.path.join(os.path.dirname(__file__), "Colección .csv")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "coleccion_organizada")

RARITY_LABELS = {
    "common": "comunes",
    "uncommon": "infrecuentes",
    "rare": "raras",
    "mythic": "miticas",
    "special": "especiales",
}

LANGUAGE_LABELS = {
    "en": "ingles",
    "es": "espanol",
}


def read_collection(path: str) -> tuple[list[str], list[dict]]:
    with open(path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or []
        rows = list(reader)
    return fieldnames, rows


def write_csv(path: str, fieldnames: list[str], rows: list[dict]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def sort_rows(rows: list[dict]) -> list[dict]:
    return sorted(rows, key=lambda r: (r["Name"].lower(), r["Set code"], r["Foil"]))


def main() -> None:
    fieldnames, rows = read_collection(INPUT)
    sorted_rows = sort_rows(rows)

    # Por rareza
    by_rarity: dict[str, list[dict]] = defaultdict(list)
    for row in sorted_rows:
        by_rarity[row["Rarity"]].append(row)

    rarity_dir = os.path.join(OUTPUT_DIR, "por_rareza")
    for rarity, label in RARITY_LABELS.items():
        if rarity in by_rarity:
            write_csv(
                os.path.join(rarity_dir, f"{label}.csv"),
                fieldnames,
                by_rarity[rarity],
            )

    # Por idioma
    by_language: dict[str, list[dict]] = defaultdict(list)
    for row in sorted_rows:
        by_language[row["Language"]].append(row)

    language_dir = os.path.join(OUTPUT_DIR, "por_idioma")
    for lang, label in LANGUAGE_LABELS.items():
        if lang in by_language:
            write_csv(
                os.path.join(language_dir, f"{label}.csv"),
                fieldnames,
                by_language[lang],
            )

    # Foils y normales
    foils = [r for r in sorted_rows if r["Foil"] == "foil"]
    normals = [r for r in sorted_rows if r["Foil"] == "normal"]
    write_csv(os.path.join(OUTPUT_DIR, "foils.csv"), fieldnames, foils)
    write_csv(os.path.join(OUTPUT_DIR, "normales.csv"), fieldnames, normals)

    # Por set
    by_set: dict[str, list[dict]] = defaultdict(list)
    set_names: dict[str, str] = {}
    for row in sorted_rows:
        code = row["Set code"]
        by_set[code].append(row)
        set_names[code] = row["Set name"]

    set_dir = os.path.join(OUTPUT_DIR, "por_set")
    for code in sorted(by_set.keys()):
        safe_name = code.replace("/", "-")
        write_csv(os.path.join(set_dir, f"{safe_name}.csv"), fieldnames, by_set[code])

    # Resumen por set
    summary_fields = [
        "Set code",
        "Set name",
        "Entradas",
        "Cantidad total",
        "Foils",
        "Valor compra (EUR)",
    ]
    summary_rows = []
    for code in sorted(by_set.keys()):
        set_rows = by_set[code]
        qty = sum(int(r["Quantity"]) for r in set_rows)
        foils_count = sum(int(r["Quantity"]) for r in set_rows if r["Foil"] == "foil")
        value = sum(
            float(r["Purchase price"] or 0) * int(r["Quantity"]) for r in set_rows
        )
        summary_rows.append(
            {
                "Set code": code,
                "Set name": set_names[code],
                "Entradas": len(set_rows),
                "Cantidad total": qty,
                "Foils": foils_count,
                "Valor compra (EUR)": round(value, 2),
            }
        )

    write_csv(os.path.join(OUTPUT_DIR, "resumen_por_set.csv"), summary_fields, summary_rows)

    # Resumen general
    total_qty = sum(int(r["Quantity"]) for r in rows)
    total_value = sum(
        float(r["Purchase price"] or 0) * int(r["Quantity"]) for r in rows
    )
    general_summary = [
        {"Metrica": "Total entradas (filas)", "Valor": len(rows)},
        {"Metrica": "Total cartas (cantidad)", "Valor": total_qty},
        {"Metrica": "Sets distintos", "Valor": len(by_set)},
        {"Metrica": "Foils (entradas)", "Valor": len(foils)},
        {"Metrica": "Normales (entradas)", "Valor": len(normals)},
        {"Metrica": "Cartas en ingles", "Valor": sum(int(r["Quantity"]) for r in by_language.get("en", []))},
        {"Metrica": "Cartas en espanol", "Valor": sum(int(r["Quantity"]) for r in by_language.get("es", []))},
        {"Metrica": "Comunes", "Valor": sum(int(r["Quantity"]) for r in by_rarity.get("common", []))},
        {"Metrica": "Infrecuentes", "Valor": sum(int(r["Quantity"]) for r in by_rarity.get("uncommon", []))},
        {"Metrica": "Raras", "Valor": sum(int(r["Quantity"]) for r in by_rarity.get("rare", []))},
        {"Metrica": "Miticas", "Valor": sum(int(r["Quantity"]) for r in by_rarity.get("mythic", []))},
        {"Metrica": "Valor total compra (EUR)", "Valor": round(total_value, 2)},
    ]
    write_csv(
        os.path.join(OUTPUT_DIR, "resumen_general.csv"),
        ["Metrica", "Valor"],
        general_summary,
    )

    print(f"Coleccion organizada en: {OUTPUT_DIR}")
    print(f"  - por_rareza/: {len(by_rarity)} archivos")
    print(f"  - por_idioma/: {len(by_language)} archivos")
    print(f"  - por_set/: {len(by_set)} archivos")
    print(f"  - foils.csv, normales.csv")
    print(f"  - resumen_general.csv, resumen_por_set.csv")


if __name__ == "__main__":
    main()
