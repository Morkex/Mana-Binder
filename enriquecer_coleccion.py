"""
Enriquece la colección de Magic con datos de Scryfall (color, imágenes, etc.)
y genera CSVs organizados por color + JSON maestro.

Imágenes híbridas:
  - imagenes/normal/  → grid (Scryfall normal, ~JPG)
  - imagenes/hq/      → detalle (Scryfall png, máxima calidad)
"""

import csv
import json
import time
import urllib.error
import urllib.request
from collections import defaultdict
from pathlib import Path

BASE_DIR = Path(__file__).parent
INPUT = BASE_DIR / "Colección .csv"
OUTPUT_DIR = BASE_DIR / "coleccion_organizada"
CACHE_FILE = OUTPUT_DIR / "scryfall_cache.json"
MASTER_JSON = OUTPUT_DIR / "coleccion_maestra.json"

SCRYFALL_COLLECTION = "https://api.scryfall.com/cards/collection"
BATCH_SIZE = 75
REQUEST_DELAY = 0.12
IMAGE_DELAY = 0.05
HEADERS_JSON = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "User-Agent": "TestCursorMagic/1.0 (coleccion-magic)",
}
HEADERS_IMG = {
    "Accept": "*/*",
    "User-Agent": "TestCursorMagic/1.0 (coleccion-magic)",
}

COLOR_LABELS = {
    "C": "incoloro",
    "W": "blanco",
    "U": "azul",
    "B": "negro",
    "R": "rojo",
    "G": "verde",
}

EXTRA_FIELDS = [
    "Colors",
    "Color identity",
    "Color category",
    "Type line",
    "Mana cost",
    "CMC",
    "Oracle text",
    "Power",
    "Toughness",
    "Loyalty",
    "Keywords",
    "Commander legal",
    "Image URL",
    "Image URL small",
    "Image URL large",
    "Image URL png",
    "Image URL art",
    "Image local",
    "Image local HQ",
]


