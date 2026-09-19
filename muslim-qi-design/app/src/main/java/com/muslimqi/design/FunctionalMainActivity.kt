package com.muslimqi.design

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Looper
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.Locale
import kotlin.coroutines.resume
import kotlin.math.roundToInt
import kotlin.random.Random

private val MqEmerald = Color(0xFF119B79)
private val MqEmeraldDark = Color(0xFF075C54)
private val MqTeal = Color(0xFF0B3D45)
private val MqCream = Color(0xFFF8F4E8)
private val MqWarm = Color(0xFFFFFCF5)
private val MqGold = Color(0xFFE0B94D)
private val MqSand = Color(0xFFF0E2BF)
private val MqBlue = Color(0xFF3D7EA3)
private val MqPurple = Color(0xFF8063A8)
private val MqCoral = Color(0xFFDC675D)
private val MqNight = Color(0xFF071B1A)
private val MqNightSurface = Color(0xFF12312E)

private enum class AppPage {
    Splash,
    Language,
    Onboarding,
    Account,
    Home,
    Play,
    Permissions,
    MemorySetup,
    MemoryGame,
    Mosques,
    Progress,
    Ranking,
    Profile
}

private data class BottomNavItem(
    val page: AppPage,
    val label: String,
    val icon: ImageVector
)

private val bottomNavigation = listOf(
    BottomNavItem(AppPage.Home, "Accueil", Icons.Rounded.Home),
    BottomNavItem(AppPage.Play, "Jouer", Icons.Rounded.SportsEsports),
    BottomNavItem(AppPage.Progress, "Progrès", Icons.Rounded.AutoGraph),
    BottomNavItem(AppPage.Ranking, "Classement", Icons.Rounded.EmojiEvents),
    BottomNavItem(AppPage.Profile, "Profil", Icons.Rounded.Person)
)

private data class BoardFormat(
    val columns: Int,
    val rows: Int,
    val label: String,
    val difficulty: String
) {
    val cardCount: Int get() = columns * rows
    val pairCount: Int get() = cardCount / 2
}

private val boardFormats = listOf(
    BoardFormat(4, 4, "4 × 4", "Classique"),
    BoardFormat(4, 5, "4 × 5", "Intermédiaire"),
    BoardFormat(4, 6, "4 × 6", "Difficile"),
    BoardFormat(4, 7, "4 × 7", "Expert")
)

private data class PairContent(
    val arabic: String,
    val french: String
)

private val pairContents = listOf(
    PairContent("الكعبة", "La Kaaba"),
    PairContent("مكة", "La Mecque"),
    PairContent("المدينة", "Médine"),
    PairContent("رمضان", "Ramadan"),
    PairContent("الصبر", "Patience"),
    PairContent("العلم", "Savoir"),
    PairContent("الأمانة", "Confiance"),
    PairContent("الرحمة", "Miséricorde"),
    PairContent("الفجر", "Fajr"),
    PairContent("القبلة", "Qibla"),
    PairContent("الهجرة", "Hégire"),
    PairContent("الزكاة", "Zakât"),
    PairContent("الحج", "Hajj"),
    PairContent("السلام", "Paix")
)

private data class MemoryCardData(
    val id: Int,
    val pairId: Int,
    val content: PairContent
)

private data class MosqueItem(
    val name: String,
    val latitude: Double,
    val longitude: Double,
    val distanceMeters: Int,
    val website: String?
)

private data class PrayerTimes(
    val fajr: String,
    val dhuhr: String,
    val asr: String,
    val maghrib: String,
    val isha: String
)

class FunctionalMainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        createNotificationChannels()
        val testPage = intent.getStringExtra("test_page")
        setContent {
            MuslimQiFunctionalApp(testPage)
        }
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java)
        val prayer = NotificationChannel(
            "prayer_reminders",
            "Rappels de prière",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Notifications configurées pour les horaires de prière"
        }
        val education = NotificationChannel(
            "education_challenges",
            "Défis éducatifs",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Défi quotidien, série et progression"
        }
        manager.createNotificationChannels(listOf(prayer, education))
    }
}

@Composable
private fun MuslimQiFunctionalApp(testPage: String?) {
    val context = LocalContext.current
    val preferences = remember {
        context.getSharedPreferences("muslim_qi_functional", Context.MODE_PRIVATE)
    }
    val directPage = when (testPage) {
        "memory_setup" -> AppPage.MemorySetup
        "memory_4x7" -> AppPage.MemoryGame
        "mosques" -> AppPage.Mosques
        else -> AppPage.Splash
    }

    var page by rememberSaveable { mutableStateOf(directPage) }
    var darkMode by rememberSaveable { mutableStateOf(false) }
    var rtlMode by rememberSaveable { mutableStateOf(false) }
    var selectedFormatIndex by rememberSaveable {
        mutableIntStateOf(if (testPage == "memory_4x7") 3 else 0)
    }
    var permissionEducationSeen by rememberSaveable {
        mutableStateOf(preferences.getBoolean("permission_education_seen", false))
    }

    val lightScheme = lightColorScheme(
        primary = MqEmerald,
        onPrimary = Color.White,
        primaryContainer = Color(0xFFDDF5EC),
        onPrimaryContainer = MqEmeraldDark,
        secondary = MqGold,
        onSecondary = Color(0xFF3D2C00),
        background = MqCream,
        onBackground = Color(0xFF153936),
        surface = MqWarm,
        onSurface = Color(0xFF153936),
        surfaceVariant = Color(0xFFF1EBDE),
        onSurfaceVariant = Color(0xFF667873),
        outline = Color(0xFFD8D5C9)
    )
    val darkScheme = darkColorScheme(
        primary = Color(0xFF68D9B8),
        onPrimary = Color(0xFF00382E),
        primaryContainer = Color(0xFF164D43),
        onPrimaryContainer = Color(0xFFC9F8E8),
        secondary = Color(0xFFF3CE68),
        onSecondary = Color(0xFF3C3000),
        background = MqNight,
        onBackground = Color(0xFFF4F8F3),
        surface = MqNightSurface,
        onSurface = Color(0xFFF4F8F3),
        surfaceVariant = Color(0xFF1B3C38),
        onSurfaceVariant = Color(0xFFB8CAC4),
        outline = Color(0xFF3A5751)
    )

    CompositionLocalProvider(
        LocalLayoutDirection provides if (rtlMode) LayoutDirection.Rtl else LayoutDirection.Ltr
    ) {
        MaterialTheme(
            colorScheme = if (darkMode) darkScheme else lightScheme,
            typography = Typography(
                displaySmall = androidx.compose.ui.text.TextStyle(
                    fontFamily = FontFamily.Serif,
                    fontWeight = FontWeight.Bold,
                    fontSize = 38.sp
                ),
                headlineMedium = androidx.compose.ui.text.TextStyle(
                    fontFamily = FontFamily.Serif,
                    fontWeight = FontWeight.Bold,
                    fontSize = 28.sp
                ),
                titleLarge = androidx.compose.ui.text.TextStyle(
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 22.sp
                ),
                titleMedium = androidx.compose.ui.text.TextStyle(
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                ),
                bodyLarge = androidx.compose.ui.text.TextStyle(fontSize = 15.sp),
                bodyMedium = androidx.compose.ui.text.TextStyle(fontSize = 13.sp)
            )
        ) {
            AppBackdrop {
                AnimatedContent(
                    targetState = page,
                    modifier = Modifier.fillMaxSize(),
                    transitionSpec = {
                        premiumScreenTransform(
                            forward = targetState.ordinal >= initialState.ordinal
                        )
                    },
                    label = "app_page"
                ) { targetPage ->
                    when (targetPage) {
                        AppPage.Splash -> SplashScreen { page = AppPage.Language }
                        AppPage.Language -> LanguageScreen(
                            onContinue = { page = AppPage.Onboarding },
                            setRtl = { rtlMode = it }
                        )
                        AppPage.Onboarding -> OnboardingScreen {
                            page = AppPage.Account
                        }
                        AppPage.Account -> AccountScreen {
                            page = AppPage.Home
                        }
                        AppPage.Home -> MainShell(
                            selected = AppPage.Home,
                            navigate = { page = it }
                        ) {
                            HomeScreen(
                                openPlay = { page = AppPage.Play },
                                openMemory = {
                                    page = if (permissionEducationSeen) {
                                        AppPage.MemorySetup
                                    } else {
                                        AppPage.Permissions
                                    }
                                },
                                openMosques = { page = AppPage.Mosques }
                            )
                        }
                        AppPage.Play -> MainShell(
                            selected = AppPage.Play,
                            navigate = { page = it }
                        ) {
                            PlayScreen(
                                openMemory = {
                                    page = if (permissionEducationSeen) {
                                        AppPage.MemorySetup
                                    } else {
                                        AppPage.Permissions
                                    }
                                }
                            )
                        }
                        AppPage.Permissions -> PermissionScreen(
                            onBack = { page = AppPage.Play },
                            onContinue = {
                                permissionEducationSeen = true
                                preferences.edit()
                                    .putBoolean("permission_education_seen", true)
                                    .apply()
                                page = AppPage.MemorySetup
                            }
                        )
                        AppPage.MemorySetup -> MemorySetupScreen(
                            selectedFormatIndex = selectedFormatIndex,
                            onFormatSelected = { selectedFormatIndex = it },
                            onBack = { page = AppPage.Play },
                            onStart = { page = AppPage.MemoryGame }
                        )
                        AppPage.MemoryGame -> MemoryGameScreen(
                            format = boardFormats[selectedFormatIndex],
                            onBack = { page = AppPage.MemorySetup }
                        )
                        AppPage.Mosques -> NearbyMosquesScreen(
                            onBack = { page = AppPage.Home }
                        )
                        AppPage.Progress -> MainShell(
                            selected = AppPage.Progress,
                            navigate = { page = it }
                        ) {
                            ProgressScreen()
                        }
                        AppPage.Ranking -> MainShell(
                            selected = AppPage.Ranking,
                            navigate = { page = it }
                        ) {
                            RankingScreen()
                        }
                        AppPage.Profile -> MainShell(
                            selected = AppPage.Profile,
                            navigate = { page = it }
                        ) {
                            ProfileScreen(
                                darkMode = darkMode,
                                setDarkMode = { darkMode = it },
                                rtlMode = rtlMode,
                                setRtlMode = { rtlMode = it },
                                openPermissions = { page = AppPage.Permissions },
                                openMosques = { page = AppPage.Mosques }
                            )
                        }
                    }
                }
            }
        }
    }

    BackHandler(
        enabled = page !in listOf(AppPage.Splash, AppPage.Language, AppPage.Home)
    ) {
        page = when (page) {
            AppPage.Onboarding -> AppPage.Language
            AppPage.Account -> AppPage.Onboarding
            AppPage.Permissions,
            AppPage.MemorySetup -> AppPage.Play
            AppPage.MemoryGame -> AppPage.MemorySetup
            AppPage.Mosques -> AppPage.Home
            else -> AppPage.Home
        }
    }
}

