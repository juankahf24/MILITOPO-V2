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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
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

private val Green = Color(0xFF0B7A6C)
private val GreenDark = Color(0xFF064E48)
private val GreenDeep = Color(0xFF073B3A)
private val Mint = Color(0xFFE1F2EC)
private val Cream = Color(0xFFF6F5EF)
private val WhiteWarm = Color(0xFFFFFEFA)
private val Gold = Color(0xFFD7B14C)
private val GoldSoft = Color(0xFFF5E9C6)
private val Ink = Color(0xFF183230)
private val Muted = Color(0xFF71807D)
private val Line = Color(0xFFE3E7E1)
private val Coral = Color(0xFFD65E55)
private val Blue = Color(0xFF416D8D)
private val Purple = Color(0xFF775F9D)

private enum class PScreen {
    Splash, Language, Onboarding, Account, Email,
    Home, Play, Memory, Progress, Ranking, Profile
}

private data class NavItem(val screen: PScreen, val label: String, val icon: ImageVector)
private val navItems = listOf(
    NavItem(PScreen.Home, "Accueil", Icons.Rounded.Home),
    NavItem(PScreen.Play, "Jouer", Icons.Rounded.SportsEsports),
    NavItem(PScreen.Progress, "Progrès", Icons.Rounded.AutoGraph),
    NavItem(PScreen.Ranking, "Classement", Icons.Rounded.EmojiEvents),
    NavItem(PScreen.Profile, "Profil", Icons.Rounded.Person)
)

class PremiumMainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { PremiumMuslimQiApp() }
    }
}

@Composable
private fun PremiumMuslimQiApp() {
    var screen by rememberSaveable { mutableStateOf(PScreen.Splash) }
    var dark by rememberSaveable { mutableStateOf(false) }
    var rtl by rememberSaveable { mutableStateOf(false) }
    val light = lightColorScheme(
        primary = Green, onPrimary = Color.White, primaryContainer = Mint,
        secondary = Gold, background = Cream, surface = WhiteWarm,
        onSurface = Ink, onSurfaceVariant = Muted, outline = Line
    )
    val night = darkColorScheme(
        primary = Color(0xFF69D7BF), onPrimary = Color(0xFF00382F),
        secondary = Color(0xFFF2CE70), background = Color(0xFF0C1D1C),
        surface = Color(0xFF132A28), onSurface = Color(0xFFF2F6F1),
        onSurfaceVariant = Color(0xFFB7C6C1), outline = Color(0xFF344C48)
    )
    CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
        MaterialTheme(
            colorScheme = if (dark) night else light,
            typography = Typography(
                headlineMedium = androidx.compose.ui.text.TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.ExtraBold, fontSize = 29.sp),
                titleLarge = androidx.compose.ui.text.TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.ExtraBold, fontSize = 21.sp),
                titleMedium = androidx.compose.ui.text.TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, fontSize = 16.sp),
                bodyLarge = androidx.compose.ui.text.TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 15.sp),
                bodyMedium = androidx.compose.ui.text.TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 13.sp)
            )
        ) {
            PremiumBackground {
                AnimatedContent(
                    targetState = screen,
                    modifier = Modifier.fillMaxSize(),
                    transitionSpec = { fadeIn(tween(220)) togetherWith fadeOut(tween(150)) },
                    label = "premium_screen"
                ) { target ->
                    when (target) {
                        PScreen.Splash -> Splash { screen = PScreen.Language }
                        PScreen.Language -> Language({ screen = PScreen.Onboarding }) { rtl = it }
                        PScreen.Onboarding -> Onboarding { screen = PScreen.Account }
                        PScreen.Account -> Account(
                            onGuest = { screen = PScreen.Home },
                            onEmail = { screen = PScreen.Email }
                        )
                        PScreen.Email -> EmailLogin({ screen = PScreen.Account }) { screen = PScreen.Home }
                        PScreen.Home -> Shell(PScreen.Home, { screen = it }) { Home { screen = it } }
                        PScreen.Play -> Shell(PScreen.Play, { screen = it }) { Play { screen = it } }
                        PScreen.Memory -> Shell(PScreen.Play, { screen = it }) { MemoryDemo() }
                        PScreen.Progress -> Shell(PScreen.Progress, { screen = it }) { Progress() }
                        PScreen.Ranking -> Shell(PScreen.Ranking, { screen = it }) { Ranking() }
                        PScreen.Profile -> Shell(PScreen.Profile, { screen = it }) {
                            Profile(dark, { dark = it }, rtl, { rtl = it })
                        }
                    }
                }
            }
        }
    }
    BackHandler(enabled = screen !in listOf(PScreen.Splash, PScreen.Language, PScreen.Home)) {
        screen = when (screen) {
            PScreen.Onboarding -> PScreen.Language
            PScreen.Account -> PScreen.Onboarding
            PScreen.Email -> PScreen.Account
            PScreen.Memory -> PScreen.Play
            else -> PScreen.Home
        }
    }
}

@Composable
private fun PremiumBackground(content: @Composable BoxScope.() -> Unit) {
    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        Canvas(Modifier.matchParentSize()) {
            drawCircle(Green.copy(alpha = .045f), size.width * .48f, Offset(size.width * 1.05f, size.height * .08f))
            drawCircle(Gold.copy(alpha = .06f), size.width * .38f, Offset(-size.width * .05f, size.height * .82f))
            val step = 58.dp.toPx()
            var y = 0f
            while (y < size.height) {
                var x = 0f
                while (x < size.width) {
                    drawCircle(Green.copy(alpha = .026f), 1.3.dp.toPx(), Offset(x, y))
                    x += step
                }
                y += step
            }
        }
        content()
    }
}

