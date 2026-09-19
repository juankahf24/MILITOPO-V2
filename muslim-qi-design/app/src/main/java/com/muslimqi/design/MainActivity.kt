package com.muslimqi.design

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.animation.core.animateFloatAsState
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
private val DeepGreen = Color(0xFF065F57)
private val Teal = Color(0xFF0C3D4A)
private val Cream = Color(0xFFF7F3E8)
private val WarmWhite = Color(0xFFFFFCF6)
private val Sand = Color(0xFFE9D8B6)
private val Gold = Color(0xFFD4AF37)
private val Purple = Color(0xFF6750A4)
private val Coral = Color(0xFFC85A47)
private val Ink = Color(0xFF12383A)
private val Muted = Color(0xFF6E7B78)

private enum class Screen { Splash, Language, Welcome, Account, Home, Play, MemorySetup, MemoryGame, Quiz, TrueFalse, Riddle, Progress, Ranking, Profile }

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { MuslimQiApp() }
    }
}

@Composable
private fun MuslimQiApp() {
    var screen by rememberSaveable { mutableStateOf(Screen.Splash) }
    var dark by rememberSaveable { mutableStateOf(false) }
    var rtl by rememberSaveable { mutableStateOf(false) }
    val scheme = if (dark) darkColorScheme(
        primary = Color(0xFF5ED7B3), secondary = Color(0xFFF2C95C), tertiary = Color(0xFFB8A6FF),
        background = Color(0xFF0D1F21), surface = Color(0xFF173033), onSurface = Color(0xFFF3EFE5)
    ) else lightColorScheme(
        primary = Emerald, secondary = Gold, tertiary = Purple,
        background = Cream, surface = WarmWhite, onSurface = Ink
    )
    CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
        MaterialTheme(
            colorScheme = scheme,
            typography = Typography(
                displaySmall = androidx.compose.ui.text.TextStyle(fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = 38.sp),
                headlineMedium = androidx.compose.ui.text.TextStyle(fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = 28.sp),
                titleLarge = androidx.compose.ui.text.TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, fontSize = 22.sp),
                titleMedium = androidx.compose.ui.text.TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 16.sp),
                bodyLarge = androidx.compose.ui.text.TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 15.sp),
                bodyMedium = androidx.compose.ui.text.TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 13.sp)
            )
        ) {
            Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
                GeometricBackground(dark)
                AnimatedContent(screen, transitionSpec = { fadeIn(tween(260)) togetherWith fadeOut(tween(180)) }, label = "screen") { target ->
                    when (target) {
                        Screen.Splash -> SplashScreen { screen = Screen.Language }
                        Screen.Language -> LanguageScreen(onContinue = { screen = Screen.Welcome }, onRtl = { rtl = it })
                        Screen.Welcome -> WelcomeScreen { screen = Screen.Account }
                        Screen.Account -> AccountScreen { screen = Screen.Home }
                        Screen.Home -> AppScaffold(Screen.Home, { screen = it }) { HomeScreen({ screen = it }, rtl) }
                        Screen.Play -> AppScaffold(Screen.Play, { screen = it }) { PlayHub { screen = it } }
                        Screen.MemorySetup -> AppScaffold(Screen.Play, { screen = it }) { MemorySetup { screen = Screen.MemoryGame } }
                        Screen.MemoryGame -> AppScaffold(Screen.Play, { screen = it }) { MemoryGame() }
                        Screen.Quiz -> AppScaffold(Screen.Play, { screen = it }) { QuizScreen() }
                        Screen.TrueFalse -> AppScaffold(Screen.Play, { screen = it }) { TrueFalseScreen() }
                        Screen.Riddle -> AppScaffold(Screen.Play, { screen = it }) { RiddleScreen() }
                        Screen.Progress -> AppScaffold(Screen.Progress, { screen = it }) { ProgressScreen() }
                        Screen.Ranking -> AppScaffold(Screen.Ranking, { screen = it }) { RankingScreen() }
                        Screen.Profile -> AppScaffold(Screen.Profile, { screen = it }) { ProfileScreen(dark, { dark = it }, rtl, { rtl = it }) }
                    }
                }
            }
        }
    }
}

@Composable
private fun GeometricBackground(dark: Boolean) {
    Canvas(Modifier.fillMaxSize()) {
        val c = if (dark) Gold.copy(alpha = .05f) else Gold.copy(alpha = .08f)
        val step = 64.dp.toPx()
        for (x in -1..(size.width / step).toInt() + 1) {
            for (y in -1..(size.height / step).toInt() + 1) {
                val center = Offset(x * step, y * step)
                drawCircle(c, 18.dp.toPx(), center, style = Stroke(1.dp.toPx()))
                drawLine(c, center + Offset(-13.dp.toPx(), 0f), center + Offset(13.dp.toPx(), 0f), 1.dp.toPx())
                drawLine(c, center + Offset(0f, -13.dp.toPx()), center + Offset(0f, 13.dp.toPx()), 1.dp.toPx())
            }
        }
    }
}

@Composable
private fun SplashScreen(onDone: () -> Unit) {
    LaunchedEffect(Unit) { delay(1350); onDone() }
    Box(
        Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(DeepGreen, Teal))),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            BrandMark(116.dp)
            Spacer(Modifier.height(26.dp))
            Text("Muslim QI", color = Color.White, style = MaterialTheme.typography.displaySmall)
            Text("Apprends l’islam chaque jour en t’amusant.", color = Sand, fontSize = 15.sp)
            Spacer(Modifier.height(70.dp))
            CircularProgressIndicator(color = Gold, strokeWidth = 2.dp, modifier = Modifier.size(24.dp))
        }
    }
}

