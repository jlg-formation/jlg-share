# JLG Share — Spécification initiale

Version : 0.10 — 24 octobre 2026
Statut : document de travail, fondé sur les échanges avec le formateur.

Ce document distingue les décisions déjà retenues des propositions de conception. Les propositions et les questions ouvertes pourront évoluer avant ou pendant le développement.

## 1. Besoin et objectif

JLG Share permet à un formateur et à ses stagiaires de partager des ressources pendant une formation : bouts de texte, liens, fichiers ZIP et, plus occasionnellement, documents Word ou Excel.

La priorité est de partager très rapidement des messages de chat, des liens et des fichiers avec une solution contrôlée par le formateur. Tous les participants peuvent publier dans un espace commun. Les messages et fichiers sont visibles par tous les participants de la session ; il n'y a pas de messages privés. Le formateur conserve les droits de gestion de la session.

Le partage d'écran en direct reste une fonction secondaire. Le groupe comporte habituellement au maximum vingt spectateurs, auxquels s'ajoute le formateur. Le microphone, la caméra et la visioconférence sont explicitement exclus du périmètre : les outils existants tels que Teams ou Google Meet peuvent couvrir ces besoins.

L'usage principal concerne les formations en présentiel. Pour les formations à distance, Microsoft Teams reste l'outil de formation et de partage d'écran. JLG Share peut alors être utilisé ponctuellement, uniquement pour partager rapidement des fichiers.

L'objectif est une application simple, accessible dans un navigateur, dont le code, les données et l'exploitation restent sous le contrôle du formateur.

## 2. Décisions retenues

| Sujet | Décision |
| --- | --- |
| Hébergement | VPS administré par le propriétaire de l'application |
| Fournisseur envisagé | OVHcloud |
| Adresse | `share.jlg-consulting.com` — sous-domaine validé |
| Nom public | JLG Share |
| Publications | Chat et fichiers communs à tous les participants de la session ; gestion réservée au formateur |
| Accès | Lien de session, avec code ou mot de passe facultatif |
| Expiration obligatoire | Date de suppression choisie par le formateur à la création de la session, via un calendrier avec sélection de l'heure |
| Taille maximale des fichiers | 50 Mo par fichier, tous formats confondus |
| Identité affichée | Prénom, initiales ou pseudonyme obligatoire, associé à chaque message et fichier |
| Gestion des publications | Chacun modifie ou supprime ses propres messages ; le formateur peut supprimer toute publication |
| Quota de session | 1 Go de fichiers au total, tous participants confondus |
| Navigateurs et affichage | Navigateurs courants, dont Chrome, Edge, Firefox et Brave ; interface responsive |
| Code et déploiement | Dépôt GitHub public et GitHub Action pour automatiser au maximum le déploiement sur le VPS |
| Sauvegarde indépendante | Pas de sauvegarde indépendante du VPS demandée |
| Priorité principale | Partage très rapide de messages de chat, textes, liens et fichiers |
| Contexte principal | Formations en présentiel |
| Usage éventuel à distance | Partage rapide de fichiers ; formation et partage d'écran assurés par Microsoft Teams |
| Écran | Fonction secondaire : WebRTC, avec redistribution du flux par le VPS |
| Audience de référence | Un formateur et jusqu'à vingt spectateurs simultanés |
| Audio et caméra | Explicitement hors périmètre ; recours aux outils de réunion existants si nécessaire |
| Enregistrement d'écran | Inutile pour le besoin exprimé ; non prévu |
| Réutilisation | Privilégier des composants existants plutôt que réécrire les fonctions techniques courantes |
| Coûts | Paiement d'un VPS accepté ; éviter les abonnements applicatifs et PaaS payants |

Le budget d'environ 55 € TTC par an pour le VPS OVH est validé. Le tarif final et les conditions seront vérifiés à la commande. Aucune commande n'est engagée par ce document.

## 3. Périmètre proposé pour la première version

### 3.1. Session de formation

Une session regroupe les ressources destinées à un groupe. Le formateur crée une session et communique son lien aux stagiaires.

Propositions :

