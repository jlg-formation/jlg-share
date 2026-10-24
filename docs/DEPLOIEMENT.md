# Installer JLG Share sur le VPS OVH

## État

Configuration préparée pour un VPS Linux unique. L'installation réelle, les ports, les certificats et la diffusion WebRTC doivent être validés sur ce VPS. Docker n'était pas disponible sur le poste de développement lors de la première implémentation.

La [première exécution GitHub Actions](https://github.com/jlg-formation/jlg-share/actions/runs/40098794465) a depuis validé la construction Docker et `docker compose config --quiet` sous Linux avec des valeurs fictives, ainsi que les tests et parcours Chromium. Cette vérification ne constitue pas un déploiement sur le VPS ni un essai des flux LiveKit.

## Préparer le VPS une fois

1. Installer Linux, Docker Engine et son plugin Compose depuis leur documentation officielle. Prévoir les mises à jour du système.
2. Créer un utilisateur de déploiement SSH dédié et le répertoire `/opt/jlg-share`, dont il est propriétaire. Cet utilisateur doit pouvoir exécuter Docker ; cet accès donne de fait des privilèges élevés sur la machine.
3. Copier `deploy/production.env.example` vers `/opt/jlg-share/.env`, droits 600. Remplacer toutes les valeurs d'exemple. Conserver le hachage Argon2 entre apostrophes. Utiliser des clés LiveKit alphanumériques aléatoires, avec un secret d'au moins 32 caractères.
4. Faire pointer `share.jlg-consulting.com` et `media.jlg-consulting.com` vers le VPS. Ces deux noms ont été enregistrés et leur résolution vers le VPS a été validée le 24 octobre 2026. Si un AAAA est présent, son IPv6 doit également joindre le serveur.
5. Ouvrir TCP 80/443 pour Caddy, UDP 50000–50100 pour WebRTC, TCP 7881 pour le secours ICE/TCP, UDP 3478 pour TURN/STUN, ainsi que le port SSH d'administration. Refuser l'accès public direct à TCP 3000 et 7880, qui ne doivent être joints que par le VPS et Caddy. Vérifier aussi le pare-feu OVH.
6. Vérifier les sauvegardes/snapshots inclus chez OVH : ils ne doivent pas conserver les contenus des sessions au-delà de leur échéance. Le projet ne prévoit pas de sauvegarde indépendante des données temporaires.

La configuration utilise le réseau hôte Linux pour permettre à LiveKit d'annoncer les bonnes adresses UDP. Le serveur applicatif écoute uniquement sur 127.0.0.1. Ne pas utiliser ce fichier de production comme configuration Docker Desktop Windows.

La configuration propose TURN/UDP et ICE/TCP. Un réseau d'entreprise autorisant uniquement TLS sur 443 peut demander un relais TURN/TLS complémentaire ; ce cas n'est pas encore configuré ni validé. Tester les réseaux réels avant une formation.

## Premier déploiement manuel

Copier le dépôt sur le VPS dans un répertoire de version, puis depuis ce répertoire :

```sh
docker compose --project-name jlg-share --env-file /opt/jlg-share/.env config --quiet
docker compose --project-name jlg-share --env-file /opt/jlg-share/.env up -d --build --wait
```

`config --quiet` valide la structure sans afficher les secrets interpolés. Caddy obtient les certificats si les DNS et ports sont corrects. Les clés LiveKit sont injectées dans `LIVEKIT_CONFIG`, jamais dans un fichier versionné.

Les volumes nommés `jlg-share_app_data`, `jlg-share_caddy_data` et `jlg-share_caddy_config` sont conservés lors des mises à jour. Ne pas utiliser `down -v`, qui supprimerait ces volumes.

## Déployer depuis GitHub Actions

Le workflow `Vérifications` contrôle le code à chaque push sur `main` et à chaque pull request. Il est aussi réutilisable. Le workflow `Déployer sur le VPS`, encore déclenché manuellement depuis `main` pendant la première installation, attend la réussite des vérifications complètes et de Gitleaks avant d'accéder aux secrets de production. Il transfère la version Git précise, construit l'image sur le VPS et lance les services. L'activation du déclenchement automatique interviendra après validation de cette première installation.

La CI teste aussi l'image Docker exécutée : santé HTTP, octets du favicon et du script de thème. Des tests avec des services simulés vérifient la préservation d'une configuration existante et le retour arrière lors d'un échec de démarrage ou de contrôle HTTPS. Ils ne remplacent pas les essais sur le VPS réel.

Pour la première configuration uniquement, le workflow manuel `Initialiser la configuration du VPS` reçoit un hachage Argon2 via `INITIAL_ADMIN_PASSWORD_HASH` et une adresse de contact via `INITIAL_ACME_EMAIL`, deux secrets temporaires de l'environnement `production`. Il crée `/opt/jlg-share/.env` avec les droits 600, génère les clés LiveKit sur le VPS et refuse d'écraser un fichier existant. Les deux secrets temporaires doivent être supprimés après réussite. Les secrets de connexion SSH restent disponibles pour les déploiements suivants.

Configurer un environnement GitHub nommé `production`, avec ces secrets :

| Secret | Valeur |
| --- | --- |
| `VPS_HOST` | IPv4 ou nom DNS du VPS |
| `VPS_USER` | Utilisateur SSH dédié |
| `VPS_SSH_KEY` | Clé privée de déploiement, dont la clé publique est autorisée sur le VPS |
| `VPS_KNOWN_HOSTS` | Ligne de clé d'hôte SSH vérifiée par un canal de confiance |

Le workflow impose la vérification de la clé d'hôte. Il ne récupère pas une clé non vérifiée à chaque connexion. Le port SSH utilisé est 22 dans cette première version.

Les secrets applicatifs restent dans `/opt/jlg-share/.env` sur le serveur. Le workflow n'en affiche pas le contenu. Les archives envoyées proviennent de `git archive` et ne contiennent ni `.env`, ni fichiers de session, ni dépendances locales.

## Mises à jour et retour arrière

`deploy/release.sh` sérialise les mises à jour avec un verrou, prépare l'image avant de remplacer le service et attend son contrôle de santé. Il vérifie ensuite HTTPS sur l'application et le point d'accès LiveKit, ainsi que les octets du thème et du favicon. En cas d'échec du démarrage ou de ces contrôles, il tente de relancer la version précédemment désignée par `/opt/jlg-share/current`. Lors d'une toute première installation, aucune version précédente n'est disponible. Les volumes de données ne sont pas supprimés.

Un retour arrière du code n'annule ni les suppressions de ressources ni une migration incompatible de base. Toute future migration devra être conçue et testée avec cette procédure. Les anciens répertoires de code ne contiennent pas les ressources des sessions ; leur nettoyage pourra être organisé séparément.

## Contrôles avant une formation

- Vérifier connexion administrateur, pseudo unique, code facultatif et autorisations.
- Tester les fichiers ZIP, Word et Excel, les limites 50 Mo / 1 Go et un dépôt interrompu.
- Créer une session courte et constater la suppression de ses messages et fichiers ; vérifier le redémarrage après expiration.
- Tester l'écran avec vingt navigateurs répartis sur les réseaux attendus, et au moins un cas de relais TURN.
- Vérifier la libération du partage après arrêt, fermeture de fenêtre et perte de réseau.
- Observer mémoire, CPU, disque et débit du VPS. Le dimensionnement reste à confirmer par ces essais.

## Références

- [Docker Engine](https://docs.docker.com/engine/install/)
- [LiveKit : ports et pare-feu](https://docs.livekit.io/transport/self-hosting/ports-firewall/)
- [Caddy](https://caddyserver.com/docs/)
