#!/usr/bin/env python3
from pathlib import Path

SOURCE = Path(
    "muslim-qi-design/app/src/main/java/com/muslimqi/design/FunctionalMainActivity.kt"
)


def main() -> None:
    lines = SOURCE.read_text(encoding="utf-8").splitlines(keepends=True)
    seen_imports: set[str] = set()
    cleaned: list[str] = []
    removed = 0

    for line in lines:
        if line.startswith("import "):
            normalized = line.strip()
            if normalized in seen_imports:
                removed += 1
                continue
            seen_imports.add(normalized)
        cleaned.append(line)

    SOURCE.write_text("".join(cleaned), encoding="utf-8")
    print(f"Removed {removed} duplicate Kotlin imports from {SOURCE}")


if __name__ == "__main__":
    main()