- À la création, le formateur renseigne un titre, une date et une heure de suppression, et éventuellement un code d'accès. Le lien de session est généré automatiquement.
- Les stagiaires accèdent à la session sans créer de compte.
- Chaque stagiaire renseigne obligatoirement un nom affiché non vide : prénom, initiales ou pseudonyme libre. Il ne s'agit pas d'une identité vérifiée. L'auteur est affiché sur chaque message, lien et fichier publié, y compris pour le formateur.
- Deux participants ne peuvent pas avoir le même pseudonyme dans une même session, y compris celui du formateur. Cette unicité est contrôlée côté serveur, même lors d'arrivées simultanées. Proposition technique : comparer les noms après suppression des espaces de début et fin et sans distinguer majuscules et minuscules. Le pseudonyme reste réservé à son participant jusqu'à expiration de la session, même pendant son absence.
- Les droits de propriété des publications reposent sur une identité technique de participant attribuée par le serveur, jamais sur le seul pseudonyme. Dans le même navigateur, le participant retrouve son pseudo et ses droits après rechargement ou fermeture, tant que son justificatif local est conservé et que la session n'a pas expiré. Avec un autre navigateur ou appareil, ou après suppression de ce justificatif, il est un nouveau participant et doit choisir un pseudo disponible ; aucun transfert automatique des droits n'est prévu.
- Le nom affiché du formateur est configurable et suivi de la mention « (admin) ». Cette mention est ajoutée par l'application à partir des droits vérifiés côté serveur ; un pseudo choisi par un stagiaire ne lui confère pas ce statut.
- Le formateur dispose d'un accès d'administration distinct, protégé par un unique mot de passe administrateur. Aucun identifiant à saisir, inscription, compte stagiaire ou système de comptes multiples n'est requis. Ce mot de passe donne accès à la création et à la gestion des sessions ; il est distinct du code ou mot de passe facultatif de chaque session.
- Les ressources déjà publiées restent visibles à un stagiaire qui rejoint la session plus tard.
- Une session peut être fermée aux participants sans être immédiatement supprimée.
- Le formateur peut supprimer la session et ses ressources.

À la création de chaque session, le formateur renseigne obligatoirement la date à laquelle toutes les informations de session seront effacées. Un calendrier et un sélecteur d'heure permettent de choisir une échéance précise. La date et l'heure sont validées comme champs de création ; le fuseau affiché par défaut proposé est Europe/Paris. Le formulaire indique clairement le fuseau et récapitule le moment de suppression avant création. Le serveur refuse une échéance absente, invalide ou déjà passée et conserve l'instant correspondant en UTC.

Cette décision remplace toutes les règles précédentes fondées sur la présence, la fermeture du navigateur et le calcul de 24 heures après le départ. Aucune limite automatique de 24 heures ne s'ajoute à la date choisie. Fermer le navigateur, revenir dans la session, une coupure réseau ou l'activité des stagiaires ne modifient pas l'échéance. La présence du formateur n'est pas utilisée pour calculer la conservation des ressources.

À l'échéance, tous les messages, fichiers échangés et données de participants propres à cette session sont supprimés du stockage applicatif, pas simplement masqués ou archivés. La session n'est plus accessible, y compris par ses anciens liens de téléchargement. L'échéance est persistée et visible dans la session. Le formateur peut avancer ou repousser cette échéance tant que la session n'a pas expiré, en choisissant une nouvelle date future. Une session expirée ne peut pas être réactivée. Le serveur contrôle cette règle au moment de la modification et répercute la nouvelle échéance chez les participants.

Le contrôle d'expiration s'applique côté serveur à chaque accès et publication. Une purge automatique supprime les messages, métadonnées, fichiers et dépôts temporaires associés et ferme les connexions de session à l'échéance. Aucun accès ou dépôt en cours ne doit contourner l'expiration. Les données ne sont pas copiées dans les journaux, les caches persistants ou une archive. La suppression doit aussi couvrir les pages SQLite libérées et les journaux transactionnels, afin de ne pas laisser le texte des chats dans des fichiers applicatifs résiduels.

