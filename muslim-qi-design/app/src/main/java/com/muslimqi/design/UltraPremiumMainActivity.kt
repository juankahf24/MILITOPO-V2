package com.muslimqi.design

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

private val Emerald = Color(0xFF0E8F6E)
private val Forest = Color(0xFF075F57)
private val DeepTeal = Color(0xFF0C3D4A)
private val Cream = Color(0xFFF7F3E8)
private val WarmWhite = Color(0xFFFFFCF6)
private val Sand = Color(0xFFE9D8B6)
private val Gold = Color(0xFFD4AF37)
private val GoldLight = Color(0xFFF6EAC8)
private val Blue = Color(0xFF2D6F8E)
private val Purple = Color(0xFF6E5A9E)
private val Coral = Color(0xFFD96259)
private val Night = Color(0xFF081C1B)
private val NightSurface = Color(0xFF12312E)

private enum class UPage { Splash, Language, Onboarding, Account, Home, Play, Memory, Progress, Ranking, Profile }
private data class NavSpec(val page: UPage, val label: String, val icon: ImageVector)
private val navigation = listOf(
    NavSpec(UPage.Home, "Accueil", Icons.Rounded.Home),
    NavSpec(UPage.Play, "Jouer", Icons.Rounded.SportsEsports),
    NavSpec(UPage.Progress, "Progrès", Icons.Rounded.AutoGraph),
    NavSpec(UPage.Ranking, "Classement", Icons.Rounded.EmojiEvents),
    NavSpec(UPage.Profile, "Profil", Icons.Rounded.Person)
)

class UltraPremiumMainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { UltraPremiumApp() }
    }
}

@Composable
private fun UltraPremiumApp() {
    var page by rememberSaveable { mutableStateOf(UPage.Splash) }
    var dark by rememberSaveable { mutableStateOf(false) }
    var rtl by rememberSaveable { mutableStateOf(false) }
    val lightScheme = lightColorScheme(
        primary = Emerald,
        onPrimary = Color.White,
        primaryContainer = Color(0xFFDDF3EA),
        onPrimaryContainer = Forest,
        secondary = Gold,
        onSecondary = Color(0xFF3B2A00),
        background = Cream,
        onBackground = Color(0xFF173B39),
        surface = WarmWhite,
        onSurface = Color(0xFF173B39),
        surfaceVariant = Color(0xFFF1EBDD),
        onSurfaceVariant = Color(0xFF667672),
        outline = Color(0xFFD8D5CA)
    )
    val darkScheme = darkColorScheme(
        primary = Color(0xFF65D6B4),
        onPrimary = Color(0xFF00382E),
        primaryContainer = Color(0xFF174B43),
        onPrimaryContainer = Color(0xFFC9F5E7),
        secondary = Color(0xFFF1C95D),
        onSecondary = Color(0xFF3B2F00),
        background = Night,
        onBackground = Color(0xFFF4F7F2),
        surface = NightSurface,
        onSurface = Color(0xFFF4F7F2),
        surfaceVariant = Color(0xFF1C3A37),
        onSurfaceVariant = Color(0xFFB8C8C3),
        outline = Color(0xFF3A5651)
    )

    CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
        MaterialTheme(
            colorScheme = if (dark) darkScheme else lightScheme,
            typography = Typography(
                displaySmall = androidx.compose.ui.text.TextStyle(fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = 37.sp),
                headlineMedium = androidx.compose.ui.text.TextStyle(fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = 28.sp),
                titleLarge = androidx.compose.ui.text.TextStyle(fontWeight = FontWeight.ExtraBold, fontSize = 22.sp),
                titleMedium = androidx.compose.ui.text.TextStyle(fontWeight = FontWeight.Bold, fontSize = 16.sp),
                bodyLarge = androidx.compose.ui.text.TextStyle(fontSize = 15.sp),
                bodyMedium = androidx.compose.ui.text.TextStyle(fontSize = 13.sp)
            )
        ) {
            PremiumBackdrop {
                AnimatedContent(
                    targetState = page,
                    modifier = Modifier.fillMaxSize(),
                    transitionSpec = { fadeIn(tween(220)) togetherWith fadeOut(tween(150)) },
                    label = "page"
                ) { target ->
                    when (target) {
                        UPage.Splash -> SplashPage { page = UPage.Language }
                        UPage.Language -> LanguagePage({ page = UPage.Onboarding }) { rtl = it }
                        UPage.Onboarding -> OnboardingPage { page = UPage.Account }
                        UPage.Account -> AccountPage { page = UPage.Home }
                        UPage.Home -> AppShell(UPage.Home, { page = it }) { HomePage { page = it } }
                        UPage.Play -> AppShell(UPage.Play, { page = it }) { PlayPage { page = it } }
                        UPage.Memory -> AppShell(UPage.Play, { page = it }) { MemoryPage() }
                        UPage.Progress -> AppShell(UPage.Progress, { page = it }) { ProgressPage() }
                        UPage.Ranking -> AppShell(UPage.Ranking, { page = it }) { RankingPage() }
                        UPage.Profile -> AppShell(UPage.Profile, { page = it }) { ProfilePage(dark, { dark = it }, rtl, { rtl = it }) }
                    }
                }
            }
        }
    }

    BackHandler(enabled = page !in listOf(UPage.Splash, UPage.Language, UPage.Home)) {
        page = when (page) {
            UPage.Onboarding -> UPage.Language
            UPage.Account -> UPage.Onboarding
            UPage.Memory -> UPage.Play
            else -> UPage.Home
        }
    }
}

@Composable
private fun PremiumBackdrop(content: @Composable BoxScope.() -> Unit) {
    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        val dark = MaterialTheme.colorScheme.background == Night
        Canvas(Modifier.matchParentSize()) {
            val primary = if (dark) Emerald.copy(alpha = .06f) else Emerald.copy(alpha = .035f)
            val gold = if (dark) Gold.copy(alpha = .055f) else Gold.copy(alpha = .05f)
            drawCircle(primary, size.width * .52f, Offset(size.width * 1.08f, size.height * .04f))
            drawCircle(gold, size.width * .45f, Offset(-size.width * .08f, size.height * .88f))
            val step = 72.dp.toPx()
            for (x in -1..(size.width / step).toInt() + 1) {
                for (y in -1..(size.height / step).toInt() + 1) {
                    val c = Offset(x * step, y * step)
                    drawCircle(primary, 18.dp.toPx(), c, style = Stroke(1.dp.toPx()))
                    drawLine(primary, c + Offset(-10.dp.toPx(), 0f), c + Offset(10.dp.toPx(), 0f), 1.dp.toPx())
                    drawLine(primary, c + Offset(0f, -10.dp.toPx()), c + Offset(0f, 10.dp.toPx()), 1.dp.toPx())
                }
            }
        }
        content()
    }
}

