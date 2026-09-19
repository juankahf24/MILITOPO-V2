package com.muslimqi.design

import androidx.compose.animation.ContentTransform
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp

internal fun premiumScreenTransform(forward: Boolean): ContentTransform {
    val direction = if (forward) 1 else -1
    val enter = fadeIn(
        animationSpec = tween(
            durationMillis = 330,
            delayMillis = 45,
            easing = FastOutSlowInEasing
        )
    ) + slideInHorizontally(
        animationSpec = tween(
            durationMillis = 520,
            easing = FastOutSlowInEasing
        ),
        initialOffsetX = { fullWidth -> direction * (fullWidth / 5) }
    ) + scaleIn(
        animationSpec = tween(
            durationMillis = 500,
            easing = FastOutSlowInEasing
        ),
        initialScale = 0.965f
    )

    val exit = fadeOut(
        animationSpec = tween(
            durationMillis = 210,
            easing = FastOutSlowInEasing
        )
    ) + slideOutHorizontally(
        animationSpec = tween(
            durationMillis = 340,
            easing = FastOutSlowInEasing
        ),
        targetOffsetX = { fullWidth -> -direction * (fullWidth / 8) }
    ) + scaleOut(
        animationSpec = tween(
            durationMillis = 260,
            easing = FastOutSlowInEasing
        ),
        targetScale = 0.985f
    )

    return enter togetherWith exit
}

internal fun Modifier.premiumReentry(key: Any): Modifier = composed {
    val progress = remember { Animatable(1f) }
    LaunchedEffect(key) {
        progress.snapTo(0f)
        progress.animateTo(
            targetValue = 1f,
            animationSpec = spring(
                dampingRatio = Spring.DampingRatioMediumBouncy,
                stiffness = Spring.StiffnessMediumLow
            )
        )
    }
    graphicsLayer {
        alpha = progress.value
        translationX = (1f - progress.value) * 58f
        translationY = (1f - progress.value) * 16f
        scaleX = 0.96f + progress.value * 0.04f
        scaleY = 0.96f + progress.value * 0.04f
    }
}