@Composable
private fun BrandMark(size: androidx.compose.ui.unit.Dp) {
    Canvas(Modifier.size(size)) {
        val center = Offset(this.size.width / 2, this.size.height / 2)
        val r = this.size.minDimension * .43f
        rotate(45f, center) { drawRoundRect(Gold, center - Offset(r, r), Size(r * 2, r * 2), CornerRadius(12f,12f), style = Stroke(5f)) }
        drawCircle(DeepGreen, r * .82f, center)
        drawCircle(Gold, r * .73f, center, style = Stroke(4f))
        drawCircle(Color.Transparent, r * .32f, center, style = Stroke(6f, pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f,7f))))
        drawLine(Gold, center + Offset(0f,-r*.5f), center + Offset(0f,r*.45f), 5f, StrokeCap.Round)
        drawCircle(Gold, r*.12f, center + Offset(0f,-r*.5f))
    }
}

@Composable
private fun LanguageScreen(onContinue: () -> Unit, onRtl: (Boolean) -> Unit) {
    var selected by remember { mutableIntStateOf(0) }
    OnboardingContainer("Choisissez votre langue", "Vous pourrez la modifier à tout moment.") {
        LanguageOption("Français", "Interface complète", "FR", selected == 0) { selected = 0; onRtl(false) }
        LanguageOption("العربية", "واجهة كاملة من اليمين إلى اليسار", "AR", selected == 1) { selected = 1; onRtl(true) }
        LanguageOption("English", "Full interface", "EN", selected == 2) { selected = 2; onRtl(false) }
        PremiumInfo(Icons.Rounded.SwapHoriz, "Arabe entièrement compatible RTL", "Navigation, textes et mise en page adaptés.")
        PrimaryButton("Continuer", onContinue)
    }
}

@Composable
private fun WelcomeScreen(onContinue: () -> Unit) {
    OnboardingContainer("Bienvenue !", "Une expérience éducative, ludique et bienveillante.") {
        ValueCard(Icons.Rounded.MenuBook, "Apprendre", "Des contenus clairs, courts et vérifiés.", Emerald)
        ValueCard(Icons.Rounded.SportsEsports, "Jouer", "Quatre modes pensés pour toute la famille.", Gold)
        ValueCard(Icons.Rounded.AutoGraph, "Progresser", "Un parcours positif sans jugement.", Teal)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
            repeat(3) { Box(Modifier.padding(4.dp).size(if (it == 0) 18.dp else 8.dp, 8.dp).clip(CircleShape).background(if (it == 0) Emerald else Sand)) }
        }
        PrimaryButton("Continuer", onContinue)
    }
}

@Composable
private fun AccountScreen(onContinue: () -> Unit) {
    OnboardingContainer("Comment continuer ?", "Jouez immédiatement ou synchronisez vos progrès.") {
        AccountOption(Icons.Rounded.PersonOutline, "Mode invité", "Explorer sans créer de compte", onContinue)
        AccountOption(Icons.Rounded.Public, "Continuer avec Google", "Synchronisation multi-appareils", onContinue)
        AccountOption(Icons.Rounded.PhoneIphone, "Continuer avec Apple", "Connexion rapide et sécurisée", onContinue)
        AccountOption(Icons.Rounded.Email, "Continuer avec E-mail", "Adresse et mot de passe", onContinue)
        PremiumInfo(Icons.Rounded.Security, "Données protégées", "Export et suppression accessibles depuis le profil.")
    }
}

@Composable
private fun OnboardingContainer(title: String, subtitle: String, content: @Composable ColumnScope.() -> Unit) {
    LazyColumn(
        Modifier.fillMaxSize().padding(WindowInsets.safeDrawing.asPaddingValues()).padding(horizontal = 22.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
        contentPadding = PaddingValues(top = 42.dp, bottom = 28.dp)
    ) {
        item {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                BrandMark(66.dp); Spacer(Modifier.height(16.dp))
                Text(title, style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center)
                Text(subtitle, color = Muted, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 6.dp))
            }
        }
        item { Column(verticalArrangement = Arrangement.spacedBy(12.dp), content = content) }
    }
}

@Composable
private fun LanguageOption(name: String, subtitle: String, tag: String, selected: Boolean, onClick: () -> Unit) {
    ElevatedCard(
        onClick = onClick, shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.elevatedCardColors(containerColor = if (selected) Emerald.copy(alpha = .12f) else MaterialTheme.colorScheme.surface),
        modifier = Modifier.fillMaxWidth().border(if (selected) 1.5.dp else 0.dp, if (selected) Emerald else Color.Transparent, RoundedCornerShape(22.dp))
    ) {
        Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(52.dp).clip(RoundedCornerShape(16.dp)).background(if (selected) Emerald else Sand.copy(alpha=.45f)), contentAlignment = Alignment.Center) {
                Text(tag, fontWeight = FontWeight.Bold, color = if(selected) Color.White else DeepGreen)
            }
            Column(Modifier.weight(1f).padding(horizontal = 16.dp)) { Text(name, style = MaterialTheme.typography.titleLarge); Text(subtitle, color = Muted, fontSize = 12.sp) }
            if (selected) Icon(Icons.Rounded.CheckCircle, null, tint = Emerald)
        }
    }
}

