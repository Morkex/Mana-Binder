"""Extract and structure Magic Comprehensive Rules from PDF."""
import json
import re
import sys
from pathlib import Path

import fitz

PDF_PATH = Path(__file__).resolve().parent.parent / "rules" / "MagicCompRules 20260619.pdf"
OUT_PATH = Path(__file__).resolve().parent.parent / "app" / "public" / "rules" / "comprehensive-rules.json"

PART_TITLES = {
    1: "Game Concepts",
    2: "Parts of a Card",
    3: "Card Types",
    4: "Zones",
    5: "Turn Structure",
    6: "Spells, Abilities, and Effects",
    7: "Additional Rules",
    8: "Multiplayer Rules",
    9: "Casual Variants",
}

SECTION_RE = re.compile(r"^(\d{3})\.\s+(.+)$")
RULE_RE = re.compile(r"^(\d{3}\.\d+)\.\s+(.+)$")
SUBRULE_RE = re.compile(r"^(\d{3}\.\d+[a-z])\s+(.+)$")
GLOSSARY_TERM_RE = re.compile(r"^[A-Za-z][A-Za-z0-9\-'/ ]*$")


def extract_text(pdf_path: Path) -> str:
    doc = fitz.open(pdf_path)
    parts: list[str] = []
    for page in doc:
        parts.append(page.get_text("text"))
    doc.close()
    return "\n".join(parts)


def clean_line(line: str) -> str:
    return re.sub(r"\s+", " ", line.strip())


def split_rules_and_glossary(lines: list[str]) -> tuple[list[str], list[str]]:
    glossary_indices = [i for i, line in enumerate(lines) if line == "Glossary"]
    if len(glossary_indices) < 2:
        raise ValueError("Could not locate glossary section")
    start_rules = glossary_indices[0] + 3
    start_glossary = glossary_indices[1] + 1
    return lines[start_rules:start_glossary], lines[start_glossary:]


def part_for_section(section_number: str) -> int:
    return int(section_number) // 100


def parse_rules_block(lines: list[str]) -> list[dict]:
    parts_map: dict[int, dict] = {}
    current_section: dict | None = None
    current_rule: dict | None = None
    current_subrule: dict | None = None
    current_text: list[str] = []

    def get_part(num: int) -> dict:
        if num not in parts_map:
            parts_map[num] = {
                "number": num,
                "title": PART_TITLES.get(num, f"Part {num}"),
                "sections": [],
            }
        return parts_map[num]

    def merge_pending_rule_text():
        nonlocal current_text
        if current_rule and current_subrule is None and current_text:
            extra = " ".join(current_text).strip()
            current_rule["text"] = (
                f"{current_rule['text']} {extra}".strip()
                if current_rule.get("text")
                else extra
            )
            current_text = []

    def flush_subrule():
        nonlocal current_subrule, current_text
        if current_subrule and current_rule:
            current_subrule["text"] = " ".join(current_text).strip()
            current_rule["subrules"].append(current_subrule)
            current_subrule = None
            current_text = []
        else:
            current_subrule = None

    def flush_rule():
        nonlocal current_rule, current_text
        flush_subrule()
        merge_pending_rule_text()
        if current_rule and current_section:
            current_section["rules"].append(current_rule)
        current_rule = None
        current_text = []

    for line in lines:
        if not line or line.startswith("Contents"):
            continue

        section_match = SECTION_RE.match(line)
        if section_match:
            flush_rule()
            num = section_match.group(1)
            current_section = {
                "number": num,
                "title": section_match.group(2),
                "rules": [],
            }
            get_part(part_for_section(num))["sections"].append(current_section)
            continue

        rule_match = RULE_RE.match(line)
        if rule_match:
            flush_rule()
            current_rule = {
                "number": rule_match.group(1),
                "text": rule_match.group(2),
                "subrules": [],
            }
            current_text = []
            continue

        subrule_match = SUBRULE_RE.match(line)
        if subrule_match:
            flush_subrule()
            merge_pending_rule_text()
            current_subrule = {"number": subrule_match.group(1), "text": ""}
            current_text = [subrule_match.group(2)]
            continue

        if current_subrule is not None:
            current_text.append(line)
        elif current_rule is not None:
            current_text.append(line)

    flush_rule()
    return [parts_map[k] for k in sorted(parts_map.keys())]


def parse_glossary_block(lines: list[str]) -> list[dict]:
    entries: list[dict] = []
    current_term: str | None = None
    current_def: list[str] = []

    def flush():
        nonlocal current_term, current_def
        if current_term:
            entries.append({"term": current_term, "definition": " ".join(current_def).strip()})
        current_term = None
        current_def = []

    for line in lines:
        if not line or line.startswith("Credits"):
            continue
        if GLOSSARY_TERM_RE.match(line) and len(line) < 80:
            flush()
            current_term = line
            continue
        if current_term:
            current_def.append(line)

    flush()
    return entries


def main() -> None:
    if not PDF_PATH.exists():
        print(f"PDF not found: {PDF_PATH}", file=sys.stderr)
        sys.exit(1)

    print(f"Reading {PDF_PATH}...")
    raw = extract_text(PDF_PATH)
    lines = [clean_line(l) for l in raw.splitlines()]
    lines = [l for l in lines if l]

    rule_lines, glossary_lines = split_rules_and_glossary(lines)
    parts = parse_rules_block(rule_lines)
    glossary = parse_glossary_block(glossary_lines)

    total_sections = sum(len(p["sections"]) for p in parts)
    total_rules = sum(len(s["rules"]) for p in parts for s in p["sections"])
    total_subrules = sum(
        len(r["subrules"]) for p in parts for s in p["sections"] for r in s["rules"]
    )

    data = {
        "title": "Magic: The Gathering Comprehensive Rules",
        "version": "June 19, 2026",
        "source": "MagicCompRules 20260619.pdf",
        "parts": parts,
        "glossary": sorted(glossary, key=lambda g: g["term"].lower()),
    }

    print(
        f"Parsed {len(parts)} parts, {total_sections} sections, "
        f"{total_rules} rules, {total_subrules} subrules, {len(glossary)} glossary terms"
    )

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Written to {OUT_PATH}")


if __name__ == "__main__":
    main()
