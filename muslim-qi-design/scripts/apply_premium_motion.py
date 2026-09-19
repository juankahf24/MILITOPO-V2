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
        "import androidx.compose.foundation.clickable\n",
        "import androidx.compose.foundation.clickable\n"
        "import androidx.compose.foundation.interaction.MutableInteractionSource\n"
        "import androidx.compose.foundation.interaction.collectIsPressedAsState\n",
        "interaction imports",
    )

    text = replace_once(
        text,
        """                    transitionSpec = {
                        fadeIn(tween(220)) togetherWith fadeOut(tween(150))
                    },
""",
        """                    transitionSpec = {
                        premiumScreenTransform(
                            forward = targetState.ordinal >= initialState.ordinal
                        )
                    },
""",
        "global direction-aware screen transitions",
    )

    text = replace_once(
        text,
        """    Box(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        Canvas(Modifier.matchParentSize()) {
""",
        """    Box(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        PremiumAmbientBackdrop(Modifier.matchParentSize())
        Canvas(Modifier.matchParentSize()) {
""",
        "animated ambient background",
    )

    text = replace_once(
        text,
        "            BrandLogo(120.dp)\n",
        "            PremiumBreathingLogo { BrandLogo(120.dp) }\n",
        "breathing splash logo",
    )

    old_primary_button = """@Composable
private fun PrimaryActionButton(
    text: String,
    icon: ImageVector,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .height(58.dp)
            .shadow(10.dp, RoundedCornerShape(19.dp)),
        shape = RoundedCornerShape(19.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary
        )
    ) {
        Text(text, fontWeight = FontWeight.ExtraBold)
        Icon(
            icon,
            contentDescription = null,
            modifier = Modifier
                .padding(start = 8.dp)
                .size(20.dp)
        )
    }
}
"""
    new_primary_button = """@Composable
private fun PrimaryActionButton(
    text: String,
    icon: ImageVector,
    onClick: () -> Unit
) {
    val interactionSource = remember { MutableInteractionSource() }
    val pressed by interactionSource.collectIsPressedAsState()
    val buttonScale by animateFloatAsState(
        targetValue = if (pressed) 0.965f else 1f,
        animationSpec = androidx.compose.animation.core.spring(
            dampingRatio = androidx.compose.animation.core.Spring.DampingRatioMediumBouncy,
            stiffness = androidx.compose.animation.core.Spring.StiffnessMedium
        ),
        label = "primary_button_scale"
    )
    Button(
        onClick = onClick,
        interactionSource = interactionSource,
        modifier = Modifier
            .fillMaxWidth()
            .height(58.dp)
            .graphicsLayer {
                scaleX = buttonScale
                scaleY = buttonScale
            }
            .shadow(
                if (pressed) 4.dp else 12.dp,
                RoundedCornerShape(19.dp)
            ),
        shape = RoundedCornerShape(19.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary
        )
    ) {
        Text(text, fontWeight = FontWeight.ExtraBold)
        PremiumActionIcon(
            icon = icon,
            modifier = Modifier
                .padding(start = 8.dp)
                .size(20.dp)
        )
    }
}
"""
    text = replace_once(
        text,
        old_primary_button,
        new_primary_button,
        "elastic premium primary buttons",
    )

    text = replace_once(
        text,
        """            bottomNavigation.forEach { item ->
                val active = item.page == selected
                Column(
""",
        """            bottomNavigation.forEach { item ->
                val active = item.page == selected
                val navigationScale by animateFloatAsState(
                    targetValue = if (active) 1.12f else 0.94f,
                    animationSpec = androidx.compose.animation.core.spring(
                        dampingRatio = androidx.compose.animation.core.Spring.DampingRatioMediumBouncy,
                        stiffness = androidx.compose.animation.core.Spring.StiffnessMediumLow
                    ),
                    label = "navigation_scale"
                )
                val navigationLift by animateFloatAsState(
                    targetValue = if (active) -5f else 0f,
                    animationSpec = androidx.compose.animation.core.spring(
                        dampingRatio = androidx.compose.animation.core.Spring.DampingRatioLowBouncy,
                        stiffness = androidx.compose.animation.core.Spring.StiffnessMediumLow
                    ),
                    label = "navigation_lift"
                )
                Column(
""",
        "animated bottom navigation values",
    )

    text = replace_once(
        text,
        """                    Box(
                        Modifier
                            .width(if (active) 48.dp else 36.dp)
                            .height(29.dp)
""",
        """                    Box(
                        Modifier
                            .width(if (active) 48.dp else 36.dp)
                            .height(29.dp)
                            .graphicsLayer {
                                scaleX = navigationScale
                                scaleY = navigationScale
                                translationY = navigationLift
                            }
""",
        "animated bottom navigation icon",
    )

    text = replace_once(
        text,
        """private fun LanguageCard(
    title: String,
    subtitle: String,
    code: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
""",
        """private fun LanguageCard(
    title: String,
    subtitle: String,
    code: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    val selectionScale by animateFloatAsState(
        targetValue = if (selected) 1f else 0.975f,
        animationSpec = androidx.compose.animation.core.spring(
            dampingRatio = androidx.compose.animation.core.Spring.DampingRatioMediumBouncy,
            stiffness = androidx.compose.animation.core.Spring.StiffnessMediumLow
        ),
        label = "language_selection_scale"
    )
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .graphicsLayer {
                scaleX = selectionScale
                scaleY = selectionScale
            }
""",
        "spring language selection",
    )

    text = replace_once(
        text,
        """private fun FormatSelectionCard(
    format: BoardFormat,
    selected: Boolean,
    modifier: Modifier,
    onClick: () -> Unit
) {
    Surface(
        modifier = modifier
            .clickable(onClick = onClick)
""",
        """private fun FormatSelectionCard(
    format: BoardFormat,
    selected: Boolean,
    modifier: Modifier,
    onClick: () -> Unit
) {
    val selectionScale by animateFloatAsState(
        targetValue = if (selected) 1f else 0.965f,
        animationSpec = androidx.compose.animation.core.spring(
            dampingRatio = androidx.compose.animation.core.Spring.DampingRatioMediumBouncy,
            stiffness = androidx.compose.animation.core.Spring.StiffnessMediumLow
        ),
        label = "format_selection_scale"
    )
    Surface(
        modifier = modifier
            .graphicsLayer {
                scaleX = selectionScale
                scaleY = selectionScale
            }
            .clickable(onClick = onClick)
""",
        "spring format selection",
    )

    text = replace_once(
        text,
        """    val showFront = rotation > 90f
    Surface(
        modifier = modifier
            .graphicsLayer {
                rotationY = rotation
                cameraDistance = 12f * density
            }
""",
        """    val showFront = rotation > 90f
    val matchScale by animateFloatAsState(
        targetValue = if (matched) 1.045f else 1f,
        animationSpec = androidx.compose.animation.core.spring(
            dampingRatio = androidx.compose.animation.core.Spring.DampingRatioLowBouncy,
            stiffness = androidx.compose.animation.core.Spring.StiffnessMediumLow
        ),
        label = "matched_card_scale"
    )
    Surface(
        modifier = modifier
            .graphicsLayer {
                rotationY = rotation
                cameraDistance = 12f * density
                scaleX = matchScale
                scaleY = matchScale
            }
""",
        "matched card celebration pulse",
    )

    text = replace_once(
        text,
        "                    Icon(Icons.Rounded.AutoAwesome, null, tint = MqGold)\n",
        """                    PremiumFloatingIcon(
                        icon = Icons.Rounded.AutoAwesome,
                        contentDescription = null,
                        tint = MqGold
                    )
""",
        "floating daily challenge icon",
    )

    SOURCE.write_text(text, encoding="utf-8")
    print(f"Premium motion patch complete: {SOURCE}")


if __name__ == "__main__":
    main()