@Composable
private fun AppBackdrop(content: @Composable BoxScope.() -> Unit) {
    val patternColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.04f)
    Box(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        PremiumAmbientBackdrop(Modifier.matchParentSize())
        Canvas(Modifier.matchParentSize()) {
            drawCircle(
                color = patternColor,
                radius = size.width * 0.52f,
                center = Offset(size.width * 1.06f, size.height * 0.05f)
            )
            drawCircle(
                color = MqGold.copy(alpha = 0.05f),
                radius = size.width * 0.42f,
                center = Offset(-size.width * 0.06f, size.height * 0.90f)
            )
            val step = 74.dp.toPx()
            var x = 0f
            while (x < size.width + step) {
                var y = 0f
                while (y < size.height + step) {
                    val center = Offset(x, y)
                    drawCircle(
                        color = patternColor,
                        radius = 17.dp.toPx(),
                        center = center,
                        style = Stroke(1.dp.toPx())
                    )
                    drawLine(
                        patternColor,
                        center + Offset(-9.dp.toPx(), 0f),
                        center + Offset(9.dp.toPx(), 0f),
                        1.dp.toPx()
                    )
                    drawLine(
                        patternColor,
                        center + Offset(0f, -9.dp.toPx()),
                        center + Offset(0f, 9.dp.toPx()),
                        1.dp.toPx()
                    )
                    y += step
                }
                x += step
            }
        }
        content()
    }
}

@Composable
private fun BrandLogo(size: Dp) {
    Canvas(Modifier.size(size)) {
        val center = Offset(this.size.width / 2, this.size.height / 2)
        val radius = this.size.minDimension * 0.39f
        rotate(45f, center) {
            drawRoundRect(
                color = MqGold,
                topLeft = center - Offset(radius, radius),
                size = Size(radius * 2, radius * 2),
                cornerRadius = CornerRadius(14f, 14f),
                style = Stroke(4.5f)
            )
        }
        drawCircle(MqEmeraldDark, radius * 0.84f, center)
        drawCircle(MqGold, radius * 0.70f, center, style = Stroke(3.7f))
        drawCircle(
            color = MqGold.copy(alpha = 0.30f),
            radius = radius * 0.39f,
            center = center,
            style = Stroke(
                width = 3f,
                pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 7f))
            )
        )
        drawLine(
            color = MqGold,
            start = center + Offset(0f, -radius * 0.47f),
            end = center + Offset(0f, radius * 0.43f),
            strokeWidth = 4.5f,
            cap = StrokeCap.Round
        )
        drawCircle(MqGold, radius * 0.105f, center + Offset(0f, -radius * 0.47f))
    }
}

@Composable
private fun SplashScreen(onFinished: () -> Unit) {
    LaunchedEffect(Unit) {
        delay(1100)
        onFinished()
    }
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(MqEmeraldDark, MqTeal, Color(0xFF082B2C))
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            PremiumBreathingLogo { BrandLogo(120.dp) }
            Text(
                text = "Muslim QI",
                color = Color.White,
                fontFamily = FontFamily.Serif,
                fontWeight = FontWeight.Bold,
                fontSize = 42.sp,
                modifier = Modifier.padding(top = 24.dp)
            )
            Text(
                text = "Apprends l’islam chaque jour en t’amusant.",
                color = Color.White.copy(alpha = 0.74f),
                fontSize = 13.sp
            )
            LinearProgressIndicator(
                progress = { 0.74f },
                modifier = Modifier
                    .padding(top = 54.dp)
                    .width(88.dp)
                    .height(4.dp)
                    .clip(CircleShape),
                color = MqGold,
                trackColor = Color.White.copy(alpha = 0.12f)
            )
        }
    }
}

@Composable
private fun IntroScaffold(
    bottom: (@Composable () -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    Scaffold(
        modifier = Modifier.fillMaxSize(),
        containerColor = Color.Transparent,
        bottomBar = {
            if (bottom != null) {
                Surface(color = MaterialTheme.colorScheme.background.copy(alpha = 0.98f)) {
                    Box(
                        Modifier
                            .navigationBarsPadding()
                            .padding(horizontal = 22.dp, vertical = 14.dp)
                    ) {
                        bottom()
                    }
                }
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .statusBarsPadding()
                .padding(horizontal = 22.dp),
            verticalArrangement = Arrangement.spacedBy(15.dp),
            content = content
        )
    }
}

@Composable
private fun LanguageScreen(
    onContinue: () -> Unit,
    setRtl: (Boolean) -> Unit
) {
    var selected by rememberSaveable { mutableIntStateOf(0) }
    IntroScaffold(
        bottom = {
            PrimaryActionButton(
                text = "Continuer",
                icon = Icons.Rounded.ArrowForward,
                onClick = onContinue
            )
        }
    ) {
        Spacer(Modifier.height(8.dp))
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                "MUSLIM QI",
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 12.sp,
                letterSpacing = 1.2.sp
            )
            Text(
                "1 / 3",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontWeight = FontWeight.Bold,
                fontSize = 12.sp
            )
        }
        LinearProgressIndicator(
            progress = { 1f / 3f },
            modifier = Modifier
                .fillMaxWidth()
                .height(5.dp)
                .clip(CircleShape)
        )
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.fillMaxWidth()
        ) {
            BrandLogo(70.dp)
            Text(
                "Choisissez votre langue",
                style = MaterialTheme.typography.headlineMedium,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 14.dp)
            )
            Text(
                "Une expérience fluide en français, en arabe ou en anglais.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 7.dp)
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            LanguageCard(
                title = "Français",
                subtitle = "Interface complète en français",
                code = "FR",
                selected = selected == 0
            ) {
                selected = 0
                setRtl(false)
            }
            LanguageCard(
                title = "العربية",
                subtitle = "واجهة عربية كاملة من اليمين إلى اليسار",
                code = "AR",
                selected = selected == 1
            ) {
                selected = 1
                setRtl(true)
            }
            LanguageCard(
                title = "English",
                subtitle = "Complete English interface",
                code = "EN",
                selected = selected == 2
            ) {
                selected = 2
                setRtl(false)
            }
        }
        InformationStrip(
            icon = Icons.Rounded.Translate,
            title = "Arabe RTL intégral",
            text = "Navigation, textes et cartes s’adaptent automatiquement."
        )
    }
}

@Composable
private fun LanguageCard(
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
            .clickable(onClick = onClick)
            .border(
                1.5.dp,
                if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline,
                RoundedCornerShape(22.dp)
            ),
        shape = RoundedCornerShape(22.dp),
        color = if (selected) {
            MaterialTheme.colorScheme.primaryContainer
        } else {
            MaterialTheme.colorScheme.surface
        },
        shadowElevation = if (selected) 9.dp else 2.dp
    ) {
        Row(
            modifier = Modifier.padding(15.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(50.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(
                        if (selected) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.surfaceVariant
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    code,
                    color = if (selected) {
                        MaterialTheme.colorScheme.onPrimary
                    } else {
                        MaterialTheme.colorScheme.onSurface
                    },
                    fontWeight = FontWeight.ExtraBold
                )
            }
            Column(
                Modifier
                    .weight(1f)
                    .padding(horizontal = 14.dp)
            ) {
                Text(title, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
                Text(
                    subtitle,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 10.sp
                )
            }
            Icon(
                if (selected) Icons.Rounded.CheckCircle else Icons.Rounded.ChevronRight,
                contentDescription = null,
                tint = if (selected) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                }
            )
        }
    }
}

@Composable
private fun OnboardingScreen(onFinished: () -> Unit) {
    var slide by rememberSaveable { mutableIntStateOf(0) }
    val titles = listOf(
        "Apprenez avec confiance",
        "Jouez selon votre rythme",
        "Progressez chaque jour"
    )
    val descriptions = listOf(
        "Des explications courtes, structurées et accompagnées de références éditoriales.",
        "Quatre formats de Memory, du 4 × 4 au 4 × 7, entièrement adaptés à l’écran.",
        "Objectifs, badges et thèmes à revoir, sans pression ni jugement."
    )
    val icons = listOf(
        Icons.Rounded.MenuBook,
        Icons.Rounded.GridView,
        Icons.Rounded.AutoGraph
    )

    IntroScaffold(
        bottom = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center
                ) {
                    repeat(3) { index ->
                        Box(
                            Modifier
                                .padding(4.dp)
                                .width(if (index == slide) 28.dp else 8.dp)
                                .height(8.dp)
                                .clip(CircleShape)
                                .background(
                                    if (index == slide) MaterialTheme.colorScheme.primary
                                    else MaterialTheme.colorScheme.outline
                                )
                        )
                    }
                }
                PrimaryActionButton(
                    text = if (slide == 2) "Commencer" else "Continuer",
                    icon = if (slide == 2) Icons.Rounded.RocketLaunch else Icons.Rounded.ArrowForward
                ) {
                    if (slide == 2) onFinished() else slide++
                }
            }
        }
    ) {
        Spacer(Modifier.height(8.dp))
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                "MUSLIM QI",
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 12.sp
            )
            TextButton(onClick = onFinished) {
                Text("Passer")
            }
        }
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .height(250.dp)
                .premiumReentry("onboarding-visual-$slide")
                .shadow(16.dp, RoundedCornerShape(32.dp)),
            shape = RoundedCornerShape(32.dp),
            color = MqTeal
        ) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Canvas(Modifier.matchParentSize()) {
                    drawCircle(
                        MqGold.copy(alpha = 0.14f),
                        size.minDimension * 0.67f,
                        Offset(size.width, 0f)
                    )
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        Modifier
                            .size(108.dp)
                            .clip(RoundedCornerShape(32.dp))
                            .background(Color.White.copy(alpha = 0.10f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            icons[slide],
                            contentDescription = null,
                            tint = if (slide == 1) MqGold else Color.White,
                            modifier = Modifier.size(58.dp)
                        )
                    }
                    Text(
                        "Muslim QI",
                        color = Color.White,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 20.sp,
                        modifier = Modifier.padding(top = 17.dp)
                    )
                    Text(
                        "La connaissance, un pas après l’autre",
                        color = Color.White.copy(alpha = 0.64f),
                        fontSize = 10.sp
                    )
                }
            }
        }
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .fillMaxWidth()
                .premiumReentry("onboarding-copy-$slide")
        ) {
            Text(
                titles[slide],
                style = MaterialTheme.typography.headlineMedium,
                textAlign = TextAlign.Center
            )
            Text(
                descriptions[slide],
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                lineHeight = 21.sp,
                modifier = Modifier.padding(top = 10.dp)
            )
        }
    }
}

