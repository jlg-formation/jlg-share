# JLG Share

Un espace temporaire pour partager textes, liens et fichiers pendant une formation, avec un partage d'écran optionnel. Application auto-hébergée destinée à `share.jlg-consulting.com`.

## Première version

- Accès formateur par un mot de passe administrateur ; nom affiché configurable avec « (admin) ».
- Sessions avec titre, adresse courte personnalisable (par exemple `/excel`), échéance de suppression et code d'accès facultatif.
- Pseudonymes obligatoires et uniques par session, identité retrouvée dans le même navigateur.
- Chat commun en direct, modification de ses messages et suppression de ses publications ; modération par le formateur.
- Fichiers de 50 Mo maximum, quota de 1 Go par session, téléchargements contrôlés et dépôts avec progression.
- Suppression automatique des messages, participants et fichiers à l'échéance ; modification de l'échéance possible avant expiration.
- Interface responsive, textes lisibles, actions regroupées dans un menu « ⋯ », thèmes clair et sombre mémorisés par navigateur.
- Partage d'écran avec LiveKit, sans micro, caméra ni enregistrement.

## Démarrer en local

Installer Bun **1.4.2**, puis depuis le répertoire du projet :

```sh
bun install --frozen-lockfile
```

Configurer le mot de passe dans un terminal interactif :

```sh
bun run password
```

La commande crée `.env` à partir de `.env.example` si nécessaire et y enregistre automatiquement le hachage du mot de passe, en préservant les autres réglages. Le mot de passe saisi n'est pas affiché et `.env` est exclu de Git. Pour afficher uniquement un hachage destiné à une autre installation, utiliser `bun run password --print`.

Pour le lancement local avec l'interface déjà construite, définir `APP_ORIGIN=http://localhost:3000` dans `.env`, puis :

```sh
bun run build
bun start
```

Ouvrir [http://localhost:3000](http://localhost:3000). Le chat et les fichiers fonctionnent sans LiveKit. Le bouton de partage d'écran indique son indisponibilité tant que ses paramètres ne sont pas configurés.

Pour développer avec rechargement de l'interface, lancer dans un premier terminal :

```sh
bun run dev
```

Puis, dans un second terminal, depuis le même dossier :

```sh
bun run dev:web
```

Ouvrir **http://localhost:5173/**. Les deux terminaux doivent rester ouverts. `bun run dev` fixe automatiquement l'origine de développement sur cette adresse, indépendamment de la valeur de production dans `.env`. L'alias **http://127.0.0.1:5173/** est également accepté en développement. Vite refuse de changer silencieusement de port si 5173 est déjà occupé.

## Vérifications

```sh
bun run format:check
bun run check
bun run test
bun run build
bun run test:e2e
bun run test:e2e:dev
```

Les tests navigateur utilisent Edge installé sur Windows. En CI, Chromium est installé par le workflow. Les données des tests sont créées dans des répertoires temporaires séparés. `test-results/` contient les captures des essais et n'est pas versionné.

Les tests couvrent les accès, l'unicité des pseudos, les droits, la conservation des octets des fichiers, les quotas, la persistance, l'effacement des textes dans SQLite, les permissions média et vingt connexions WebSocket réelles. Le scénario navigateur utilise deux participants, un doublon de pseudo, un dépôt/téléchargement, une modification et un affichage mobile.

## Architecture

- Bun et TypeScript : serveur HTTP, WebSocket et SQLite natifs.
- React et Vite : interface construite puis servie par Bun en production.
- SQLite et fichiers locaux dans `DATA_DIR` : aucune donnée de session dans le dépôt.
- LiveKit : serveur média séparé, SDK isolés dans `src/server/livekit.ts` et `src/client/media.ts`.
- Docker Compose et Caddy : installation Linux et HTTPS.

Le serveur applicatif fonctionne en **un seul processus**. Plusieurs instances nécessiteraient une coordination différente des connexions et de la diffusion. Les identifiants du navigateur sont stockés dans un cookie HttpOnly ; les droits ne dépendent jamais du pseudo.

Voir la [spécification](SPECIFICATION.md), l'[ADR LiveKit](docs/adr/0001-livekit.md), l'[ADR applicatif](docs/adr/0002-application.md) et le [guide de déploiement](docs/DEPLOIEMENT.md).

## Limites de validation actuelles

Le partage d'écran est intégré mais sa transmission réelle, TURN et la charge de vingt spectateurs doivent encore être validés sur un environnement LiveKit et les réseaux de formation. Le test des vingt connexions concerne le **chat**, pas vingt flux vidéo. Les essais navigateur locaux ont été réalisés sur Edge ; Firefox, Chrome, Brave et Safari restent à vérifier séparément.

Les fichiers Docker et workflows sont préparés ; la construction Docker et l'installation Linux restent à exécuter sur un hôte équipé. Aucun VPS, DNS ou dépôt distant n'a été modifié pendant cette implémentation.

Les échéances sont vérifiées par le serveur à chaque accès et la purge est programmée. Un VPS arrêté ne peut pas effacer ses fichiers pendant son arrêt ; les données expirées sont purgées au redémarrage avant d'ouvrir le service. Les copies déjà téléchargées par les participants ne peuvent pas être effacées à distance. Les sauvegardes OVH doivent être configurées pour respecter la suppression.

Un délai de libération média pouvant atteindre environ 40 secondes protège contre le chevauchement d'autorisations de diffusion après un arrêt ou une déconnexion. Il ne concerne pas le chat ni les fichiers.

## Publication et licence

Le projet est destiné à un dépôt GitHub public. Le compte, le dépôt distant et la licence doivent être définis avant publication. Aucune licence de réutilisation du code applicatif n'est encore accordée dans cette première version. Les composants tiers conservent leurs propres licences.