@Composable
private fun BrandLogo(size: androidx.compose.ui.unit.Dp) {
    Canvas(Modifier.size(size)) {
        val c = Offset(this.size.width / 2, this.size.height / 2)
        val r = this.size.minDimension * .39f
        rotate(45f, c) {
            drawRoundRect(Gold, c - Offset(r, r), Size(r * 2, r * 2), CornerRadius(14f, 14f), style = Stroke(4.5f))
        }
        drawCircle(Forest, r * .84f, c)
        drawCircle(Gold, r * .70f, c, style = Stroke(3.7f))
        drawCircle(Gold.copy(alpha = .30f), r * .39f, c, style = Stroke(3f, pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 7f))))
        drawLine(Gold, c + Offset(0f, -r * .47f), c + Offset(0f, r * .43f), 4.5f, StrokeCap.Round)
        drawCircle(Gold, r * .105f, c + Offset(0f, -r * .47f))
    }
}

@Composable
private fun SplashPage(done: () -> Unit) {
    LaunchedEffect(Unit) { delay(1200); done() }
    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Forest, DeepTeal, Color(0xFF092C2B)))), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            BrandLogo(120.dp)
            Text("Muslim QI", color = Color.White, fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = 42.sp, modifier = Modifier.padding(top = 24.dp))
            Text("Apprends l’islam chaque jour en t’amusant.", color = Color.White.copy(alpha = .74f), fontSize = 13.sp)
            LinearProgressIndicator(progress = { .72f }, modifier = Modifier.padding(top = 54.dp).width(88.dp).height(4.dp).clip(CircleShape), color = Gold, trackColor = Color.White.copy(alpha = .12f))
        }
    }
}

@Composable
private fun OnboardingLayout(bottom: @Composable (() -> Unit)? = null, content: androidx.compose.foundation.lazy.LazyListScope.() -> Unit) {
    Scaffold(modifier = Modifier.fillMaxSize(), containerColor = Color.Transparent, bottomBar = {
        if (bottom != null) Surface(color = MaterialTheme.colorScheme.background.copy(alpha = .97f)) {
            Box(Modifier.navigationBarsPadding().padding(horizontal = 22.dp, vertical = 14.dp)) { bottom() }
        }
    }) { pad ->
        LazyColumn(Modifier.fillMaxSize().padding(pad).padding(horizontal = 22.dp), contentPadding = PaddingValues(top = 22.dp, bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(18.dp), content = content)
    }
}

@Composable
private fun BrandHeader(step: Int, title: String, subtitle: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("MUSLIM QI", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.ExtraBold, fontSize = 12.sp, letterSpacing = 1.2.sp)
            Text("$step / 3", color = MaterialTheme.colorScheme.onSurfaceVariant, fontWeight = FontWeight.Bold, fontSize = 12.sp)
        }
        LinearProgressIndicator(progress = { step / 3f }, modifier = Modifier.padding(top = 16.dp).fillMaxWidth().height(5.dp).clip(CircleShape), color = MaterialTheme.colorScheme.primary, trackColor = MaterialTheme.colorScheme.primaryContainer)
        BrandLogo(72.dp)
        Text(title, style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 16.dp))
        Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center, lineHeight = 21.sp, modifier = Modifier.padding(top = 8.dp))
    }
}

@Composable
private fun LanguagePage(next: () -> Unit, setRtl: (Boolean) -> Unit) {
    var selected by rememberSaveable { mutableIntStateOf(0) }
    OnboardingLayout(bottom = { MainButton("Continuer", Icons.Rounded.ArrowForward, next) }) {
        item { BrandHeader(1, "Choisissez votre langue", "Une expérience fluide en français, en arabe ou en anglais.") }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                LanguageChoice("Français", "Interface complète en français", "FR", selected == 0) { selected = 0; setRtl(false) }
                LanguageChoice("العربية", "واجهة عربية كاملة من اليمين إلى اليسار", "AR", selected == 1) { selected = 1; setRtl(true) }
                LanguageChoice("English", "Complete English interface", "EN", selected == 2) { selected = 2; setRtl(false) }
            }
        }
        item { InfoStrip(Icons.Rounded.Translate, "Arabe RTL intégral", "Navigation, textes et mises en page s’adaptent automatiquement.") }
    }
}