@Composable
private fun Splash(done: () -> Unit) {
    LaunchedEffect(Unit) { delay(1100); done() }
    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(GreenDark, GreenDeep, Color(0xFF082D2E)))), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Logo(118.dp)
            Text("Muslim QI", color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 39.sp, modifier = Modifier.padding(top = 26.dp))
            Text("Apprendre • Jouer • Progresser", color = Color.White.copy(alpha = .68f), fontSize = 13.sp, letterSpacing = .8.sp)
            LinearProgressIndicator(.72f, Modifier.padding(top = 58.dp).width(82.dp).height(4.dp).clip(CircleShape), color = Gold, trackColor = Color.White.copy(alpha = .12f))
        }
    }
}

@Composable
private fun Logo(size: androidx.compose.ui.unit.Dp) {
    Canvas(Modifier.size(size)) {
        val c = Offset(this.size.width / 2, this.size.height / 2)
        val r = this.size.minDimension * .39f
        rotate(45f, c) { drawRoundRect(Gold, c - Offset(r, r), Size(r * 2, r * 2), CornerRadius(14f, 14f), style = Stroke(4.5f)) }
        drawCircle(GreenDark, r * .82f, c)
        drawCircle(Gold, r * .68f, c, style = Stroke(3.8f))
        drawCircle(Gold.copy(alpha = .35f), r * .36f, c, style = Stroke(3f, pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 7f))))
        drawLine(Gold, c + Offset(0f, -r * .46f), c + Offset(0f, r * .42f), 4.5f, StrokeCap.Round)
        drawCircle(Gold, r * .105f, c + Offset(0f, -r * .46f))
    }
}

@Composable
private fun OnboardingScaffold(bottom: (@Composable () -> Unit)? = null, content: androidx.compose.foundation.lazy.LazyListScope.() -> Unit) {
    Scaffold(
        modifier = Modifier.fillMaxSize(),
        containerColor = Color.Transparent,
        bottomBar = {
            if (bottom != null) Surface(color = MaterialTheme.colorScheme.background.copy(alpha = .97f)) {
                Box(Modifier.navigationBarsPadding().padding(horizontal = 22.dp, vertical = 14.dp)) { bottom() }
            }
        }
    ) { pad ->
        LazyColumn(
            Modifier.fillMaxSize().padding(pad).padding(horizontal = 22.dp),
            contentPadding = PaddingValues(top = 28.dp, bottom = 26.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
            content = content
        )
    }
}

@Composable
private fun StepHeader(step: Int, title: String, subtitle: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("MUSLIM QI", color = Green, fontWeight = FontWeight.ExtraBold, fontSize = 12.sp, letterSpacing = 1.2.sp)
            Text("$step / 3", color = Muted, fontWeight = FontWeight.Bold, fontSize = 12.sp)
        }
        LinearProgressIndicator(step / 3f, Modifier.padding(top = 17.dp).fillMaxWidth().height(5.dp).clip(CircleShape), color = Green, trackColor = Mint)
        Logo(72.dp)
        Text(title, style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 16.dp))
        Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center, lineHeight = 21.sp, modifier = Modifier.padding(top = 8.dp))
    }
}

@Composable
private fun Language(next: () -> Unit, rtlChanged: (Boolean) -> Unit) {
    var selected by rememberSaveable { mutableIntStateOf(0) }
    OnboardingScaffold(bottom = { PrimaryButton("Continuer", Icons.Rounded.ArrowForward, next) }) {
        item { StepHeader(1, "Choisissez votre langue", "Une interface claire, accessible et adaptée à votre lecture.") }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                LanguageCard("Français", "Interface complète en français", "FR", selected == 0) { selected = 0; rtlChanged(false) }
                LanguageCard("العربية", "واجهة عربية من اليمين إلى اليسار", "AR", selected == 1) { selected = 1; rtlChanged(true) }
                LanguageCard("English", "Complete English interface", "EN", selected == 2) { selected = 2; rtlChanged(false) }
            }
        }
        item { Notice(Icons.Rounded.Translate, "Arabe RTL complet", "Les menus, cartes et écrans s’inversent automatiquement.") }
    }
}

@Composable
private fun LanguageCard(title: String, subtitle: String, code: String, selected: Boolean, click: () -> Unit) {
    Surface(
        Modifier.fillMaxWidth().clickable(onClick = click).border(if (selected) 1.5.dp else 1.dp, if (selected) Green else MaterialTheme.colorScheme.outline, RoundedCornerShape(22.dp)),
        shape = RoundedCornerShape(22.dp), color = if (selected) Mint else MaterialTheme.colorScheme.surface, shadowElevation = if (selected) 8.dp else 2.dp
    ) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(52.dp).clip(RoundedCornerShape(17.dp)).background(if (selected) Green else Mint), contentAlignment = Alignment.Center) {
                Text(code, color = if (selected) Color.White else GreenDark, fontWeight = FontWeight.ExtraBold)
            }
            Column(Modifier.weight(1f).padding(horizontal = 15.dp)) {
                Text(title, fontWeight = FontWeight.ExtraBold, fontSize = 17.sp)
                Text(subtitle, color = Muted, fontSize = 11.sp, modifier = Modifier.padding(top = 3.dp))
            }
            Icon(if (selected) Icons.Rounded.CheckCircle else Icons.Rounded.RadioButtonUnchecked, null, tint = if (selected) Green else Muted)
        }
    }
}

