#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
PROJECT="$ROOT/tawba-android"
QA="$PROJECT/docs/qa"

preserve_diagnostics() {
  mkdir -p "$QA"
  if [ -d "$PROJECT/app/build/reports" ]; then
    cp -R "$PROJECT/app/build/reports/." "$QA/build-reports/" 2>/dev/null || true
  fi
  find "$PROJECT/app/build/intermediates" -type f \
    \( -name 'lint-results-*.txt' -o -name 'lint-results-*.sarif' -o -name 'lint-results-*.html' \) \
    -exec cp -f {} "$QA/" \; 2>/dev/null || true
}
trap preserve_diagnostics EXIT

rm -rf "$PROJECT" "$ROOT/delivery"
mkdir -p "$PROJECT" "$QA"

cat tawba-bootstrap/source.zip.b64.part* | base64 --decode > /tmp/tawba-source.zip
python3 - <<'PY'
from pathlib import Path
import zipfile
archive = Path('/tmp/tawba-source.zip')
target = Path('tawba-android')
with zipfile.ZipFile(archive) as zf:
    bad = zf.testzip()
    if bad is not None:
        raise SystemExit(f'CRC invalide: {bad}')
    entries = len(zf.infolist())
    zf.extractall(target)
if not (target / 'settings.gradle.kts').is_file():
    raise SystemExit('Projet Gradle absent après extraction')
print(f'Archive source validée: {entries} entrées')
PY

cat tawba-bootstrap/clean-overlay.b64.part* | base64 --decode > /tmp/tawba-clean-overlay.tar.gz
echo 'e6863d0c92ab0737258cf3085baae019f3b80ad7b03f31f07396c4f33f9c2f83  /tmp/tawba-clean-overlay.tar.gz' | sha256sum --check
tar -xzf /tmp/tawba-clean-overlay.tar.gz -C "$PROJECT"
cp -a tawba-bootstrap/overlay/. "$PROJECT/"
rm -f "$PROJECT/app/lint-baseline.xml"
test -f "$PROJECT/app/src/main/assets/licenses/QURAN-CORPUS-NOTICE.txt"
grep -q 'compileSdk = 36' "$PROJECT/app/build.gradle.kts"
grep -q 'targetSdk = 36' "$PROJECT/app/build.gradle.kts"

mkdir -p "$PROJECT/app/src/main/assets/databases" "$QA"
curl --fail --location --retry 4 \
  'https://raw.githubusercontent.com/risan/quran-json/v3.1.2/dist/quran.json' \
  --output /tmp/quran.json
test "$(git hash-object /tmp/quran.json)" = '0fbe186ef6c9e54ef69adf5787f0d1419839d3f8'
python3 "$PROJECT/tools/generate_quran_db.py" \
  /tmp/quran.json \
  "$PROJECT/app/src/main/assets/databases/tawba.db" \
  | tee "$QA/quran-generation.json"
python3 "$PROJECT/tools/verify_corpus.py" \
  "$PROJECT/app/src/main/assets/databases/tawba.db" \
  | tee "$QA/corpus-verification-ci.json"