Une panne du VPS empêche de garantir une suppression physique à l'heure prévue : l'échéance ne change pas, et au redémarrage les données expirées sont purgées avant de rouvrir le service. Il s'agit d'une limite d'exploitation à prendre en compte, pas d'une option de prolongation. Le nombre de sessions ouvertes simultanément reste à préciser.

Une seule session peut couvrir une formation sur plusieurs jours : le formateur choisit une échéance après la formation. Les fermetures du navigateur entre deux journées ou pendant un week-end ne déclenchent aucune suppression anticipée.

L'accès se fait par un lien dont le nom n'a pas besoin d'être difficile à deviner. Le formateur peut ajouter un code d'accès ou un mot de passe. Sans cette protection, toute personne disposant du lien ou le découvrant peut rejoindre la session. Les contenus sont communs aux participants, mais ne sont pas publiés dans un catalogue public ni destinés à l'indexation par les moteurs de recherche ; l'absence d'indexation ne constitue pas un contrôle d'accès.

### 3.2. Partage de textes

- Chaque participant, formateur ou stagiaire, saisit ou colle un texte, puis le publie dans le chat commun.
- Les stagiaires voient le texte et disposent d'un bouton pour le copier.
- Les retours à la ligne sont conservés.
- Les extraits techniques doivent rester lisibles et copiables sans altération.
- Chaque participant peut modifier ou supprimer ses propres messages et supprimer ses propres fichiers. Le formateur peut supprimer tout message ou fichier de la session, quel qu'en soit l'auteur. Il ne modifie pas les messages des autres à leur place.
- Les modifications et suppressions sont répercutées chez tous les participants ; leurs autorisations sont contrôlées côté serveur.

Un texte publié ne doit jamais être exécuté comme du HTML ou du JavaScript.

### 3.3. Partage de liens

- Chaque participant peut publier une adresse web, accompagnée éventuellement d'un intitulé.
- Les stagiaires peuvent ouvrir ou copier le lien.
- Les adresses acceptées sont limitées aux protocoles web autorisés, initialement HTTP et HTTPS.

Les aperçus automatiques de sites ne sont pas nécessaires pour la première version.

### 3.4. Partage de fichiers

- Chaque participant peut sélectionner ou déposer un fichier dans l'interface ; les fichiers sont visibles et téléchargeables par tous les participants de la session.
- L'interface indique la progression du dépôt et signale son résultat.
- Après dépôt réussi, les stagiaires voient le nom et la taille du fichier, puis peuvent le télécharger.
- Les octets du fichier téléchargé doivent être identiques à ceux du fichier déposé.
- Les ZIP, documents Word et classeurs Excel sont pris en charge comme fichiers téléchargeables.
- Aucune édition bureautique dans le navigateur n'est prévue.
- Les fichiers sont stockés sur le VPS, hors du dépôt de code.
- La taille maximale d'un fichier est de 50 Mo, quel que soit son format, notamment ZIP, Word et Excel. Le quota total de fichiers d'une session est de 1 Go, partagé par tous les participants. Convention proposée : Mo et Go décimaux (50 000 000 et 1 000 000 000 octets).
- Le serveur contrôle les limites, y compris lors de dépôts simultanés. Un dépassement est refusé avec un message clair ; un dépôt refusé ou abandonné ne consomme pas durablement le quota.

Le serveur ne décompresse pas les ZIP et n'exécute pas les fichiers déposés. Un dépôt incomplet ne doit pas apparaître comme une ressource disponible. Les fichiers temporaires abandonnés doivent être nettoyés.

### 3.5. Mise à jour des ressources

- Les nouvelles publications apparaissent chez les stagiaires sans rechargement manuel de la page.
- Après une coupure de connexion, la page récupère l'état actuel de la session, y compris les ajouts, corrections et suppressions.
- Les textes et fichiers restent accessibles si le formateur ferme son navigateur, tant que la session reste ouverte et conservée.

### 3.6. Partage d'écran