@Composable
private fun AccountScreen(onContinue: () -> Unit) {
    IntroScaffold {
        Spacer(Modifier.height(20.dp))
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.fillMaxWidth()
        ) {
            BrandLogo(74.dp)
            Text(
                "Comment continuer ?",
                style = MaterialTheme.typography.headlineMedium,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 16.dp)
            )
            Text(
                "Commencez immédiatement. La synchronisation sera reliée ensuite.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 7.dp)
            )
        }
        AccountChoice(
            title = "Continuer en invité",
            subtitle = "Jouer sans créer de compte",
            icon = Icons.Rounded.Person,
            strong = true,
            onClick = onContinue
        )
        AccountChoice(
            title = "Continuer avec Google",
            subtitle = "Synchronisation multi-appareils",
            icon = Icons.Rounded.Public,
            strong = false,
            onClick = onContinue
        )
        AccountChoice(
            title = "Continuer avec Apple",
            subtitle = "Connexion sécurisée",
            icon = Icons.Rounded.PhoneIphone,
            strong = false,
            onClick = onContinue
        )
        AccountChoice(
            title = "Continuer avec e-mail",
            subtitle = "Adresse et mot de passe",
            icon = Icons.Rounded.Email,
            strong = false,
            onClick = onContinue
        )
        InformationStrip(
            icon = Icons.Rounded.Security,
            title = "Données protégées",
            text = "Export et suppression seront disponibles depuis le profil."
        )
    }
}

@Composable
private fun AccountChoice(
    title: String,
    subtitle: String,
    icon: ImageVector,
    strong: Boolean,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(22.dp),
        color = if (strong) MqTeal else MaterialTheme.colorScheme.surface,
        shadowElevation = if (strong) 10.dp else 3.dp
    ) {
        Row(
            Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                Modifier
                    .size(49.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(
                        if (strong) Color.White.copy(alpha = 0.12f)
                        else MaterialTheme.colorScheme.primaryContainer
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    icon,
                    contentDescription = null,
                    tint = if (strong) Color.White else MaterialTheme.colorScheme.primary
                )
            }
            Column(
                Modifier
                    .weight(1f)
                    .padding(horizontal = 14.dp)
            ) {
                Text(
                    title,
                    color = if (strong) Color.White else MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 16.sp
                )
                Text(
                    subtitle,
                    color = if (strong) {
                        Color.White.copy(alpha = 0.66f)
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
                    fontSize = 10.sp
                )
            }
            Icon(
                Icons.Rounded.ChevronRight,
                contentDescription = null,
                tint = if (strong) MqGold else MaterialTheme.colorScheme.primary
            )
        }
    }
}

@Composable
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

@Composable
private fun InformationStrip(
    icon: ImageVector,
    title: String,
    text: String
) {
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = MqGold.copy(alpha = 0.14f),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                Modifier
                    .size(42.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(MqGold.copy(alpha = 0.18f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    icon,
                    contentDescription = null,
                    tint = Color(0xFF9A7517),
                    modifier = Modifier.size(22.dp)
                )
            }
            Column(Modifier.padding(start = 12.dp)) {
                Text(title, fontWeight = FontWeight.ExtraBold, fontSize = 13.sp)
                Text(
                    text,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 10.sp
                )
            }
        }
    }
}

@Composable
private fun MainShell(
    selected: AppPage,
    navigate: (AppPage) -> Unit,
    content: @Composable () -> Unit
) {
    Scaffold(
        modifier = Modifier.fillMaxSize(),
        containerColor = Color.Transparent,
        bottomBar = {
            BottomNavigationBar(selected, navigate)
        }
    ) { padding ->
        Box(
            Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            content()
        }
    }
}

@Composable
private fun BottomNavigationBar(
    selected: AppPage,
    navigate: (AppPage) -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.98f),
        shadowElevation = 18.dp
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .height(76.dp)
                .padding(horizontal = 5.dp, vertical = 7.dp)
        ) {
            bottomNavigation.forEach { item ->
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
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .clip(RoundedCornerShape(18.dp))
                        .clickable { navigate(item.page) }
                        .padding(vertical = 5.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Box(
                        Modifier
                            .width(if (active) 48.dp else 36.dp)
                            .height(29.dp)
                            .graphicsLayer {
                                scaleX = navigationScale
                                scaleY = navigationScale
                                translationY = navigationLift
                            }
                            .graphicsLayer {
                                scaleX = navigationScale
                                scaleY = navigationScale
                                translationY = navigationLift
                            }
                            .graphicsLayer {
                                scaleX = navigationScale
                                scaleY = navigationScale
                                translationY = navigationLift
                            }
                            .graphicsLayer {
                                scaleX = navigationScale
                                scaleY = navigationScale
                                translationY = navigationLift
                            }
                            .graphicsLayer {
                                scaleX = navigationScale
                                scaleY = navigationScale
                                translationY = navigationLift
                            }
                            .graphicsLayer {
                                scaleX = navigationScale
                                scaleY = navigationScale
                                translationY = navigationLift
                            }
                            .graphicsLayer {
                                scaleX = navigationScale
                                scaleY = navigationScale
                                translationY = navigationLift
                            }
                            .clip(RoundedCornerShape(15.dp))
                            .background(
                                if (active) MaterialTheme.colorScheme.primaryContainer
                                else Color.Transparent
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            item.icon,
                            contentDescription = item.label,
                            tint = if (active) {
                                MaterialTheme.colorScheme.primary
                            } else {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            },
                            modifier = Modifier.size(21.dp)
                        )
                    }
                    Text(
                        item.label,
                        color = if (active) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        },
                        fontSize = 9.sp,
                        fontWeight = if (active) FontWeight.ExtraBold else FontWeight.Medium
                    )
                }
            }
        }
    }
}

@Composable
private fun ScreenHeader(
    title: String,
    subtitle: String? = null,
    trailing: (@Composable () -> Unit)? = null
) {
    Row(
        Modifier
            .fillMaxWidth()
            .statusBarsPadding()
            .padding(horizontal = 20.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleLarge)
            subtitle?.let {
                Text(
                    it,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 10.sp,
                    modifier = Modifier.padding(top = 2.dp)
                )
            }
        }
        trailing?.invoke()
    }
}

@Composable
private fun HomeScreen(
    openPlay: () -> Unit,
    openMemory: () -> Unit,
    openMosques: () -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Row(
                Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 20.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    Modifier
                        .size(46.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primaryContainer),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Rounded.Person,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
                Column(
                    Modifier
                        .weight(1f)
                        .padding(horizontal = 12.dp)
                ) {
                    Text(
                        "As-salāmu ʿalaykum",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 10.sp
                    )
                    Text("Youssef", fontWeight = FontWeight.ExtraBold, fontSize = 19.sp)
                }
                Surface(
                    shape = RoundedCornerShape(18.dp),
                    color = MqGold.copy(alpha = 0.18f)
                ) {
                    Text(
                        "145 XP",
                        color = Color(0xFF806018),
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                    )
                }
            }
        }
        item {
            PrayerAndMosqueCard(openMosques)
        }
        item {
            DailyLearningCard(openPlay)
        }
        item {
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(9.dp)
            ) {
                MiniStatistic(
                    Icons.Rounded.LocalFireDepartment,
                    "7 jours",
                    "Série",
                    MqCoral,
                    Modifier.weight(1f)
                )
                MiniStatistic(
                    Icons.Rounded.School,
                    "820 XP",
                    "Semaine",
                    MqGold,
                    Modifier.weight(1f)
                )
                MiniStatistic(
                    Icons.Rounded.Verified,
                    "68%",
                    "Maîtrise",
                    MqEmerald,
                    Modifier.weight(1f)
                )
            }
        }
        item {
            SectionTitle("Jouer et apprendre", "Voir tout", openPlay)
        }
        item {
            Row(
                Modifier.padding(horizontal = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                ColorModeCard(
                    title = "Mémoire",
                    subtitle = "4 formats responsifs",
                    icon = Icons.Rounded.GridView,
                    colors = listOf(MqEmerald, MqEmeraldDark),
                    modifier = Modifier.weight(1f),
                    onClick = openMemory
                )
                ColorModeCard(
                    title = "Quiz",
                    subtitle = "Tester ses acquis",
                    icon = Icons.Rounded.Quiz,
                    colors = listOf(MqBlue, Color(0xFF285C80)),
                    modifier = Modifier.weight(1f),
                    onClick = openPlay
                )
            }
        }
        item {
            Row(
                Modifier.padding(horizontal = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                ColorModeCard(
                    title = "Vrai ou faux",
                    subtitle = "Répondre vite",
                    icon = Icons.Rounded.Rule,
                    colors = listOf(MqGold, Color(0xFFC99421)),
                    modifier = Modifier.weight(1f),
                    onClick = openPlay
                )
                ColorModeCard(
                    title = "Devinettes",
                    subtitle = "Révéler des indices",
                    icon = Icons.Rounded.Lightbulb,
                    colors = listOf(MqPurple, Color(0xFF5E4A8C)),
                    modifier = Modifier.weight(1f),
                    onClick = openPlay
                )
            }
        }
    }
}

@Composable
private fun PrayerAndMosqueCard(onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .padding(horizontal = 20.dp)
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(24.dp),
        color = MaterialTheme.colorScheme.surface,
        shadowElevation = 5.dp
    ) {
        Row(
            Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                Modifier
                    .size(54.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Rounded.Mosque,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(29.dp)
                )
            }
            Column(
                Modifier
                    .weight(1f)
                    .padding(horizontal = 13.dp)
            ) {
                Text(
                    "Mosquée et prochaine prière",
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 14.sp
                )
                Text(
                    "Rechercher les mosquées réellement proches",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 10.sp
                )
            }
            Icon(
                Icons.Rounded.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary
            )
        }
    }
}

