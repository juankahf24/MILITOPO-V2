# Tawba 4.0 — Phase 1

Reconstruction Android native de Tawba centrée sur une base vérifiable : accueil Compose, corpus coranique local, 114 sourates, lecteur RTL, recherche normalisée séparée du texte affiché, signets, reprise de lecture, cinq polices arabes et thèmes Ivoire, Nuit et AMOLED.

## Principes de sûreté religieuse

- Le texte affiché provient exclusivement de `assets/databases/tawba.db`.
- Aucun verset et aucune Basmala ne sont codés en dur dans l’interface.
- La normalisation est limitée à l’index de recherche.
- Le corpus est régénéré depuis une révision épinglée puis contrôlé avant chaque build CI.
- La certification mot à mot par rapport à une édition canonique externe reste explicitement non vérifiée.

## Environnement de build validé

- JDK 17
- Gradle 9.5
- Android Gradle Plugin 9.3.0
- Kotlin / Compose Compiler 2.3.21
- compileSdk 36
- targetSdk 36
- Build Tools 36.0.0

```bash
gradle :app:testDebugUnitTest :app:lintDebug :app:assembleDebug
```

L’APK de test utilise `com.tawba.app.phase1`, afin de ne pas écraser Tawba 3.5.0. La future publication conservera `com.tawba.app` et nécessitera la clé historique ou la configuration Play App Signing autorisée.
