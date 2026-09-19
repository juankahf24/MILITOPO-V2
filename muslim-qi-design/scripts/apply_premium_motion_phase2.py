#!/usr/bin/env python3
from pathlib import Path

SOURCE = Path(
    "muslim-qi-design/app/src/main/java/com/muslimqi/design/FunctionalMainActivity.kt"
)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count == 0:
        if new in text:
            print(f"[skip] {label}: already applied")
            return text
        raise RuntimeError(f"Patch marker not found for {label}")
    if count != 1:
        raise RuntimeError(f"Patch marker for {label} occurred {count} times")
    print(f"[apply] {label}")
    return text.replace(old, new, 1)


def main() -> None:
    text = SOURCE.read_text(encoding="utf-8")

    text = replace_once(
        text,
        """        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .height(250.dp)
                .shadow(16.dp, RoundedCornerShape(32.dp)),
            shape = RoundedCornerShape(32.dp),
            color = MqTeal
""",
        """        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .height(250.dp)
                .premiumReentry("onboarding-visual-$slide")
                .shadow(16.dp, RoundedCornerShape(32.dp)),
            shape = RoundedCornerShape(32.dp),
            color = MqTeal
""",
        "onboarding visual reentry",
    )

    text = replace_once(
        text,
        """        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                titles[slide],
""",
        """        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .fillMaxWidth()
                .premiumReentry("onboarding-copy-$slide")
        ) {
            Text(
                titles[slide],
""",
        "onboarding copy reentry",
    )

    text = replace_once(
        text,
        """            Canvas(Modifier.matchParentSize()) {
                drawCircle(
                    MqGold.copy(alpha = 0.14f),
                    size.minDimension * 0.64f,
                    Offset(size.width, 0f)
                )
            }
            Column(
""",
        """            Canvas(Modifier.matchParentSize()) {
                drawCircle(
                    MqGold.copy(alpha = 0.14f),
                    size.minDimension * 0.64f,
                    Offset(size.width, 0f)
                )
            }
            PremiumShimmerSweep(Modifier.matchParentSize())
            Column(
""",
        "daily challenge shimmer sweep",
    )

    text = replace_once(
        text,
        """            contentAlignment = Alignment.Center
        ) {
            if (!showFront) {
""",
        """            contentAlignment = Alignment.Center
        ) {
            PremiumSuccessSparkles(
                visible = matched,
                modifier = Modifier.matchParentSize()
            )
            if (!showFront) {
""",
        "matched card sparkles",
    )

    text = replace_once(
        text,
        """            icon = {
                Icon(
                    Icons.Rounded.EmojiEvents,
                    null,
                    tint = MqGold,
                    modifier = Modifier.size(44.dp)
                )
            },
""",
        """            icon = {
                Box(Modifier.size(76.dp), contentAlignment = Alignment.Center) {
                    PremiumSuccessSparkles(
                        visible = true,
                        modifier = Modifier.matchParentSize()
                    )
                    Icon(
                        Icons.Rounded.EmojiEvents,
                        null,
                        tint = MqGold,
                        modifier = Modifier.size(44.dp)
                    )
                }
            },
""",
        "completion dialog celebration",
    )

    SOURCE.write_text(text, encoding="utf-8")
    print(f"Premium motion phase 2 complete: {SOURCE}")


if __name__ == "__main__":
    main()