@Composable
private fun LanguageChoice(title: String, subtitle: String, code: String, selected: Boolean, click: () -> Unit) {
    Surface(modifier = Modifier.fillMaxWidth().clickable(onClick = click).border(1.5.dp, if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline, RoundedCornerShape(24.dp)), shape = RoundedCornerShape(24.dp), color = if (selected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface, shadowElevation = if (selected) 10.dp else 3.dp) {
        Row(Modifier.padding(17.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(54.dp).clip(RoundedCornerShape(18.dp)).background(if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant), contentAlignment = Alignment.Center) {
                Text(code, color = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.ExtraBold)
            }
            Column(Modifier.weight(1f).padding(horizontal = 15.dp)) {
                Text(title, fontWeight = FontWeight.ExtraBold, fontSize = 17.sp)
                Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp, modifier = Modifier.padding(top = 3.dp))
            }
            Icon(if (selected) Icons.Rounded.CheckCircle else Icons.Rounded.RadioButtonUnchecked, null, tint = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun OnboardingPage(done: () -> Unit) {
    var slide by rememberSaveable { mutableIntStateOf(0) }
    val titles = listOf("Apprenez avec confiance", "Jouez selon votre rythme", "Progressez chaque jour")
    val subtitles = listOf("Des explications courtes, structurées et accompagnées de références éditoriales.", "Mémoire, quiz, vrai ou faux et devinettes réunis dans une expérience familiale.", "Objectifs, badges et thèmes à revoir, sans pression ni jugement.")
    val icons = listOf(Icons.Rounded.MenuBook, Icons.Rounded.SportsEsports, Icons.Rounded.AutoGraph)
    val accents = listOf(Emerald, Gold, Blue)
    OnboardingLayout(bottom = {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            PageDots(slide, 3)
            MainButton(if (slide == 2) "Commencer" else "Continuer", if (slide == 2) Icons.Rounded.RocketLaunch else Icons.Rounded.ArrowForward) { if (slide == 2) done() else slide++ }
        }
    }) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("MUSLIM QI", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.ExtraBold, fontSize = 12.sp, letterSpacing = 1.2.sp)
                TextButton(onClick = done) { Text("Passer", color = MaterialTheme.colorScheme.onSurfaceVariant) }
            }
        }
        item {
            Surface(Modifier.fillMaxWidth().height(250.dp).shadow(18.dp, RoundedCornerShape(34.dp)), shape = RoundedCornerShape(34.dp), color = DeepTeal) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Canvas(Modifier.matchParentSize()) { drawCircle(accents[slide].copy(alpha = .22f), size.minDimension * .68f, Offset(size.width, 0f)); drawCircle(Color.White.copy(alpha = .035f), size.minDimension * .42f, Offset(0f, size.height)) }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(Modifier.size(112.dp).clip(RoundedCornerShape(32.dp)).background(Color.White.copy(alpha = .11f)).border(1.dp, Color.White.copy(alpha = .15f), RoundedCornerShape(32.dp)), contentAlignment = Alignment.Center) { Icon(icons[slide], null, tint = if (slide == 1) Gold else Color.White, modifier = Modifier.size(58.dp)) }
                        Text(listOf("APPRENDRE", "S’AMUSER", "PROGRESSER")[slide], color = Gold, fontWeight = FontWeight.ExtraBold, fontSize = 11.sp, letterSpacing = 1.4.sp, modifier = Modifier.padding(top = 18.dp))
                    }
                }
            }
        }
        item {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                Text(titles[slide], style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center)
                Text(subtitles[slide], color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center, lineHeight = 21.sp, modifier = Modifier.padding(top = 10.dp))
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("Clair", "Progressif", "Bienveillant").forEach { label ->
                    Surface(Modifier.weight(1f), shape = RoundedCornerShape(18.dp), color = accents[slide].copy(alpha = .10f)) {
                        Column(Modifier.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) { Icon(Icons.Rounded.CheckCircle, null, tint = accents[slide], modifier = Modifier.size(19.dp)); Text(label, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 5.dp)) }
                    }
                }
            }
        }
    }
}

@Composable
private fun AccountPage(done: () -> Unit) {
    var dialog by remember { mutableStateOf<String?>(null) }
    OnboardingLayout {
        item { BrandHeader(3, "Comment continuer ?", "Jouez immédiatement ou synchronisez votre progression.") }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                AccountChoice(Icons.Rounded.PersonOutline, "Continuer en invité", "Explorer sans créer de compte", true, done)
                AccountChoice(Icons.Rounded.Public, "Continuer avec Google", "Synchronisation multi-appareils") { dialog = "La connexion Google sera activée avec Firebase Auth." }
                AccountChoice(Icons.Rounded.PhoneIphone, "Continuer avec Apple", "Connexion rapide et sécurisée") { dialog = "La connexion Apple sera activée dans la phase comptes." }
                AccountChoice(Icons.Rounded.Email, "Continuer avec un e-mail", "Adresse, mot de passe et récupération") { dialog = "Le formulaire complet sera branché au serveur lors de la phase fonctionnelle." }
            }
        }
        item { InfoStrip(Icons.Rounded.VerifiedUser, "Données sous votre contrôle", "Export et suppression seront accessibles depuis le profil.") }
    }
    dialog?.let { AlertDialog(onDismissRequest = { dialog = null }, confirmButton = { TextButton(onClick = { dialog = null }) { Text("Compris") } }, title = { Text("Fonction en préparation") }, text = { Text(it) }, shape = RoundedCornerShape(28.dp)) }
}

@Composable
private fun AccountChoice(icon: ImageVector, title: String, subtitle: String, featured: Boolean = false, click: () -> Unit) {
    Surface(Modifier.fillMaxWidth().clickable(onClick = click), shape = RoundedCornerShape(24.dp), color = if (featured) DeepTeal else MaterialTheme.colorScheme.surface, shadowElevation = if (featured) 12.dp else 4.dp) {
        Row(Modifier.padding(17.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(52.dp).clip(RoundedCornerShape(17.dp)).background(if (featured) Color.White.copy(alpha = .13f) else MaterialTheme.colorScheme.primaryContainer), contentAlignment = Alignment.Center) { Icon(icon, null, tint = if (featured) Gold else MaterialTheme.colorScheme.primary, modifier = Modifier.size(27.dp)) }
            Column(Modifier.weight(1f).padding(horizontal = 14.dp)) { Text(title, color = if (featured) Color.White else MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp); Text(subtitle, color = if (featured) Color.White.copy(alpha = .66f) else MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp, modifier = Modifier.padding(top = 3.dp)) }
            Icon(Icons.Rounded.ChevronRight, null, tint = if (featured) Gold else MaterialTheme.colorScheme.primary)
        }
    }
}

@Composable
private fun MainButton(text: String, icon: ImageVector, click: () -> Unit) {
    Button(onClick = click, modifier = Modifier.fillMaxWidth().height(58.dp).shadow(12.dp, RoundedCornerShape(19.dp)), shape = RoundedCornerShape(19.dp), colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)) { Text(text, fontWeight = FontWeight.ExtraBold); Icon(icon, null, modifier = Modifier.padding(start = 9.dp).size(20.dp)) }
}

@Composable
private fun PageDots(selected: Int, count: Int) { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) { repeat(count) { index -> Box(Modifier.padding(horizontal = 4.dp).width(if (index == selected) 28.dp else 8.dp).height(8.dp).clip(CircleShape).background(if (index == selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline)) } } }

