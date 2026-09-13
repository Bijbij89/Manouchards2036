"""Convertit ton ancien dossier grilles_jazz/data/*.json (projet Reflex) en
un seul fichier default-songs.json à placer dans le dossier de la PWA.

Utilisation (depuis le dossier qui contient à la fois grilles-jazz/ et
grilles-jazz-pwa/) :
    python export_bundle.py
"""
import json
from pathlib import Path

SRC = Path("grilles-jazz") / "grilles_jazz" / "data"
OUT = Path("grilles-jazz-pwa") / "default-songs.json"

library = {}
for f in sorted(SRC.glob("*.json")):
    with open(f, encoding="utf-8") as fh:
        library[f.stem] = json.load(fh)

OUT.write_text(json.dumps(library, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"{len(library)} grilles écrites dans {OUT}")