@Composable
private fun Onboarding(done: () -> Unit) {
    var page by rememberSaveable { mutableIntStateOf(0) }
    val titles = listOf("Comprendre avec des explications simples", "Apprendre avec quatre modes de jeu", "Suivre une progression motivante")
    val bodies = listOf("Des contenus courts, structurés et accompagnés de références éditoriales.", "Mémoire, quiz, vrai ou faux et devinettes avec retours immédiats.", "Objectifs, séries et thèmes à revoir sans pression ni jugement.")
    val icons = listOf(Icons.Rounded.MenuBook, Icons.Rounded.SportsEsports, Icons.Rounded.AutoGraph)
    val accents = listOf(Green, Gold, Blue)
    OnboardingScaffold(bottom = {
        Column(verticalArrangement = Arrangement.spacedBy(13.dp)) {
            Dots(page, 3)
            PrimaryButton(if (page == 2) "Commencer" else "Continuer", if (page == 2) Icons.Rounded.RocketLaunch else Icons.Rounded.ArrowForward) {
                if (page == 2) done() else page++
            }
        }
    }) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("MUSLIM QI", color = Green, fontWeight = FontWeight.ExtraBold, fontSize = 12.sp, letterSpacing = 1.2.sp)
                TextButton(onClick = done) { Text("Passer", color = Muted) }
            }
        }
        item {
            Surface(Modifier.fillMaxWidth().height(230.dp).shadow(17.dp, RoundedCornerShape(32.dp)), shape = RoundedCornerShape(32.dp), color = GreenDeep) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Canvas(Modifier.matchParentSize()) { drawCircle(accents[page].copy(alpha = .18f), size.minDimension * .62f, Offset(size.width, 0f)) }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(Modifier.size(104.dp).clip(RoundedCornerShape(30.dp)).background(Color.White.copy(alpha = .10f)), contentAlignment = Alignment.Center) {
                            Icon(icons[page], null, tint = if (page == 1) Gold else Color.White, modifier = Modifier.size(54.dp))
                        }
                        Text("Muslim QI", color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 20.sp, modifier = Modifier.padding(top = 17.dp))
                        Text("La connaissance, un pas après l’autre", color = Color.White.copy(alpha = .62f), fontSize = 10.sp)
                    }
                }
            }
        }
        item {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                Text(listOf("APPRENDRE", "JOUER", "PROGRESSER")[page], color = accents[page], fontWeight = FontWeight.ExtraBold, fontSize = 11.sp, letterSpacing = 1.4.sp)
                Text(titles[page], style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 10.dp))
                Text(bodies[page], color = Muted, textAlign = TextAlign.Center, lineHeight = 21.sp, modifier = Modifier.padding(top = 11.dp))
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("Clair", "Progressif", "Bienveillant").forEach { feature ->
                    Surface(Modifier.weight(1f), shape = RoundedCornerShape(16.dp), color = accents[page].copy(alpha = .09f)) {
                        Column(Modifier.padding(11.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Rounded.CheckCircle, null, tint = accents[page], modifier = Modifier.size(18.dp))
                            Text(feature, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 5.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Account(onGuest: () -> Unit, onEmail: () -> Unit) {
    var info by remember { mutableStateOf<String?>(null) }
    OnboardingScaffold {
        item { StepHeader(3, "Comment continuer ?", "Commencez immédiatement ou synchronisez votre progression.") }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                AccountCard("👤", "Continuer en invité", "Découvrir sans créer de compte", true, onGuest)
                AccountCard("G", "Continuer avec Google", "Synchronisation multi-appareils") { info = "La connexion Google sera branchée avec Firebase Auth." }
                AccountCard("", "Continuer avec Apple", "Connexion sécurisée") { info = "La connexion Apple sera activée dans la phase compte." }
                AccountCard("✉", "Continuer avec un e-mail", "Adresse, mot de passe et récupération", click = onEmail)
            }
        }
        item { Notice(Icons.Rounded.VerifiedUser, "Données sous votre contrôle", "Export et suppression seront accessibles depuis le profil.") }
    }
    info?.let {
        AlertDialog(onDismissRequest = { info = null }, confirmButton = { TextButton(onClick = { info = null }) { Text("Compris") } }, title = { Text("Fonction en préparation") }, text = { Text(it) }, shape = RoundedCornerShape(28.dp))
    }
}

@Composable
private fun AccountCard(symbol: String, title: String, subtitle: String, strong: Boolean = false, click: () -> Unit) {
    Surface(Modifier.fillMaxWidth().clickable(onClick = click), shape = RoundedCornerShape(22.dp), color = if (strong) GreenDeep else MaterialTheme.colorScheme.surface, shadowElevation = if (strong) 12.dp else 4.dp) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(50.dp).clip(RoundedCornerShape(16.dp)).background(if (strong) Color.White.copy(alpha = .13f) else Mint), contentAlignment = Alignment.Center) {
                Text(symbol, color = if (strong) Color.White else GreenDark, fontWeight = FontWeight.ExtraBold, fontSize = 20.sp)
            }
            Column(Modifier.weight(1f).padding(horizontal = 14.dp)) {
                Text(title, color = if (strong) Color.White else MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
                Text(subtitle, color = if (strong) Color.White.copy(alpha = .62f) else Muted, fontSize = 10.sp, modifier = Modifier.padding(top = 3.dp))
            }
            Icon(Icons.Rounded.ChevronRight, null, tint = if (strong) Gold else Green)
        }
    }
}