- Le partage d'écran cible les formations en présentiel, afin que les stagiaires puissent regarder l'écran du formateur dans leur navigateur.
- Seul le formateur est autorisé à diffuser dans la première version.
- Un seul partage d'écran peut être actif à la fois sur tout le VPS, toutes sessions et tous onglets confondus. Le serveur réserve cette capacité de façon atomique et refuse une deuxième diffusion avec une indication claire. La réservation est libérée après arrêt ou perte confirmée du diffuseur.
- Il lance et arrête volontairement le partage depuis l'application.
- Le navigateur lui propose de choisir un écran, une fenêtre ou un onglet, selon ses capacités.
- Le flux est envoyé au VPS, qui le redistribue aux spectateurs par WebRTC.
- Aucun accès au microphone ou à la caméra n'est demandé par l'application.
- Aucun flux audio n'est publié, y compris le son d'un onglet.
- Aucune fonction d'enregistrement n'est installée ou activée.
- L'arrivée d'un spectateur pendant une diffusion lui permet de rejoindre le flux en cours.
- L'interface distingue l'absence de diffusion, la connexion en cours et un échec de réception.
- L'arrêt du partage depuis le navigateur est répercuté dans l'application.
- Un mode plein écran est proposé aux spectateurs si le navigateur le permet.

La priorité est la lisibilité des textes, du code et des tableaux. La fréquence d'images peut être réduite pour préserver cette lisibilité et limiter le débit. La diffusion de films ou de jeux à haute fréquence n'est pas une cible de la première version.

## 4. Parcours proposés

### Formateur

1. S'authentifier dans l'administration.
2. Créer une session en indiquant sa date et son heure de suppression, ou rouvrir une session existante non expirée.
3. Copier son lien d'accès et le communiquer aux stagiaires.
4. Publier des textes, liens et fichiers au cours de la formation.
5. Activer ponctuellement le partage d'écran.
6. Arrêter la diffusion, puis fermer ou conserver la session selon le besoin.

### Stagiaire

1. Ouvrir le lien reçu et, si nécessaire, saisir le code d'accès de la session.
2. Consulter les ressources déjà publiées et les nouveaux ajouts.
3. Copier les textes, ouvrir les liens et télécharger les fichiers.
4. Regarder l'écran du formateur lorsqu'une diffusion est active.

Les stagiaires peuvent également publier des textes, liens et fichiers dans l'espace commun sous leur nom affiché obligatoire. Les droits de publication sont les mêmes pour le formateur et les stagiaires ; chacun modifie ou supprime ses propres messages. Le formateur garde les droits de gestion et de suppression de toute publication. Le participant retrouve son identité et ses droits dans le même navigateur tant que le justificatif local est conservé. Il peut supprimer ses propres fichiers.

## 5. Architecture envisagée

```text
Navigateur du formateur
  | HTTPS : textes, liens, fichiers et administration
  | WebRTC : écran en direct
  v
VPS OVHcloud
  - Entrée HTTPS et certificats
  - Application et contrôle des accès
  - Base de données des sessions et publications
  - Stockage local des fichiers
  - Serveur WebRTC de redistribution (SFU)
  - Relais TURN pour les réseaux qui en ont besoin
  |
  v
Navigateurs des stagiaires
```

Le SFU redistribue la vidéo sans enregistrement et sans transcodage prévu. Un relais TURN est distinct de cette fonction : il permet de transporter les connexions WebRTC lorsque les réseaux empêchent le chemin habituel.

### Composants retenus et propositions

| Fonction | Proposition |
| --- | --- |
| Serveur WebRTC et SDK navigateur | LiveKit auto-hébergé — décision acceptée, voir [ADR-0001](docs/adr/0001-livekit.md) |
| Base de données applicative | SQLite pour le déploiement sur un seul VPS |
| Stockage des fichiers | Répertoire persistant sur le VPS |
| HTTPS | Caddy ou équivalent avec renouvellement automatique des certificats |
| Installation | Services conteneurisés décrits par Docker Compose |
| Exécution du serveur applicatif | Bun, choisi à la place de Node.js |
| Interface et langage applicatif | React et TypeScript proposés, à confirmer |

