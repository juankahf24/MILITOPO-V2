# Tawba 4.0 — Phase 1 propre

Application Android native Kotlin/Jetpack Compose consacrée au socle Coran hors connexion.

## Périmètre effectivement livré

- écran d’accueil premium et adaptatif ;
- 114 sourates et 6 236 versets embarqués ;
- navigation par sourate, verset, page et juz via les métadonnées locales ;
- recherche arabe normalisée sans altérer le texte affiché ;
- signets et reprise automatique de lecture ;
- cinq polices arabes embarquées avec leurs licences ;
- thèmes ivoire, nuit et AMOLED ;
- validation du corpus au démarrage ;
- fonctionnement hors connexion, sans permission réseau, localisation ou notification.

## Socle technique

- Android Gradle Plugin 9.3.1 ;
- Kotlin 2.4.10 et Java 17 ;
- compileSdk/targetSdk 36 ;
- Jetpack Compose BOM 2025.12.00 ;
- DataStore Preferences avec traitement de corruption ;
- SQLite embarqué, en lecture seule, copié atomiquement et contrôlé avant ouverture ;
- build `qa` optimisé par R8 et signé avec la clé de débogage uniquement pour installation de validation.

## Commandes

```bash
gradle :app:testDebugUnitTest :app:lintDebug :app:assembleDebug :app:assembleQa
gradle :app:connectedDebugAndroidTest
```

La signature de production historique n’est pas incluse. Le package installable de validation est `com.tawba.app.phase1` afin de ne pas remplacer une éventuelle version publiée.