@Composable
private fun InfoStrip(icon: ImageVector, title: String, body: String) {
    Surface(shape = RoundedCornerShape(20.dp), color = MaterialTheme.colorScheme.secondary.copy(alpha = .13f), modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(43.dp).clip(RoundedCornerShape(14.dp)).background(MaterialTheme.colorScheme.secondary.copy(alpha = .18f)), contentAlignment = Alignment.Center) { Icon(icon, null, tint = MaterialTheme.colorScheme.secondary, modifier = Modifier.size(22.dp)) }
            Column(Modifier.padding(start = 12.dp)) { Text(title, fontWeight = FontWeight.ExtraBold, fontSize = 13.sp); Text(body, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp, modifier = Modifier.padding(top = 2.dp)) }
        }
    }
}

@Composable
private fun AppShell(selected: UPage, navigate: (UPage) -> Unit, content: @Composable () -> Unit) {
    Scaffold(modifier = Modifier.fillMaxSize(), containerColor = Color.Transparent, bottomBar = { BottomNavigation(selected, navigate) }) { pad -> Box(Modifier.fillMaxSize().padding(pad)) { content() } }
}

@Composable
private fun BottomNavigation(selected: UPage, navigate: (UPage) -> Unit) {
    Surface(Modifier.fillMaxWidth(), color = MaterialTheme.colorScheme.surface.copy(alpha = .98f), shadowElevation = 18.dp) {
        Row(Modifier.fillMaxWidth().navigationBarsPadding().height(76.dp).padding(horizontal = 8.dp, vertical = 8.dp)) {
            navigation.forEach { item ->
                val active = item.page == selected
                Column(Modifier.weight(1f).fillMaxHeight().clip(RoundedCornerShape(19.dp)).clickable { navigate(item.page) }.padding(vertical = 5.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                    Box(Modifier.width(if (active) 50.dp else 38.dp).height(30.dp).clip(RoundedCornerShape(16.dp)).background(if (active) MaterialTheme.colorScheme.primaryContainer else Color.Transparent), contentAlignment = Alignment.Center) { Icon(item.icon, null, tint = if (active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(22.dp)) }
                    Text(item.label, color = if (active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 9.sp, fontWeight = if (active) FontWeight.ExtraBold else FontWeight.Medium, maxLines = 1)
                }
            }
        }
    }
}

@Composable
private fun PageTop(title: String, subtitle: String, trailing: @Composable (() -> Unit)? = null) {
    Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 20.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) { Text(title, style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onBackground); Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp, modifier = Modifier.padding(top = 3.dp)) }
        trailing?.invoke()
    }
}

@Composable
private fun HomePage(navigate: (UPage) -> Unit) {
    var notification by remember { mutableStateOf(false) }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 30.dp), verticalArrangement = Arrangement.spacedBy(15.dp)) {
        item {
            Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 20.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(48.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primaryContainer), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.Person, null, tint = MaterialTheme.colorScheme.primary) }
                Column(Modifier.weight(1f).padding(horizontal = 12.dp)) { Text("As-salāmu ʿalaykum,", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp); Text("Youssef ! 👋", fontWeight = FontWeight.ExtraBold, fontSize = 20.sp, color = MaterialTheme.colorScheme.onBackground) }
                CoinPill(); IconButton(onClick = { notification = true }) { Icon(Icons.Rounded.NotificationsNone, null, tint = MaterialTheme.colorScheme.onBackground) }
            }
        }
        item { PrayerCard() }
        item { LearningHero { navigate(UPage.Play) } }
        item { Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(9.dp)) { MetricCard(Icons.Rounded.LocalFireDepartment, "7 jours", "Série", Coral, Modifier.weight(1f)); MetricCard(Icons.Rounded.Bolt, "820 XP", "Semaine", Gold, Modifier.weight(1f)); MetricCard(Icons.Rounded.School, "68%", "Maîtrise", Emerald, Modifier.weight(1f)) } }
        item { SectionTitle("Jouer et apprendre", "Voir tout") { navigate(UPage.Play) } }
        item { Row(Modifier.padding(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(11.dp)) { GameTile("Mémoire\nislamique", "Trouver les paires", Icons.Rounded.GridView, listOf(Emerald, Forest), Modifier.weight(1f)) { navigate(UPage.Memory) }; GameTile("Quiz", "Tester ses acquis", Icons.Rounded.Quiz, listOf(Blue, DeepTeal), Modifier.weight(1f)) { navigate(UPage.Play) } } }
        item { Row(Modifier.padding(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(11.dp)) { GameTile("Vrai ou faux", "Répondre vite", Icons.Rounded.Rule, listOf(Color(0xFFE1B43F), Color(0xFFBF8924)), Modifier.weight(1f)) { navigate(UPage.Play) }; GameTile("Devinettes", "Révéler des indices", Icons.Rounded.Lightbulb, listOf(Purple, Color(0xFF534176)), Modifier.weight(1f)) { navigate(UPage.Play) } } }
        item { SectionTitle("Défi du jour", "+80 XP") {} }
        item { DailyChallenge() }
    }
    if (notification) AlertDialog(onDismissRequest = { notification = false }, confirmButton = { TextButton(onClick = { notification = false }) { Text("Fermer") } }, title = { Text("Notifications") }, text = { Text("Aucune nouvelle notification. Les rappels seront configurables depuis le profil.") }, shape = RoundedCornerShape(28.dp))
}

@Composable
private fun CoinPill() {
    Surface(shape = RoundedCornerShape(18.dp), color = GoldLight) { Row(Modifier.padding(horizontal = 11.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Rounded.MonetizationOn, null, tint = Color(0xFFA47B17), modifier = Modifier.size(18.dp)); Text("1 240", color = Color(0xFF76560C), fontWeight = FontWeight.ExtraBold, fontSize = 11.sp, modifier = Modifier.padding(start = 4.dp)) } }
}

@Composable
private fun PrayerCard() {
    Surface(Modifier.padding(horizontal = 20.dp).fillMaxWidth(), shape = RoundedCornerShape(24.dp), color = MaterialTheme.colorScheme.surface, shadowElevation = 7.dp) {
        Row(Modifier.padding(17.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(62.dp).clip(RoundedCornerShape(19.dp)).background(Brush.linearGradient(listOf(MaterialTheme.colorScheme.primaryContainer, GoldLight))), contentAlignment = Alignment.Center) { MosqueMiniature() }
            Column(Modifier.weight(1f).padding(horizontal = 14.dp)) { Text("Prochaine prière", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp); Text("Dhuhr", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.ExtraBold, fontSize = 20.sp); Text("Ligue islamique mondiale", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 9.sp) }
            Column(horizontalAlignment = Alignment.End) { Text("12:45", fontWeight = FontWeight.ExtraBold, fontSize = 20.sp); Text("dans 1 h 02", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp) }
        }
    }
}