@Composable
private fun EmailLogin(back: () -> Unit, done: () -> Unit) {
    var email by rememberSaveable { mutableStateOf("") }
    var pass by rememberSaveable { mutableStateOf("") }
    OnboardingScaffold(bottom = { PrimaryButton("Se connecter", Icons.Rounded.Login, done) }) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = back) { Icon(Icons.Rounded.ArrowBack, null) }
                Text("Connexion", style = MaterialTheme.typography.titleLarge)
            }
        }
        item {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                Logo(78.dp)
                Text("Retrouvez votre progression", style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 18.dp))
                Text("Le formulaire fonctionne visuellement ; le serveur sera connecté ensuite.", color = Muted, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp))
            }
        }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(13.dp)) {
                OutlinedTextField(email, { email = it }, Modifier.fillMaxWidth(), label = { Text("Adresse e-mail") }, leadingIcon = { Icon(Icons.Rounded.Email, null) }, shape = RoundedCornerShape(18.dp), singleLine = true)
                OutlinedTextField(pass, { pass = it }, Modifier.fillMaxWidth(), label = { Text("Mot de passe") }, leadingIcon = { Icon(Icons.Rounded.Lock, null) }, shape = RoundedCornerShape(18.dp), singleLine = true)
                TextButton(onClick = {}) { Text("Mot de passe oublié ?") }
            }
        }
    }
}

@Composable
private fun Notice(icon: ImageVector, title: String, body: String) {
    Surface(shape = RoundedCornerShape(20.dp), color = GoldSoft.copy(alpha = .64f), modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(42.dp).clip(RoundedCornerShape(14.dp)).background(Gold.copy(alpha = .18f)), contentAlignment = Alignment.Center) { Icon(icon, null, tint = Color(0xFF97721A), modifier = Modifier.size(22.dp)) }
            Column(Modifier.padding(start = 12.dp)) {
                Text(title, fontWeight = FontWeight.ExtraBold, fontSize = 13.sp)
                Text(body, color = Muted, fontSize = 10.sp, modifier = Modifier.padding(top = 2.dp))
            }
        }
    }
}

@Composable
private fun Dots(selected: Int, count: Int) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
        repeat(count) { index -> Box(Modifier.padding(horizontal = 4.dp).width(if (index == selected) 28.dp else 8.dp).height(8.dp).clip(CircleShape).background(if (index == selected) Green else MaterialTheme.colorScheme.outline)) }
    }
}

@Composable
private fun PrimaryButton(text: String, icon: ImageVector, click: () -> Unit) {
    Button(click, Modifier.fillMaxWidth().height(58.dp).shadow(11.dp, RoundedCornerShape(19.dp)), shape = RoundedCornerShape(19.dp), colors = ButtonDefaults.buttonColors(containerColor = Green)) {
        Text(text, fontWeight = FontWeight.ExtraBold)
        Icon(icon, null, modifier = Modifier.padding(start = 9.dp).size(20.dp))
    }
}

@Composable
private fun Shell(selected: PScreen, navigate: (PScreen) -> Unit, content: @Composable () -> Unit) {
    Scaffold(Modifier.fillMaxSize(), containerColor = Color.Transparent, bottomBar = { BottomBar(selected, navigate) }) { pad ->
        Box(Modifier.fillMaxSize().padding(pad)) { content() }
    }
}

@Composable
private fun BottomBar(selected: PScreen, navigate: (PScreen) -> Unit) {
    Surface(Modifier.fillMaxWidth(), color = MaterialTheme.colorScheme.surface.copy(alpha = .98f), shadowElevation = 20.dp) {
        Row(Modifier.fillMaxWidth().navigationBarsPadding().height(76.dp).padding(horizontal = 6.dp, vertical = 7.dp)) {
            navItems.forEach { item ->
                val active = item.screen == selected
                Column(Modifier.weight(1f).fillMaxHeight().clip(RoundedCornerShape(18.dp)).clickable { navigate(item.screen) }.padding(vertical = 6.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                    Box(Modifier.width(if (active) 46.dp else 36.dp).height(28.dp).clip(RoundedCornerShape(14.dp)).background(if (active) Mint else Color.Transparent), contentAlignment = Alignment.Center) {
                        Icon(item.icon, null, tint = if (active) Green else MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(21.dp))
                    }
                    Text(item.label, color = if (active) Green else MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 9.sp, fontWeight = if (active) FontWeight.ExtraBold else FontWeight.Medium, maxLines = 1)
                }
            }
        }
    }
}

@Composable
private fun Top(title: String, subtitle: String? = null, trailing: @Composable (() -> Unit)? = null) {
    Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 20.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleLarge)
            subtitle?.let { Text(it, color = Muted, fontSize = 10.sp, modifier = Modifier.padding(top = 2.dp)) }
        }
        trailing?.invoke()
    }
}