Bun est retenu pour exécuter le serveur applicatif. Les scripts de développement, vérification, construction et déploiement seront adaptés à Bun, avec une version fixée et un fichier de verrouillage des dépendances suivi dans Git. Le serveur LiveKit reste un service indépendant ; ce choix ne change pas son fonctionnement. La compatibilité des dépendances retenues avec Bun sera vérifiée lors de leur intégration.

Le code et la procédure d'installation seront conservés dans un dépôt GitHub public. Une GitHub Action automatisera au maximum la vérification, la construction et le déploiement sur le VPS. Les données des sessions, fichiers et secrets sont exclus du dépôt et des journaux de déploiement. Les identifiants de déploiement sont conservés dans les secrets GitHub ; la connexion au VPS vérifie son identité et utilise des droits limités. GitHub Pages n'est pas nécessaire à cette architecture.

L'intégration LiveKit est isolée derrière un adaptateur côté navigateur et un adaptateur côté serveur. Les sessions, participants, droits applicatifs, messages et fichiers ne dépendent pas du modèle LiveKit. Aucun type ni jeton LiveKit ne doit devenir une donnée métier persistante. Le déploiement permet d'ajouter ou remplacer le service média séparément. Le remplacement demandera un nouvel adaptateur et des essais, mais ne doit pas imposer une réécriture du chat et du stockage. Voir l'ADR pour les limites de cette séparation.

Le déploiement de production ne doit dépendre d'aucun abonnement à LiveKit Cloud ni à un service applicatif payant. Les licences des composants retenus seront vérifiées avant leur intégration.

## 6. Accès et protection des données

- Le mot de passe administrateur est vérifié côté serveur, stocké sous forme de hachage adapté aux mots de passe et exclu du dépôt public. Les tentatives de connexion sont limitées ; une session administrateur sécurisée et une déconnexion sont prévues. Le formateur est authentifié pour toute opération d'administration. Tous les participants admis dans une session peuvent publier des messages et fichiers.
- Les droits sont vérifiés par le serveur, pour les ressources comme pour la vidéo.
- Un accès participant ne donne pas les droits de gestion du formateur ni le droit de diffuser un écran.
- Les liens de session peuvent être simples. Lorsqu'un code ou mot de passe est activé, le serveur le vérifie avant de donner accès aux messages, fichiers et connexions de session. Les tentatives sont limitées et le secret n'est pas stocké en clair.
- Les fichiers ne sont pas exposés dans un répertoire public contournant le contrôle d'accès.
- Les secrets restent sur le serveur et ne sont jamais inclus dans le code envoyé au navigateur.
- Les connexions web utilisent HTTPS ; les flux WebRTC utilisent leur chiffrement de transport.
- Le relais TURN doit être protégé contre l'utilisation par des tiers non autorisés.
- Les journaux techniques évitent les textes partagés, les secrets et les liens donnant accès aux sessions.
- La suppression d'une ressource retire l'accès et déclenche la suppression du fichier associé s'il n'est plus utilisé.

La redistribution par un serveur auto-hébergé ne constitue pas à elle seule une garantie de chiffrement de bout en bout. Ce besoin éventuel reste à préciser.

Un fichier téléchargé ou un écran visible peut être copié par un participant. La fermeture ou la suppression d'une session ne retire pas ces copies. La suppression vise les données contrôlées par JLG Share ; elle ne constitue pas un effacement forensique du support physique de l'hébergeur. Les sauvegardes et snapshots ne doivent pas conserver les contenus des sessions au-delà de l'échéance : vérifier et adapter les sauvegardes OVH, y compris celles incluses dans l'offre, avant mise en production. Aucune restauration ne doit réintroduire une session expirée.

## 7. Hébergement, exploitation et capacité