@Composable
private fun MosqueMiniature() {
    Canvas(Modifier.size(48.dp)) {
        val base = size.height * .72f
        drawRoundRect(Emerald, Offset(size.width * .12f, base), Size(size.width * .76f, size.height * .16f), CornerRadius(5f, 5f)); drawCircle(Emerald, size.width * .22f, Offset(size.width * .48f, base)); drawRect(Emerald, Offset(size.width * .17f, size.height * .28f), Size(size.width * .10f, size.height * .45f)); drawCircle(Gold, size.width * .035f, Offset(size.width * .22f, size.height * .22f)); drawLine(Gold, Offset(size.width * .22f, size.height * .24f), Offset(size.width * .22f, size.height * .33f), 2f)
    }
}

@Composable
private fun LearningHero(click: () -> Unit) {
    Surface(Modifier.padding(horizontal = 20.dp).fillMaxWidth().height(238.dp).shadow(18.dp, RoundedCornerShape(31.dp)), shape = RoundedCornerShape(31.dp), color = DeepTeal) {
        Box(Modifier.fillMaxSize()) {
            Canvas(Modifier.matchParentSize()) { drawCircle(Gold.copy(alpha = .14f), size.minDimension * .64f, Offset(size.width, 0f)); drawCircle(Emerald.copy(alpha = .13f), size.minDimension * .48f, Offset(0f, size.height)) }
            Column(Modifier.fillMaxSize().padding(22.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) { Surface(shape = RoundedCornerShape(12.dp), color = Color.White.copy(alpha = .10f)) { Text("PARCOURS DU JOUR", color = Gold, fontWeight = FontWeight.ExtraBold, fontSize = 9.sp, letterSpacing = 1.1.sp, modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp)) }; Spacer(Modifier.weight(1f)); Icon(Icons.Rounded.AutoAwesome, null, tint = Gold) }
                Text("Les prophètes\net leurs enseignements", color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 25.sp, lineHeight = 28.sp, modifier = Modifier.padding(top = 18.dp)); Text("6 minutes • 3 activités", color = Color.White.copy(alpha = .68f), fontSize = 10.sp, modifier = Modifier.padding(top = 6.dp)); Spacer(Modifier.weight(1f))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) { LinearProgressIndicator(progress = { .42f }, modifier = Modifier.fillMaxWidth().height(6.dp).clip(CircleShape), color = Gold, trackColor = Color.White.copy(alpha = .14f)); Text("42% terminé", color = Color.White.copy(alpha = .64f), fontSize = 9.sp, modifier = Modifier.padding(top = 5.dp)) }
                    Spacer(Modifier.width(14.dp)); Button(click, colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = Forest), shape = RoundedCornerShape(17.dp)) { Text("Continuer", fontWeight = FontWeight.ExtraBold); Icon(Icons.Rounded.ArrowForward, null, modifier = Modifier.padding(start = 5.dp).size(18.dp)) }
                }
            }
        }
    }
}

@Composable
private fun RowScope.MetricCard(icon: ImageVector, value: String, label: String, accent: Color, modifier: Modifier) {
    Surface(modifier, shape = RoundedCornerShape(21.dp), color = MaterialTheme.colorScheme.surface, shadowElevation = 4.dp) { Column(Modifier.padding(vertical = 14.dp), horizontalAlignment = Alignment.CenterHorizontally) { Icon(icon, null, tint = accent, modifier = Modifier.size(22.dp)); Text(value, fontWeight = FontWeight.ExtraBold, fontSize = 14.sp, modifier = Modifier.padding(top = 6.dp)); Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 8.sp) } }
}

@Composable
private fun SectionTitle(title: String, action: String, click: () -> Unit) { Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp), verticalAlignment = Alignment.CenterVertically) { Text(title, fontWeight = FontWeight.ExtraBold, fontSize = 18.sp, modifier = Modifier.weight(1f), color = MaterialTheme.colorScheme.onBackground); TextButton(onClick = click) { Text(action, color = MaterialTheme.colorScheme.primary, fontSize = 10.sp) } } }

@Composable
private fun RowScope.GameTile(title: String, subtitle: String, icon: ImageVector, colors: List<Color>, modifier: Modifier, click: () -> Unit) {
    Surface(modifier.height(150.dp).shadow(8.dp, RoundedCornerShape(25.dp)).clickable(onClick = click), shape = RoundedCornerShape(25.dp), color = Color.Transparent) {
        Box(Modifier.fillMaxSize().background(Brush.linearGradient(colors)).padding(16.dp)) {
            Canvas(Modifier.matchParentSize()) { drawCircle(Color.White.copy(alpha = .08f), size.minDimension * .58f, Offset(size.width, 0f)) }
            Box(Modifier.size(43.dp).clip(RoundedCornerShape(14.dp)).background(Color.White.copy(alpha = .16f)), contentAlignment = Alignment.Center) { Icon(icon, null, tint = Color.White, modifier = Modifier.size(25.dp)) }
            Column(Modifier.align(Alignment.BottomStart)) { Text(title, color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 17.sp, lineHeight = 19.sp); Text(subtitle, color = Color.White.copy(alpha = .72f), fontSize = 9.sp, modifier = Modifier.padding(top = 4.dp)) }
        }
    }
}

@Composable
private fun DailyChallenge() {
    Surface(Modifier.padding(horizontal = 20.dp).fillMaxWidth(), shape = RoundedCornerShape(24.dp), color = MaterialTheme.colorScheme.surface, shadowElevation = 5.dp) {
        Row(Modifier.padding(17.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(56.dp).clip(RoundedCornerShape(19.dp)).background(GoldLight), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.CardGiftcard, null, tint = Color(0xFFA47B17), modifier = Modifier.size(29.dp)) }
            Column(Modifier.weight(1f).padding(horizontal = 14.dp)) { Text("Répondre à 10 questions", fontWeight = FontWeight.ExtraBold); Text("Valeurs et comportements", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 9.sp); LinearProgressIndicator(progress = { .6f }, modifier = Modifier.padding(top = 8.dp).fillMaxWidth().height(6.dp).clip(CircleShape), color = MaterialTheme.colorScheme.primary, trackColor = MaterialTheme.colorScheme.primaryContainer) }
            Text("6/10", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.ExtraBold)
        }
    }
}

