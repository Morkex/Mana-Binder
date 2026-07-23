"""Actualiza datos de caras múltiples en cache y coleccion_maestra.json."""

import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from enriquecer_coleccion import (
    BATCH_SIZE,
    CACHE_FILE,
    MASTER_JSON,
    MULTI_FACE_LAYOUTS,
    REQUEST_DELAY,
    card_faces_for_app,
    download_multi_face_images,
    download_one,
    extract_card_info,
    fetch_batch,
    load_cache,
    save_cache,
)

BASE = ROOT
IMAGES_ROOT = BASE / "coleccion_organizada" / "imagenes"


def main() -> None:
    cache = load_cache()
    stale = [
        sid
        for sid, info in cache.items()
        if (info.get("layout") in MULTI_FACE_LAYOUTS or "//" in info.get("name_scryfall", ""))
        and not info.get("faces")
    ]
    print(f"Re-fetch Scryfall para {len(stale)} cartas de varias caras...")

    for i in range(0, len(stale), BATCH_SIZE):
        batch = stale[i : i + BATCH_SIZE]
        try:
            cards, _ = fetch_batch(batch)
        except urllib.error.HTTPError:
            time.sleep(1)
            cards, _ = fetch_batch(batch)
        for card in cards:
            cache[card["id"]] = extract_card_info(card)
        save_cache(cache)
        time.sleep(REQUEST_DELAY)

    with open(MASTER_JSON, encoding="utf-8") as f:
        master = json.load(f)

    rows = []
    for card in master["cards"]:
        info = cache.get(card["id"])
        row = {
            "Scryfall ID": card["id"],
            "Image local": card["images"].get("local") or "",
            "Image local HQ": card["images"].get("localHq") or "",
            "Image local back": "",
            "Image local HQ back": "",
        }
        faces = card_faces_for_app(info, row)
        if info and info.get("layout"):
            card["layout"] = info["layout"]
        if info and info.get("oracle_text"):
            card["oracleText"] = info["oracle_text"]
        if info and info.get("type_line"):
            card["typeLine"] = info["type_line"]
        if info and info.get("mana_cost"):
            card["manaCost"] = info["mana_cost"]
        if faces:
            card["faces"] = faces
        rows.append(row)

    download_multi_face_images(rows, cache, IMAGES_ROOT)

    by_id = {row["Scryfall ID"]: row for row in rows}
    for card in master["cards"]:
        row = by_id.get(card["id"])
        if not row or not card.get("faces"):
            continue
        card["faces"][0]["images"]["local"] = row.get("Image local") or card["faces"][0]["images"].get("local")
        card["faces"][0]["images"]["localHq"] = row.get("Image local HQ") or card["faces"][0]["images"].get("localHq")
        if len(card["faces"]) > 1:
            card["faces"][1]["images"]["local"] = row.get("Image local back") or card["faces"][1]["images"].get("local")
            card["faces"][1]["images"]["localHq"] = row.get("Image local HQ back") or card["faces"][1]["images"].get("localHq")

    with open(MASTER_JSON, "w", encoding="utf-8") as f:
        json.dump(master, f, ensure_ascii=False, indent=2)

    patched = sum(1 for c in master["cards"] if c.get("faces"))
    print(f"Listo: {patched} cartas con caras en {MASTER_JSON}")


if __name__ == "__main__":
    main()