@Composable
private fun ValueCard(icon: ImageVector, title: String, body: String, accent: Color) {
    ElevatedCard(shape = RoundedCornerShape(22.dp), modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(52.dp).clip(RoundedCornerShape(18.dp)).background(accent.copy(.14f)), contentAlignment = Alignment.Center) { Icon(icon, null, tint = accent) }
            Column(Modifier.padding(start = 16.dp)) { Text(title, style = MaterialTheme.typography.titleMedium); Text(body, color = Muted, fontSize = 12.sp) }
        }
    }
}

@Composable
private fun AccountOption(icon: ImageVector, title: String, body: String, onClick: () -> Unit) {
    ElevatedCard(onClick = onClick, shape = RoundedCornerShape(22.dp), modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(48.dp).clip(CircleShape).background(Emerald.copy(.12f)), contentAlignment = Alignment.Center) { Icon(icon, null, tint = DeepGreen) }
            Column(Modifier.weight(1f).padding(horizontal = 14.dp)) { Text(title, fontWeight = FontWeight.Bold); Text(body, color = Muted, fontSize = 12.sp) }
            Icon(Icons.Rounded.ChevronRight, null, tint = Emerald)
        }
    }
}

@Composable
private fun PremiumInfo(icon: ImageVector, title: String, body: String) {
    Surface(shape = RoundedCornerShape(18.dp), color = Gold.copy(.10f), modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, tint = Gold); Column(Modifier.padding(start = 12.dp)) { Text(title, fontWeight = FontWeight.SemiBold, fontSize = 13.sp); Text(body, color = Muted, fontSize = 11.sp) }
        }
    }
}

@Composable
private fun PrimaryButton(text: String, onClick: () -> Unit) {
    Button(onClick, Modifier.fillMaxWidth().height(56.dp), shape = RoundedCornerShape(18.dp), colors = ButtonDefaults.buttonColors(containerColor = Emerald)) {
        Text(text, fontWeight = FontWeight.Bold); Spacer(Modifier.width(8.dp)); Icon(Icons.Rounded.ArrowForward, null, Modifier.size(18.dp))
    }
}

@Composable
private fun AppScaffold(selected: Screen, navigate: (Screen) -> Unit, content: @Composable () -> Unit) {
    Scaffold(
        containerColor = Color.Transparent,
        contentWindowInsets = WindowInsets.safeDrawing,
        bottomBar = { BottomNavigation(selected, navigate) }
    ) { pad -> Box(Modifier.fillMaxSize().padding(pad)) { content() } }
}

@Composable
private fun BottomNavigation(selected: Screen, navigate: (Screen) -> Unit) {
    val items = listOf(
        Triple(Screen.Home, Icons.Rounded.Home, "Accueil"), Triple(Screen.Play, Icons.Rounded.SportsEsports, "Jouer"),
        Triple(Screen.Progress, Icons.Rounded.AutoGraph, "Progression"), Triple(Screen.Ranking, Icons.Rounded.EmojiEvents, "Classement"),
        Triple(Screen.Profile, Icons.Rounded.Person, "Profil")
    )
    NavigationBar(containerColor = MaterialTheme.colorScheme.surface.copy(.96f), tonalElevation = 10.dp) {
        items.forEach { (s, i, label) -> NavigationBarItem(selected == s, { navigate(s) }, { Icon(i, null) }, { Text(label, fontSize = 10.sp) }) }
    }
}

@Composable
private fun ScreenHeader(title: String, subtitle: String? = null, trailing: @Composable (() -> Unit)? = null) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 22.dp, vertical = 18.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) { Text(title, style = MaterialTheme.typography.titleLarge); subtitle?.let { Text(it, color = Muted, fontSize = 12.sp) } }
        trailing?.invoke()
    }
}

@Composable
private fun HomeScreen(navigate: (Screen) -> Unit, rtl: Boolean) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 24.dp)) {
        item {
            Row(Modifier.fillMaxWidth().padding(22.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) { Text(if (rtl) "السّلام عليكم" else "As-salāmu ʿalaykum,", color = Muted, fontSize = 12.sp); Text(if (rtl) "يوسف !" else "Youssef ! 👋", style = MaterialTheme.typography.titleLarge) }
                CoinPill(); Spacer(Modifier.width(8.dp)); IconButton({}) { Icon(Icons.Rounded.NotificationsNone, null) }
            }
        }
        item { PrayerCard { } }
        item { ProgressHero() }
        item {
            Text("Choisis ton mode", fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 22.dp, vertical = 12.dp))
            Column(Modifier.padding(horizontal = 18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    ModeCard("Mémoire\nislamique", Icons.Rounded.ViewModule, Emerald, Modifier.weight(1f)) { navigate(Screen.MemorySetup) }
                    ModeCard("Quiz", Icons.Rounded.Quiz, Teal, Modifier.weight(1f)) { navigate(Screen.Quiz) }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    ModeCard("Vrai ou faux", Icons.Rounded.Rule, Gold, Modifier.weight(1f)) { navigate(Screen.TrueFalse) }
                    ModeCard("Devinettes", Icons.Rounded.Lightbulb, Purple, Modifier.weight(1f)) { navigate(Screen.Riddle) }
                }
            }
        }
        item { DailyChallenge() }
    }
}