@Composable
internal fun PremiumAmbientBackdrop(modifier: Modifier = Modifier) {
    val transition = rememberInfiniteTransition(label = "ambient_motion")
    val driftX by transition.animateFloat(
        initialValue = -28f,
        targetValue = 34f,
        animationSpec = infiniteRepeatable(
            animation = tween(7600, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "ambient_drift_x"
    )
    val driftY by transition.animateFloat(
        initialValue = 22f,
        targetValue = -30f,
        animationSpec = infiniteRepeatable(
            animation = tween(9200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "ambient_drift_y"
    )
    val pulse by transition.animateFloat(
        initialValue = 0.055f,
        targetValue = 0.13f,
        animationSpec = infiniteRepeatable(
            animation = tween(3600, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "ambient_pulse"
    )
    val starRotation by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(28000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "ambient_rotation"
    )

    Canvas(modifier = modifier) {
        val emerald = Color(0xFF119B79)
        val gold = Color(0xFFE0B94D)
        drawCircle(
            color = emerald.copy(alpha = pulse),
            radius = size.minDimension * 0.23f,
            center = Offset(
                x = size.width * 0.83f + driftX,
                y = size.height * 0.18f + driftY
            )
        )
        drawCircle(
            color = gold.copy(alpha = pulse * 0.72f),
            radius = size.minDimension * 0.17f,
            center = Offset(
                x = size.width * 0.13f - driftX * 0.55f,
                y = size.height * 0.76f - driftY * 0.75f
            )
        )

        val centerPoint = Offset(size.width * 0.5f, size.height * 0.48f)
        val radius = size.minDimension * 0.41f
        repeat(8) { index ->
            val angle = Math.toRadians((starRotation + index * 45f).toDouble())
            val x = centerPoint.x + kotlin.math.cos(angle).toFloat() * radius
            val y = centerPoint.y + kotlin.math.sin(angle).toFloat() * radius
            drawCircle(
                color = gold.copy(alpha = 0.075f),
                radius = if (index % 2 == 0) 3.2f else 2.2f,
                center = Offset(x, y)
            )
        }
    }
}

@Composable
internal fun PremiumBreathingLogo(
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit
) {
    val transition = rememberInfiniteTransition(label = "logo_breathing")
    val scale by transition.animateFloat(
        initialValue = 0.985f,
        targetValue = 1.045f,
        animationSpec = infiniteRepeatable(
            animation = tween(1850, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "logo_scale"
    )
    val rotation by transition.animateFloat(
        initialValue = -1.2f,
        targetValue = 1.2f,
        animationSpec = infiniteRepeatable(
            animation = tween(2600, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "logo_rotation"
    )
    val glow by transition.animateFloat(
        initialValue = 0.13f,
        targetValue = 0.28f,
        animationSpec = infiniteRepeatable(
            animation = tween(1500, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "logo_glow"
    )

    Box(
        modifier = modifier
            .size(154.dp)
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
                rotationZ = rotation
            },
        contentAlignment = Alignment.Center
    ) {
        Canvas(Modifier.matchParentSize()) {
            drawCircle(
                color = Color(0xFFE0B94D).copy(alpha = glow),
                radius = size.minDimension * 0.44f,
                center = center
            )
            drawCircle(
                color = Color.White.copy(alpha = glow * 0.45f),
                radius = size.minDimension * 0.34f,
                center = center
            )
        }
        content()
    }
}

@Composable
internal fun PremiumFloatingIcon(
    icon: ImageVector,
    contentDescription: String?,
    tint: Color,
    modifier: Modifier = Modifier
) {
    val transition = rememberInfiniteTransition(label = "floating_icon")
    val lift by transition.animateFloat(
        initialValue = 3f,
        targetValue = -7f,
        animationSpec = infiniteRepeatable(
            animation = tween(1350, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "floating_icon_lift"
    )
    val rotation by transition.animateFloat(
        initialValue = -4f,
        targetValue = 4f,
        animationSpec = infiniteRepeatable(
            animation = tween(1800, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "floating_icon_rotation"
    )
    Icon(
        imageVector = icon,
        contentDescription = contentDescription,
        tint = tint,
        modifier = modifier.graphicsLayer {
            translationY = lift
            rotationZ = rotation
        }
    )
}

@Composable
internal fun PremiumActionIcon(
    icon: ImageVector,
    modifier: Modifier = Modifier
) {
    val transition = rememberInfiniteTransition(label = "action_icon")
    val travel by transition.animateFloat(
        initialValue = 0f,
        targetValue = 5f,
        animationSpec = infiniteRepeatable(
            animation = tween(900, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "action_icon_travel"
    )
    Icon(
        imageVector = icon,
        contentDescription = null,
        modifier = modifier.graphicsLayer {
            translationX = travel
        }
    )
}

@Composable
internal fun PremiumShimmerSweep(modifier: Modifier = Modifier) {
    val transition = rememberInfiniteTransition(label = "premium_shimmer")
    val progress by transition.animateFloat(
        initialValue = -1.1f,
        targetValue = 2.1f,
        animationSpec = infiniteRepeatable(
            animation = tween(2900, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "premium_shimmer_progress"
    )
    Canvas(modifier = modifier) {
        val width = size.width * 0.28f
        val centerX = size.width * progress
        drawRect(
            brush = Brush.linearGradient(
                colors = listOf(
                    Color.Transparent,
                    Color.White.copy(alpha = 0.075f),
                    Color.White.copy(alpha = 0.18f),
                    Color.White.copy(alpha = 0.075f),
                    Color.Transparent
                ),
                start = Offset(centerX - width, 0f),
                end = Offset(centerX + width, size.height)
            )
        )
    }
}

@Composable
internal fun PremiumSuccessSparkles(
    visible: Boolean,
    modifier: Modifier = Modifier
) {
    if (!visible) return
    val transition = rememberInfiniteTransition(label = "success_sparkles")
    val rotation by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(2600, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "success_sparkles_rotation"
    )
    val pulse by transition.animateFloat(
        initialValue = 0.45f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(700, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "success_sparkles_pulse"
    )
    Canvas(modifier = modifier) {
        val centerPoint = center
        val radius = size.minDimension * 0.37f
        repeat(8) { index ->
            val angle = Math.toRadians((rotation + index * 45f).toDouble())
            val point = Offset(
                x = centerPoint.x + kotlin.math.cos(angle).toFloat() * radius,
                y = centerPoint.y + kotlin.math.sin(angle).toFloat() * radius
            )
            drawCircle(
                color = Color(0xFFE0B94D).copy(alpha = 0.35f * pulse),
                radius = (if (index % 2 == 0) 4f else 2.6f) * pulse,
                center = point
            )
        }
    }
}