- Cible initiale : un VPS Linux OVHcloud situé en France, avec stockage persistant.
- Configuration candidate : 2 cœurs virtuels, 4 Go de RAM et 40 Go de disque ; à valider par les essais.
- Adresse retenue : `share.jlg-consulting.com`.
- Un nom DNS supplémentaire pour la partie WebRTC peut être nécessaire selon le déploiement retenu.
- Les ports HTTPS et WebRTC/TURN nécessaires seront documentés et ouverts explicitement.
- Les volumes applicatifs sont conservés lors d'une mise à jour ou d'un redémarrage des services.
- Aucune sauvegarde indépendante du VPS n'est exigée. La perte du VPS peut donc entraîner la perte des ressources temporaires. Le dépôt public et la configuration de déploiement permettent de réinstaller l'application, sans restaurer les données des sessions.
- L'espace disque, l'état des services et l'expiration des certificats sont surveillés.
- Les versions déployées sont identifiées ; la mise à jour et le retour à une version précédente sont documentés.

Exemple de dimensionnement réseau, et non débit garanti : un flux de 2 Mbit/s redistribué à vingt spectateurs représente environ 40 Mbit/s en sortie du VPS, hors surcoûts réseau. Le débit réel varie avec le contenu et les paramètres vidéo.

Les offres VPS OVHcloud consultées annoncent du trafic illimité en France et un débit de 500 Mbit/s pour l'entrée de gamme examinée. Le tarif, la localisation, les conditions d'engagement et les conditions de trafic seront revérifiés avant commande. Ces annonces ne remplacent pas une validation des performances réelles.

## 8. Critères de validation de la première version

1. Une session est accessible par son lien, sans compte stagiaire selon le mode proposé.
2. Les participants peuvent publier textes, liens et fichiers et voir les publications de tous ; ils ne peuvent pas administrer la session ni diffuser l'écran. Une session protégée refuse tout accès sans code ou mot de passe valide.
3. Un texte multiligne est publié et copié sans altération.
4. Un lien web est consultable et copiable ; une adresse exécutable telle que `javascript:` est refusée.
5. Un ZIP et des fichiers Word/Excel sont déposés puis téléchargés avec un contenu identique.
6. Un stagiaire arrivé tardivement retrouve les ressources précédentes.
7. Les publications et fichiers survivent au redémarrage de l'application.
8. Une coupure suivie d'une reconnexion rétablit l'état actuel des ressources.
9. Un formateur partage son écran avec vingt navigateurs spectateurs simultanés, sans publication de micro, caméra ou audio d'onglet.
10. Le partage est testé avec un contenu représentatif : texte, code, tableur et défilement. La lisibilité, la stabilité et le délai sont observés ; les seuils d'acceptation seront définis avant cet essai.
11. La réception vidéo est essayée sur plusieurs réseaux, dont un cas nécessitant TURN, et pas seulement sur vingt onglets d'un même ordinateur.
12. L'arrêt de la diffusion, la fermeture de session et la suppression des ressources produisent les effets attendus sur les connexions et les nouveaux accès.
13. L'application peut être installée sur un environnement vierge depuis le dépôt et la procédure de déploiement ; aucune restauration des données temporaires n'est requise.
14. Les fichiers de plus de 50 Mo, quel que soit leur format, et les dépôts dépassant 1 Go par session sont refusés, y compris en cas de dépôts concurrents.
15. La création impose une échéance future valide choisie via calendrier et heure, avec fuseau explicite. À cette échéance, les chats, fichiers et données de session sont supprimés, les connexions sont fermées et les URL directes sont inutilisables. La fermeture du navigateur et les reconnexions ne changent pas cette date. Tester les changements de fuseau et d'heure saisonnière, les accès et dépôts à l'échéance et le redémarrage serveur ; en cas de redémarrage après échéance, purger avant de servir les utilisateurs. Vérifier l'absence de contenu résiduel dans les journaux et stockages applicatifs.
16. L'interface est utilisable sur ordinateur et mobile, et vérifiée sur Chrome, Edge, Firefox et Brave récents. La matrice précise des versions et systèmes reste à établir.
17. La GitHub Action déploie une version identifiée sans exposer de secret et sans effacer les données des sessions encore valides.
18. Un nom affiché non vide est obligatoire avant de participer. Chaque message et fichier affiche son auteur. Un pseudonyme déjà réservé dans la session est refusé, y compris lors de requêtes concurrentes. Un participant retrouve ses droits dans le même navigateur, mais un nouveau navigateur ne peut pas reprendre les publications au seul moyen du pseudo. Chacun peut modifier ou supprimer ses propres messages et supprimer ses fichiers ; le formateur peut supprimer toute publication. Son nom configurable porte la mention « (admin) ».