@Composable
private fun CoinPill() { Surface(shape = RoundedCornerShape(50), color = Gold.copy(.14f)) { Row(Modifier.padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Rounded.MonetizationOn, null, tint = Gold, modifier = Modifier.size(18.dp)); Text("1 240", fontWeight = FontWeight.Bold, fontSize = 12.sp) } } }

@Composable
private fun PrayerCard(onClick: () -> Unit) {
    ElevatedCard(onClick, Modifier.padding(horizontal = 20.dp).fillMaxWidth(), shape = RoundedCornerShape(24.dp)) {
        Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(58.dp).clip(RoundedCornerShape(18.dp)).background(Brush.linearGradient(listOf(Emerald.copy(.2f), Gold.copy(.16f)))), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.AccountBalance, null, tint = DeepGreen, modifier = Modifier.size(30.dp)) }
            Column(Modifier.weight(1f).padding(horizontal = 14.dp)) { Text("Prochaine prière", color = Muted, fontSize = 11.sp); Text("Dhuhr", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = DeepGreen); Text("Méthode : Ligue islamique mondiale", color = Muted, fontSize = 10.sp) }
            Column(horizontalAlignment = Alignment.End) { Text("12:45", fontWeight = FontWeight.Bold, fontSize = 20.sp); Text("dans 1 h 02", color = Muted, fontSize = 11.sp) }
        }
    }
}

@Composable
private fun ProgressHero() {
    ElevatedCard(Modifier.padding(20.dp).fillMaxWidth(), shape = RoundedCornerShape(24.dp)) {
        Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) { Text("Ton évolution", color = Muted, fontSize = 11.sp); Text("Niveau 12", fontWeight = FontWeight.Bold, fontSize = 20.sp); Text("Chercheur de science", color = Emerald, fontSize = 12.sp); Spacer(Modifier.height(10.dp)); LinearProgressIndicator(.68f, Modifier.fillMaxWidth().height(8.dp).clip(CircleShape), color = Emerald, trackColor = Sand.copy(.35f)); Text("820 / 1 200 XP", color = Muted, fontSize = 10.sp, modifier = Modifier.padding(top = 5.dp)) }
            Spacer(Modifier.width(14.dp)); BrandMark(66.dp)
        }
    }
}

@Composable
private fun RowScope.ModeCard(title: String, icon: ImageVector, accent: Color, modifier: Modifier, onClick: () -> Unit) {
    ElevatedCard(onClick, modifier.height(138.dp), shape = RoundedCornerShape(24.dp), colors = CardDefaults.elevatedCardColors(containerColor = accent)) {
        Box(Modifier.fillMaxSize().padding(16.dp)) {
            Canvas(Modifier.matchParentSize()) { drawCircle(Color.White.copy(.08f), 75.dp.toPx(), Offset(size.width, 0f)) }
            Icon(icon, null, tint = Color.White, modifier = Modifier.size(42.dp).align(Alignment.TopEnd))
            Column(Modifier.align(Alignment.BottomStart)) { Text(title, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp); Text("Jouer  →", color = Color.White.copy(.85f), fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp)) }
        }
    }
}

@Composable
private fun DailyChallenge() {
    ElevatedCard(Modifier.padding(20.dp).fillMaxWidth(), shape = RoundedCornerShape(24.dp)) {
        Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(54.dp).clip(RoundedCornerShape(18.dp)).background(Gold.copy(.16f)), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.CardGiftcard, null, tint = Gold) }
            Column(Modifier.weight(1f).padding(horizontal = 14.dp)) { Text("Défi du jour", fontWeight = FontWeight.Bold); Text("Réponds à 10 questions sur les Prophètes", color = Muted, fontSize = 11.sp); Spacer(Modifier.height(8.dp)); LinearProgressIndicator(.6f, Modifier.fillMaxWidth().height(7.dp).clip(CircleShape), color = Emerald, trackColor = Sand.copy(.35f)) }
            Text("6/10", fontWeight = FontWeight.Bold, color = Emerald)
        }
    }
}

@Composable
private fun PlayHub(navigate: (Screen) -> Unit) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 28.dp)) {
        item { ScreenHeader("Jouer", "Choisis une expérience d’apprentissage") { CoinPill() } }
        items(listOf(
            Triple("Mémoire islamique", "Retourne les cartes et découvre une leçon à chaque paire.", Screen.MemorySetup),
            Triple("Quiz", "Quatre réponses, une explication claire et une source.", Screen.Quiz),
            Triple("Vrai ou faux", "Teste ta compréhension avec des affirmations courtes.", Screen.TrueFalse),
            Triple("Devinettes", "Révèle les indices et gagne un bonus de rapidité.", Screen.Riddle)
        )) { (title, body, target) ->
            ElevatedCard(onClick = { navigate(target) }, modifier = Modifier.padding(horizontal = 20.dp, vertical = 7.dp).fillMaxWidth(), shape = RoundedCornerShape(24.dp)) {
                Row(Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(58.dp).clip(RoundedCornerShape(18.dp)).background(Emerald.copy(.12f)), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.AutoAwesome, null, tint = Emerald) }
                    Column(Modifier.weight(1f).padding(horizontal = 15.dp)) { Text(title, fontWeight = FontWeight.Bold, fontSize = 17.sp); Text(body, color = Muted, fontSize = 12.sp) }
                    Icon(Icons.Rounded.ChevronRight, null, tint = Emerald)
                }
            }
        }
    }
}