@Composable
private fun Home(navigate: (PScreen) -> Unit) {
    var notification by remember { mutableStateOf(false) }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(15.dp)) {
        item {
            Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 20.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(46.dp).clip(CircleShape).background(Mint), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.Person, null, tint = Green) }
                Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                    Text("As-salāmu ʿalaykum", color = Muted, fontSize = 10.sp)
                    Text("Youssef", fontWeight = FontWeight.ExtraBold, fontSize = 19.sp)
                }
                Coin()
                IconButton(onClick = { notification = true }) { Icon(Icons.Rounded.NotificationsNone, null) }
            }
        }
        item { DailyHero { navigate(PScreen.Play) } }
        item {
            Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                MiniStat(Icons.Rounded.LocalFireDepartment, "7 jours", "Série", Coral, Modifier.weight(1f))
                MiniStat(Icons.Rounded.Bolt, "820 XP", "Semaine", Gold, Modifier.weight(1f))
                MiniStat(Icons.Rounded.School, "68%", "Maîtrise", Green, Modifier.weight(1f))
            }
        }
        item { Section("Jouer et apprendre", "Voir tout") { navigate(PScreen.Play) } }
        item {
            Row(Modifier.padding(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Mode("Mémoire", "Trouver les paires", Icons.Rounded.GridView, Green, Modifier.weight(1f)) { navigate(PScreen.Memory) }
                Mode("Quiz", "Tester ses acquis", Icons.Rounded.Quiz, Blue, Modifier.weight(1f)) { navigate(PScreen.Play) }
            }
        }
        item {
            Row(Modifier.padding(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Mode("Vrai ou faux", "Répondre vite", Icons.Rounded.Rule, Gold, Modifier.weight(1f)) { navigate(PScreen.Play) }
                Mode("Devinettes", "Révéler des indices", Icons.Rounded.Lightbulb, Purple, Modifier.weight(1f)) { navigate(PScreen.Play) }
            }
        }
        item { Section("Défi du jour", "+80 XP") {} }
        item { Challenge() }
    }
    if (notification) AlertDialog(onDismissRequest = { notification = false }, confirmButton = { TextButton(onClick = { notification = false }) { Text("Fermer") } }, title = { Text("Notifications") }, text = { Text("Aucune nouvelle notification. Les rappels seront configurables depuis le profil.") }, shape = RoundedCornerShape(28.dp))
}

@Composable
private fun Coin() {
    Surface(shape = RoundedCornerShape(18.dp), color = GoldSoft) {
        Row(Modifier.padding(horizontal = 10.dp, vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Rounded.MonetizationOn, null, tint = Color(0xFFA37B18), modifier = Modifier.size(17.dp))
            Text("145", color = Color(0xFF7B5C12), fontWeight = FontWeight.ExtraBold, fontSize = 11.sp, modifier = Modifier.padding(start = 4.dp))
        }
    }
}

@Composable
private fun DailyHero(click: () -> Unit) {
    Surface(Modifier.padding(horizontal = 20.dp).fillMaxWidth().height(238.dp).shadow(18.dp, RoundedCornerShape(30.dp)), shape = RoundedCornerShape(30.dp), color = GreenDeep) {
        Box(Modifier.fillMaxSize()) {
            Canvas(Modifier.matchParentSize()) { drawCircle(Gold.copy(alpha = .13f), size.minDimension * .62f, Offset(size.width, 0f)) }
            Column(Modifier.fillMaxSize().padding(22.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(shape = RoundedCornerShape(12.dp), color = Color.White.copy(alpha = .10f)) { Text("PARCOURS DU JOUR", color = Gold, fontWeight = FontWeight.ExtraBold, fontSize = 9.sp, letterSpacing = 1.1.sp, modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp)) }
                    Spacer(Modifier.weight(1f)); Icon(Icons.Rounded.AutoAwesome, null, tint = Gold)
                }
                Text("Les prophètes\net leurs enseignements", color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 25.sp, lineHeight = 28.sp, modifier = Modifier.padding(top = 18.dp))
                Text("6 minutes • 3 activités", color = Color.White.copy(alpha = .65f), fontSize = 10.sp, modifier = Modifier.padding(top = 6.dp))
                Spacer(Modifier.weight(1f))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        LinearProgressIndicator(.42f, Modifier.fillMaxWidth().height(6.dp).clip(CircleShape), color = Gold, trackColor = Color.White.copy(alpha = .13f))
                        Text("42% terminé", color = Color.White.copy(alpha = .60f), fontSize = 9.sp, modifier = Modifier.padding(top = 5.dp))
                    }
                    Spacer(Modifier.width(14.dp))
                    Button(click, colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = GreenDark), shape = RoundedCornerShape(16.dp)) { Text("Continuer", fontWeight = FontWeight.ExtraBold); Icon(Icons.Rounded.ArrowForward, null, modifier = Modifier.padding(start = 5.dp).size(18.dp)) }
                }
            }
        }
    }
}

@Composable
private fun RowScope.MiniStat(icon: ImageVector, value: String, label: String, color: Color, modifier: Modifier) {
    Surface(modifier, shape = RoundedCornerShape(20.dp), color = MaterialTheme.colorScheme.surface, shadowElevation = 3.dp) {
        Column(Modifier.padding(vertical = 13.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(icon, null, tint = color, modifier = Modifier.size(21.dp)); Text(value, fontWeight = FontWeight.ExtraBold, fontSize = 14.sp, modifier = Modifier.padding(top = 6.dp)); Text(label, color = Muted, fontSize = 8.sp)
        }
    }
}

@Composable
private fun Section(title: String, action: String, click: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(title, fontWeight = FontWeight.ExtraBold, fontSize = 17.sp, modifier = Modifier.weight(1f))
        TextButton(onClick = click) { Text(action, color = Green, fontSize = 10.sp) }
    }
}