@Composable
private fun PlayPage(navigate: (UPage) -> Unit) {
    val modes = listOf(listOf("Mémoire islamique", "Retournez les cartes et découvrez une leçon à chaque paire.", Icons.Rounded.GridView, Emerald), listOf("Quiz", "Choisissez une réponse puis lisez une explication claire.", Icons.Rounded.Quiz, Blue), listOf("Vrai ou faux", "Testez rapidement votre compréhension.", Icons.Rounded.Rule, Gold), listOf("Devinettes", "Révélez les indices au bon moment.", Icons.Rounded.Lightbulb, Purple))
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 30.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { PageTop("Jouer", "Choisissez une expérience") { CoinPill() } }
        item { Box(Modifier.padding(horizontal = 20.dp)) { InfoStrip(Icons.Rounded.TipsAndUpdates, "Conseil du jour", "Une partie courte suffit pour maintenir votre série.") } }
        items(modes) { mode ->
            val title = mode[0] as String; val body = mode[1] as String; val icon = mode[2] as ImageVector; val accent = mode[3] as Color
            Surface(Modifier.padding(horizontal = 20.dp).fillMaxWidth().clickable { navigate(UPage.Memory) }, shape = RoundedCornerShape(25.dp), color = MaterialTheme.colorScheme.surface, shadowElevation = 5.dp) {
                Row(Modifier.padding(17.dp), verticalAlignment = Alignment.CenterVertically) { Box(Modifier.size(64.dp).clip(RoundedCornerShape(21.dp)).background(accent.copy(alpha = .12f)), contentAlignment = Alignment.Center) { Icon(icon, null, tint = accent, modifier = Modifier.size(32.dp)) }; Column(Modifier.weight(1f).padding(horizontal = 15.dp)) { Text(title, fontWeight = FontWeight.ExtraBold, fontSize = 17.sp); Text(body, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp, lineHeight = 14.sp, modifier = Modifier.padding(top = 4.dp)); Text("Jouer maintenant  →", color = accent, fontWeight = FontWeight.Bold, fontSize = 10.sp, modifier = Modifier.padding(top = 8.dp)) } }
            }
        }
    }
}

@Composable
private fun MemoryPage() {
    val values = listOf("محمد ﷺ", "مكة", "الصبر", "رمضان", "محمد ﷺ", "مكة", "الصبر", "رمضان", "الكعبة", "العلم", "الكعبة", "العلم")
    val open = remember { mutableStateListOf<Int>() }; val matched = remember { mutableStateListOf<Int>() }; var score by rememberSaveable { mutableIntStateOf(0) }; var fact by remember { mutableStateOf(false) }
    LaunchedEffect(open.toList()) { if (open.size == 2) { delay(650); if (values[open[0]] == values[open[1]]) { matched.addAll(open); score += 100; fact = true }; open.clear() } }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
        item { PageTop("Mémoire islamique", "Prophètes • Niveau facile") { Surface(shape = RoundedCornerShape(14.dp), color = MaterialTheme.colorScheme.primaryContainer) { Text("$score pts", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.ExtraBold, fontSize = 11.sp, modifier = Modifier.padding(horizontal = 11.dp, vertical = 7.dp)) } } }
        item { Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp), horizontalArrangement = Arrangement.SpaceBetween) { StatSmall("01:28", "Temps"); StatSmall("8", "Tentatives"); StatSmall("1", "Erreur"); StatSmall("${matched.size / 2}/6", "Paires") } }
        item {
            Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                values.chunked(3).forEachIndexed { row, line -> Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    line.forEachIndexed { col, value ->
                        val index = row * 3 + col; val visible = index in open || index in matched
                        Surface(Modifier.weight(1f).aspectRatio(.72f).clickable { if (!visible && open.size < 2) open.add(index) }, shape = RoundedCornerShape(18.dp), color = if (visible) MaterialTheme.colorScheme.surface else Forest, shadowElevation = 7.dp) {
                            Box(Modifier.fillMaxSize().border(1.4.dp, if (visible) Gold.copy(alpha = .45f) else Gold.copy(alpha = .72f), RoundedCornerShape(18.dp)), contentAlignment = Alignment.Center) { if (visible) Column(horizontalAlignment = Alignment.CenterHorizontally) { Text(value, fontWeight = FontWeight.ExtraBold, fontSize = 14.sp, textAlign = TextAlign.Center); Icon(Icons.Rounded.AutoAwesome, null, tint = Gold, modifier = Modifier.padding(top = 6.dp).size(16.dp)) } else CardBackPattern() }
                        }
                    }
                } }
            }
        }
        item { Box(Modifier.padding(horizontal = 20.dp)) { InfoStrip(Icons.Rounded.MenuBook, "Apprendre après chaque paire", "Une information courte et vérifiée s’affiche lorsque la paire est trouvée.") } }
    }
    if (fact) AlertDialog(onDismissRequest = { fact = false }, confirmButton = { Button(onClick = { fact = false }, colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)) { Text("Continuer") } }, icon = { Icon(Icons.Rounded.CheckCircle, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(42.dp)) }, title = { Text("Paire trouvée !", fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold) }, text = { Column(horizontalAlignment = Alignment.CenterHorizontally) { Text("Muhammad ﷺ", fontWeight = FontWeight.ExtraBold, fontSize = 20.sp); Text("Le prophète Muhammad ﷺ est le dernier prophète de l’islam. Il a reçu la première révélation à l’âge de quarante ans.", textAlign = TextAlign.Center, fontSize = 13.sp, modifier = Modifier.padding(top = 10.dp)); Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = RoundedCornerShape(14.dp), modifier = Modifier.padding(top = 13.dp)) { Text("Référence : Coran 33:40", color = MaterialTheme.colorScheme.onPrimaryContainer, fontSize = 11.sp, modifier = Modifier.padding(11.dp)) } } }, shape = RoundedCornerShape(28.dp))
}