@Composable
private fun DailyLearningCard(onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .padding(horizontal = 20.dp)
            .fillMaxWidth()
            .height(225.dp)
            .shadow(16.dp, RoundedCornerShape(30.dp)),
        shape = RoundedCornerShape(30.dp),
        color = MqTeal
    ) {
        Box(Modifier.fillMaxSize()) {
            Canvas(Modifier.matchParentSize()) {
                drawCircle(
                    MqGold.copy(alpha = 0.14f),
                    size.minDimension * 0.64f,
                    Offset(size.width, 0f)
                )
            }
            PremiumShimmerSweep(Modifier.matchParentSize())
            Column(
                Modifier
                    .fillMaxSize()
                    .padding(22.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = Color.White.copy(alpha = 0.10f)
                    ) {
                        Text(
                            "PARCOURS DU JOUR",
                            color = MqGold,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 9.sp,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp)
                        )
                    }
                    Spacer(Modifier.weight(1f))
                    PremiumFloatingIcon(
                        icon = Icons.Rounded.AutoAwesome,
                        contentDescription = null,
                        tint = MqGold
                    )
                }
                Text(
                    "Les valeurs\net leurs enseignements",
                    color = Color.White,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 25.sp,
                    lineHeight = 28.sp,
                    modifier = Modifier.padding(top = 17.dp)
                )
                Text(
                    "6 minutes • 3 activités",
                    color = Color.White.copy(alpha = 0.66f),
                    fontSize = 10.sp,
                    modifier = Modifier.padding(top = 5.dp)
                )
                Spacer(Modifier.weight(1f))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        LinearProgressIndicator(
                            progress = { 0.42f },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(6.dp)
                                .clip(CircleShape),
                            color = MqGold,
                            trackColor = Color.White.copy(alpha = 0.13f)
                        )
                        Text(
                            "42% terminé",
                            color = Color.White.copy(alpha = 0.62f),
                            fontSize = 9.sp,
                            modifier = Modifier.padding(top = 5.dp)
                        )
                    }
                    Spacer(Modifier.width(14.dp))
                    Button(
                        onClick = onClick,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color.White,
                            contentColor = MqEmeraldDark
                        ),
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Text("Continuer", fontWeight = FontWeight.ExtraBold)
                        Icon(
                            Icons.Rounded.ArrowForward,
                            contentDescription = null,
                            modifier = Modifier
                                .padding(start = 5.dp)
                                .size(18.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun RowScope.MiniStatistic(
    icon: ImageVector,
    value: String,
    label: String,
    color: Color,
    modifier: Modifier
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(20.dp),
        color = MaterialTheme.colorScheme.surface,
        shadowElevation = 3.dp
    ) {
        Column(
            Modifier.padding(vertical = 13.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(icon, null, tint = color, modifier = Modifier.size(21.dp))
            Text(
                value,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 14.sp,
                modifier = Modifier.padding(top = 6.dp)
            )
            Text(
                label,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 8.sp
            )
        }
    }
}

@Composable
private fun SectionTitle(
    title: String,
    action: String,
    onAction: () -> Unit
) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            title,
            fontWeight = FontWeight.ExtraBold,
            fontSize = 17.sp,
            modifier = Modifier.weight(1f)
        )
        TextButton(onClick = onAction) {
            Text(action, color = MaterialTheme.colorScheme.primary, fontSize = 10.sp)
        }
    }
}

@Composable
private fun RowScope.ColorModeCard(
    title: String,
    subtitle: String,
    icon: ImageVector,
    colors: List<Color>,
    modifier: Modifier,
    onClick: () -> Unit
) {
    Surface(
        modifier = modifier
            .height(140.dp)
            .clip(RoundedCornerShape(25.dp))
            .clickable(onClick = onClick),
        color = Color.Transparent,
        shadowElevation = 8.dp
    ) {
        Box(
            Modifier
                .fillMaxSize()
                .background(Brush.linearGradient(colors))
                .padding(16.dp)
        ) {
            Canvas(Modifier.matchParentSize()) {
                drawCircle(
                    Color.White.copy(alpha = 0.08f),
                    size.minDimension * 0.62f,
                    Offset(size.width, 0f)
                )
            }
            Box(
                Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color.White.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, null, tint = Color.White)
            }
            Column(Modifier.align(Alignment.BottomStart)) {
                Text(
                    title,
                    color = Color.White,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 17.sp
                )
                Text(
                    subtitle,
                    color = Color.White.copy(alpha = 0.72f),
                    fontSize = 9.sp
                )
            }
        }
    }
}

