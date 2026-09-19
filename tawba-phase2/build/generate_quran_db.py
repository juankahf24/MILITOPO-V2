#!/usr/bin/env python3
"""Generate Tawba's immutable Quran database from a pinned JSON source."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sqlite3
import unicodedata
from bisect import bisect_right
from pathlib import Path


def normalize(text: str) -> str:
    replacements = {"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ئ": "ي", "ؤ": "و", "ة": "ه"}
    output: list[str] = []
    for character in unicodedata.normalize("NFKD", text):
        code_point = ord(character)
        if unicodedata.category(character).startswith("M") or character == "ـ" or 0x06D6 <= code_point <= 0x06ED:
            continue
        output.append(replacements.get(character, character))
    normalized = re.sub(r"\s+", " ", "".join(output)).strip()
    for old, new in (("صلوه", "صلاه"), ("زكوه", "زكاه"), ("حيوه", "حياه"), ("مشكوه", "مشكاه"), ("الربوا", "الربا")):
        normalized = normalized.replace(old, new)
    return normalized


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("structure", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()

    chapters = json.loads(args.source.read_text(encoding="utf-8"))
    structure = json.loads(args.structure.read_text(encoding="utf-8"))
    page_starts = structure["page_starts"]
    juz_starts = structure["juz_starts"]
    if len(chapters) != 114 or len(page_starts) != 604 or len(juz_starts) != 30:
        raise SystemExit("Invalid Quran source or structure metadata")

    args.destination.parent.mkdir(parents=True, exist_ok=True)
    args.destination.unlink(missing_ok=True)
    database = sqlite3.connect(args.destination)
    database.executescript(
        """
        PRAGMA page_size=4096;
        PRAGMA journal_mode=OFF;
        PRAGMA synchronous=OFF;
        PRAGMA foreign_keys=ON;
        CREATE TABLE corpus_metadata(key TEXT NOT NULL PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE surahs(
          id INTEGER NOT NULL PRIMARY KEY,
          arabic_name TEXT NOT NULL,
          transliterated_name TEXT NOT NULL,
          verse_count INTEGER NOT NULL,
          has_separate_bismillah INTEGER NOT NULL CHECK(has_separate_bismillah IN (0,1))
        );
        CREATE TABLE ayahs(
          global_id INTEGER NOT NULL PRIMARY KEY,
          surah_id INTEGER NOT NULL,
          ayah_number INTEGER NOT NULL,
          text TEXT NOT NULL,
          page INTEGER NOT NULL,
          juz INTEGER NOT NULL,
          text_sha256 TEXT NOT NULL,
          FOREIGN KEY(surah_id) REFERENCES surahs(id),
          UNIQUE(surah_id, ayah_number)
        );
        CREATE TABLE ayah_search(
          global_id INTEGER NOT NULL PRIMARY KEY,
          normalized_text TEXT NOT NULL,
          FOREIGN KEY(global_id) REFERENCES ayahs(global_id)
        );
        CREATE INDEX idx_ayahs_surah_ayah ON ayahs(surah_id, ayah_number);
        CREATE INDEX idx_ayahs_page ON ayahs(page, global_id);
        CREATE INDEX idx_ayahs_juz ON ayahs(juz, global_id);
        """
    )

    global_id = 0
    display_texts: list[str] = []
    with database:
        for chapter in chapters:
            chapter_id = int(chapter["id"])
            verses = chapter["verses"]
            if chapter_id not in range(1, 115) or len(verses) != int(chapter["total_verses"]):
                raise SystemExit(f"Invalid chapter {chapter_id}")
            database.execute(
                "INSERT INTO surahs VALUES(?,?,?,?,?)",
                (chapter_id, chapter["name"], chapter["transliteration"], len(verses), 1 if chapter_id not in (1, 9) else 0),
            )
            for verse in verses:
                global_id += 1
                ayah_number = int(verse["id"])
                text = verse["text"]
                if ayah_number < 1 or not text.strip():
                    raise SystemExit(f"Invalid verse {chapter_id}:{ayah_number}")
                display_texts.append(text)
                database.execute(
                    "INSERT INTO ayahs VALUES(?,?,?,?,?,?,?)",
                    (global_id, chapter_id, ayah_number, text, bisect_right(page_starts, global_id), bisect_right(juz_starts, global_id), sha256_text(text)),
                )
                database.execute("INSERT INTO ayah_search VALUES(?,?)", (global_id, normalize(text)))

        if global_id != 6236:
            raise SystemExit(f"Expected 6236 ayahs, got {global_id}")
        metadata = {
            "arabic_text_serialized_sha256": sha256_text("\n".join(display_texts)),
            "ayah_count": "6236",
            "corpus_origin": "risan/quran-json v3.1.2 dist/quran.json",
            "corpus_status": "source_pinned_structure_verified_religious_certification_not_independently_established",
            "display_text_policy": "immutable; search normalization stored separately",
            "juz_count": "30",
            "page_count": "604",
            "schema_version": "2",
            "search_normalizer_version": "2",
            "surah_count": "114",
        }
        database.executemany("INSERT INTO corpus_metadata(key,value) VALUES (?,?)", sorted(metadata.items()))

    if database.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
        raise SystemExit("SQLite integrity check failed")
    counts = (
        database.execute("SELECT COUNT(*) FROM surahs").fetchone()[0],
        database.execute("SELECT COUNT(*) FROM ayahs").fetchone()[0],
        database.execute("SELECT COUNT(DISTINCT page) FROM ayahs").fetchone()[0],
        database.execute("SELECT COUNT(DISTINCT juz) FROM ayahs").fetchone()[0],
    )
    if counts != (114, 6236, 604, 30):
        raise SystemExit(f"Unexpected generated counts: {counts}")
    database.execute("VACUUM")
    database.close()
    print(hashlib.sha256(args.destination.read_bytes()).hexdigest())


if __name__ == "__main__":
    main()
