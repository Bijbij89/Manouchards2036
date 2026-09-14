# Grilles Jazz — version PWA (autonome, hors-ligne)

## Ta clé Gemini (une seule fois)

Ouvre `app.js`, tout en haut, et remplace `COLLE_TA_CLE_ICI` par ta clé
gratuite (https://aistudio.google.com/apikey). Elle est utilisée directement
depuis le navigateur — voir l'avertissement en commentaire dans le fichier
sur ce que ça implique si tu partages l'appli.

## Récupérer tes 80 grilles existantes

Si tu as encore le dossier `grilles-jazz/` (projet Reflex) à côté de ce
dossier `grilles-jazz-pwa/` :
```
python export_bundle.py
```

## Pourquoi un serveur pour tester, alors que le but est de ne pas en avoir besoin ?

Ce sont deux choses différentes :

- **Pendant qu'on développe, sur ton PC** : les navigateurs bloquent le
  fonctionnement hors-ligne (et parfois le chargement des données) pour un
  fichier ouvert directement (double-clic). Il faut donc un petit serveur
  **juste pour toi, juste maintenant, le temps des tests** :
  ```
  cd grilles-jazz-pwa
  python -m http.server 8000
  ```
  puis `http://localhost:8000`. C'est une commande de confort pour toi en
  tant que développeur, pas quelque chose que l'utilisateur final verra un
  jour.

- **Sur ton téléphone, une fois installé** : aucun serveur, jamais. Le
  navigateur garde tout en cache après la première visite. Ni ton PC, ni le
  mien, ni personne d'autre n'est impliqué à partir de ce moment-là.

Pour que le téléphone puisse faire cette "première visite" sans être
physiquement connecté à ton PC (utile pour toi en jam, et indispensable pour
que des amis puissent installer l'appli), il faut que ces fichiers soient
accessibles une fois via une adresse `https://` — d'où GitHub Pages
ci-dessous. Ce n'est pas un serveur qui doit rester allumé : une fois les
fichiers déposés, GitHub les sert en permanence, gratuitement, sans aucune
action de ta part.

## Installer sur téléphone/tablette (PC éteint ensuite)

1. Crée un compte GitHub (gratuit) si besoin.
2. Crée un dépôt, ex. `grilles-jazz`.
3. "Add file" → "Upload files", glisse tous les fichiers de ce dossier.
4. "Settings" → "Pages" → branche `main`, dossier racine → Save. Tu obtiens
   une adresse `https://tonpseudo.github.io/grilles-jazz/`.
5. Ouvre cette adresse une fois sur ton téléphone (avec internet), puis
   menu du navigateur → "Ajouter à l'écran d'accueil".
6. À partir de là : PC éteint, pas de réseau, tout fonctionne.

Pour mettre à jour : re-uploader les fichiers modifiés sur GitHub, rouvrir
l'appli une fois avec du réseau.

## Partager avec des amis

Donne-leur ton adresse GitHub Pages. Ils installent, ta bibliothèque de
départ est là, tout ce qu'ils ajoutent ensuite reste stocké uniquement sur
leur appareil. Menu ⋮ → Importer/Exporter pour échanger des grilles
ponctuellement dans un sens ou l'autre.

## Après chaque mise à jour des fichiers

Ouvre `service-worker.js` et incrémente le numéro dans `CACHE_NAME` (ex:
`grilles-jazz-v3` → `grilles-jazz-v4`), à chaque fois que tu uploades une
nouvelle version sur GitHub. C'est ce qui permet au navigateur de détecter
qu'il y a une mise à jour — sans ce changement, il continue de servir
l'ancienne version en cache indéfiniment, même après un simple F5. L'appli
se recharge maintenant automatiquement dès qu'elle détecte la mise à jour,
donc plus besoin de faire Ctrl+F5 à la main — mais l'étape "changer le
numéro" doit être faite par toi avant de pousser sur GitHub.

## À savoir

Code non testé dans un vrai navigateur avant envoi — les parties les plus
susceptibles de nécessiter un ajustement : le positionnement du texte en
diagonale, et le format de réponse de l'API Gemini (nom du modèle dans
`app.js`, variable `GEMINI_MODEL`, à vérifier sur aistudio.google.com si
besoin).