@Composable
private fun PlayScreen(openMemory: () -> Unit) {
    val modes = listOf(
        Triple(
            "Mémoire islamique",
            "Choisissez 4 × 4, 4 × 5, 4 × 6 ou 4 × 7.",
            Icons.Rounded.GridView
        ),
        Triple(
            "Quiz",
            "Quatre réponses et une explication claire.",
            Icons.Rounded.Quiz
        ),
        Triple(
            "Vrai ou faux",
            "Des affirmations courtes et chronométrées.",
            Icons.Rounded.Rule
        ),
        Triple(
            "Devinettes",
            "Des indices révélés progressivement.",
            Icons.Rounded.Lightbulb
        )
    )
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(11.dp)
    ) {
        item {
            ScreenHeader("Jouer", "Choisissez une expérience")
        }
        item {
            Box(Modifier.padding(horizontal = 20.dp)) {
                InformationStrip(
                    Icons.Rounded.TipsAndUpdates,
                    "Conseil du jour",
                    "Une partie courte suffit pour maintenir votre série."
                )
            }
        }
        items(modes) { mode ->
            val isMemory = mode.first == "Mémoire islamique"
            Surface(
                modifier = Modifier
                    .padding(horizontal = 20.dp)
                    .fillMaxWidth()
                    .clickable(enabled = isMemory) {
                        if (isMemory) openMemory()
                    },
                shape = RoundedCornerShape(24.dp),
                color = MaterialTheme.colorScheme.surface,
                shadowElevation = 4.dp
            ) {
                Row(
                    Modifier.padding(17.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        Modifier
                            .size(60.dp)
                            .clip(RoundedCornerShape(20.dp))
                            .background(MaterialTheme.colorScheme.primaryContainer),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            mode.third,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(31.dp)
                        )
                    }
                    Column(
                        Modifier
                            .weight(1f)
                            .padding(horizontal = 14.dp)
                    ) {
                        Text(
                            mode.first,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 17.sp
                        )
                        Text(
                            mode.second,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 10.sp,
                            lineHeight = 14.sp,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                        Text(
                            if (isMemory) "Choisir un format →" else "Bientôt disponible",
                            color = MaterialTheme.colorScheme.primary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 10.sp,
                            modifier = Modifier.padding(top = 8.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun PermissionScreen(
    onBack: () -> Unit,
    onContinue: () -> Unit
) {
    val context = LocalContext.current
    var refreshToken by remember { mutableIntStateOf(0) }
    val notificationGranted = remember(refreshToken) {
        hasNotificationPermission(context)
    }
    val foregroundLocationGranted = remember(refreshToken) {
        hasForegroundLocation(context)
    }
    val backgroundLocationGranted = remember(refreshToken) {
        hasBackgroundLocation(context)
    }

    val notificationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) {
        refreshToken++
    }
    val foregroundLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        refreshToken++
    }
    val backgroundLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) {
        refreshToken++
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        containerColor = Color.Transparent,
        bottomBar = {
            Surface(color = MaterialTheme.colorScheme.background.copy(alpha = 0.98f)) {
                Column(
                    Modifier
                        .navigationBarsPadding()
                        .padding(horizontal = 20.dp, vertical = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    PrimaryActionButton(
                        "Continuer vers les formats",
                        Icons.Rounded.ArrowForward,
                        onContinue
                    )
                    Text(
                        "Le jeu reste accessible si une autorisation est refusée. Seules les fonctions concernées seront désactivées.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 9.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(bottom = 18.dp),
            verticalArrangement = Arrangement.spacedBy(11.dp)
        ) {
            item {
                ScreenHeader(
                    "Autorisations",
                    "Prières, défis éducatifs et mosquées proches"
                ) {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Rounded.Close, null)
                    }
                }
            }
            item {
                Surface(
                    modifier = Modifier
                        .padding(horizontal = 20.dp)
                        .fillMaxWidth(),
                    shape = RoundedCornerShape(28.dp),
                    color = MqTeal,
                    shadowElevation = 8.dp
                ) {
                    Column(Modifier.padding(20.dp)) {
                        Icon(
                            Icons.Rounded.Security,
                            null,
                            tint = MqGold,
                            modifier = Modifier.size(36.dp)
                        )
                        Text(
                            "Votre vie privée reste prioritaire",
                            color = Color.White,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 21.sp,
                            modifier = Modifier.padding(top = 10.dp)
                        )
                        Text(
                            "Muslim QI explique chaque demande. Android vous laisse toujours accepter ou refuser.",
                            color = Color.White.copy(alpha = 0.72f),
                            fontSize = 11.sp,
                            lineHeight = 16.sp,
                            modifier = Modifier.padding(top = 7.dp)
                        )
                    }
                }
            }
            item {
                PermissionRow(
                    icon = Icons.Rounded.NotificationsActive,
                    title = "Notifications",
                    description = "Rappels de prière et défi éducatif quotidien.",
                    granted = notificationGranted,
                    buttonLabel = "Autoriser",
                    onClick = {
                        if (Build.VERSION.SDK_INT >= 33) {
                            notificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                        } else {
                            refreshToken++
                        }
                    }
                )
            }
            item {
                PermissionRow(
                    icon = Icons.Rounded.LocationOn,
                    title = "Position pendant l’utilisation",
                    description = "Recherche des mosquées proches et horaires locaux.",
                    granted = foregroundLocationGranted,
                    buttonLabel = "Autoriser",
                    onClick = {
                        foregroundLauncher.launch(
                            arrayOf(
                                Manifest.permission.ACCESS_COARSE_LOCATION,
                                Manifest.permission.ACCESS_FINE_LOCATION
                            )
                        )
                    }
                )
            }
            item {
                PermissionRow(
                    icon = Icons.Rounded.Map,
                    title = "Position en arrière-plan",
                    description = "Option séparée pour de futurs rappels géolocalisés.",
                    granted = backgroundLocationGranted,
                    enabled = foregroundLocationGranted,
                    buttonLabel = if (Build.VERSION.SDK_INT >= 30) {
                        "Réglages"
                    } else {
                        "Autoriser"
                    },
                    onClick = {
                        if (Build.VERSION.SDK_INT >= 30) {
                            openApplicationSettings(context)
                        } else if (Build.VERSION.SDK_INT >= 29) {
                            backgroundLauncher.launch(
                                Manifest.permission.ACCESS_BACKGROUND_LOCATION
                            )
                        } else {
                            refreshToken++
                        }
                    }
                )
            }
            item {
                Box(Modifier.padding(horizontal = 20.dp)) {
                    InformationStrip(
                        Icons.Rounded.Info,
                        "Utilisation responsable",
                        "La localisation en arrière-plan n’est pas nécessaire pour jouer. Touchez Actualiser après un changement dans les réglages."
                    )
                }
            }
            item {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp),
                    contentAlignment = Alignment.Center
                ) {
                    OutlinedButton(onClick = { refreshToken++ }) {
                        Icon(Icons.Rounded.Refresh, null, modifier = Modifier.size(17.dp))
                        Text("Actualiser", modifier = Modifier.padding(start = 6.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun PermissionRow(
    icon: ImageVector,
    title: String,
    description: String,
    granted: Boolean,
    enabled: Boolean = true,
    buttonLabel: String,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .padding(horizontal = 20.dp)
            .fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        color = MaterialTheme.colorScheme.surface,
        shadowElevation = 3.dp
    ) {
        Row(
            Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                Modifier
                    .size(50.dp)
                    .clip(RoundedCornerShape(17.dp))
                    .background(
                        if (granted) MaterialTheme.colorScheme.primaryContainer
                        else MaterialTheme.colorScheme.surfaceVariant
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    icon,
                    null,
                    tint = if (granted) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    }
                )
            }
            Column(
                Modifier
                    .weight(1f)
                    .padding(horizontal = 13.dp)
            ) {
                Text(title, fontWeight = FontWeight.ExtraBold, fontSize = 14.sp)
                Text(
                    description,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 9.sp,
                    lineHeight = 13.sp
                )
            }
            if (granted) {
                Icon(
                    Icons.Rounded.CheckCircle,
                    null,
                    tint = MaterialTheme.colorScheme.primary
                )
            } else {
                OutlinedButton(
                    onClick = onClick,
                    enabled = enabled,
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(if (enabled) buttonLabel else "Après", fontSize = 9.sp)
                }
            }
        }
    }
}

@Composable
private fun MemorySetupScreen(
    selectedFormatIndex: Int,
    onFormatSelected: (Int) -> Unit,
    onBack: () -> Unit,
    onStart: () -> Unit
) {
    Scaffold(
        modifier = Modifier.fillMaxSize(),
        containerColor = Color.Transparent,
        bottomBar = {
            Surface(color = MaterialTheme.colorScheme.background.copy(alpha = 0.98f)) {
                Box(
                    Modifier
                        .navigationBarsPadding()
                        .padding(horizontal = 20.dp, vertical = 12.dp)
                ) {
                    PrimaryActionButton(
                        "Lancer la partie",
                        Icons.Rounded.PlayArrow,
                        onStart
                    )
                }
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .statusBarsPadding()
                .padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.Rounded.ArrowBack, null)
                }
                Column(Modifier.weight(1f)) {
                    Text("Mémoire islamique", style = MaterialTheme.typography.titleLarge)
                    Text(
                        "Choisissez un format",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 10.sp
                    )
                }
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = MaterialTheme.colorScheme.primaryContainer
                ) {
                    Text(
                        "${boardFormats[selectedFormatIndex].pairCount} paires",
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 10.sp,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp)
                    )
                }
            }
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(25.dp),
                color = MqTeal,
                shadowElevation = 8.dp
            ) {
                Row(
                    Modifier.padding(17.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        Modifier
                            .size(55.dp)
                            .clip(RoundedCornerShape(18.dp))
                            .background(Color.White.copy(alpha = 0.10f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.Rounded.GridView,
                            null,
                            tint = MqGold,
                            modifier = Modifier.size(30.dp)
                        )
                    }
                    Column(Modifier.padding(start = 14.dp)) {
                        Text(
                            "Grille responsive sans défilement",
                            color = Color.White,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 15.sp
                        )
                        Text(
                            "Les cartes occupent automatiquement toute la surface disponible.",
                            color = Color.White.copy(alpha = 0.68f),
                            fontSize = 9.sp,
                            lineHeight = 13.sp
                        )
                    }
                }
            }
            Text("Formats disponibles", fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                boardFormats.chunked(2).forEachIndexed { rowIndex, rowFormats ->
                    Row(
                        modifier = Modifier.weight(1f),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        rowFormats.forEachIndexed { columnIndex, format ->
                            val index = rowIndex * 2 + columnIndex
                            FormatSelectionCard(
                                format = format,
                                selected = selectedFormatIndex == index,
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxHeight()
                            ) {
                                onFormatSelected(index)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FormatSelectionCard(
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
            .border(
                1.5.dp,
                if (selected) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.outline,
                RoundedCornerShape(24.dp)
            ),
        shape = RoundedCornerShape(24.dp),
        color = if (selected) {
            MaterialTheme.colorScheme.primaryContainer
        } else {
            MaterialTheme.colorScheme.surface
        },
        shadowElevation = if (selected) 8.dp else 3.dp
    ) {
        Box(
            Modifier
                .fillMaxSize()
                .padding(14.dp)
        ) {
            if (selected) {
                Icon(
                    Icons.Rounded.CheckCircle,
                    null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.align(Alignment.TopEnd)
                )
            }
            Column(
                modifier = Modifier.align(Alignment.Center),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                MiniBoardPreview(format, selected)
                Text(
                    format.label,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 22.sp,
                    modifier = Modifier.padding(top = 10.dp)
                )
                Text(
                    format.difficulty,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 10.sp
                )
                Text(
                    "${format.cardCount} cartes",
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Bold,
                    fontSize = 9.sp,
                    modifier = Modifier.padding(top = 5.dp)
                )
            }
        }
    }
}

@Composable
private fun MiniBoardPreview(format: BoardFormat, selected: Boolean) {
    Column(
        modifier = Modifier
            .height(62.dp)
            .width(70.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        repeat(format.rows) {
            Row(
                modifier = Modifier.weight(1f),
                horizontalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                repeat(format.columns) {
                    Box(
                        Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .clip(RoundedCornerShape(2.dp))
                            .background(
                                if (selected) {
                                    MaterialTheme.colorScheme.primary.copy(alpha = 0.75f)
                                } else {
                                    MaterialTheme.colorScheme.outline.copy(alpha = 0.50f)
                                }
                            )
                    )
                }
            }
        }
    }
}

@Composable
private fun MemoryGameScreen(
    format: BoardFormat,
    onBack: () -> Unit
) {
    var restartKey by rememberSaveable { mutableIntStateOf(0) }
    val deck = remember(format, restartKey) { buildMemoryDeck(format) }
    val selectedCardIndexes = remember(restartKey) { mutableStateListOf<Int>() }
    val matchedPairIds = remember(restartKey) { mutableStateListOf<Int>() }
    var attempts by rememberSaveable(restartKey) { mutableIntStateOf(0) }
    var errors by rememberSaveable(restartKey) { mutableIntStateOf(0) }
    var score by rememberSaveable(restartKey) { mutableIntStateOf(0) }
    var elapsedSeconds by rememberSaveable(restartKey) { mutableIntStateOf(0) }
    var paused by rememberSaveable(restartKey) { mutableStateOf(false) }
    val completed = matchedPairIds.size == format.pairCount

    LaunchedEffect(restartKey, paused, completed) {
        while (!paused && !completed) {
            delay(1000)
            elapsedSeconds++
        }
    }

    LaunchedEffect(selectedCardIndexes.toList()) {
        if (selectedCardIndexes.size != 2) return@LaunchedEffect
        attempts++
        delay(520)
        val firstCard = deck[selectedCardIndexes[0]]
        val secondCard = deck[selectedCardIndexes[1]]
        if (firstCard.pairId == secondCard.pairId) {
            if (firstCard.pairId !in matchedPairIds) {
                matchedPairIds.add(firstCard.pairId)
            }
            score += 100 + format.rows * 5
        } else {
            errors++
            score = (score - 3).coerceAtLeast(0)
        }
        selectedCardIndexes.clear()
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        containerColor = Color.Transparent
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(horizontal = 10.dp, vertical = 7.dp)
        ) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .height(44.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.Rounded.ArrowBack, null)
                }
                Column(Modifier.weight(1f)) {
                    Text(
                        "Mémoire islamique",
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 16.sp
                    )
                    Text(
                        "${format.label} • ${format.pairCount} paires",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 9.sp
                    )
                }
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = MqGold.copy(alpha = 0.18f)
                ) {
                    Text(
                        "$score pts",
                        color = Color(0xFF826116),
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 10.sp,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp)
                    )
                }
                IconButton(onClick = { paused = !paused }) {
                    Icon(
                        if (paused) Icons.Rounded.PlayArrow else Icons.Rounded.Pause,
                        null
                    )
                }
            }
            Row(
                Modifier
                    .fillMaxWidth()
                    .height(42.dp),
                horizontalArrangement = Arrangement.SpaceAround,
                verticalAlignment = Alignment.CenterVertically
            ) {
                GameStatistic(formatGameTime(elapsedSeconds), "Temps")
                GameStatistic(attempts.toString(), "Essais")
                GameStatistic(errors.toString(), "Erreurs")
                GameStatistic(
                    "${matchedPairIds.size}/${format.pairCount}",
                    "Paires"
                )
            }
            LinearProgressIndicator(
                progress = { matchedPairIds.size / format.pairCount.toFloat() },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(5.dp)
                    .clip(CircleShape),
                color = MaterialTheme.colorScheme.primary,
                trackColor = MaterialTheme.colorScheme.primaryContainer
            )
            Spacer(Modifier.height(6.dp))
            BoxWithConstraints(
                Modifier
                    .fillMaxWidth()
                    .weight(1f)
            ) {
                val gap = when {
                    maxHeight < 450.dp -> 3.dp
                    format.rows >= 7 -> 4.dp
                    else -> 6.dp
                }
                Column(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(gap)
                ) {
                    deck.chunked(format.columns).forEachIndexed { rowIndex, rowCards ->
                        Row(
                            modifier = Modifier.weight(1f),
                            horizontalArrangement = Arrangement.spacedBy(gap)
                        ) {
                            rowCards.forEachIndexed { columnIndex, card ->
                                val cardIndex = rowIndex * format.columns + columnIndex
                                val selected = cardIndex in selectedCardIndexes
                                val matched = card.pairId in matchedPairIds
                                MemoryCard(
                                    card = card,
                                    visible = selected || matched,
                                    matched = matched,
                                    compact = format.rows >= 6,
                                    modifier = Modifier
                                        .weight(1f)
                                        .fillMaxHeight()
                                ) {
                                    if (
                                        !paused &&
                                        !completed &&
                                        selectedCardIndexes.size < 2 &&
                                        cardIndex !in selectedCardIndexes &&
                                        !matched
                                    ) {
                                        selectedCardIndexes.add(cardIndex)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (paused) {
        AlertDialog(
            onDismissRequest = { paused = false },
            icon = {
                Icon(
                    Icons.Rounded.Pause,
                    null,
                    tint = MaterialTheme.colorScheme.primary
                )
            },
            title = { Text("Partie en pause") },
            text = {
                Text("Le chronomètre est arrêté. Reprenez quand vous êtes prêt.")
            },
            confirmButton = {
                Button(onClick = { paused = false }) {
                    Text("Reprendre")
                }
            },
            dismissButton = {
                TextButton(onClick = onBack) {
                    Text("Quitter")
                }
            },
            shape = RoundedCornerShape(28.dp)
        )
    }

    if (completed) {
        AlertDialog(
            onDismissRequest = {},
            icon = {
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
            title = {
                Text("Grille terminée !", fontWeight = FontWeight.ExtraBold)
            },
            text = {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        "$score points",
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 25.sp
                    )
                    Text(
                        "${format.label} • $attempts tentatives • $errors erreurs • ${formatGameTime(elapsedSeconds)}",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(top = 7.dp)
                    )
                }
            },
            confirmButton = {
                Button(onClick = { restartKey++ }) {
                    Text("Rejouer")
                }
            },
            dismissButton = {
                TextButton(onClick = onBack) {
                    Text("Formats")
                }
            },
            shape = RoundedCornerShape(28.dp)
        )
    }
}

@Composable
private fun GameStatistic(value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, fontWeight = FontWeight.ExtraBold, fontSize = 12.sp)
        Text(
            label,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            fontSize = 8.sp
        )
    }
}

@Composable
private fun MemoryCard(
    card: MemoryCardData,
    visible: Boolean,
    matched: Boolean,
    compact: Boolean,
    modifier: Modifier,
    onClick: () -> Unit
) {
    val rotation by animateFloatAsState(
        targetValue = if (visible) 180f else 0f,
        animationSpec = tween(320),
        label = "memory_card_flip"
    )
    val showFront = rotation > 90f
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
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(if (compact) 11.dp else 15.dp),
        color = if (showFront) MaterialTheme.colorScheme.surface else MqEmeraldDark,
        shadowElevation = if (matched) 1.dp else 4.dp
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer {
                    if (showFront) rotationY = 180f
                }
                .border(
                    width = if (matched) 2.dp else 1.dp,
                    color = if (matched) MqGold else MqGold.copy(alpha = 0.48f),
                    shape = RoundedCornerShape(if (compact) 11.dp else 15.dp)
                ),
            contentAlignment = Alignment.Center
        ) {
            PremiumSuccessSparkles(
                visible = matched,
                modifier = Modifier.matchParentSize()
            )
            if (!showFront) {
                Canvas(Modifier.fillMaxSize()) {
                    val center = Offset(size.width / 2, size.height / 2)
                    drawCircle(
                        MqGold.copy(alpha = 0.18f),
                        size.minDimension * 0.28f,
                        center
                    )
                    drawCircle(
                        MqGold.copy(alpha = 0.58f),
                        size.minDimension * 0.19f,
                        center,
                        style = Stroke(2.dp.toPx())
                    )
                    drawLine(
                        MqGold.copy(alpha = 0.70f),
                        center + Offset(0f, -size.minDimension * 0.14f),
                        center + Offset(0f, size.minDimension * 0.14f),
                        2.dp.toPx()
                    )
                    drawLine(
                        MqGold.copy(alpha = 0.70f),
                        center + Offset(-size.minDimension * 0.14f, 0f),
                        center + Offset(size.minDimension * 0.14f, 0f),
                        2.dp.toPx()
                    )
                }
                Text(
                    "✦",
                    color = MqGold,
                    fontSize = if (compact) 14.sp else 20.sp
                )
            } else {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(2.dp)
                ) {
                    Text(
                        card.content.arabic,
                        color = if (matched) MqEmerald else MaterialTheme.colorScheme.onSurface,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = if (compact) 11.sp else 15.sp,
                        maxLines = 1
                    )
                    Text(
                        card.content.french,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontWeight = FontWeight.Bold,
                        fontSize = if (compact) 6.sp else 8.sp,
                        maxLines = 1,
                        textAlign = TextAlign.Center
                    )
                    if (matched) {
                        Icon(
                            Icons.Rounded.Check,
                            null,
                            tint = MqGold,
                            modifier = Modifier.size(if (compact) 10.dp else 14.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun NearbyMosquesScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    var refreshToken by remember { mutableIntStateOf(0) }
    var loading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var mosques by remember { mutableStateOf<List<MosqueItem>>(emptyList()) }
    var selectedMosque by remember { mutableStateOf<MosqueItem?>(null) }
    var prayerTimes by remember { mutableStateOf<PrayerTimes?>(null) }
    val locationGranted = remember(refreshToken) {
        hasForegroundLocation(context)
    }

    val locationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        refreshToken++
    }

    LaunchedEffect(locationGranted, refreshToken) {
        if (!locationGranted) return@LaunchedEffect
        loading = true
        errorMessage = null
        try {
            val location = getBestLocation(context)
            if (location == null) {
                errorMessage = "Position indisponible. Activez le GPS puis réessayez."
            } else {
                mosques = loadNearbyMosques(location.latitude, location.longitude)
                if (mosques.isEmpty()) {
                    errorMessage = "Aucune mosquée renseignée dans un rayon de 12 km."
                }
            }
        } catch (exception: Exception) {
            errorMessage = "Recherche impossible : ${exception.message ?: "erreur réseau"}."
        } finally {
            loading = false
        }
    }

    LaunchedEffect(selectedMosque) {
        prayerTimes = null
        val mosque = selectedMosque ?: return@LaunchedEffect
        prayerTimes = try {
            loadCalculatedPrayerTimes(mosque.latitude, mosque.longitude)
        } catch (_: Exception) {
            null
        }
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        containerColor = Color.Transparent
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(11.dp)
        ) {
            item {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Rounded.ArrowBack, null)
                    }
                    Column(Modifier.weight(1f)) {
                        Text("Mosquées proches", style = MaterialTheme.typography.titleLarge)
                        Text(
                            "Recherche réelle à partir de votre position",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 10.sp
                        )
                    }
                    IconButton(onClick = { refreshToken++ }) {
                        Icon(Icons.Rounded.Refresh, null)
                    }
                }
            }
            if (!locationGranted) {
                item {
                    Surface(
                        modifier = Modifier
                            .padding(horizontal = 20.dp)
                            .fillMaxWidth(),
                        shape = RoundedCornerShape(28.dp),
                        color = MqTeal,
                        shadowElevation = 8.dp
                    ) {
                        Column(
                            Modifier.padding(20.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                Icons.Rounded.LocationOn,
                                null,
                                tint = MqGold,
                                modifier = Modifier.size(44.dp)
                            )
                            Text(
                                "Autorisez la position",
                                color = Color.White,
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 21.sp,
                                modifier = Modifier.padding(top = 10.dp)
                            )
                            Text(
                                "La position sert à classer les mosquées par distance et à calculer les horaires locaux.",
                                color = Color.White.copy(alpha = 0.72f),
                                textAlign = TextAlign.Center,
                                fontSize = 11.sp,
                                modifier = Modifier.padding(top = 7.dp)
                            )
                            Button(
                                onClick = {
                                    locationLauncher.launch(
                                        arrayOf(
                                            Manifest.permission.ACCESS_COARSE_LOCATION,
                                            Manifest.permission.ACCESS_FINE_LOCATION
                                        )
                                    )
                                },
                                modifier = Modifier.padding(top = 16.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color.White,
                                    contentColor = MqEmeraldDark
                                )
                            ) {
                                Text("Autoriser la position")
                            }
                        }
                    }
                }
            } else {
                item {
                    Box(Modifier.padding(horizontal = 20.dp)) {
                        InformationStrip(
                            Icons.Rounded.Info,
                            "Sources transparentes",
                            "Les mosquées proviennent d’OpenStreetMap. Les horaires sont calculés à leurs coordonnées et ne sont pas présentés comme des horaires officiels d’iqama."
                        )
                    }
                }
                if (loading) {
                    item {
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .height(160.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator()
                        }
                    }
                }
                errorMessage?.let { message ->
                    item {
                        Surface(
                            modifier = Modifier
                                .padding(horizontal = 20.dp)
                                .fillMaxWidth(),
                            shape = RoundedCornerShape(20.dp),
                            color = MqCoral.copy(alpha = 0.12f)
                        ) {
                            Text(
                                message,
                                modifier = Modifier.padding(16.dp),
                                color = MaterialTheme.colorScheme.onSurface,
                                fontSize = 12.sp
                            )
                        }
                    }
                }
                items(mosques) { mosque ->
                    MosqueResultCard(mosque) {
                        selectedMosque = mosque
                    }
                }
            }
        }
    }

    selectedMosque?.let { mosque ->
        AlertDialog(
            onDismissRequest = { selectedMosque = null },
            icon = {
                Icon(
                    Icons.Rounded.Mosque,
                    null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(42.dp)
                )
            },
            title = {
                Text(
                    mosque.name,
                    fontWeight = FontWeight.ExtraBold,
                    textAlign = TextAlign.Center
                )
            },
            text = {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        "À environ ${formatDistance(mosque.distanceMeters)}",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 11.sp
                    )
                    if (prayerTimes == null) {
                        CircularProgressIndicator(
                            modifier = Modifier
                                .padding(18.dp)
                                .size(28.dp),
                            strokeWidth = 3.dp
                        )
                    } else {
                        PrayerTimesGrid(prayerTimes!!)
                        Text(
                            "Horaires calculés aux coordonnées de la mosquée • méthode Ligue islamique mondiale. Les horaires officiels et l’iqama nécessitent une source publiée par cette mosquée.",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 9.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(top = 10.dp)
                        )
                    }
                }
            },
            confirmButton = {
                Button(onClick = { selectedMosque = null }) {
                    Text("Fermer")
                }
            },
            dismissButton = {
                mosque.website?.let { website ->
                    TextButton(onClick = { openWebsite(context, website) }) {
                        Text("Site de la mosquée")
                    }
                }
            },
            shape = RoundedCornerShape(28.dp)
        )
    }
}

@Composable
private fun MosqueResultCard(
    mosque: MosqueItem,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .padding(horizontal = 20.dp)
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(22.dp),
        color = MaterialTheme.colorScheme.surface,
        shadowElevation = 3.dp
    ) {
        Row(
            Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                Modifier
                    .size(52.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Rounded.Mosque,
                    null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(28.dp)
                )
            }
            Column(
                Modifier
                    .weight(1f)
                    .padding(horizontal = 13.dp)
            ) {
                Text(
                    mosque.name,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 14.sp,
                    maxLines = 2
                )
                Text(
                    "${formatDistance(mosque.distanceMeters)} • toucher pour les horaires",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 9.sp
                )
            }
            Icon(
                Icons.Rounded.ChevronRight,
                null,
                tint = MaterialTheme.colorScheme.primary
            )
        }
    }
}

@Composable
private fun PrayerTimesGrid(times: PrayerTimes) {
    val entries = listOf(
        "Fajr" to times.fajr,
        "Dhuhr" to times.dhuhr,
        "Asr" to times.asr,
        "Maghrib" to times.maghrib,
        "Isha" to times.isha
    )
    Column(
        Modifier
            .fillMaxWidth()
            .padding(top = 14.dp),
        verticalArrangement = Arrangement.spacedBy(7.dp)
    ) {
        entries.chunked(2).forEach { rowEntries ->
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(7.dp)
            ) {
                rowEntries.forEach { entry ->
                    Surface(
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(14.dp),
                        color = MaterialTheme.colorScheme.primaryContainer
                    ) {
                        Column(
                            Modifier.padding(9.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                entry.first,
                                color = MaterialTheme.colorScheme.onPrimaryContainer,
                                fontSize = 9.sp
                            )
                            Text(
                                entry.second,
                                color = MaterialTheme.colorScheme.onPrimaryContainer,
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 15.sp
                            )
                        }
                    }
                }
                if (rowEntries.size == 1) {
                    Spacer(Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun ProgressScreen() {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(13.dp)
    ) {
        item {
            ScreenHeader("Progression", "Votre chemin de connaissance")
        }
        item {
            Surface(
                modifier = Modifier
                    .padding(horizontal = 20.dp)
                    .fillMaxWidth(),
                shape = RoundedCornerShape(28.dp),
                color = MqTeal,
                shadowElevation = 8.dp
            ) {
                Row(
                    Modifier.padding(20.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            "NIVEAU 12",
                            color = MqGold,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 10.sp
                        )
                        Text(
                            "Chercheur de science",
                            color = Color.White,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 20.sp,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                        Text(
                            "380 XP avant le niveau suivant",
                            color = Color.White.copy(alpha = 0.64f),
                            fontSize = 9.sp
                        )
                        LinearProgressIndicator(
                            progress = { 0.68f },
                            modifier = Modifier
                                .padding(top = 12.dp)
                                .fillMaxWidth()
                                .height(7.dp)
                                .clip(CircleShape),
                            color = MqGold,
                            trackColor = Color.White.copy(alpha = 0.13f)
                        )
                    }
                    Box(
                        Modifier
                            .padding(start = 14.dp)
                            .size(72.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(
                            progress = { 0.68f },
                            modifier = Modifier.fillMaxSize(),
                            color = MqGold,
                            trackColor = Color.White.copy(alpha = 0.12f),
                            strokeWidth = 7.dp
                        )
                        Text(
                            "68%",
                            color = Color.White,
                            fontWeight = FontWeight.ExtraBold
                        )
                    }
                }
            }
        }
        item {
            SectionTitle("Maîtrise par thème", "", {})
        }
        item {
            Row(
                Modifier.padding(horizontal = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(9.dp)
            ) {
                MasteryCard("Coran", 0.80f, MqEmerald, Modifier.weight(1f))
                MasteryCard("Histoire", 0.72f, MqBlue, Modifier.weight(1f))
                MasteryCard("Valeurs", 0.65f, MqGold, Modifier.weight(1f))
            }
        }
        item {
            SectionTitle("À revoir", "3 thèmes", {})
        }
        items(
            listOf(
                "Les piliers de la foi" to 0.42f,
                "Les ablutions" to 0.58f,
                "Les mois hégiriens" to 0.64f
            )
        ) { review ->
            Surface(
                modifier = Modifier
                    .padding(horizontal = 20.dp)
                    .fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                color = MaterialTheme.colorScheme.surface,
                shadowElevation = 3.dp
            ) {
                Row(
                    Modifier.padding(15.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Rounded.MenuBook,
                        null,
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Column(
                        Modifier
                            .weight(1f)
                            .padding(horizontal = 12.dp)
                    ) {
                        Text(review.first, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        LinearProgressIndicator(
                            progress = { review.second },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(5.dp)
                                .clip(CircleShape),
                            color = MqGold,
                            trackColor = MqSand
                        )
                    }
                    Text(
                        "${(review.second * 100).toInt()}%",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 10.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun RowScope.MasteryCard(
    label: String,
    progress: Float,
    color: Color,
    modifier: Modifier
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(22.dp),
        color = MaterialTheme.colorScheme.surface,
        shadowElevation = 3.dp
    ) {
        Column(
            Modifier.padding(vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(Modifier.size(58.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(
                    progress = { progress },
                    modifier = Modifier.fillMaxSize(),
                    color = color,
                    trackColor = color.copy(alpha = 0.12f),
                    strokeWidth = 6.dp
                )
                Text(
                    "${(progress * 100).toInt()}%",
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 10.sp
                )
            }
            Text(
                label,
                fontWeight = FontWeight.Bold,
                fontSize = 9.sp,
                modifier = Modifier.padding(top = 7.dp)
            )
        }
    }
}

@Composable
private fun RankingScreen() {
    val ranking = listOf(
        "Aïcha" to 1640,
        "Youssef" to 1520,
        "Amine" to 1410,
        "Fatima" to 1280,
        "Hassan" to 1190
    )
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            ScreenHeader("Classement", "Une motivation facultative")
        }
        item {
            Surface(
                modifier = Modifier
                    .padding(horizontal = 20.dp)
                    .fillMaxWidth(),
                shape = RoundedCornerShape(28.dp),
                color = MqTeal,
                shadowElevation = 8.dp
            ) {
                Column(
                    Modifier.padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        Icons.Rounded.EmojiEvents,
                        null,
                        tint = MqGold,
                        modifier = Modifier.size(42.dp)
                    )
                    Text(
                        "Vous êtes 2e cette semaine",
                        color = Color.White,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 19.sp,
                        modifier = Modifier.padding(top = 9.dp)
                    )
                    Text(
                        "Encore 120 XP pour atteindre la première place",
                        color = Color.White.copy(alpha = 0.64f),
                        fontSize = 9.sp
                    )
                    LinearProgressIndicator(
                        progress = { 0.82f },
                        modifier = Modifier
                            .padding(top = 13.dp)
                            .fillMaxWidth()
                            .height(7.dp)
                            .clip(CircleShape),
                        color = MqGold,
                        trackColor = Color.White.copy(alpha = 0.13f)
                    )
                }
            }
        }
        item {
            SectionTitle("Classement hebdomadaire", "Top 100", {})
        }
        items(ranking) { entry ->
            val rank = ranking.indexOf(entry) + 1
            val isCurrentUser = entry.first == "Youssef"
            Surface(
                modifier = Modifier
                    .padding(horizontal = 20.dp)
                    .fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                color = if (isCurrentUser) {
                    MaterialTheme.colorScheme.primaryContainer
                } else {
                    MaterialTheme.colorScheme.surface
                },
                shadowElevation = if (isCurrentUser) 6.dp else 3.dp
            ) {
                Row(
                    Modifier.padding(15.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(MqGold.copy(alpha = 0.22f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(rank.toString(), fontWeight = FontWeight.ExtraBold)
                    }
                    Icon(
                        Icons.Rounded.Person,
                        null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(start = 10.dp)
                    )
                    Text(
                        if (isCurrentUser) "${entry.first} • Vous" else entry.first,
                        modifier = Modifier
                            .weight(1f)
                            .padding(horizontal = 12.dp),
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        "${entry.second} XP",
                        color = if (isCurrentUser) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        },
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 10.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun ProfileScreen(
    darkMode: Boolean,
    setDarkMode: (Boolean) -> Unit,
    rtlMode: Boolean,
    setRtlMode: (Boolean) -> Unit,
    openPermissions: () -> Unit,
    openMosques: () -> Unit
) {
    var sounds by rememberSaveable { mutableStateOf(true) }
    var vibration by rememberSaveable { mutableStateOf(true) }
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            ScreenHeader("Profil", "Paramètres et confidentialité") {
                Icon(
                    Icons.Rounded.Settings,
                    null,
                    tint = MaterialTheme.colorScheme.primary
                )
            }
        }
        item {
            Surface(
                modifier = Modifier
                    .padding(horizontal = 20.dp)
                    .fillMaxWidth(),
                shape = RoundedCornerShape(28.dp),
                color = MqTeal,
                shadowElevation = 8.dp
            ) {
                Row(
                    Modifier.padding(20.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        Modifier
                            .size(64.dp)
                            .clip(CircleShape)
                            .background(MqEmerald),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.Rounded.Person,
                            null,
                            tint = Color.White,
                            modifier = Modifier.size(34.dp)
                        )
                    }
                    Column(
                        Modifier
                            .weight(1f)
                            .padding(horizontal = 14.dp)
                    ) {
                        Text(
                            "Youssef",
                            color = Color.White,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 20.sp
                        )
                        Text(
                            "Mode invité",
                            color = Color.White.copy(alpha = 0.64f),
                            fontSize = 10.sp
                        )
                        Text(
                            "Niveau 12",
                            color = MqGold,
                            fontWeight = FontWeight.Bold,
                            fontSize = 10.sp,
                            modifier = Modifier.padding(top = 5.dp)
                        )
                    }
                    BrandLogo(50.dp)
                }
            }
        }
        item { ProfileSectionTitle("Préférences") }
        item {
            SettingsCard {
                SwitchSetting(
                    Icons.Rounded.DarkMode,
                    "Mode sombre",
                    "Réduire la luminosité",
                    darkMode,
                    setDarkMode
                )
                HorizontalDivider(color = MaterialTheme.colorScheme.outline)
                SwitchSetting(
                    Icons.Rounded.Translate,
                    "Interface arabe RTL",
                    "Inverser la mise en page",
                    rtlMode,
                    setRtlMode
                )
                HorizontalDivider(color = MaterialTheme.colorScheme.outline)
                SwitchSetting(
                    Icons.Rounded.VolumeUp,
                    "Effets sonores",
                    "Pendant les jeux",
                    sounds
                ) { sounds = it }
                HorizontalDivider(color = MaterialTheme.colorScheme.outline)
                SwitchSetting(
                    Icons.Rounded.Vibration,
                    "Vibration",
                    "Retour tactile léger",
                    vibration
                ) { vibration = it }
            }
        }
        item { ProfileSectionTitle("Prières et localisation") }
        item {
            SettingsCard {
                ActionSetting(
                    Icons.Rounded.Security,
                    "Gérer les autorisations",
                    "Notifications et localisation",
                    openPermissions
                )
                HorizontalDivider(color = MaterialTheme.colorScheme.outline)
                ActionSetting(
                    Icons.Rounded.Mosque,
                    "Mosquées proches",
                    "Recherche réelle autour de vous",
                    openMosques
                )
            }
        }
        item {
            Text(
                "Muslim QI • Version 0.5.0",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 9.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp)
            )
        }
    }
}

@Composable
private fun ProfileSectionTitle(text: String) {
    Text(
        text,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 14.sp,
        modifier = Modifier.padding(horizontal = 20.dp)
    )
}

@Composable
private fun SettingsCard(content: @Composable ColumnScope.() -> Unit) {
    Surface(
        modifier = Modifier
            .padding(horizontal = 20.dp)
            .fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        color = MaterialTheme.colorScheme.surface,
        shadowElevation = 4.dp
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 4.dp),
            content = content
        )
    }
}

@Composable
private fun SwitchSetting(
    icon: ImageVector,
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(13.dp))
                .background(MaterialTheme.colorScheme.primaryContainer),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                icon,
                null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(21.dp)
            )
        }
        Column(
            Modifier
                .weight(1f)
                .padding(horizontal = 11.dp)
        ) {
            Text(title, fontWeight = FontWeight.ExtraBold, fontSize = 12.sp)
            Text(
                subtitle,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 9.sp
            )
        }
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

@Composable
private fun ActionSetting(
    icon: ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit
) {
    Row(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(13.dp))
                .background(MaterialTheme.colorScheme.primaryContainer),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                icon,
                null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(21.dp)
            )
        }
        Column(
            Modifier
                .weight(1f)
                .padding(horizontal = 11.dp)
        ) {
            Text(title, fontWeight = FontWeight.ExtraBold, fontSize = 12.sp)
            Text(
                subtitle,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 9.sp
            )
        }
        Icon(
            Icons.Rounded.ChevronRight,
            null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

private fun buildMemoryDeck(format: BoardFormat): List<MemoryCardData> {
    val selectedPairs = pairContents.take(format.pairCount)
    return selectedPairs
        .flatMapIndexed { pairIndex, content ->
            listOf(
                MemoryCardData(pairIndex * 2, pairIndex, content),
                MemoryCardData(pairIndex * 2 + 1, pairIndex, content)
            )
        }
        .shuffled(Random(System.nanoTime()))
}

private fun formatGameTime(seconds: Int): String {
    return String.format(Locale.US, "%02d:%02d", seconds / 60, seconds % 60)
}

private fun hasPermission(context: Context, permission: String): Boolean {
    return Build.VERSION.SDK_INT < 23 ||
        context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED
}

private fun hasNotificationPermission(context: Context): Boolean {
    return Build.VERSION.SDK_INT < 33 ||
        hasPermission(context, Manifest.permission.POST_NOTIFICATIONS)
}

private fun hasForegroundLocation(context: Context): Boolean {
    return hasPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ||
        hasPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION)
}

private fun hasBackgroundLocation(context: Context): Boolean {
    return Build.VERSION.SDK_INT < 29 ||
        hasPermission(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION)
}

private fun openApplicationSettings(context: Context) {
    val intent = Intent(
        Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
        Uri.parse("package:${context.packageName}")
    ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
}

@SuppressLint("MissingPermission")
private suspend fun getBestLocation(context: Context): Location? {
    return suspendCancellableCoroutine { continuation ->
        val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val providers = listOf(
            LocationManager.GPS_PROVIDER,
            LocationManager.NETWORK_PROVIDER
        ).filter { provider ->
            runCatching { manager.isProviderEnabled(provider) }.getOrDefault(false)
        }
        val cachedLocation = providers
            .mapNotNull { provider ->
                runCatching { manager.getLastKnownLocation(provider) }.getOrNull()
            }
            .maxByOrNull { location -> location.time }

        if (
            cachedLocation != null &&
            System.currentTimeMillis() - cachedLocation.time < 15 * 60 * 1000L
        ) {
            continuation.resume(cachedLocation)
            return@suspendCancellableCoroutine
        }

        val provider = providers.firstOrNull()
        if (provider == null) {
            continuation.resume(cachedLocation)
            return@suspendCancellableCoroutine
        }

        if (Build.VERSION.SDK_INT >= 30) {
            manager.getCurrentLocation(
                provider,
                null,
                context.mainExecutor
            ) { location ->
                if (continuation.isActive) {
                    continuation.resume(location ?: cachedLocation)
                }
            }
        } else {
            val listener = object : LocationListener {
                override fun onLocationChanged(location: Location) {
                    manager.removeUpdates(this)
                    if (continuation.isActive) {
                        continuation.resume(location)
                    }
                }

                @Deprecated("Deprecated in Java")
                override fun onStatusChanged(
                    provider: String?,
                    status: Int,
                    extras: Bundle?
                ) = Unit

                override fun onProviderEnabled(provider: String) = Unit
                override fun onProviderDisabled(provider: String) = Unit
            }
            manager.requestSingleUpdate(provider, listener, Looper.getMainLooper())
            continuation.invokeOnCancellation {
                manager.removeUpdates(listener)
            }
        }
    }
}

private suspend fun loadNearbyMosques(
    latitude: Double,
    longitude: Double
): List<MosqueItem> = withContext(Dispatchers.IO) {
    val query = """
        [out:json][timeout:20];
        (
          node["amenity"="place_of_worship"]["religion"="muslim"](around:12000,$latitude,$longitude);
          way["amenity"="place_of_worship"]["religion"="muslim"](around:12000,$latitude,$longitude);
          relation["amenity"="place_of_worship"]["religion"="muslim"](around:12000,$latitude,$longitude);
        );
        out center 30;
    """.trimIndent()
    val encodedQuery = URLEncoder.encode(query, "UTF-8")
    val endpoints = listOf(
        "https://overpass-api.de/api/interpreter?data=$encodedQuery",
        "https://overpass.kumi.systems/api/interpreter?data=$encodedQuery"
    )
    var lastError: Exception? = null

    for (endpoint in endpoints) {
        try {
            val root = JSONObject(httpGet(endpoint))
            val elements = root.getJSONArray("elements")
            val results = mutableListOf<MosqueItem>()
            for (index in 0 until elements.length()) {
                val element = elements.getJSONObject(index)
                val tags = element.optJSONObject("tags") ?: JSONObject()
                val center = element.optJSONObject("center")
                val itemLatitude = if (element.has("lat")) {
                    element.optDouble("lat")
                } else {
                    center?.optDouble("lat") ?: Double.NaN
                }
                val itemLongitude = if (element.has("lon")) {
                    element.optDouble("lon")
                } else {
                    center?.optDouble("lon") ?: Double.NaN
                }
                if (itemLatitude.isNaN() || itemLongitude.isNaN()) continue

                val name = tags.optString("name")
                    .ifBlank { tags.optString("name:fr") }
                    .ifBlank { tags.optString("name:ar") }
                    .ifBlank { "Mosquée" }
                val rawWebsite = tags.optString("website")
                    .ifBlank { tags.optString("contact:website") }
                val website = rawWebsite.takeIf { it.isNotBlank() }
                val distance = FloatArray(1)
                Location.distanceBetween(
                    latitude,
                    longitude,
                    itemLatitude,
                    itemLongitude,
                    distance
                )
                results += MosqueItem(
                    name = name,
                    latitude = itemLatitude,
                    longitude = itemLongitude,
                    distanceMeters = distance[0].roundToInt(),
                    website = website
                )
            }
            return@withContext results
                .distinctBy { "${it.name}-${it.latitude}-${it.longitude}" }
                .sortedBy { it.distanceMeters }
                .take(12)
        } catch (exception: Exception) {
            lastError = exception
        }
    }
    throw lastError ?: IllegalStateException("Service cartographique indisponible")
}

private suspend fun loadCalculatedPrayerTimes(
    latitude: Double,
    longitude: Double
): PrayerTimes = withContext(Dispatchers.IO) {
    val timestamp = System.currentTimeMillis() / 1000L
    val endpoint = "https://api.aladhan.com/v1/timings/$timestamp" +
        "?latitude=$latitude&longitude=$longitude&method=3"
    val root = JSONObject(httpGet(endpoint))
    val timings = root
        .getJSONObject("data")
        .getJSONObject("timings")
    PrayerTimes(
        fajr = cleanPrayerTime(timings.getString("Fajr")),
        dhuhr = cleanPrayerTime(timings.getString("Dhuhr")),
        asr = cleanPrayerTime(timings.getString("Asr")),
        maghrib = cleanPrayerTime(timings.getString("Maghrib")),
        isha = cleanPrayerTime(timings.getString("Isha"))
    )
}

private fun cleanPrayerTime(value: String): String {
    return value.substringBefore(" ").trim()
}

private fun httpGet(endpoint: String): String {
    val connection = URL(endpoint).openConnection() as HttpURLConnection
    return try {
        connection.requestMethod = "GET"
        connection.connectTimeout = 12_000
        connection.readTimeout = 20_000
        connection.setRequestProperty("Accept", "application/json")
        connection.setRequestProperty("User-Agent", "MuslimQI/0.5 Android")
        val responseCode = connection.responseCode
        if (responseCode !in 200..299) {
            throw IllegalStateException("HTTP $responseCode")
        }
        connection.inputStream.bufferedReader().use { reader ->
            reader.readText()
        }
    } finally {
        connection.disconnect()
    }
}

private fun formatDistance(meters: Int): String {
    return if (meters < 1000) {
        "$meters m"
    } else {
        String.format(Locale.FRANCE, "%.1f km", meters / 1000.0)
    }
}

private fun openWebsite(context: Context, website: String) {
    val normalized = if (
        website.startsWith("http://") || website.startsWith("https://")
    ) {
        website
    } else {
        "https://$website"
    }
    runCatching {
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(normalized)))
    }
}