@Composable
private fun CardBackPattern() { Canvas(Modifier.size(54.dp)) { val c = center; drawCircle(Gold.copy(alpha = .24f), size.minDimension * .42f, c, style = Stroke(3f)); drawLine(Gold.copy(alpha = .75f), Offset(c.x, c.y - 20f), Offset(c.x, c.y + 20f), 4f, StrokeCap.Round); drawLine(Gold.copy(alpha = .75f), Offset(c.x - 20f, c.y), Offset(c.x + 20f, c.y), 4f, StrokeCap.Round); drawCircle(Gold, 4f, c) } }

@Composable
private fun StatSmall(value: String, label: String) { Column(horizontalAlignment = Alignment.CenterHorizontally) { Text(value, fontWeight = FontWeight.ExtraBold, fontSize = 14.sp); Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 9.sp) } }

@Composable
private fun ProgressPage() {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 30.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { PageTop("Progression", "Votre chemin de connaissance") }
        item { Surface(Modifier.padding(horizontal = 20.dp).fillMaxWidth(), shape = RoundedCornerShape(29.dp), color = Color.Transparent, shadowElevation = 10.dp) { Box(Modifier.fillMaxWidth().background(Brush.linearGradient(listOf(Forest, DeepTeal))).padding(22.dp)) { Row(verticalAlignment = Alignment.CenterVertically) { Column(Modifier.weight(1f)) { Text("NIVEAU 12", color = Gold, fontWeight = FontWeight.ExtraBold, fontSize = 10.sp, letterSpacing = .9.sp); Text("Chercheur de science", color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 21.sp, modifier = Modifier.padding(top = 5.dp)); Text("380 XP avant le niveau suivant", color = Color.White.copy(alpha = .64f), fontSize = 9.sp); LinearProgressIndicator(progress = { .68f }, modifier = Modifier.padding(top = 13.dp).fillMaxWidth().height(7.dp).clip(CircleShape), color = Gold, trackColor = Color.White.copy(alpha = .14f)) }; Box(Modifier.padding(start = 16.dp).size(76.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(progress = { .68f }, modifier = Modifier.fillMaxSize(), color = Gold, trackColor = Color.White.copy(alpha = .14f), strokeWidth = 7.dp); Text("68%", color = Color.White, fontWeight = FontWeight.ExtraBold) } } } } }
        item { SectionTitle("Maîtrise par thème", "") {} }
        item { Row(Modifier.padding(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(9.dp)) { MasteryCard("Coran", .80f, Emerald, Modifier.weight(1f)); MasteryCard("Histoire", .72f, Blue, Modifier.weight(1f)); MasteryCard("Valeurs", .65f, Gold, Modifier.weight(1f)) } }
        item { SectionTitle("À revoir", "3 thèmes") {} }
        items(listOf("Les piliers de la foi" to .42f, "Les ablutions" to .58f, "Les mois hégiriens" to .64f)) { item -> ReviewCard(item.first, item.second) }
    }
}

@Composable
private fun RowScope.MasteryCard(label: String, progress: Float, accent: Color, modifier: Modifier) { Surface(modifier, shape = RoundedCornerShape(23.dp), color = MaterialTheme.colorScheme.surface, shadowElevation = 4.dp) { Column(Modifier.padding(vertical = 17.dp), horizontalAlignment = Alignment.CenterHorizontally) { Box(Modifier.size(61.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(progress = { progress }, modifier = Modifier.fillMaxSize(), color = accent, trackColor = accent.copy(alpha = .14f), strokeWidth = 6.dp); Text("${(progress * 100).toInt()}%", fontWeight = FontWeight.ExtraBold, fontSize = 10.sp) }; Text(label, fontWeight = FontWeight.Bold, fontSize = 10.sp, modifier = Modifier.padding(top = 8.dp)) } } }

@Composable
private fun ReviewCard(title: String, progress: Float) {
    Surface(Modifier.padding(horizontal = 20.dp).fillMaxWidth(), shape = RoundedCornerShape(20.dp), color = MaterialTheme.colorScheme.surface, shadowElevation = 3.dp) {
        Row(Modifier.padding(15.dp), verticalAlignment = Alignment.CenterVertically) { Box(Modifier.size(42.dp).clip(RoundedCornerShape(14.dp)).background(MaterialTheme.colorScheme.primaryContainer), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.MenuBook, null, tint = MaterialTheme.colorScheme.primary) }; Column(Modifier.weight(1f).padding(horizontal = 12.dp)) { Text(title, fontWeight = FontWeight.Bold, fontSize = 12.sp); LinearProgressIndicator(progress = { progress }, modifier = Modifier.padding(top = 7.dp).fillMaxWidth().height(6.dp).clip(CircleShape), color = Gold, trackColor = GoldLight) }; Text("${(progress * 100).toInt()}%", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp) }
    }
}

@Composable
private fun RankingPage() {
    val ranking = listOf("Aïcha" to 1640, "Youssef" to 1520, "Amine" to 1410, "Fatima" to 1280, "Hassan" to 1190)
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 30.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { PageTop("Classement", "Une motivation facultative") }
        item { Surface(Modifier.padding(horizontal = 20.dp).fillMaxWidth(), shape = RoundedCornerShape(29.dp), color = DeepTeal, shadowElevation = 10.dp) { Column(Modifier.padding(22.dp), horizontalAlignment = Alignment.CenterHorizontally) { Box(Modifier.size(64.dp).clip(CircleShape).background(Gold.copy(alpha = .14f)), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.EmojiEvents, null, tint = Gold, modifier = Modifier.size(39.dp)) }; Text("Vous êtes 2e cette semaine", color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 20.sp, modifier = Modifier.padding(top = 11.dp)); Text("Encore 120 XP pour atteindre la première place", color = Color.White.copy(alpha = .66f), fontSize = 9.sp); LinearProgressIndicator(progress = { .82f }, modifier = Modifier.padding(top = 14.dp).fillMaxWidth().height(7.dp).clip(CircleShape), color = Gold, trackColor = Color.White.copy(alpha = .14f)) } } }
        item { SectionTitle("Classement hebdomadaire", "Top 100") {} }
        items(ranking) { entry ->
            val rank = ranking.indexOf(entry) + 1; val me = entry.first == "Youssef"
            Surface(Modifier.padding(horizontal = 20.dp).fillMaxWidth(), shape = RoundedCornerShape(21.dp), color = if (me) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface, shadowElevation = if (me) 6.dp else 3.dp) { Row(Modifier.padding(15.dp), verticalAlignment = Alignment.CenterVertically) { Box(Modifier.size(40.dp).clip(CircleShape).background(if (rank <= 3) GoldLight else MaterialTheme.colorScheme.surfaceVariant), contentAlignment = Alignment.Center) { Text(rank.toString(), fontWeight = FontWeight.ExtraBold) }; Box(Modifier.padding(start = 11.dp).size(37.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primary.copy(alpha = .12f)), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.Person, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(22.dp)) }; Text(if (me) "${entry.first} • Vous" else entry.first, Modifier.weight(1f).padding(horizontal = 12.dp), fontWeight = FontWeight.Bold); Text("${entry.second} XP", color = if (me) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant, fontWeight = FontWeight.ExtraBold, fontSize = 10.sp) } }
        }
    }
}