19. Le formateur peut modifier l'échéance avant expiration ; une modification arrivée après expiration est refusée et ne réactive pas la session.
20. Deux demandes simultanées de partage d'écran ne peuvent pas créer deux diffusions sur le VPS, même dans des sessions différentes. L'arrêt ou la perte du diffuseur libère la capacité.

## 9. Hors périmètre initial proposé

- Microphone, caméra et visioconférence, y compris une diffusion audio ou caméra limitée au formateur.
- Enregistrement ou rediffusion de l'écran.
- Contrôle à distance de l'ordinateur du formateur.
- Édition collaborative de documents bureautiques.
- Messages privés entre participants ; tous les échanges sont communs à la session.
- Gestion de plusieurs formateurs et facturation d'un service commercial.
- Application native à installer sur les postes.

## 10. Questions encore ouvertes

Les numéros sont conservés pour faciliter le suivi de la discussion. Les points résolus sont signalés explicitement.

1. Résolu : nom public JLG Share, sous-domaine `share.jlg-consulting.com`.
2. Point résolu : usage principal en présentiel ; à distance, usage éventuel limité au partage rapide de fichiers, en complément de Microsoft Teams.
3. Résolu : titre, date et heure de suppression obligatoires à la création, code facultatif et lien généré automatiquement. Le formateur peut modifier l'échéance avant expiration. Reste la configuration OVH excluant la conservation de contenus expirés dans les sauvegardes ou snapshots.
4. Limites validées : 50 Mo par fichier pour tous les formats et 1 Go de fichiers au total par session. Reste le quota global du serveur.
5. Résolu : accès par lien simple, avec mot de passe ou code facultatif.
6. Résolu : pseudo obligatoire et unique dans chaque session, auteur affiché sur messages et fichiers, identité et droits retrouvés dans le même navigateur ; autre navigateur ou appareil = nouveau participant. Chacun modifie ou supprime ses messages et supprime ses fichiers. Le formateur peut supprimer toute publication ; son nom est configurable et suivi de « (admin) ».
7. Un seul partage d'écran simultané sur le VPS est validé. Le nombre de sessions ouvertes ou conservées simultanément reste à préciser.
8. Exigence validée : navigateurs courants dont Chrome, Edge, Firefox, Brave, et interface responsive. La matrice précise des versions et systèmes, notamment Safari et les appareils mobiles, reste à établir.
9. Résolu : budget d'environ 55 € TTC par an validé pour le VPS OVH.
10. Résolu : pas de sauvegarde indépendante du VPS exigée ; dépôt GitHub public et GitHub Action pour automatiser au maximum le déploiement. Le compte GitHub, le nom du dépôt et la licence du projet restent à définir.

## 11. Étapes proposées

1. Préciser les questions qui influencent directement les accès, le stockage et l'interface.
2. Choisir les composants et dessiner les deux vues : formateur et stagiaire.
3. Construire le partage de ressources et la gestion des sessions.
4. Intégrer le partage d'écran WebRTC avec redistribution sur le VPS.
5. Préparer l'installation, la GitHub Action de déploiement et la configuration du domaine.
6. Valider l'ensemble avec vingt spectateurs avant une utilisation en formation.

## 12. Références techniques consultées pendant le cadrage

- [Offres VPS OVHcloud](https://www.ovhcloud.com/fr/vps/)
- [Conditions de trafic des VPS OVHcloud](https://www.ovhcloud.com/fr/vps/unmetered-vps/)
- [LiveKit : auto-hébergement](https://docs.livekit.io/transport/self-hosting/)
- [LiveKit : fonctionnement du SFU](https://docs.livekit.io/reference/internals/livekit-sfu/)
- [LiveKit : partage d'écran](https://docs.livekit.io/transport/media/screenshare/)

Les références servent au cadrage. Les versions, compatibilités et conditions tarifaires devront être vérifiées au moment de l'implémentation et de la commande.
