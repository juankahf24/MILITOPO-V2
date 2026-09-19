#!/usr/bin/env python3
import hashlib
import json
import re
import sqlite3
import time
import unicodedata
import urllib.request
from pathlib import Path

URL = "https://api.alquran.cloud/v1/quran/quran-uthmani"


def download_payload():
    last_error = None
    for attempt in range(5):
        try:
            request = urllib.request.Request(URL, headers={"User-Agent": "Tawba-QA-Builder/1.0"})
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.load(response)
        except Exception as exc:
            last_error = exc
            time.sleep(3 * (attempt + 1))
    raise SystemExit(f"Quran API download failed: {last_error}")


def normalize_arabic(value: str) -> str:
    value = unicodedata.normalize("NFKC", value)
    value = re.sub(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]", "", value)
    return value.translate(str.maketrans({
        "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
        "ى": "ي", "ؤ": "و", "ئ": "ي", "ة": "ه",
    }))


def main():
    payload = download_payload()
    data = payload.get("data", payload)
    surahs = data.get("surahs", [])
    if len(surahs) != 114:
        raise SystemExit(f"Expected 114 surahs, received {len(surahs)}")

    output = Path("Tawba/core/database/src/main/assets/databases/tawba_quran.db")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.unlink(missing_ok=True)
    connection = sqlite3.connect(output)
    connection.executescript("""
    PRAGMA page_size=4096;
    PRAGMA journal_mode=DELETE;
    PRAGMA synchronous=FULL;
    CREATE TABLE corpus_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE surahs (
        id INTEGER PRIMARY KEY,
        arabic_name TEXT NOT NULL,
        transliterated_name TEXT NOT NULL,
        verse_count INTEGER NOT NULL,
        has_separate_bismillah INTEGER NOT NULL
    );
    CREATE TABLE ayahs (
        global_id INTEGER PRIMARY KEY,
        surah_id INTEGER NOT NULL,
        ayah_number INTEGER NOT NULL,
        text TEXT NOT NULL,
        page INTEGER NOT NULL,
        juz INTEGER NOT NULL,
        text_sha256 TEXT NOT NULL,
        UNIQUE(surah_id, ayah_number)
    );
    CREATE TABLE ayah_search (
        global_id INTEGER PRIMARY KEY,
        normalized_text TEXT NOT NULL
    );
    CREATE INDEX idx_ayahs_surah ON ayahs(surah_id, ayah_number);
    CREATE INDEX idx_ayahs_page ON ayahs(page, global_id);
    CREATE INDEX idx_ayahs_juz ON ayahs(juz, global_id);
    """)
    metadata = {
        "corpus_origin": URL,
        "corpus_status": "qa_build_external_uthmani_source_structurally_verified",
        "build_purpose": "installable_QA_APK_before_phase_2",
        "canonical_identity": "not_certified_for_release",
    }
    connection.executemany("INSERT INTO corpus_metadata(key, value) VALUES (?, ?)", metadata.items())

    count = 0
    for surah in surahs:
        ayahs = surah.get("ayahs", [])
        sid = int(surah["number"])
        connection.execute(
            "INSERT INTO surahs VALUES (?, ?, ?, ?, ?)",
            (sid, surah.get("name", ""), surah.get("englishName", f"Surah {sid}"), len(ayahs), 0 if sid in (1, 9) else 1),
        )
        for ayah in ayahs:
            text = str(ayah["text"]).strip()
            global_id = int(ayah["number"])
            number_in_surah = int(ayah["numberInSurah"])
            page = int(ayah["page"])
            juz = int(ayah["juz"])
            digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
            connection.execute(
                "INSERT INTO ayahs VALUES (?, ?, ?, ?, ?, ?, ?)",
                (global_id, sid, number_in_surah, text, page, juz, digest),
            )
            connection.execute(
                "INSERT INTO ayah_search VALUES (?, ?)",
                (global_id, normalize_arabic(text)),
            )
            count += 1

    connection.commit()
    integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
    page_count = connection.execute("SELECT COUNT(DISTINCT page) FROM ayahs").fetchone()[0]
    juz_count = connection.execute("SELECT COUNT(DISTINCT juz) FROM ayahs").fetchone()[0]
    connection.close()
    if (count, page_count, juz_count, integrity) != (6236, 604, 30, "ok"):
        raise SystemExit(
            f"Corpus structure invalid: ayahs={count}, pages={page_count}, juz={juz_count}, integrity={integrity}"
        )

    db_hash = hashlib.sha256(output.read_bytes()).hexdigest()
    kotlin = Path("Tawba/core/database/src/main/kotlin/com/tawba/core/database/QuranDatabase.kt")
    source = kotlin.read_text(encoding="utf-8")
    source, replacements = re.subn(
        r'private const val EXPECTED_DATABASE_SHA256 = "[0-9a-f]{64}"',
        f'private const val EXPECTED_DATABASE_SHA256 = "{db_hash}"',
        source,
    )
    if replacements != 1:
        raise SystemExit("Unable to patch expected database SHA-256")
    kotlin.write_text(source, encoding="utf-8")
    Path("/tmp/quran-db-sha256.txt").write_text(db_hash + "\n", encoding="utf-8")
    print(f"Quran DB: {count} ayahs, 604 pages, 30 juz, SHA-256 {db_hash}")


if __name__ == "__main__":
    main()