@Composable
private fun RowScope.Mode(title: String, subtitle: String, icon: ImageVector, color: Color, modifier: Modifier, click: () -> Unit) {
    Surface(modifier.height(132.dp).clickable(onClick = click), shape = RoundedCornerShape(24.dp), color = color, shadowElevation = 7.dp) {
        Column(Modifier.fillMaxSize().padding(15.dp)) {
            Box(Modifier.size(38.dp).clip(RoundedCornerShape(13.dp)).background(Color.White.copy(alpha = .14f)), contentAlignment = Alignment.Center) { Icon(icon, null, tint = Color.White, modifier = Modifier.size(23.dp)) }
            Spacer(Modifier.weight(1f)); Text(title, color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp); Text(subtitle, color = Color.White.copy(alpha = .70f), fontSize = 9.sp)
        }
    }
}

@Composable
private fun Challenge() {
    Surface(Modifier.padding(horizontal = 20.dp).fillMaxWidth(), shape = RoundedCornerShape(24.dp), color = MaterialTheme.colorScheme.surface, shadowElevation = 4.dp) {
        Row(Modifier.padding(17.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(54.dp).clip(RoundedCornerShape(18.dp)).background(GoldSoft), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.MilitaryTech, null, tint = Color(0xFFA27A18), modifier = Modifier.size(28.dp)) }
            Column(Modifier.weight(1f).padding(horizontal = 14.dp)) {
                Text("Répondre à 10 questions", fontWeight = FontWeight.ExtraBold); Text("Valeurs et comportements", color = Muted, fontSize = 9.sp)
                LinearProgressIndicator(.6f, Modifier.fillMaxWidth().height(6.dp).clip(CircleShape), color = Green, trackColor = Mint)
            }
            Text("6/10", color = Green, fontWeight = FontWeight.ExtraBold)
        }
    }
}

@Composable
private fun Play(navigate: (PScreen) -> Unit) {
    val modes = listOf(
        Triple("Mémoire islamique", "Trouver les paires et découvrir une information.", Icons.Rounded.GridView),
        Triple("Quiz", "Choisir une réponse et lire une explication claire.", Icons.Rounded.Quiz),
        Triple("Vrai ou faux", "Répondre rapidement à des affirmations courtes.", Icons.Rounded.Rule),
        Triple("Devinettes", "Révéler les indices au bon moment.", Icons.Rounded.Lightbulb)
    )
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Top("Jouer", "Choisissez une expérience") { Coin() } }
        item { Box(Modifier.padding(horizontal = 20.dp)) { Notice(Icons.Rounded.TipsAndUpdates, "Conseil du jour", "Une partie courte suffit pour maintenir votre série.") } }
        items(modes) { mode ->
            Surface(Modifier.padding(horizontal = 20.dp).fillMaxWidth().clickable { navigate(PScreen.Memory) }, shape = RoundedCornerShape(24.dp), color = MaterialTheme.colorScheme.surface, shadowElevation = 4.dp) {
                Row(Modifier.padding(17.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(60.dp).clip(RoundedCornerShape(20.dp)).background(Mint), contentAlignment = Alignment.Center) { Icon(mode.third, null, tint = Green, modifier = Modifier.size(31.dp)) }
                    Column(Modifier.weight(1f).padding(horizontal = 14.dp)) { Text(mode.first, fontWeight = FontWeight.ExtraBold, fontSize = 17.sp); Text(mode.second, color = Muted, fontSize = 10.sp, lineHeight = 14.sp, modifier = Modifier.padding(top = 4.dp)); Text("Jouer maintenant →", color = Green, fontWeight = FontWeight.Bold, fontSize = 10.sp, modifier = Modifier.padding(top = 8.dp)) }
                }
            }
        }
    }
}

@Composable
private fun MemoryDemo() {
    val labels = listOf("محمد ﷺ", "مكة", "الصبر", "رمضان", "محمد ﷺ", "مكة", "الصبر", "رمضان")
    val open = remember { mutableStateListOf<Int>() }
    var score by rememberSaveable { mutableIntStateOf(0) }
    LaunchedEffect(open.toList()) {
        if (open.size == 2) { delay(600); if (labels[open[0]] == labels[open[1]]) score += 100; open.clear() }
    }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
        item { Top("Mémoire islamique", "Démonstration jouable") { Text("$score pts", color = Green, fontWeight = FontWeight.ExtraBold) } }
        item { Text("Touchez deux cartes pour chercher une paire.", color = Muted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()) }
        item {
            Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                labels.chunked(2).forEachIndexed { row, values ->
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        values.forEachIndexed { col, value ->
                            val index = row * 2 + col
                            val shown = index in open
                            Surface(Modifier.weight(1f).height(104.dp).clickable { if (!shown && open.size < 2) open.add(index) }, shape = RoundedCornerShape(20.dp), color = if (shown) MaterialTheme.colorScheme.surface else GreenDeep, shadowElevation = 6.dp) {
                                Box(Modifier.fillMaxSize().border(1.dp, Gold.copy(alpha = .55f), RoundedCornerShape(20.dp)), contentAlignment = Alignment.Center) { Text(if (shown) value else "✦", color = if (shown) MaterialTheme.colorScheme.onSurface else Gold, fontWeight = FontWeight.ExtraBold, fontSize = if (shown) 18.sp else 27.sp) }
                            }
                        }
                    }
                }
            }
        }
        item { Box(Modifier.padding(horizontal = 20.dp)) { Notice(Icons.Rounded.Info, "Prototype interactif", "La logique complète, les animations et le contenu vérifié seront ajoutés étape par étape.") } }
    }
}

