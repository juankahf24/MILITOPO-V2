#!/usr/bin/env bash
set -euo pipefail

cd tawba-android
QA='docs/qa'
PACKAGE='com.tawba.app.phase1.debug'

gradle --no-daemon --stacktrace :app:connectedDebugAndroidTest \
  2>&1 | tee "$QA/instrumented-tests.log"

adb shell pm clear "$PACKAGE"
adb logcat -c
adb shell am start -W -n "$PACKAGE/com.tawba.app.MainActivity" \
  | tee "$QA/activity-start.txt"
sleep 8
adb exec-out screencap -p > "$QA/home-emulator.png"
adb shell uiautomator dump /sdcard/tawba-home.xml >/dev/null
adb pull /sdcard/tawba-home.xml "$QA/tawba-home.xml" >/dev/null
adb shell dumpsys package "$PACKAGE" > "$QA/dumpsys-package.txt"
adb shell pidof "$PACKAGE" | tee "$QA/app-pid.txt"
test -s "$QA/app-pid.txt"
grep -q 'text="Tawba"' "$QA/tawba-home.xml"
grep -q 'text="Corpus local vérifié avant utilisation"' "$QA/tawba-home.xml"
adb logcat -d > "$QA/logcat-emulator.txt"
if grep -E 'FATAL EXCEPTION|Process: com\.tawba\.app\.phase1\.debug.*has died' "$QA/logcat-emulator.txt"; then
  exit 1
fi
