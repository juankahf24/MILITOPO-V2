# État de validation — Tawba 4.0 Phase 1

## Implémenté

- Architecture Kotlin et Jetpack Compose avec flux d’état et dépôts séparés.
- Corpus SQLite local copié atomiquement et lisible hors connexion.
- Contrôle structurel : 114 sourates, 6 236 versets, 604 pages et 30 juz.
- Liste des sourates, lecteur RTL, informations page et juz.
- Recherche locale avec index normalisé distinct du texte affiché.
- Comptage des occurrences, versets et sourates trouvés.
- Signets et reprise de lecture avec DataStore.
- Cinq polices arabes embarquées avec licences OFL.
- Thèmes Ivoire, Nuit et AMOLED.
- Navigation Compose, transitions, composants adaptatifs et accessibilité de base.
- Variante de test isolée `com.tawba.app.phase1`.

## Validation automatisée

- Vérification CRC de l’archive source.
- Génération reproductible et contrôle SQLite du corpus.
- Tests unitaires.
- Android Lint avec rapports HTML et SARIF conservés.
- Compilation APK sous API 36.
- Inspection du package, du versionCode, des assets et de la signature APK.
- Test instrumenté sur émulateur Android : accueil visible et ouverture réelle de l’écran Coran.
- Installation propre, lancement mesuré, capture écran et contrôle Logcat sans crash fatal.

## Explicitement non implémenté dans cette phase

- Horaires de prière, notifications, Adhan, Qibla, mosquées et carte.
- Récitations, traductions, tafsir, compte utilisateur et synchronisation cloud.

## Non vérifié ou non livrable en phase 1

- Tests sur plusieurs téléphones physiques.
- Validation TalkBack exhaustive.
- Comparaison visuelle sur petits écrans, tablettes, pliables et paysage.
- Certification religieuse mot à mot par une autorité ou une édition canonique externe.
- Signature historique de production et mise à jour directe de Tawba 3.5.0.