@Composable
private fun Progress() {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { Top("Progression", "Votre chemin de connaissance") }
        item {
            Surface(Modifier.padding(horizontal = 20.dp).fillMaxWidth(), shape = RoundedCornerShape(28.dp), color = GreenDeep, shadowElevation = 9.dp) {
                Row(Modifier.padding(21.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) { Text("NIVEAU 12", color = Gold, fontWeight = FontWeight.ExtraBold, fontSize = 10.sp); Text("Chercheur de science", color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 20.sp, modifier = Modifier.padding(top = 5.dp)); Text("380 XP avant le niveau suivant", color = Color.White.copy(alpha = .60f), fontSize = 9.sp); LinearProgressIndicator(.68f, Modifier.padding(top = 13.dp).fillMaxWidth().height(7.dp).clip(CircleShape), color = Gold, trackColor = Color.White.copy(alpha = .13f)) }
                    Box(Modifier.padding(start = 16.dp).size(72.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(.68f, Modifier.fillMaxSize(), color = Gold, trackColor = Color.White.copy(alpha = .12f), strokeWidth = 7.dp); Text("68%", color = Color.White, fontWeight = FontWeight.ExtraBold) }
                }
            }
        }
        item { Section("Maîtrise par thème", "") {} }
        item {
            Row(Modifier.padding(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                Mastery("Coran", .80f, Green, Modifier.weight(1f)); Mastery("Histoire", .72f, Blue, Modifier.weight(1f)); Mastery("Valeurs", .65f, Gold, Modifier.weight(1f))
            }
        }
        item { Section("À revoir", "3 thèmes") {} }
        items(listOf("Les piliers de la foi" to .42f, "Les ablutions" to .58f, "Les mois hégiriens" to .64f)) { review ->
            Surface(Modifier.padding(horizontal = 20.dp).fillMaxWidth(), shape = RoundedCornerShape(19.dp), color = MaterialTheme.colorScheme.surface, shadowElevation = 2.dp) {
                Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Rounded.MenuBook, null, tint = Green); Column(Modifier.weight(1f).padding(horizontal = 12.dp)) { Text(review.first, fontWeight = FontWeight.Bold, fontSize = 12.sp); LinearProgressIndicator(review.second, Modifier.fillMaxWidth().height(5.dp).clip(CircleShape), color = Gold, trackColor = GoldSoft) }; Text("${(review.second * 100).toInt()}%", color = Muted, fontSize = 10.sp) }
            }
        }
    }
}

@Composable
private fun RowScope.Mastery(label: String, progress: Float, color: Color, modifier: Modifier) {
    Surface(modifier, shape = RoundedCornerShape(22.dp), color = MaterialTheme.colorScheme.surface, shadowElevation = 3.dp) {
        Column(Modifier.padding(vertical = 16.dp), horizontalAlignment = Alignment.CenterHorizontally) { Box(Modifier.size(58.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(progress, Modifier.fillMaxSize(), color = color, trackColor = color.copy(alpha = .12f), strokeWidth = 6.dp); Text("${(progress * 100).toInt()}%", fontWeight = FontWeight.ExtraBold, fontSize = 10.sp) }; Text(label, fontWeight = FontWeight.Bold, fontSize = 9.sp, modifier = Modifier.padding(top = 7.dp)) }
    }
}

@Composable
private fun Ranking() {
    val list = listOf("Aïcha" to 1640, "Youssef" to 1520, "Amine" to 1410, "Fatima" to 1280, "Hassan" to 1190)
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Top("Classement", "Une motivation facultative") }
        item {
            Surface(Modifier.padding(horizontal = 20.dp).fillMaxWidth(), shape = RoundedCornerShape(28.dp), color = GreenDeep, shadowElevation = 9.dp) {
                Column(Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) { Icon(Icons.Rounded.EmojiEvents, null, tint = Gold, modifier = Modifier.size(42.dp)); Text("Vous êtes 2e cette semaine", color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 19.sp, modifier = Modifier.padding(top = 9.dp)); Text("Encore 120 XP pour atteindre la première place", color = Color.White.copy(alpha = .60f), fontSize = 9.sp); LinearProgressIndicator(.82f, Modifier.padding(top = 13.dp).fillMaxWidth().height(7.dp).clip(CircleShape), color = Gold, trackColor = Color.White.copy(alpha = .13f)) }
            }
        }
        item { Section("Classement hebdomadaire", "Top 100") {} }
        items(list) { entry ->
            val rank = list.indexOf(entry) + 1; val me = entry.first == "Youssef"
            Surface(Modifier.padding(horizontal = 20.dp).fillMaxWidth(), shape = RoundedCornerShape(19.dp), color = if (me) Mint else MaterialTheme.colorScheme.surface, shadowElevation = if (me) 5.dp else 2.dp) {
                Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) { Box(Modifier.size(34.dp).clip(CircleShape).background(GoldSoft), contentAlignment = Alignment.Center) { Text(rank.toString(), fontWeight = FontWeight.ExtraBold) }; Icon(Icons.Rounded.Person, null, tint = Green, modifier = Modifier.padding(start = 10.dp)); Text(if (me) "${entry.first} • Vous" else entry.first, Modifier.weight(1f).padding(horizontal = 12.dp), fontWeight = FontWeight.Bold); Text("${entry.second} XP", color = if (me) Green else Muted, fontWeight = FontWeight.ExtraBold, fontSize = 10.sp) }
            }
        }
    }
}