@Composable
private fun MemorySetup(onStart: () -> Unit) {
    var category by remember { mutableStateOf("Prophètes") }
    var difficulty by remember { mutableStateOf("Facile") }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 28.dp)) {
        item { ScreenHeader("Mémoire islamique", "Choisis une catégorie et une difficulté") { Icon(Icons.Rounded.ViewModule, null, tint = Emerald) } }
        item { SectionTitle("Catégories") }
        item { FlowRowSimple(listOf("Prophètes", "Mosquées", "Villes", "Valeurs", "Mois hégiriens", "Savants"), category) { category = it } }
        item { SectionTitle("Difficulté") }
        item { FlowRowSimple(listOf("Facile", "Normal", "Difficile", "Expert"), difficulty) { difficulty = it } }
        item {
            ElevatedCard(Modifier.padding(20.dp).fillMaxWidth(), shape = RoundedCornerShape(24.dp)) {
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    SettingRow(Icons.Rounded.Timer, "Mode chronométré", "Active", true)
                    HorizontalDivider(color = Sand.copy(.45f))
                    SettingRow(Icons.Rounded.VolumeUp, "Effets sonores", "Désactivables", true)
                    HorizontalDivider(color = Sand.copy(.45f))
                    SettingRow(Icons.Rounded.TouchApp, "Animation des cartes", "Fluide", true)
                }
            }
        }
        item { Box(Modifier.padding(horizontal = 20.dp)) { PrimaryButton("Lancer la partie", onStart) } }
    }
}

@Composable
private fun FlowRowSimple(values: List<String>, selected: String, onSelect: (String) -> Unit) {
    Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        values.chunked(3).forEach { row -> Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { row.forEach { value -> FilterChip(selected == value, { onSelect(value) }, { Text(value, fontSize = 11.sp) }, modifier = Modifier.weight(1f)) } } }
    }
}

@Composable
private fun SectionTitle(text: String) { Text(text, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 22.dp, vertical = 12.dp)) }

@Composable
private fun MemoryGame() {
    val cards = remember { listOf("محمد ﷺ", "محمد ﷺ", "الكعبة", "الكعبة", "رمضان", "رمضان", "مكة", "مكة", "الصبر", "الصبر", "العلم", "العلم") }
    val visible = remember { mutableStateListOf<Boolean>().apply { repeat(cards.size) { add(it == 1 || it == 7) } } }
    var popup by remember { mutableStateOf(false) }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 28.dp)) {
        item { ScreenHeader("Partie en cours", "Trouve toutes les paires") { IconButton({}) { Icon(Icons.Rounded.PauseCircle, null, tint = Emerald) } } }
        item {
            Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                StatMini("01:28", "Temps"); StatMini("12", "Tentatives"); StatMini("1", "Erreur"); StatMini("2/6", "Paires")
            }
        }
        item {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                cards.chunked(3).forEachIndexed { r, row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        row.forEachIndexed { c, label ->
                            val idx = r * 3 + c
                            MemoryCard(label, visible[idx], Modifier.weight(1f)) {
                                visible[idx] = true
                                if (idx == 0 || idx == 1) popup = true
                            }
                        }
                    }
                }
            }
        }
        item { ProgressHero() }
    }
    if (popup) EducationalDialog { popup = false }
}

@Composable
private fun StatMini(value: String, label: String) { Column(horizontalAlignment = Alignment.CenterHorizontally) { Text(value, fontWeight = FontWeight.Bold); Text(label, color = Muted, fontSize = 9.sp) } }

@Composable
private fun MemoryCard(label: String, visible: Boolean, modifier: Modifier, onClick: () -> Unit) {
    animateFloatAsState(if (visible) 180f else 0f, animationSpec = tween(380), label = "flip")
    ElevatedCard(onClick, modifier.aspectRatio(.72f), shape = RoundedCornerShape(16.dp), colors = CardDefaults.elevatedCardColors(containerColor = if (visible) WarmWhite else DeepGreen)) {
        Box(Modifier.fillMaxSize().padding(8.dp), contentAlignment = Alignment.Center) {
            Canvas(Modifier.fillMaxSize()) {
                drawRoundRect(if (visible) Gold.copy(.22f) else Gold.copy(.7f), style = Stroke(2.dp.toPx()))
                if (!visible) {
                    drawCircle(Gold.copy(.25f), size.minDimension * .24f, center)
                    drawLine(Gold.copy(.45f), Offset(center.x, center.y - 28f), Offset(center.x, center.y + 28f), 3f)
                    drawLine(Gold.copy(.45f), Offset(center.x - 28f, center.y), Offset(center.x + 28f, center.y), 3f)
                }
            }
            Text(if (visible) label else "✦", color = if (visible) Ink else Gold, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, fontSize = if (visible) 15.sp else 24.sp)
        }
    }
}

