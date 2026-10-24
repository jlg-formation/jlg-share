# Consignes pour travailler sur JLG Share

## Collaboration

- Communiquer en français, avec des explications simples et concrètes.
- Respecter le périmètre demandé. Une demande d'analyse ou de rédaction n'autorise pas à modifier le code applicatif.
- Avancer de manière autonome sur les tâches autorisées ; demander une précision uniquement si une ambiguïté a une conséquence importante sur le résultat.
- Avant toute modification, consulter l'état Git et préserver les changements déjà présents, même s'ils concernent les mêmes fichiers. Ne pas les annuler, les écraser ou les inclure automatiquement dans un commit.
- En fin de tâche, indiquer le résultat, les vérifications réellement exécutées et les limites restantes. Ne pas présenter une préparation comme un déploiement ou un test réussi.

## Objectif et documents de référence

JLG Share est une application auto-hébergée de partage temporaire de textes, liens et fichiers pour des formations. La simplicité d'utilisation et la rapidité de partage priment. Le partage d'écran est secondaire ; microphone, caméra et enregistrement sont hors périmètre.

Lire les documents pertinents avant d'intervenir :

- `SPECIFICATION.md` : comportement attendu, décisions retenues et propositions encore ouvertes. Ne pas traiter une proposition comme une décision validée.
- `README.md` : démarrage, commandes, architecture et limites de validation connues.
- `docs/adr/0001-livekit.md` et `docs/adr/0002-application.md` : choix techniques et leurs conséquences.
- `docs/DEPLOIEMENT.md` : exploitation et déploiement.

Si ces documents et le code divergent sur un point qui touche la tâche, signaler l'écart et le résoudre dans le périmètre autorisé. Maintenir les documents concernés lorsque le comportement ou les commandes changent. Garder ce fichier centré sur les consignes durables, sans y recopier la spécification ni un journal de tâches.

## Architecture et conventions

- Utiliser Bun et TypeScript ; la version de Bun de référence est déclarée dans `package.json` et la CI. Installer les dépendances avec `bun install --frozen-lockfile`.
- `src/server/` : serveur HTTP, WebSocket, sécurité, persistance SQLite et intégration média.
- `src/client/` : interface React, appels à l'API, styles et client média ; construction avec Vite.
- `src/shared/` : types et logique partagés, sans dépendance aux API propres au serveur ou au navigateur.
- `tests/` : tests Bun ; `e2e/` : scénarios navigateur Playwright.
- `deploy/`, `compose.yml`, `Dockerfile` et `.github/workflows/` : exploitation et automatisation.
- Conserver un seul processus applicatif : plusieurs instances exigeraient de revoir la coordination des connexions et de la diffusion.
- Garder les SDK LiveKit derrière les adaptateurs existants. Le chat et les fichiers doivent fonctionner sans configuration LiveKit.
- Suivre les conventions TypeScript et Prettier du dépôt. Privilégier des modifications ciblées et les composants existants ; éviter les dépendances et refontes sans lien avec la demande.
- Modifier les sources ; ne pas éditer manuellement `dist/`, `node_modules/` ou les résultats des tests.

## Invariants à préserver

- Contrôler les autorisations côté serveur. Le pseudo n'est jamais une preuve d'identité ; préserver les cookies HttpOnly et les contrôles d'origine HTTP et WebSocket.
- Chaque participant peut modifier ses propres messages et supprimer ses publications. Le formateur peut supprimer les publications des autres, sans modifier leurs messages à leur place.
- Ne jamais exécuter les messages comme du HTML ou du JavaScript. Conserver les restrictions sur les protocoles des liens.
- Préserver les octets des fichiers, les téléchargements contrôlés, la limite de 50 000 000 octets par fichier et le quota de 1 000 000 000 octets par session, y compris lors de dépôts simultanés.
- Ne jamais exécuter les fichiers déposés ni décompresser les ZIP. Nettoyer les dépôts incomplets et les fichiers temporaires.
- Faire respecter l'expiration par le serveur à chaque accès. Une session expirée ne peut pas être réactivée. La purge couvre SQLite, les fichiers, les dépôts temporaires et les connexions ; elle précède l'ouverture du service au redémarrage.
- Pour les échéances, distinguer durée écoulée et fin de journée civile. Utiliser le fuseau de la session, Europe/Paris par défaut, et conserver exactement l'échéance lors d'une modification sans rapport avec celle-ci. Consulter les détails dans la spécification.
- Préserver une interface française, responsive et utilisable au clavier, les thèmes clair et sombre, ainsi que des messages d'erreur compréhensibles.

## Données et secrets

- Utiliser des données fictives et des répertoires temporaires isolés pour les tests. Ne pas purger ni réinitialiser les données réelles de `data/` ou de `DATA_DIR` pour vérifier une modification.
- Ne jamais versionner ni afficher les secrets de `.env`, les mots de passe, les clés LiveKit ou les contenus des sessions. Utiliser les fichiers d'exemple pour documenter la configuration.
- Éviter de journaliser les messages, fichiers ou autres données qui doivent disparaître à l'expiration.
- Toute action sur la production, le VPS, le DNS, les secrets distants ou une publication doit être couverte par la demande de l'utilisateur. Préparer et vérifier localement ce qui peut l'être avant une éventuelle demande d'accord.

## Vérifications

Adapter les vérifications à la modification ; ne pas lancer l'application ou la suite de tests pour une simple rédaction documentaire.

Pour une modification de code, exécuter les contrôles pertinents parmi :

```sh
bun run format:check
bun run check
bun run test
bun run build
bun run test:e2e
bun run test:e2e:dev
```

- Ajouter ou adapter les tests lorsque le comportement change ou qu'un correctif doit être protégé contre une régression. Cibler les droits, l'expiration, les quotas et la persistance lorsque ces domaines sont touchés.
- Pour une modification de l'interface ou du parcours utilisateur, vérifier le rendu et l'interaction concernés sur ordinateur et mobile ; utiliser les scénarios navigateur pertinents.
- Playwright utilise Edge en local et Chromium en CI. Le scénario `test:e2e:dev` vérifie le mode avec proxy Vite. Les détails de lancement figurent dans `README.md` et `playwright.config.ts`.
- Pour une modification de déploiement, consulter les vérifications Docker et Compose du workflow CI ; ne jamais afficher la configuration résolue contenant des secrets.
- Rapporter les commandes bloquées et leur cause. Un test de vingt connexions au chat ne valide pas vingt spectateurs vidéo ; les validations LiveKit, TURN, multi-navigateurs et Linux doivent être attestées séparément.
