#!/usr/bin/env bash
set -euo pipefail

APK="muslim-qi-design/app/build/outputs/apk/debug/app-debug.apk"
PACKAGE="com.muslimqi.design.demo"
ACTIVITY="com.muslimqi.design.FunctionalMainActivity"

adb install -r "$APK"
adb shell dumpsys package "$PACKAGE" | grep -q "versionName=0.6.0-premium-motion-demo"
adb shell am force-stop "$PACKAGE"
adb logcat -c
adb shell am start -W -n "$PACKAGE/$ACTIVITY"
sleep 5

# Close a possible hosted-emulator launcher dialog without affecting the app.
adb shell input tap 410 1590 || true
sleep 1

adb exec-out screencap -p > muslim-qi-language-screen.png
adb logcat -d -v threadtime > muslim-qi-logcat.txt
APP_PID="$(adb shell pidof "$PACKAGE" | tr -d '\r')"
test -n "$APP_PID"
adb shell dumpsys activity activities | grep "$PACKAGE/$ACTIVITY"
test -s muslim-qi-language-screen.png

# Exercise the direction-aware page transition from language to onboarding.
adb shell dumpsys gfxinfo "$PACKAGE" reset >/dev/null || true
adb shell input tap 540 2190
sleep 0.18
adb exec-out screencap -p > muslim-qi-transition-frame.png
sleep 1.4
adb shell uiautomator dump /sdcard/muslim-qi-onboarding.xml >/dev/null
adb shell cat /sdcard/muslim-qi-onboarding.xml > muslim-qi-onboarding.xml
grep -q "Apprenez avec confiance" muslim-qi-onboarding.xml
test -s muslim-qi-transition-frame.png
adb shell dumpsys gfxinfo "$PACKAGE" > muslim-qi-gfxinfo.txt
test -s muslim-qi-gfxinfo.txt

# Open the real 4 x 7 responsive game directly for a deterministic UI smoke test.
adb shell am force-stop "$PACKAGE"
adb shell am start -W -n "$PACKAGE/$ACTIVITY" --es test_page memory_4x7
sleep 4
adb shell uiautomator dump /sdcard/muslim-qi-ui.xml >/dev/null
adb shell cat /sdcard/muslim-qi-ui.xml > muslim-qi-ui.xml
grep -q "4 × 7" muslim-qi-ui.xml
grep -q "Paires" muslim-qi-ui.xml

# Pixel 6 native resolution is 1080 x 2400. Tap the centres of cards 1 and 2.
adb shell input tap 145 650
sleep 1
adb shell input tap 410 650
sleep 1
SECOND_PID="$(adb shell pidof "$PACKAGE" | tr -d '\r')"
test -n "$SECOND_PID"

# A completed comparison must increment the attempt counter from 0 to 1.
adb shell uiautomator dump /sdcard/muslim-qi-after.xml >/dev/null
adb shell cat /sdcard/muslim-qi-after.xml > muslim-qi-after.xml
grep -q 'text="Essais"' muslim-qi-after.xml
grep -q 'text="1"' muslim-qi-after.xml

adb exec-out screencap -p > muslim-qi-after-interaction.png
test -s muslim-qi-after-interaction.png
adb logcat -d -v threadtime > muslim-qi-logcat.txt
if grep -q "FATAL EXCEPTION.*com.muslimqi.design.demo" muslim-qi-logcat.txt; then
  grep -A 100 -B 20 -E 'FATAL EXCEPTION|AndroidRuntime|Process: com.muslimqi.design.demo' muslim-qi-logcat.txt || true
  exit 1
fi

echo "Muslim QI v0.6 premium motion, transition, responsive 4x7 layout and card interaction test passed."
