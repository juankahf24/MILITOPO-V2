#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
PROJECT="$ROOT/tawba-android"
DELIVERY="$ROOT/delivery"

cd "$PROJECT"
zip -qr "$ROOT/Tawba-4.0.0-Phase1-Clean-Source.zip" . \
  -x 'app/build/*' '.gradle/*' 'docs/qa/*'
sha256sum "$ROOT/Tawba-4.0.0-Phase1-Clean-Source.zip" \
  | tee docs/qa/source-sha256.txt

cd "$ROOT"
rm -rf "$DELIVERY"
mkdir -p "$DELIVERY/qa"
cp "$PROJECT/app/build/outputs/apk/qa/app-qa.apk" \
  "$DELIVERY/Tawba-4.0.0-Phase1-Clean-QA.apk"
cp "$PROJECT/app/build/outputs/apk/debug/app-debug.apk" \
  "$DELIVERY/Tawba-4.0.0-Phase1-Clean-debug.apk"
cp "$ROOT/Tawba-4.0.0-Phase1-Clean-Source.zip" "$DELIVERY/"
cp -R "$PROJECT/docs/qa/." "$DELIVERY/qa/"
cp "$PROJECT/docs/PHASE1_STATUS.md" "$DELIVERY/"
cp "$PROJECT/docs/QURAN_SOURCE.md" "$DELIVERY/"
sha256sum \
  "$DELIVERY/Tawba-4.0.0-Phase1-Clean-QA.apk" \
  "$DELIVERY/Tawba-4.0.0-Phase1-Clean-debug.apk" \
  "$DELIVERY/Tawba-4.0.0-Phase1-Clean-Source.zip" \
  > "$DELIVERY/SHA256SUMS.txt"