@Composable
private fun EducationalDialog(onClose: () -> Unit) {
    AlertDialog(onDismissRequest = onClose, confirmButton = { Button(onClose, colors = ButtonDefaults.buttonColors(containerColor = Emerald)) { Text("Continuer") } }, icon = { Icon(Icons.Rounded.CheckCircle, null, tint = Emerald, modifier = Modifier.size(42.dp)) }, title = { Text("Paire trouvée !", fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold) }, text = {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("محمد", fontSize = 42.sp, color = Gold); Text("Muhammad ﷺ", fontWeight = FontWeight.Bold, fontSize = 18.sp)
            Spacer(Modifier.height(12.dp)); Text("Le prophète Muhammad ﷺ est le dernier prophète de l’islam. La première révélation lui est parvenue à La Mecque à l’âge de quarante ans.", textAlign = TextAlign.Center, fontSize = 13.sp)
            Surface(color = Emerald.copy(.09f), shape = RoundedCornerShape(14.dp), modifier = Modifier.padding(top = 14.dp)) { Text("Référence éditoriale : Coran 33:40", Modifier.padding(12.dp), fontSize = 11.sp, color = DeepGreen) }
        }
    }, shape = RoundedCornerShape(28.dp), containerColor = MaterialTheme.colorScheme.surface)
}

@Composable
private fun QuizScreen() {
    var selected by remember { mutableIntStateOf(0) }
    val options = listOf("Lis, au nom de ton Seigneur", "Ô toi, enveloppé !", "Dis : Il est Allah, Unique", "Craignez votre Seigneur")
    GamePage("Quiz", "Question 3 sur 10", Icons.Rounded.Quiz) {
        Text("Quelle est la première parole révélée au Prophète ﷺ ?", fontWeight = FontWeight.Bold, fontSize = 20.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp))
        options.forEachIndexed { i, v -> AnswerCard(('A'.code+i).toChar().toString(), v, selected == i) { selected = i } }
        AnimatedVisibility(selected >= 0) { FeedbackCard("Bonne réponse !", "La première révélation commence par « Lis, au nom de ton Seigneur qui a créé ».", "Sourate Al-‘Alaq, 96:1") }
        PrimaryButton("Question suivante") { selected = 0 }
    }
}

@Composable
private fun TrueFalseScreen() {
    var answer by remember { mutableStateOf<Boolean?>(null) }
    GamePage("Vrai ou faux", "Série rapide • 00:20", Icons.Rounded.Rule) {
        ElevatedCard(shape = RoundedCornerShape(24.dp), modifier = Modifier.fillMaxWidth()) { Text("La Kaaba se trouve à La Mecque.", Modifier.padding(30.dp), fontWeight = FontWeight.Bold, fontSize = 21.sp, textAlign = TextAlign.Center) }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Button({ answer = true }, Modifier.weight(1f).height(100.dp), colors = ButtonDefaults.buttonColors(containerColor = Emerald), shape = RoundedCornerShape(22.dp)) { Column(horizontalAlignment = Alignment.CenterHorizontally) { Icon(Icons.Rounded.Check, null, Modifier.size(34.dp)); Text("Vrai", fontWeight = FontWeight.Bold) } }
            Button({ answer = false }, Modifier.weight(1f).height(100.dp), colors = ButtonDefaults.buttonColors(containerColor = Coral), shape = RoundedCornerShape(22.dp)) { Column(horizontalAlignment = Alignment.CenterHorizontally) { Icon(Icons.Rounded.Close, null, Modifier.size(34.dp)); Text("Faux", fontWeight = FontWeight.Bold) } }
        }
        AnimatedVisibility(answer != null) { FeedbackCard("Bonne réponse !", "La Kaaba est située au centre de la Mosquée sacrée à La Mecque.", "Coran 2:125") }
    }
}

@Composable
private fun RiddleScreen() {
    var hint by remember { mutableIntStateOf(1) }
    GamePage("Devinettes", "Bonus rapidité +20 XP", Icons.Rounded.Lightbulb) {
        AssistChip({ hint = 1 }, { Text("Indice 1 / 3") }, leadingIcon = { Icon(Icons.Rounded.AutoAwesome, null) })
        ElevatedCard(shape = RoundedCornerShape(24.dp), modifier = Modifier.fillMaxWidth()) { Text("Je suis la première sourate du Coran et j’ouvre chaque prière.", Modifier.padding(28.dp), fontWeight = FontWeight.Bold, fontSize = 20.sp, textAlign = TextAlign.Center) }
        OutlinedButton({ hint = 2 }, Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp)) { Text(if (hint >= 2) "Mon nom signifie « L’Ouverture »" else "Révéler l’indice 2  •  -10 XP") }
        OutlinedButton({ hint = 3 }, Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp)) { Text(if (hint >= 3) "Je comporte sept versets" else "Révéler l’indice 3  •  -20 XP") }
        FlowRowSimple(listOf("Al-Falaq", "Al-Ikhlâs", "Al-Fâtihah", "An-Nâs"), "Al-Fâtihah") { }
        FeedbackCard("Excellent !", "Trouvé avec $hint indice${if(hint>1)"s" else ""}.", "Sourate Al-Fâtihah, 1")
    }
}

@Composable
private fun GamePage(title: String, subtitle: String, icon: ImageVector, content: @Composable ColumnScope.() -> Unit) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { ScreenHeader(title, subtitle) { Icon(icon, null, tint = Emerald) } }
        item { LinearProgressIndicator(.3f, Modifier.fillMaxWidth().height(7.dp).clip(CircleShape), color = Emerald, trackColor = Sand.copy(.35f)) }
        item { Column(verticalArrangement = Arrangement.spacedBy(12.dp), content = content) }
    }
}