@Composable
private fun ProfilePage(dark: Boolean, setDark: (Boolean) -> Unit, rtl: Boolean, setRtl: (Boolean) -> Unit) {
    var sound by rememberSaveable { mutableStateOf(true) }; var vibration by rememberSaveable { mutableStateOf(true) }; var dialog by remember { mutableStateOf<String?>(null) }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 30.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
        item { PageTop("Profil", "Paramètres et confidentialité") { Icon(Icons.Rounded.Settings, null, tint = MaterialTheme.colorScheme.primary) } }
        item { Surface(Modifier.padding(horizontal = 20.dp).fillMaxWidth(), shape = RoundedCornerShape(29.dp), color = DeepTeal, shadowElevation = 10.dp) { Row(Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) { Box(Modifier.size(70.dp).clip(CircleShape).background(Brush.linearGradient(listOf(Emerald, Forest))), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.Person, null, tint = Color.White, modifier = Modifier.size(37.dp)) }; Column(Modifier.weight(1f).padding(horizontal = 14.dp)) { Text("Youssef", color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 21.sp); Text("Mode invité", color = Color.White.copy(alpha = .64f), fontSize = 10.sp); Surface(shape = RoundedCornerShape(11.dp), color = Gold.copy(alpha = .16f), modifier = Modifier.padding(top = 8.dp)) { Text("Niveau 12", color = Gold, fontWeight = FontWeight.Bold, fontSize = 9.sp, modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)) } }; BrandLogo(54.dp) } } }
        item { ProfileSectionTitle("Préférences") }
        item { SettingsSurface { SwitchRow(Icons.Rounded.DarkMode, "Mode sombre", "Réduire la luminosité", dark, setDark); HorizontalDivider(color = MaterialTheme.colorScheme.outline); SwitchRow(Icons.Rounded.Translate, "Interface arabe RTL", "Inverser la mise en page", rtl, setRtl); HorizontalDivider(color = MaterialTheme.colorScheme.outline); SwitchRow(Icons.Rounded.VolumeUp, "Effets sonores", "Pendant les jeux", sound) { sound = it }; HorizontalDivider(color = MaterialTheme.colorScheme.outline); SwitchRow(Icons.Rounded.Vibration, "Vibration", "Retour tactile léger", vibration) { vibration = it } } }
        item { ProfileSectionTitle("Compte et application") }
        item { SettingsSurface { ActionRow(Icons.Rounded.PersonAdd, "Créer un compte", "Synchroniser la progression") { dialog = "La création de compte sera reliée à Firebase Auth." }; HorizontalDivider(color = MaterialTheme.colorScheme.outline); ActionRow(Icons.Rounded.NotificationsActive, "Notifications", "Rappels et objectifs") { dialog = "Les canaux de notification seront ajoutés pendant la phase fonctionnelle." }; HorizontalDivider(color = MaterialTheme.colorScheme.outline); ActionRow(Icons.Rounded.ReportProblem, "Signaler une erreur", "Contenu ou problème technique") { dialog = "Un formulaire de signalement sera intégré au tableau de bord éditorial." }; HorizontalDivider(color = MaterialTheme.colorScheme.outline); ActionRow(Icons.Rounded.PrivacyTip, "Confidentialité", "Données, export et suppression") { dialog = "La politique de confidentialité sera disponible avant la publication." } } }
        item { Text("Muslim QI • Design 0.4.0", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 9.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp)) }
    }
    dialog?.let { AlertDialog(onDismissRequest = { dialog = null }, confirmButton = { TextButton(onClick = { dialog = null }) { Text("Fermer") } }, title = { Text("Information") }, text = { Text(it) }, shape = RoundedCornerShape(28.dp)) }
}

@Composable
private fun ProfileSectionTitle(text: String) { Text(text, fontWeight = FontWeight.ExtraBold, fontSize = 15.sp, color = MaterialTheme.colorScheme.onBackground, modifier = Modifier.padding(horizontal = 20.dp)) }

@Composable
private fun SettingsSurface(content: @Composable ColumnScope.() -> Unit) { Surface(Modifier.padding(horizontal = 20.dp).fillMaxWidth(), shape = RoundedCornerShape(25.dp), color = MaterialTheme.colorScheme.surface, shadowElevation = 5.dp) { Column(Modifier.padding(horizontal = 14.dp, vertical = 4.dp), content = content) } }

@Composable
private fun SwitchRow(icon: ImageVector, title: String, subtitle: String, checked: Boolean, change: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 11.dp), verticalAlignment = Alignment.CenterVertically) { Box(Modifier.size(42.dp).clip(RoundedCornerShape(14.dp)).background(MaterialTheme.colorScheme.primaryContainer), contentAlignment = Alignment.Center) { Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(22.dp)) }; Column(Modifier.weight(1f).padding(horizontal = 12.dp)) { Text(title, fontWeight = FontWeight.ExtraBold, fontSize = 12.sp); Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 9.sp) }; Switch(checked = checked, onCheckedChange = change) }
}

@Composable
private fun ActionRow(icon: ImageVector, title: String, subtitle: String, click: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = click).padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) { Box(Modifier.size(42.dp).clip(RoundedCornerShape(14.dp)).background(MaterialTheme.colorScheme.primaryContainer), contentAlignment = Alignment.Center) { Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(22.dp)) }; Column(Modifier.weight(1f).padding(horizontal = 12.dp)) { Text(title, fontWeight = FontWeight.ExtraBold, fontSize = 12.sp); Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 9.sp) }; Icon(Icons.Rounded.ChevronRight, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(19.dp)) }
}