def load_cache() -> dict:
    if CACHE_FILE.exists():
        with open(CACHE_FILE, encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_cache(cache: dict) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def fetch_batch(ids: list[str]) -> tuple[list[dict], list[dict]]:
    payload = json.dumps({"identifiers": [{"id": sid} for sid in ids]}).encode("utf-8")
    req = urllib.request.Request(
        SCRYFALL_COLLECTION,
        data=payload,
        headers=HEADERS_JSON,
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.load(resp)
    return data.get("data", []), data.get("not_found", [])


def get_image_uris(card: dict) -> dict:
    if card.get("image_uris"):
        return card["image_uris"]
    faces = card.get("card_faces") or []
    for face in faces:
        if face.get("image_uris"):
            return face["image_uris"]
    return {}


MULTI_FACE_LAYOUTS = {
    "transform",
    "modal_dfc",
    "adventure",
    "meld",
    "split",
    "flip",
    "reversible_card",
}


def extract_face_info(face: dict) -> dict:
    images = face.get("image_uris") or {}
    return {
        "name": face.get("name") or "",
        "type_line": face.get("type_line") or "",
        "mana_cost": face.get("mana_cost") or "",
        "oracle_text": face.get("oracle_text") or "",
        "power": face.get("power") or "",
        "toughness": face.get("toughness") or "",
        "loyalty": face.get("loyalty") or "",
        "image_url": images.get("normal") or images.get("large") or "",
        "image_url_small": images.get("small") or "",
        "image_url_large": images.get("large") or "",
        "image_url_png": images.get("png") or images.get("large") or "",
        "image_url_art": images.get("art_crop") or images.get("border_crop") or "",
    }


def extract_card_info(card: dict) -> dict:
    layout = card.get("layout") or ""
    card_faces = card.get("card_faces") or []
    faces = [extract_face_info(face) for face in card_faces] if len(card_faces) > 1 else []

    if faces:
        primary = card_faces[0]
        images = primary.get("image_uris") or get_image_uris(card)
        type_line = " // ".join(face["type_line"] for face in faces if face["type_line"])
        mana_cost = " // ".join(face["mana_cost"] for face in faces if face["mana_cost"])
        oracle_text = " // ".join(face["oracle_text"] for face in faces if face["oracle_text"])
        power = faces[0].get("power") or ""
        toughness = faces[0].get("toughness") or ""
        loyalty = faces[0].get("loyalty") or ""
    else:
        images = get_image_uris(card)
        type_line = card.get("type_line") or ""
        mana_cost = card.get("mana_cost") or ""
        oracle_text = card.get("oracle_text") or ""
        power = card.get("power") or ""
        toughness = card.get("toughness") or ""
        loyalty = card.get("loyalty") or ""

    color_identity = card.get("color_identity") or []
    colors = card.get("colors") or []

    if len(color_identity) == 0:
        category = "C"
    elif len(color_identity) == 1:
        category = color_identity[0]
    else:
        category = "M"

    legalities = card.get("legalities") or {}
    return {
        "colors": "".join(sorted(colors)),
        "color_identity": "".join(sorted(color_identity)),
        "color_category": category,
        "type_line": type_line,
        "mana_cost": mana_cost,
        "cmc": card.get("cmc", 0),
        "oracle_text": oracle_text,
        "power": power,
        "toughness": toughness,
        "loyalty": loyalty,
        "keywords": ", ".join(card.get("keywords") or []),
        "commander_legal": legalities.get("commander") == "legal",
        "image_url": images.get("normal") or images.get("large") or "",
        "image_url_small": images.get("small") or "",
        "image_url_large": images.get("large") or "",
        "image_url_png": images.get("png") or images.get("large") or "",
        "image_url_art": images.get("art_crop") or images.get("border_crop") or "",
        "name_scryfall": card.get("name") or "",
        "layout": layout,
        "faces": faces,
    }


def cache_needs_image_urls(info: dict) -> bool:
    if not info.get("image_url_png") or not info.get("image_url_large"):
        return True
    layout = info.get("layout") or ""
    if layout in MULTI_FACE_LAYOUTS and not info.get("faces"):
        return True
    return False


def fetch_all_scryfall_ids(unique_ids: list[str], cache: dict) -> dict:
    missing = [
        sid
        for sid in unique_ids
        if sid not in cache or cache_needs_image_urls(cache[sid])
    ]
    total_batches = (len(missing) + BATCH_SIZE - 1) // BATCH_SIZE
    print(f"Scryfall: {len(unique_ids)} IDs unicos, {len(missing)} por actualizar")

    for i in range(0, len(missing), BATCH_SIZE):
        batch = missing[i : i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        print(f"  Lote {batch_num}/{total_batches} ({len(batch)} cartas)...")
        try:
            cards, not_found = fetch_batch(batch)
            for card in cards:
                cache[card["id"]] = extract_card_info(card)
            if not_found:
                print(f"    {len(not_found)} no encontradas en Scryfall")
        except urllib.error.HTTPError as exc:
            print(f"  Error HTTP {exc.code}, reintentando en 1s...")
            time.sleep(1)
            cards, not_found = fetch_batch(batch)
            for card in cards:
                cache[card["id"]] = extract_card_info(card)
        save_cache(cache)
        time.sleep(REQUEST_DELAY)

    return cache


def color_category_label(category: str, color_identity: str) -> str:
    if category == "M":
        return f"multicolor_{color_identity.lower()}" if color_identity else "multicolor"
    return COLOR_LABELS.get(category, "desconocido")


def enrich_row(row: dict, info: dict | None) -> dict:
    enriched = dict(row)
    if not info:
        for field in EXTRA_FIELDS:
            enriched[field] = ""
        enriched["Commander legal"] = "unknown"
        return enriched

    enriched["Colors"] = info["colors"]
    enriched["Color identity"] = info["color_identity"]
    enriched["Color category"] = info["color_category"]
    enriched["Type line"] = info["type_line"]
    enriched["Mana cost"] = info["mana_cost"]
    enriched["CMC"] = str(info["cmc"])
    enriched["Oracle text"] = info["oracle_text"]
    enriched["Power"] = info["power"]
    enriched["Toughness"] = info["toughness"]
    enriched["Loyalty"] = info["loyalty"]
    enriched["Keywords"] = info["keywords"]
    enriched["Commander legal"] = "legal" if info["commander_legal"] else "not_legal"
    enriched["Image URL"] = info["image_url"]
    enriched["Image URL small"] = info["image_url_small"]
    enriched["Image URL large"] = info.get("image_url_large", "")
    enriched["Image URL png"] = info.get("image_url_png", "")
    enriched["Image URL art"] = info["image_url_art"]
    enriched["Image local"] = ""
    enriched["Image local HQ"] = ""
    enriched["Image local back"] = ""
    enriched["Image local HQ back"] = ""
    return enriched


def write_csv(path: Path, fieldnames: list[str], rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def download_one(url: str, dest: Path) -> bool:
    try:
        req = urllib.request.Request(url, headers=HEADERS_IMG)
        with urllib.request.urlopen(req, timeout=60) as resp:
            dest.write_bytes(resp.read())
        return True
    except Exception as exc:
        print(f"  Fallo {dest.name}: {exc}")
        if dest.exists():
            dest.unlink(missing_ok=True)
        return False


def download_image_tier(
    rows: list[dict],
    *,
    url_field: str,
    dest_dir: Path,
    rel_prefix: str,
    local_field: str,
    label: str,
) -> None:
    dest_dir.mkdir(parents=True, exist_ok=True)
    to_download: dict[str, str] = {}
    for row in rows:
        sid = row["Scryfall ID"]
        url = row.get(url_field) or ""
        if sid and url and sid not in to_download:
            to_download[sid] = url

    print(f"Descargando {label}: {len(to_download)} imagenes -> {dest_dir}...")
    downloaded = 0
    skipped = 0
    failed = 0

    for i, (sid, url) in enumerate(to_download.items(), 1):
        ext = ".png" if ".png" in url.split("?")[0].lower() else ".jpg"
        dest = dest_dir / f"{sid}{ext}"
        rel_path = f"{rel_prefix}/{sid}{ext}"

        if dest.exists() and dest.stat().st_size > 1000:
            skipped += 1
        else:
            ok = download_one(url, dest)
            if ok:
                downloaded += 1
                time.sleep(IMAGE_DELAY)
            else:
                failed += 1
                continue

            if i % 50 == 0:
                print(f"  {i}/{len(to_download)}...")

        for row in rows:
            if row["Scryfall ID"] == sid:
                row[local_field] = rel_path.replace("\\", "/")

    print(f"  {label}: nuevas={downloaded}, existentes={skipped}, fallos={failed}")


def download_multi_face_images(rows: list[dict], cache: dict, images_root: Path) -> None:
    """Descarga imágenes de la cara trasera para cartas de doble cara."""
    normal_dir = images_root / "normal"
    hq_dir = images_root / "hq"
    normal_dir.mkdir(parents=True, exist_ok=True)
    hq_dir.mkdir(parents=True, exist_ok=True)

    targets: dict[str, dict[str, str]] = {}
    for row in rows:
        sid = row["Scryfall ID"]
        info = cache.get(sid)
        if not info:
            continue
        faces = info.get("faces") or []
        if len(faces) < 2:
            continue
        back = faces[1]
        targets[sid] = {
            "normal": back.get("image_url") or "",
            "png": back.get("image_url_png") or "",
        }

    if not targets:
        return

    print(f"Descargando caras traseras: {len(targets)} cartas...")
    for sid, urls in targets.items():
        for tier, dest_dir, rel_prefix, field, url in (
            ("normal", normal_dir, "imagenes/normal", "Image local back", urls["normal"]),
            ("png HQ", hq_dir, "imagenes/hq", "Image local HQ back", urls["png"]),
        ):
            if not url:
                continue
            ext = ".png" if ".png" in url.split("?")[0].lower() else ".jpg"
            dest = dest_dir / f"{sid}_back{ext}"
            rel_path = f"{rel_prefix}/{sid}_back{ext}"
            if not dest.exists() or dest.stat().st_size <= 1000:
                download_one(url, dest)
                time.sleep(IMAGE_DELAY)
            for row in rows:
                if row["Scryfall ID"] == sid:
                    row[field] = rel_path.replace("\\", "/")


def face_images_from_info(face: dict, row: dict, suffix: str = "") -> dict:
    return {
        "small": face.get("image_url_small") or "",
        "normal": face.get("image_url") or "",
        "large": face.get("image_url_large") or "",
        "png": face.get("image_url_png") or "",
        "art": face.get("image_url_art") or "",
        "local": row.get(f"Image local{suffix}") or "",
        "localHq": row.get(f"Image local HQ{suffix}") or "",
    }


def card_faces_for_app(info: dict | None, row: dict) -> list[dict]:
    if not info:
        return []
    faces = info.get("faces") or []
    if len(faces) < 2:
        return []

    suffixes = ["", " back"]
    out = []
    for idx, face in enumerate(faces):
        suffix = suffixes[idx] if idx < len(suffixes) else f" {idx + 1}"
        out.append(
            {
                "name": face.get("name") or "",
                "typeLine": face.get("type_line") or "",
                "manaCost": face.get("mana_cost") or "",
                "oracleText": face.get("oracle_text") or "",
                "power": face.get("power") or None,
                "toughness": face.get("toughness") or None,
                "loyalty": face.get("loyalty") or None,
                "images": face_images_from_info(face, row, suffix),
            }
        )
    return out


def cleanup_legacy_flat_images(images_root: Path) -> None:
    """Elimina JPG planos antiguos (small) de imagenes/ dejando solo subcarpetas."""
    removed = 0
    for path in images_root.glob("*.jpg"):
        path.unlink(missing_ok=True)
        removed += 1
    for path in images_root.glob("*.png"):
        if path.is_file():
            path.unlink(missing_ok=True)
            removed += 1
    if removed:
        print(f"Eliminadas {removed} imagenes legacy en imagenes/")


def main() -> None:
    with open(INPUT, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        original_fields = reader.fieldnames or []
        rows = list(reader)

    unique_ids = sorted({r["Scryfall ID"] for r in rows if r["Scryfall ID"]})
    cache = load_cache()
    cache = fetch_all_scryfall_ids(unique_ids, cache)

    enriched_rows = []
    for row in rows:
        info = cache.get(row["Scryfall ID"])
        enriched_rows.append(enrich_row(row, info))

    fieldnames = original_fields + EXTRA_FIELDS
    enriched_rows.sort(key=lambda r: (r["Name"].lower(), r["Set code"], r["Foil"]))

    images_root = OUTPUT_DIR / "imagenes"
    download_image_tier(
        enriched_rows,
        url_field="Image URL",
        dest_dir=images_root / "normal",
        rel_prefix="imagenes/normal",
        local_field="Image local",
        label="normal (grid)",
    )
    download_image_tier(
        enriched_rows,
        url_field="Image URL png",
        dest_dir=images_root / "hq",
        rel_prefix="imagenes/hq",
        local_field="Image local HQ",
        label="png HQ (detalle)",
    )
    download_multi_face_images(enriched_rows, cache, images_root)
    cleanup_legacy_flat_images(images_root)

    write_csv(OUTPUT_DIR / "coleccion_completa.csv", fieldnames, enriched_rows)

    by_color: dict[str, list[dict]] = defaultdict(list)
    for row in enriched_rows:
        cat = row["Color category"] or "?"
        if cat == "M":
            label = color_category_label("M", row["Color identity"])
        else:
            label = COLOR_LABELS.get(cat, "desconocido")
        by_color[label].append(row)

    color_dir = OUTPUT_DIR / "por_color"
    for label, color_rows in sorted(by_color.items()):
        write_csv(color_dir / f"{label}.csv", fieldnames, color_rows)

    simple_groups = {
        "monocolor": [r for r in enriched_rows if len(r["Color identity"]) == 1],
        "multicolor": [r for r in enriched_rows if len(r["Color identity"]) > 1],
        "incoloro": [r for r in enriched_rows if len(r["Color identity"]) == 0],
        "commander_legal": [r for r in enriched_rows if r["Commander legal"] == "legal"],
    }
    simple_dir = OUTPUT_DIR / "por_color_grupos"
    for name, group_rows in simple_groups.items():
        write_csv(simple_dir / f"{name}.csv", fieldnames, group_rows)

    cards_for_app = []
    for row in enriched_rows:
        info = cache.get(row["Scryfall ID"])
        card_obj = {
            "id": row["Scryfall ID"],
            "manaboxId": row["ManaBox ID"],
            "name": row["Name"],
            "setCode": row["Set code"],
            "setName": row["Set name"],
            "collectorNumber": row["Collector number"],
            "foil": row["Foil"] == "foil",
            "rarity": row["Rarity"],
            "quantity": int(row["Quantity"]),
            "condition": row["Condition"],
            "language": row["Language"],
            "purchasePrice": float(row["Purchase price"] or 0),
            "currency": row["Purchase price currency"],
            "colors": list(row["Colors"]),
            "colorIdentity": list(row["Color identity"]),
            "typeLine": row["Type line"],
            "manaCost": row["Mana cost"],
            "cmc": float(row["CMC"] or 0),
            "oracleText": row["Oracle text"],
            "power": row["Power"] or None,
            "toughness": row["Toughness"] or None,
            "loyalty": row["Loyalty"] or None,
            "keywords": [k.strip() for k in row["Keywords"].split(",") if k.strip()],
            "commanderLegal": row["Commander legal"] == "legal",
            "images": {
                "small": row["Image URL small"],
                "normal": row["Image URL"],
                "large": row["Image URL large"],
                "png": row["Image URL png"],
                "art": row["Image URL art"],
                "local": row["Image local"],
                "localHq": row["Image local HQ"],
            },
        }
        faces = card_faces_for_app(info, row)
        if info and info.get("layout"):
            card_obj["layout"] = info["layout"]
        if faces:
            card_obj["faces"] = faces
        cards_for_app.append(card_obj)

    master = {
        "version": 2,
        "source": "ManaBox + Scryfall",
        "imageStrategy": {
            "grid": "normal (local)",
            "detail": "png (local HQ)",
        },
        "totalEntries": len(enriched_rows),
        "totalQuantity": sum(int(r["Quantity"]) for r in enriched_rows),
        "uniqueCards": len(unique_ids),
        "colorGroups": {k: len(v) for k, v in by_color.items()},
        "cards": cards_for_app,
    }
    with open(MASTER_JSON, "w", encoding="utf-8") as f:
        json.dump(master, f, ensure_ascii=False, indent=2)

    normal_count = len(list((images_root / "normal").glob("*"))) if (images_root / "normal").exists() else 0
    hq_count = len(list((images_root / "hq").glob("*"))) if (images_root / "hq").exists() else 0
    print(f"\nListo en {OUTPUT_DIR}")
    print(f"  coleccion_maestra.json ({len(cards_for_app)} entradas, v2)")
    print(f"  imagenes/normal/: {normal_count}")
    print(f"  imagenes/hq/: {hq_count}")


if __name__ == "__main__":
    main()