@Composable
private fun AnswerCard(letter: String, text: String, selected: Boolean, onClick: () -> Unit) {
    ElevatedCard(onClick, shape = RoundedCornerShape(18.dp), colors = CardDefaults.elevatedCardColors(containerColor = if(selected) Emerald.copy(.12f) else MaterialTheme.colorScheme.surface), modifier = Modifier.fillMaxWidth().border(if(selected) 1.5.dp else 0.dp, if(selected) Emerald else Color.Transparent, RoundedCornerShape(18.dp))) {
        Row(Modifier.padding(15.dp), verticalAlignment = Alignment.CenterVertically) { Box(Modifier.size(34.dp).clip(CircleShape).background(if(selected) Emerald else Sand.copy(.4f)), contentAlignment = Alignment.Center) { Text(letter, color = if(selected) Color.White else Ink, fontWeight = FontWeight.Bold) }; Text(text, Modifier.weight(1f).padding(horizontal = 12.dp), fontSize = 13.sp); if(selected) Icon(Icons.Rounded.CheckCircle, null, tint = Emerald) }
    }
}

@Composable
private fun FeedbackCard(title: String, body: String, source: String) {
    Surface(color = Emerald.copy(.09f), shape = RoundedCornerShape(20.dp), modifier = Modifier.fillMaxWidth().border(1.dp, Emerald.copy(.25f), RoundedCornerShape(20.dp))) {
        Column(Modifier.padding(16.dp)) { Row(verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Rounded.WorkspacePremium, null, tint = Gold); Text(title, fontWeight = FontWeight.Bold, color = DeepGreen, modifier = Modifier.padding(start = 8.dp)) }; Text(body, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp)); Text(source, color = Muted, fontSize = 10.sp, modifier = Modifier.padding(top = 10.dp)) }
    }
}

@Composable
private fun ProgressScreen() {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 28.dp)) {
        item { ScreenHeader("Mon chemin de connaissance", "Chaque pas compte") }
        item { ProgressHero() }
        item { SectionTitle("Maîtrise par catégorie") }
        item { Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp), horizontalArrangement = Arrangement.SpaceBetween) { MasteryRing("Coran", .80f); MasteryRing("Aqidah", .65f); MasteryRing("Histoire", .72f); MasteryRing("Fiqh", .58f) } }
        item { SectionTitle("Série d’apprentissage") }
        item { ElevatedCard(Modifier.padding(horizontal = 20.dp).fillMaxWidth(), shape = RoundedCornerShape(24.dp)) { Row(Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Rounded.LocalFireDepartment, null, tint = Coral, modifier = Modifier.size(42.dp)); Column(Modifier.padding(start = 14.dp)) { Text("7 jours consécutifs", fontWeight = FontWeight.Bold, fontSize = 18.sp); Text("Meilleur record : 12 jours", color = Muted, fontSize = 12.sp) } } } }
        item { SectionTitle("Sujets à revoir") }
        items(listOf("Les piliers de la foi" to .4f, "Les ablutions" to .6f, "Les mois hégiriens" to .55f)) { (t,p) -> ReviewRow(t,p) }
    }
}

@Composable
private fun MasteryRing(label: String, progress: Float) { Column(horizontalAlignment = Alignment.CenterHorizontally) { Box(Modifier.size(62.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(progress, Modifier.fillMaxSize(), color = Emerald, trackColor = Sand.copy(.4f), strokeWidth = 6.dp); Text("${(progress*100).toInt()}%", fontWeight = FontWeight.Bold, fontSize = 12.sp) }; Text(label, color = Muted, fontSize = 10.sp, modifier = Modifier.padding(top = 6.dp)) } }

@Composable
private fun ReviewRow(title: String, progress: Float) { ElevatedCard(Modifier.padding(horizontal = 20.dp, vertical = 5.dp).fillMaxWidth(), shape = RoundedCornerShape(18.dp)) { Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Rounded.MenuBook, null, tint = Emerald); Column(Modifier.weight(1f).padding(horizontal = 12.dp)) { Text(title, fontWeight = FontWeight.SemiBold); LinearProgressIndicator(progress, Modifier.fillMaxWidth().height(6.dp).clip(CircleShape), color = Gold, trackColor = Sand.copy(.35f)) }; Text("${(progress*100).toInt()}%", color = Muted, fontSize = 11.sp) } } }

@Composable
private fun RankingScreen() {
    val ranking = listOf("Youssef" to 1240, "Aïcha" to 940, "Amine" to 900, "Fatima" to 820, "Hassan" to 720, "Ibrahim" to 610)
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 28.dp)) {
        item { ScreenHeader("Classement", "Facultatif et bienveillant") }
        item { Box(Modifier.padding(horizontal = 20.dp)) { PremiumInfo(Icons.Rounded.Info, "Ton apprentissage avant tout", "Le classement peut être désactivé à tout moment.") } }
        item { Podium() }
        items(ranking) { (name,xp) -> RankingRow(name,xp, name=="Youssef") }
    }
}