FONT_COMMIT='2796410152d4f9524b68ed46e69c1b60f8e0f7c3'
FONT_BASE="https://raw.githubusercontent.com/google/fonts/${FONT_COMMIT}"
mkdir -p "$PROJECT/app/src/main/assets/fonts" "$PROJECT/app/src/main/assets/licenses"
fetch_font() {
  local remote="$1" local_name="$2" expected_blob="$3"
  local output="$PROJECT/app/src/main/assets/fonts/$local_name"
  curl --fail --location --retry 4 "$FONT_BASE/$remote" --output "$output"
  test "$(git hash-object "$output")" = "$expected_blob"
}
fetch_font 'ofl/amiri/Amiri-Regular.ttf' 'amiri.ttf' '14dfa0d6c80db50460d23daa306a7ac92e74676f'
fetch_font 'ofl/amiri/Amiri-Bold.ttf' 'amiri_bold.ttf' '017afa9adb8ce417b08796d22d9204569ad211c7'
fetch_font 'ofl/amiriquran/AmiriQuran-Regular.ttf' 'amiri_quran.ttf' '2a4de2c4fd3e6fd23656586151935a98723acaff'
fetch_font 'ofl/notonaskharabic/NotoNaskhArabic%5Bwght%5D.ttf' 'noto_naskh_arabic.ttf' 'a8d2867262dc7bb28492ad746de5d56235735c8b'
fetch_font 'ofl/notosansarabic/NotoSansArabic%5Bwdth%2Cwght%5D.ttf' 'noto_sans_arabic.ttf' 'f1d01edce4ebaedcbe9a06fc75fec07b304ec3df'
curl --fail --location --retry 4 "$FONT_BASE/ofl/amiri/OFL.txt" --output "$PROJECT/app/src/main/assets/licenses/AMIRI-OFL.txt"
curl --fail --location --retry 4 "$FONT_BASE/ofl/notonaskharabic/OFL.txt" --output "$PROJECT/app/src/main/assets/licenses/NOTO-NASKH-ARABIC-OFL.txt"
curl --fail --location --retry 4 "$FONT_BASE/ofl/notosansarabic/OFL.txt" --output "$PROJECT/app/src/main/assets/licenses/NOTO-SANS-ARABIC-OFL.txt"
sha256sum "$PROJECT"/app/src/main/assets/fonts/* | tee "$QA/font-sha256.txt"

sdkmanager 'platform-tools' 'platforms;android-36' 'build-tools;36.0.0'

cd "$PROJECT"
set -o pipefail
gradle --no-daemon --stacktrace \
  :app:testDebugUnitTest \
  :app:lintDebug \
  :app:assembleDebug \
  :app:assembleQa \
  2>&1 | tee "$QA/gradle-build.log"

cp app/build/reports/lint-results-debug.html "$QA/"
cp app/build/reports/lint-results-debug.sarif "$QA/"
cp app/build/reports/lint-results-debug.txt "$QA/"
cp -R app/build/reports/tests "$QA/unit-test-reports"

APK='app/build/outputs/apk/qa/app-qa.apk'
DEBUG_APK='app/build/outputs/apk/debug/app-debug.apk'
test -s "$APK"
test -s "$DEBUG_APK"
BUILD_TOOLS="$ANDROID_HOME/build-tools/36.0.0"
"$BUILD_TOOLS/aapt" dump badging "$APK" | tee "$QA/apk-badging.txt"
"$BUILD_TOOLS/aapt" dump permissions "$APK" | tee "$QA/apk-permissions.txt"
"$BUILD_TOOLS/apksigner" verify --verbose --print-certs "$APK" | tee "$QA/apk-signature.txt"
sha256sum "$APK" "$DEBUG_APK" | tee "$QA/apk-sha256.txt"
unzip -l "$APK" | tee "$QA/apk-contents.txt"
stat --printf='%n %s bytes\n' "$APK" "$DEBUG_APK" | tee "$QA/apk-sizes.txt"
grep -q "package: name='com.tawba.app.phase1'" "$QA/apk-badging.txt"
grep -q "versionCode='410'" "$QA/apk-badging.txt"
grep -q "targetSdkVersion:'36'" "$QA/apk-badging.txt"
grep -q 'Verified using v2 scheme (APK Signature Scheme v2): true' "$QA/apk-signature.txt"
grep -q 'assets/databases/tawba.db' "$QA/apk-contents.txt"
grep -q 'assets/fonts/amiri_quran.ttf' "$QA/apk-contents.txt"
grep -q 'assets/licenses/QURAN-CORPUS-NOTICE.txt' "$QA/apk-contents.txt"
if grep -Eq 'android.permission.(INTERNET|ACCESS_FINE_LOCATION|ACCESS_COARSE_LOCATION|POST_NOTIFICATIONS)' "$QA/apk-permissions.txt"; then
  echo 'Permission interdite détectée dans la phase 1' >&2
  exit 1
fi
