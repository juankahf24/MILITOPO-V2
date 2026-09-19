# Tawba 4.0 — État de la phase 1

## Terminé dans le code

- architecture Android native Kotlin/Compose ;
- design system ivoire, vert profond, or, nuit et AMOLED ;
- accueil adaptatif ;
- lecture des 114 sourates et 6 236 versets ;
- recherche locale normalisée ;
- signets ;
- reprise automatique ;
- cinq polices arabes ;
- affichage de la Basmala à partir du corpus, jamais depuis une chaîne coranique codée en dur ;
- vérification complète du corpus avant activation de la lecture ;
- copie atomique et versionnée de la base SQLite ;
- gestion des erreurs avec relance et Snackbar ;
- tests unitaires et tests instrumentés.

## Validation requise avant livraison

Le livrable n’est déclaré validé qu’après succès simultané de : génération reproductible du corpus, tests unitaires, Lint sans avertissement, assemblage debug et QA, inspection de l’APK, installation sur émulateur, tests instrumentés, lancement réel, capture d’écran et contrôle Logcat.

## Hors périmètre de la phase 1

Prières, Adhan, notifications, géolocalisation, Qibla, mosquées, audio réseau, compte utilisateur et synchronisation. Aucun faux bouton actif ne prétend fournir ces fonctions.

## Limites explicites

- la clé de signature Google Play historique n’est pas fournie ;
- le build QA est destiné à l’installation et aux tests, pas à la publication ;
- un test sur téléphone physique reste distinct du test émulateur ;
- la vérification structurelle du corpus ne remplace pas une certification éditoriale islamique indépendante.