@Composable
private fun Podium() { Row(Modifier.fillMaxWidth().padding(24.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.Bottom) { PodiumItem("Amine", 2, 86.dp, Sand); PodiumItem("Youssef", 1, 118.dp, Gold); PodiumItem("Aïcha", 3, 72.dp, Color(0xFFB98258)) } }

@Composable
private fun PodiumItem(name: String, rank: Int, h: androidx.compose.ui.unit.Dp, color: Color) { Column(horizontalAlignment = Alignment.CenterHorizontally) { Box(Modifier.size(52.dp).clip(CircleShape).background(Emerald.copy(.15f)), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.Person, null, tint = DeepGreen) }; Text(name, fontWeight = FontWeight.Bold, fontSize = 11.sp, modifier = Modifier.padding(vertical = 6.dp)); Box(Modifier.width(88.dp).height(h).clip(RoundedCornerShape(topStart=18.dp,topEnd=18.dp)).background(color.copy(.65f)), contentAlignment = Alignment.TopCenter) { Text(rank.toString(), fontSize = 28.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 12.dp)) } } }

@Composable
private fun RankingRow(name: String, xp: Int, me: Boolean) { ElevatedCard(Modifier.padding(horizontal = 20.dp, vertical = 5.dp).fillMaxWidth(), shape = RoundedCornerShape(18.dp), colors = CardDefaults.elevatedCardColors(containerColor = if(me) Gold.copy(.12f) else MaterialTheme.colorScheme.surface)) { Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) { Box(Modifier.size(42.dp).clip(CircleShape).background(Emerald.copy(.12f)), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.Person, null, tint = Emerald) }; Text(if(me) "$name  •  Toi" else name, Modifier.weight(1f).padding(horizontal = 12.dp), fontWeight = FontWeight.SemiBold); Text("$xp XP", fontWeight = FontWeight.Bold, color = if(me) Gold else Emerald) } } }

@Composable
private fun ProfileScreen(dark: Boolean, onDark: (Boolean)->Unit, rtl:Boolean, onRtl:(Boolean)->Unit) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 28.dp)) {
        item { ScreenHeader("Profil & paramètres", "Personnalise ton expérience") { Icon(Icons.Rounded.Settings, null, tint = Emerald) } }
        item { ElevatedCard(Modifier.padding(horizontal = 20.dp).fillMaxWidth(), shape = RoundedCornerShape(24.dp)) { Row(Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) { Box(Modifier.size(64.dp).clip(CircleShape).background(Brush.linearGradient(listOf(Emerald,Teal))), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.Person, null, tint = Color.White, modifier = Modifier.size(34.dp)) }; Column(Modifier.weight(1f).padding(horizontal = 14.dp)) { Text("Youssef", fontWeight = FontWeight.Bold, fontSize = 18.sp); Text("Mode invité", color = Muted, fontSize = 12.sp); Text("Niveau 12", color = Emerald, fontWeight = FontWeight.SemiBold) }; BrandMark(52.dp) } } }
        item { SectionTitle("Préférences") }
        item { SettingsCard { SwitchRow(Icons.Rounded.DarkMode,"Mode sombre",dark,onDark); SwitchRow(Icons.Rounded.Translate,"Interface arabe RTL",rtl,onRtl); SwitchRow(Icons.Rounded.VolumeUp,"Sons",true,{}); SwitchRow(Icons.Rounded.Vibration,"Vibration",true,{}) } }
        item { SectionTitle("Contenu & expérience") }
        item { SettingsCard { ActionRow(Icons.Rounded.WorkspacePremium,"Acheter sans publicité"); ActionRow(Icons.Rounded.AccountBalance,"Afficher la prochaine prière"); ActionRow(Icons.Rounded.TextFields,"Taille du texte") } }
        item { SectionTitle("Données & sécurité") }
        item { SettingsCard { ActionRow(Icons.Rounded.FileDownload,"Exporter mes données"); ActionRow(Icons.Rounded.ReportProblem,"Signaler une erreur"); ActionRow(Icons.Rounded.DeleteForever,"Supprimer mon compte",Coral) } }
    }
}

@Composable
private fun SettingsCard(content: @Composable ColumnScope.() -> Unit) { ElevatedCard(Modifier.padding(horizontal = 20.dp).fillMaxWidth(), shape = RoundedCornerShape(24.dp)) { Column(Modifier.padding(vertical = 4.dp), content = content) } }

@Composable
private fun SwitchRow(icon:ImageVector,title:String,checked:Boolean,onChange:(Boolean)->Unit) { Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) { Icon(icon,null,tint=Emerald); Text(title,Modifier.weight(1f).padding(horizontal=12.dp),fontWeight=FontWeight.SemiBold); Switch(checked,onChange) } }

@Composable
private fun ActionRow(icon:ImageVector,title:String,tint:Color=Emerald) { Row(Modifier.fillMaxWidth().clickable{}.padding(horizontal=16.dp,vertical=14.dp),verticalAlignment=Alignment.CenterVertically){Icon(icon,null,tint=tint);Text(title,Modifier.weight(1f).padding(horizontal=12.dp),fontWeight=FontWeight.SemiBold,color=if(tint==Coral)Coral else MaterialTheme.colorScheme.onSurface);Icon(Icons.Rounded.ChevronRight,null,tint=Muted)} }

@Composable
private fun SettingRow(icon:ImageVector,title:String,subtitle:String,checked:Boolean){Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically){Icon(icon,null,tint=Emerald);Column(Modifier.weight(1f).padding(horizontal=12.dp)){Text(title,fontWeight=FontWeight.SemiBold);Text(subtitle,color=Muted,fontSize=11.sp)};Switch(checked,{})}}
