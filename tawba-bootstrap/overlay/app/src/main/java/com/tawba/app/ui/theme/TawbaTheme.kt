package com.tawba.app.ui.theme

import android.graphics.Color as AndroidColor
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.LocalActivity
import androidx.activity.enableEdgeToEdge
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import com.tawba.app.data.AppThemeMode

val DeepGreen = Color(0xFF063D35)
val PrimaryGreen = Color(0xFF0D6251)
val SoftGreen = Color(0xFFDDECE5)
val Ivory = Color(0xFFFBF7EE)
val CardIvory = Color(0xFFFFFDF8)
val Gold = Color(0xFFC6A15B)
val SoftGold = Color(0xFFE5D19A)
val TextPrimary = Color(0xFF183C34)
val TextSecondary = Color(0xFF6F7D78)
val Divider = Color(0xFFE8DDC9)

private val IvoryScheme = lightColorScheme(
    primary = PrimaryGreen,
    onPrimary = Color.White,
    primaryContainer = SoftGreen,
    onPrimaryContainer = DeepGreen,
    secondary = Gold,
    onSecondary = DeepGreen,
    background = Ivory,
    onBackground = TextPrimary,
    surface = CardIvory,
    onSurface = TextPrimary,
    surfaceVariant = Color(0xFFF1EADF),
    onSurfaceVariant = TextSecondary,
    outline = Divider,
    error = Color(0xFFB3261E),
    errorContainer = Color(0xFFF9DEDC),
    onErrorContainer = Color(0xFF410E0B),
)

private val NightScheme = darkColorScheme(
    primary = Color(0xFF81CDB9),
    onPrimary = Color(0xFF00382E),
    primaryContainer = Color(0xFF075246),
    onPrimaryContainer = Color(0xFFB5F5DF),
    secondary = SoftGold,
    onSecondary = Color(0xFF3B2E00),
    background = Color(0xFF0B1815),
    onBackground = Color(0xFFE4F0EB),
    surface = Color(0xFF12231F),
    onSurface = Color(0xFFE4F0EB),
    surfaceVariant = Color(0xFF1D302B),
    onSurfaceVariant = Color(0xFFB7C9C3),
    outline = Color(0xFF3F554E),
)

private val AmoledScheme = darkColorScheme(
    primary = Color(0xFF86D7C1),
    onPrimary = Color.Black,
    primaryContainer = Color(0xFF063D35),
    onPrimaryContainer = Color.White,
    secondary = SoftGold,
    onSecondary = Color.Black,
    background = Color.Black,
    onBackground = Color(0xFFF3F5F4),
    surface = Color(0xFF080A09),
    onSurface = Color(0xFFF3F5F4),
    surfaceVariant = Color(0xFF111512),
    onSurfaceVariant = Color(0xFFBEC8C4),
    outline = Color(0xFF33413B),
)

@Composable
fun TawbaTheme(mode: AppThemeMode, content: @Composable () -> Unit) {
    val activity = LocalActivity.current as? ComponentActivity
    SideEffect {
        activity?.enableEdgeToEdge(
            statusBarStyle = if (mode == AppThemeMode.IVORY) {
                SystemBarStyle.light(AndroidColor.TRANSPARENT, AndroidColor.TRANSPARENT)
            } else {
                SystemBarStyle.dark(AndroidColor.TRANSPARENT)
            },
            navigationBarStyle = if (mode == AppThemeMode.IVORY) {
                SystemBarStyle.light(AndroidColor.TRANSPARENT, AndroidColor.TRANSPARENT)
            } else {
                SystemBarStyle.dark(AndroidColor.TRANSPARENT)
            },
        )
    }

    MaterialTheme(
        colorScheme = when (mode) {
            AppThemeMode.IVORY -> IvoryScheme
            AppThemeMode.NIGHT -> NightScheme
            AppThemeMode.AMOLED -> AmoledScheme
        },
        content = content,
    )
}

val ColorScheme.gold: Color get() = secondary