@Composable
private fun Profile(dark: Boolean, setDark: (Boolean) -> Unit, rtl: Boolean, setRtl: (Boolean) -> Unit) {
    var sounds by rememberSaveable { mutableStateOf(true) }
    var vibration by rememberSaveable { mutableStateOf(true) }
    var dialog by remember { mutableStateOf<String?>(null) }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
        item { Top("Profil", "Paramètres et confidentialité") { Icon(Icons.Rounded.Settings, null, tint = Green) } }
        item {
            Surface(Modifier.padding(horizontal = 20.dp).fillMaxWidth(), shape = RoundedCornerShape(28.dp), color = GreenDeep, shadowElevation = 9.dp) {
                Row(Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) { Box(Modifier.size(66.dp).clip(CircleShape).background(Green), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.Person, null, tint = Color.White, modifier = Modifier.size(35.dp)) }; Column(Modifier.weight(1f).padding(horizontal = 14.dp)) { Text("Youssef", color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 20.sp); Text("Mode invité", color = Color.White.copy(alpha = .60f), fontSize = 10.sp); Surface(shape = RoundedCornerShape(10.dp), color = Gold.copy(alpha = .16f), modifier = Modifier.padding(top = 8.dp)) { Text("Niveau 12", color = Gold, fontWeight = FontWeight.Bold, fontSize = 9.sp, modifier = Modifier.padding(horizontal = 9.dp, vertical = 5.dp)) } }; Logo(50.dp) }
            }
        }
        item { ProfileTitle("Préférences") }
        item { SettingsCard { SwitchSetting(Icons.Rounded.DarkMode, "Mode sombre", "Réduire la luminosité", dark, setDark); HorizontalDivider(color = MaterialTheme.colorScheme.outline); SwitchSetting(Icons.Rounded.Translate, "Interface arabe RTL", "Inverser la mise en page", rtl, setRtl); HorizontalDivider(color = MaterialTheme.colorScheme.outline); SwitchSetting(Icons.Rounded.VolumeUp, "Effets sonores", "Pendant les jeux", sounds) { sounds = it }; HorizontalDivider(color = MaterialTheme.colorScheme.outline); SwitchSetting(Icons.Rounded.Vibration, "Vibration", "Retour tactile léger", vibration) { vibration = it } } }
        item { ProfileTitle("Compte et application") }
        item { SettingsCard { ActionSetting(Icons.Rounded.PersonAdd, "Créer un compte", "Synchroniser la progression") { dialog = "La création de compte sera reliée à Firebase Auth." }; HorizontalDivider(color = MaterialTheme.colorScheme.outline); ActionSetting(Icons.Rounded.NotificationsActive, "Notifications", "Rappels et objectifs") { dialog = "Les canaux de notification seront ajoutés ensuite." }; HorizontalDivider(color = MaterialTheme.colorScheme.outline); ActionSetting(Icons.Rounded.ReportProblem, "Signaler une erreur", "Contenu ou problème technique") { dialog = "Un formulaire de signalement sera intégré." } } }
        item { Text("Muslim QI • Design 0.3.0", color = Muted, fontSize = 9.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp)) }
    }
    dialog?.let { AlertDialog(onDismissRequest = { dialog = null }, confirmButton = { TextButton(onClick = { dialog = null }) { Text("Fermer") } }, title = { Text("Information") }, text = { Text(it) }, shape = RoundedCornerShape(28.dp)) }
}

@Composable
private fun ProfileTitle(text: String) { Text(text, fontWeight = FontWeight.ExtraBold, fontSize = 14.sp, modifier = Modifier.padding(horizontal = 20.dp)) }

@Composable
private fun SettingsCard(content: @Composable ColumnScope.() -> Unit) {
    Surface(Modifier.padding(horizontal = 20.dp).fillMaxWidth(), shape = RoundedCornerShape(24.dp), color = MaterialTheme.colorScheme.surface, shadowElevation = 4.dp) { Column(Modifier.padding(horizontal = 14.dp, vertical = 4.dp), content = content) }
}

@Composable
private fun SwitchSetting(icon: ImageVector, title: String, subtitle: String, checked: Boolean, change: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) { Box(Modifier.size(39.dp).clip(RoundedCornerShape(13.dp)).background(Mint), contentAlignment = Alignment.Center) { Icon(icon, null, tint = Green, modifier = Modifier.size(21.dp)) }; Column(Modifier.weight(1f).padding(horizontal = 11.dp)) { Text(title, fontWeight = FontWeight.ExtraBold, fontSize = 12.sp); Text(subtitle, color = Muted, fontSize = 9.sp) }; Switch(checked, change) }
}

@Composable
private fun ActionSetting(icon: ImageVector, title: String, subtitle: String, click: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = click).padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) { Box(Modifier.size(39.dp).clip(RoundedCornerShape(13.dp)).background(Mint), contentAlignment = Alignment.Center) { Icon(icon, null, tint = Green, modifier = Modifier.size(21.dp)) }; Column(Modifier.weight(1f).padding(horizontal = 11.dp)) { Text(title, fontWeight = FontWeight.ExtraBold, fontSize = 12.sp); Text(subtitle, color = Muted, fontSize = 9.sp) }; Icon(Icons.Rounded.ChevronRight, null, tint = Muted, modifier = Modifier.size(19.dp)) }
}
