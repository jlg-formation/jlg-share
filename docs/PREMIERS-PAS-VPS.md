# Du VPS neuf à la connexion SSH : nos premiers pas

État au 24 octobre 2026. Ce document résume la préparation du VPS pour JLG Share et les commandes expliquées pendant l'installation. Il distingue les résultats confirmés des étapes encore à vérifier.

## 1. Le point de départ

Le projet a été publié sur [GitHub, dans jlg-formation/jlg-share](https://github.com/jlg-formation/jlg-share), sous licence MIT. Les fichiers à publier et l'historique Git ont été contrôlés avec Gitleaks, sans secret détecté. Les fichiers `.env` et les données de session sont exclus de Git ; la détection des secrets et la protection des envois sont activées sur GitHub.

Les tests, la compilation, les parcours navigateur et la construction Docker ont réussi dans GitHub Actions. Ces vérifications ne constituent pas une installation sur le VPS.

L'objectif est d'arriver à un déploiement continu : après validation d'une modification sur `main`, GitHub vérifiera puis installera automatiquement la version sur le VPS. Le workflow de déploiement existant est encore déclenché manuellement ; l'automatisation complète reste à préparer.

## 2. Le serveur acheté chez OVH

Le VPS a été acheté pour douze mois et est dédié à JLG Share. Aucun autre service n'y était hébergé au début de la préparation.

| Élément | Valeur constatée |
| --- | --- |
| IPv4 publique | `57.129.186.119` |
| Nom de machine | `vps-665bcc7c` |
| Utilisateur initial | `ubuntu` |
| Système initial | Ubuntu 26.04 LTS |
| Architecture | `x86_64` |
| Mémoire vive affichée | 7,6 GiB |
| Disque racine affiché | 72 Go environ, dont 70 Go disponibles avant les mises à jour |

Dans l'affichage de `free -h`, `Gi` désigne ici des gibioctets : 1 GiB vaut 1 073 741 824 octets. Cela explique la différence avec les gigaoctets décimaux. Ces ressources permettent de démarrer ; elles ne prouvent pas encore la capacité à servir vingt spectateurs LiveKit.

## 3. Première connexion et changement de mot de passe — réalisés

Depuis un terminal Windows, la connexion au serveur a été établie avec :

```bat
ssh ubuntu@57.129.186.119
```

Le mot de passe initial fourni par OVH a été remplacé par un mot de passe personnel, conservé par le propriétaire. Aucun mot de passe n'a été communiqué dans la discussion ni ajouté au projet.

À la première connexion, SSH demande d'accepter l'empreinte du serveur. La méthode expliquée pour la vérifier consiste à comparer l'empreinte ED25519 affichée par SSH avec celle obtenue depuis la console KVM OVH :

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

Le propriétaire a confirmé avoir effectué cette vérification le 24 octobre 2026, depuis la console KVM OVH et depuis sa connexion SSH personnelle ouverte dans CMD sur Windows. Les empreintes obtenues sont strictement identiques : la vérification de l'empreinte du serveur est validée. Il s'agit de l'empreinte de la clé d'hôte SSH du serveur, distincte de la clé personnelle d'authentification décrite plus bas.

## 4. Vérification du système et des ressources — réalisée

Dans le terminal connecté au VPS, les commandes suivantes ont été exécutées et leurs résultats partagés :

```bash
whoami
cat /etc/os-release
uname -m
free -h
df -h /
```

Elles ont confirmé l'utilisateur `ubuntu`, Ubuntu 26.04 LTS, l'architecture x86_64 et les ressources indiquées ci-dessus. Ces commandes ne modifient pas le serveur.

## 5. Mise à jour et redémarrage — reconnexion confirmée

La procédure donnée sur le VPS était :

```bash
sudo apt update
sudo apt upgrade
sudo reboot
```

`apt update` actualise la liste des paquets disponibles ; `apt upgrade` installe les mises à jour. `sudo` permet d'effectuer une opération avec les droits d'administration et peut demander le mot de passe de l'utilisateur.

Le redémarrage a provoqué le message suivant dans le terminal Windows :

```text
client_loop: send disconnect: Connection reset
```

C'est la fermeture attendue de la connexion lorsque le serveur redémarre. La reconnexion a ensuite réussi avec :

```bat
ssh ubuntu@57.129.186.119
```

Le serveur a alors annoncé **Ubuntu 26.04.1 LTS**, le noyau **7.0.0-38-generic**, ainsi que **0 mise à jour immédiatement applicable**. Les sorties détaillées des commandes `apt` n'ont pas été partagées, mais le redémarrage et cet état après reconnexion sont confirmés.

## 6. Bien distinguer Windows du VPS

Deux types de terminaux interviennent dans la préparation :

| Invite affichée | Où s'exécutent les commandes ? |
| --- | --- |
| `ubuntu@vps-665bcc7c:~$` | Sur le VPS, dans Bash |
| `D:\___AGENTS\jlg-share>` | Sur l'ordinateur Windows, dans CMD |
| `PS C:\Users\...>` | Sur l'ordinateur Windows, dans PowerShell |

Après une connexion SSH, les commandes saisies dans cette fenêtre s'exécutent sur le VPS. Pour travailler sur Windows en parallèle, ouvrir une nouvelle fenêtre CMD ou PowerShell et conserver la connexion au VPS ouverte.

Les variables de chemin diffèrent selon le terminal : `%USERPROFILE%` dans CMD, `$env:USERPROFILE` dans PowerShell. SSH est utilisable depuis les deux.

## 7. Accès personnel par clé SSH — validé

L'objectif est de remplacer, pour la connexion habituelle, la saisie du mot de passe du serveur par l'utilisation d'une clé protégée par une phrase secrète.

La **clé privée reste sur l'ordinateur Windows**. Seule la **clé publique**, dont le fichier se termine par `.pub`, est envoyée au VPS. La phrase secrète protège la clé privée et ne correspond pas au mot de passe du serveur.

### Procédure retenue pour CMD sur Windows

Toutes les commandes de cette section s'exécutent dans **CMD sur l'ordinateur Windows**, pas dans le terminal du VPS.

Créer une clé dédiée, protégée par une phrase secrète :

```bat
ssh-keygen -t ed25519 -f "%USERPROFILE%\.ssh\jlg-share-admin" -C "jlg-share-admin"
```

Si un fichier existe déjà à cet emplacement, ne pas accepter son remplacement sans vérifier son usage.

Ajouter la clé publique aux accès du serveur, sans supprimer les clés déjà autorisées :

```bat
type "%USERPROFILE%\.ssh\jlg-share-admin.pub" | ssh ubuntu@57.129.186.119 "umask 077; mkdir -p ~/.ssh; cat >> ~/.ssh/authorized_keys; chmod 700 ~/.ssh; chmod 600 ~/.ssh/authorized_keys"
```

Cette étape demande encore le mot de passe du VPS. Tester ensuite une connexion qui utilise uniquement la clé :

```bat
ssh -o PasswordAuthentication=no -o KbdInteractiveAuthentication=no -i "%USERPROFILE%\.ssh\jlg-share-admin" ubuntu@57.129.186.119
```

Si nécessaire, SSH demande la phrase secrète de la clé. Un agent SSH peut éviter de la redemander si la clé y est déjà déverrouillée.

Le propriétaire a confirmé le 24 octobre 2026 que la connexion avec `ssh jlg-share` fonctionne correctement depuis Windows. Avec la configuration ci-dessous, qui désactive les méthodes par mot de passe côté client pour ce raccourci, l'accès personnel par clé SSH est validé.

## 8. Une commande plus simple : `ssh jlg-share` — fonctionnement confirmé

Pour éviter de répéter le chemin de la clé et les options, la configuration suivante a été proposée sur Windows.

Depuis CMD, ouvrir le fichier :

```bat
notepad "%USERPROFILE%\.ssh\config"
```

Ajouter ce bloc en conservant les éventuelles entrées existantes :

```sshconfig
Host jlg-share
    HostName 57.129.186.119
    User ubuntu
    IdentityFile ~/.ssh/jlg-share-admin
    IdentitiesOnly yes
    PasswordAuthentication no
    KbdInteractiveAuthentication no
```

Enregistrer sous le nom exact **`config`**, sans extension `.txt`. Depuis CMD ou PowerShell, la connexion devient alors :

```text
ssh jlg-share
```

Ces options s'appliquent à ce raccourci sur l'ordinateur Windows. Elles ne désactivent pas à elles seules l'authentification par mot de passe sur le serveur. La désactivation côté serveur a ensuite été réalisée et validée à l'étape 11.

Le propriétaire a confirmé que le raccourci `ssh jlg-share` fonctionne correctement, puis l'a de nouveau vérifié après la désactivation du mot de passe SSH côté serveur.

## 9. Installation de Docker et Compose — validée

Les commandes ont été exécutées manuellement par le propriétaire dans sa connexion SSH au VPS. Elles ont installé `ca-certificates` et `curl`, ajouté la clé de signature Docker dans `/etc/apt/keyrings/docker.asc` et déclaré le dépôt officiel dans `/etc/apt/sources.list.d/docker.sources`, avec la suite Ubuntu `resolute` et l'architecture `amd64`.

Voici le **script complet exécuté**, à conserver comme référence. Il s'exécute dans le terminal SSH du VPS, à l'invite `ubuntu@vps-665bcc7c:~$`, et non dans CMD ou PowerShell sur Windows. Il n'est pas nécessaire de le relancer sur ce serveur, puisque l'installation est validée. Le bloc entre parenthèses s'arrête si une commande échoue, sans fermer la session SSH.

```bash
(
set -eu

# Vérifier les droits d'administration.
sudo -v

# Installer les outils nécessaires.
sudo apt-get update
sudo apt-get install -y ca-certificates curl

# Ajouter la clé de signature officielle de Docker.
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Déclarer le dépôt Docker correspondant à Ubuntu.
sudo tee /etc/apt/sources.list.d/docker.sources > /dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

# Installer Docker, Compose et l'outil de construction.
sudo apt-get update
sudo apt-get install -y \
  docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

# Activer Docker immédiatement et au démarrage du VPS.
sudo systemctl enable --now docker

# Vérifier les versions et exécuter un conteneur de test.
sudo docker version
sudo docker compose version
sudo docker run --rm hello-world

echo "Installation et vérification Docker terminées."
)
```

Le propriétaire a partagé la fin de la sortie : **Docker Compose v5.6.1**, téléchargement réussi de l'image `hello-world`, message **`Hello from Docker!`**, puis **`Installation et vérification Docker terminées.`** Le téléchargement et l'exécution d'un conteneur sont donc validés. La version exacte du moteur Docker n'a pas été communiquée.

Le conteneur de test a été supprimé automatiquement grâce à `--rm` ; l'image téléchargée peut rester dans le cache Docker. Aucun service JLG Share n'a été lancé par ce test.

Référence : [installation depuis le dépôt officiel Docker pour Ubuntu](https://docs.docker.com/engine/install/ubuntu/).

## 10. Pare-feu UFW et nouvelle connexion SSH — validés

Le script suivant a été fourni pour être exécuté dans la connexion SSH au VPS, en conservant cette connexion ouverte :

```bash
(
set -eu

sudo -v
sudo apt-get install -y ufw

# Vérifier que la connexion SSH utilise bien le port prévu.
if [ "${SSH_CONNECTION##* }" != "22" ]; then
  echo "Arrêt : le port SSH doit être vérifié avant de continuer."
  exit 1
fi

# Vérifier que le pare-feu couvrira aussi IPv6.
if ! grep -Eq '^IPV6=yes[[:space:]]*$' /etc/default/ufw; then
  echo "Arrêt : la prise en charge IPv6 doit être vérifiée."
  exit 1
fi

# Autoriser SSH avant d'activer le filtrage.
sudo ufw allow 22/tcp comment 'SSH'

# Site HTTP et HTTPS.
sudo ufw allow 80/tcp comment 'HTTP et certificats'
sudo ufw allow 443/tcp comment 'HTTPS'

# Partage d'écran LiveKit.
sudo ufw allow 7881/tcp comment 'LiveKit ICE TCP'
sudo ufw allow 3478/udp comment 'LiveKit TURN'
sudo ufw allow 50000:50100/udp comment 'LiveKit WebRTC'

# Refuser les autres connexions entrantes.
sudo ufw default deny incoming
sudo ufw default allow outgoing

sudo ufw --force enable
sudo ufw status verbose
)
```

Le propriétaire a ensuite ouvert une nouvelle fenêtre CMD sur Windows et réussi une connexion avec `ssh jlg-share`, avec demande de la phrase secrète de sa clé. Il a partagé la sortie de `sudo ufw status verbose` :

- État `active`, journalisation `on (low)`.
- Politique par défaut : `deny (incoming)`, `allow (outgoing)`, `deny (routed)`.
- Autorisations pour TCP 22, 80, 443 et 7881, UDP 3478 et UDP 50000 à 50100, toutes présentes en IPv4 et IPv6.

L'exécution initiale de `ufw status verbose` sans `sudo` a été refusée faute de droits administrateur ; la commande correcte est `sudo ufw status verbose`.

Cette vérification confirme les règles locales UFW et la possibilité d'une nouvelle connexion SSH. Elle ne valide pas encore les autres ports depuis Internet, le pare-feu OVH ou le fonctionnement de LiveKit. Les ports internes TCP 3000 et 7880 n'ont pas de règle d'autorisation publique dans UFW. La configuration Compose actuelle utilise le réseau hôte ; toute évolution vers des ports publiés par Docker devra tenir compte de leurs interactions avec UFW.

## 11. Désactivation du mot de passe SSH — validée

Le contrôle préalable avec `sudo /usr/sbin/sshd -T` indiquait `pubkeyauthentication yes`, `passwordauthentication yes`, `kbdinteractiveauthentication no` et `permitrootlogin prohibit-password`, sur le port 22. Les fichiers de configuration additionnels présents étaient `50-cloud-init.conf` et `60-cloudimg-settings.conf`.

L'objectif est de conserver l'authentification par clé et de refuser le mot de passe pour SSH. La phrase secrète continue à protéger la clé privée sur Windows ; le mot de passe du compte `ubuntu` reste utilisable pour `sudo` et la console KVM. Ce changement ne supprime pas le mot de passe du compte.

Le script suivant a été fourni pour le terminal du VPS, en gardant la connexion existante ouverte. Un retour automatique aux anciens réglages après 15 minutes protégeait la vérification d'une nouvelle connexion. Ce script est conservé comme trace de l'opération ; il n'est pas nécessaire de le relancer.

```bash
(
set -eu
sudo -v

config=/etc/ssh/sshd_config.d/00-jlg-share-key-only.conf

# Ne pas remplacer un fichier déjà présent.
if sudo test -e "$config"; then
  echo "Arrêt : le fichier existe déjà. Transmettez ce message."
  exit 1
fi

# Vérifier la configuration actuelle.
sudo /usr/sbin/sshd -t

# Prévoir un retour aux anciens réglages dans 15 minutes.
sudo systemd-run \
  --unit=jlg-share-ssh-rollback \
  --on-active=15m \
  /bin/sh -c \
  'rm -f /etc/ssh/sshd_config.d/00-jlg-share-key-only.conf; /usr/sbin/sshd -t && systemctl reload ssh'

# Conserver les clés et désactiver les méthodes par mot de passe.
sudo tee "$config" > /dev/null <<'EOF'
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
EOF
sudo chmod 644 "$config"

# Vérifier la syntaxe et les réglages effectifs pour votre connexion.
sudo /usr/sbin/sshd -t
read -r client_ip client_port server_ip server_port <<< "$SSH_CONNECTION"
effective=$(sudo /usr/sbin/sshd -T -C \
  "user=$(id -un),addr=$client_ip,host=$client_ip,laddr=$server_ip,lport=$server_port")

printf '%s\n' "$effective" | grep -qx 'pubkeyauthentication yes'
printf '%s\n' "$effective" | grep -qx 'passwordauthentication no'
printf '%s\n' "$effective" | grep -qx 'kbdinteractiveauthentication no'

# Appliquer sans couper les connexions ouvertes.
sudo systemctl reload ssh

echo "Réglages appliqués. Testez maintenant une NOUVELLE connexion SSH."
echo "Retour automatique aux anciens réglages dans 15 minutes."
)
```

Le propriétaire a ensuite ouvert une nouvelle connexion depuis CMD sur Windows avec :

```bat
ssh jlg-share
```

La connexion a réussi après saisie de la phrase secrète. Dans cette nouvelle session du VPS, il a annulé le retour automatique puis contrôlé les réglages :

```bash
sudo systemctl stop jlg-share-ssh-rollback.timer
sudo /usr/sbin/sshd -T | grep -E '^(pubkeyauthentication|passwordauthentication|kbdinteractiveauthentication) '
```

La sortie partagée confirme :

```text
pubkeyauthentication yes
passwordauthentication no
kbdinteractiveauthentication no
```

L'accès par clé après application des réglages et l'annulation du retour automatique sont validés. Un essai séparé de connexion SSH en forçant le mot de passe n'a pas été réalisé dans la discussion.

En cas de perte de la clé privée, la console KVM et le mode rescue OVH permettent de préparer une nouvelle clé autorisée. Une copie protégée du dossier `.ssh` sur un support externe a été conseillée, mais sa réalisation n'a pas été confirmée. La réinstallation complète du VPS depuis l'espace client OVH reste une solution de dernier recours ; elle efface les données du disque principal.

## 12. Accès dédié à GitHub et répertoires — validés

Le compte `jlg-deploy` sert aux livraisons automatiques ; le compte `ubuntu` reste celui de l'administration personnelle. `jlg-deploy` appartient au groupe `docker`, qui donne des pouvoirs équivalents à ceux d'un administrateur sur le VPS, même sans appartenir au groupe `sudo`. La clé privée de déploiement doit donc être protégée comme un secret d'administration.

### Créer le compte et les répertoires sur le VPS

Le bloc fourni à exécuter dans la connexion SSH personnelle était :

```bash
(
set -eu
sudo -v

# Créer le compte sans connexion par mot de passe.
if ! id jlg-deploy > /dev/null 2>&1; then
  sudo adduser --disabled-password --gecos "" jlg-deploy
fi

# Autoriser Docker sans donner accès au groupe sudo.
sudo usermod -aG docker jlg-deploy

# Préparer les répertoires de livraison.
sudo install -d -m 750 -o jlg-deploy -g jlg-deploy \
  /opt/jlg-share \
  /opt/jlg-share/releases

# Préparer le dossier des clés publiques autorisées.
sudo install -d -m 700 -o jlg-deploy -g jlg-deploy \
  /home/jlg-deploy/.ssh

id jlg-deploy
sudo ls -ld /opt/jlg-share /opt/jlg-share/releases

echo "Compte et répertoires préparés."
)
```

### Créer une clé distincte sur Windows

Dans CMD, sur l'ordinateur Windows :

```bat
ssh-keygen -t ed25519 -f "%USERPROFILE%\.ssh\jlg-share-github" -C "jlg-share-github"
```

Pour cette clé d'automatisation, la phrase secrète est vide : GitHub doit pouvoir l'utiliser sans saisie interactive. La clé personnelle `jlg-share-admin` conserve sa propre phrase secrète. Si une phrase secrète a été définie sur la clé GitHub, elle peut être retirée sans changer la clé publique :

```bat
ssh-keygen -p -f "%USERPROFILE%\.ssh\jlg-share-github"
```

Saisir l'ancienne phrase secrète, puis laisser la nouvelle vide et confirmer avec Entrée. Il n'est pas nécessaire de recréer la clé ou de retransférer sa partie publique après cette opération.

### Transférer et autoriser uniquement la clé publique

Depuis CMD sur Windows :

```bat
scp "%USERPROFILE%\.ssh\jlg-share-github.pub" jlg-share:jlg-share-github.pub
```

La demande éventuelle de phrase secrète concerne ici la clé personnelle `jlg-share-admin`, utilisée pour ce transfert. Le propriétaire a confirmé la réussite de ce transfert.

Dans le terminal du VPS, sous le compte personnel `ubuntu` :

```bash
(
set -eu
sudo -v

# Vérifier que le fichier reçu est une clé publique valide.
ssh-keygen -lf "$HOME/jlg-share-github.pub"

# Préserver un éventuel fichier d'accès déjà présent.
if sudo test -e /home/jlg-deploy/.ssh/authorized_keys; then
  echo "Arrêt : authorized_keys existe déjà. Transmettez ce message."
  exit 1
fi

# Autoriser la clé en désactivant notamment les tunnels et le terminal interactif.
{ printf 'restrict '; cat "$HOME/jlg-share-github.pub"; } |
  sudo tee /home/jlg-deploy/.ssh/authorized_keys > /dev/null

sudo chown jlg-deploy:jlg-deploy /home/jlg-deploy/.ssh/authorized_keys
sudo chmod 600 /home/jlg-deploy/.ssh/authorized_keys

echo "Clé publique de déploiement installée."
)
```

L'option `restrict` conserve l'exécution de commandes et les transferts nécessaires aux livraisons, mais désactive notamment les tunnels, le transfert d'agent et l'allocation d'un terminal. Elle ne limite pas les commandes exécutables et ne retire pas les pouvoirs conférés par Docker.

### Résultat du test depuis Windows

Le propriétaire a exécuté dans CMD :

```bat
ssh -o BatchMode=yes -o IdentitiesOnly=yes -i "%USERPROFILE%\.ssh\jlg-share-github" jlg-deploy@57.129.186.119 "whoami && docker compose version && docker info --format '{{.ServerVersion}}' && test -w /opt/jlg-share/releases && echo DEPLOY_ACCESS_OK"
```

Résultat partagé :

```text
jlg-deploy
Docker Compose version v5.6.1
29.9.2
DEPLOY_ACCESS_OK
```

L'authentification SSH de déploiement sans saisie interactive, l'accès au moteur Docker **29.9.2**, la disponibilité de Compose **v5.6.1** et le droit d'écriture dans `/opt/jlg-share/releases` sont validés depuis Windows. L'accès depuis une machine GitHub Actions reste à vérifier. Aucun secret privé n'a été ajouté au projet.

## 13. Secrets de l'environnement GitHub production — présence confirmée

Les commandes suivantes ont été fournies pour CMD sur Windows. Elles enregistrent les paramètres dans l'environnement `production`, sans publier les valeurs dans le dépôt :

```bat
gh api --method PUT repos/jlg-formation/jlg-share/environments/production --silent
gh secret set VPS_HOST --repo jlg-formation/jlg-share --env production --body "57.129.186.119"
gh secret set VPS_USER --repo jlg-formation/jlg-share --env production --body "jlg-deploy"
gh secret set VPS_SSH_KEY --repo jlg-formation/jlg-share --env production < "%USERPROFILE%\.ssh\jlg-share-github"
```

Pour l'identité du serveur, la procédure reprend la clé d'hôte déjà connue de l'ordinateur Windows. La commande d'enregistrement doit être exécutée seulement si la recherche avec `ssh-keygen -F` réussit :

```bat
ssh-keygen -F 57.129.186.119 > "%TEMP%\jlg-share-known-hosts"
gh secret set VPS_KNOWN_HOSTS --repo jlg-formation/jlg-share --env production < "%TEMP%\jlg-share-known-hosts"
```

Le propriétaire a exécuté la commande de vérification :

```bat
gh secret list --repo jlg-formation/jlg-share --env production
```

La liste partagée contient bien `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` et `VPS_KNOWN_HOSTS`. Elle confirme leur présence, sans révéler leur contenu ni valider leur fonctionnement depuis GitHub.

Le workflow manuel [Vérifier l'accès au VPS](../.github/workflows/check-vps.yml) teste ces quatre paramètres depuis GitHub Actions, sur `main`. Il vérifie l'identité du serveur SSH, l'utilisateur `jlg-deploy`, l'accès à Docker et le droit d'écriture dans le répertoire des versions. Il ne déploie ni ne redémarre de service.

L'agent a publié le document et le workflow, puis déclenché le test avec :

```text
gh workflow run check-vps.yml --repo jlg-formation/jlg-share --ref main
```

L'[exécution 40106006636](https://github.com/jlg-formation/jlg-share/actions/runs/40106006636) a réussi le 24 octobre 2026. Les journaux confirment Compose `v5.6.1`, Docker `29.9.2` et `VPS_ACCESS_OK`. L'accès automatique depuis GitHub est donc validé ; aucun déploiement applicatif n'a été déclenché par ce test.

## 14. Passage à la gestion automatique des opérations GitHub

Après avoir confirmé la présence des quatre secrets, le propriétaire a demandé que les étapes réalisées jusqu'ici soient consignées dans ce document, puis que l'agent prenne en charge les opérations automatiques. La publication des fichiers préparés et le lancement du test GitHub sont donc confiés à l'agent ; les commandes de publication précédemment proposées n'ont pas été présentées comme déjà exécutées par le propriétaire.

Les étapes précédentes sur le VPS ont été exécutées manuellement par le propriétaire, qui a conservé ses mots de passe et phrases secrètes. Les opérations suivantes doivent toujours distinguer préparation, exécution et résultat vérifié, et ne jamais publier de secret ni de contenu de session.

## 15. DNS — configuration manuelle à effectuer

Le propriétaire a précisé qu'il effectuera lui-même la configuration DNS dans OVH. Aucun accès à la gestion DNS n'a été fourni à l'agent.

La vérification DNS publique effectuée par l'agent le 24 octobre 2026 a constaté que `share.jlg-consulting.com` et `media.jlg-consulting.com` n'existaient pas encore. Les serveurs DNS du domaine sont `dns.ovh.net` et `ns.ovh.net`.

Dans l'espace client OVH : **Web Cloud → Noms de domaine → jlg-consulting.com → Zone DNS → Ajouter une entrée**. Les entrées proposées pour le démarrage en IPv4 sont :

| Type | Sous-domaine | Cible | Usage |
| --- | --- | --- | --- |
| A | `share` | `57.129.186.119` | Application JLG Share |
| A | `media` | `57.129.186.119` | Adresse proposée pour LiveKit, à confirmer par le propriétaire |

Le TTL peut être fixé à 300 secondes si proposé, ou laissé par défaut. Il suffit d'ajouter ces entrées à la zone existante, en préservant les autres services du domaine. Aucun enregistrement AAAA n'est nécessaire pour ce premier démarrage en IPv4.

La création de ces entrées et leur résolution publique restent à confirmer. Le DNS désigne le serveur ; il ne lance ni l'application ni HTTPS. La configuration applicative et le premier déploiement restent nécessaires.

Référence : [éditer une zone DNS OVHcloud](https://docs.ovhcloud.com/fr/guides/web-cloud/domains/dns-zone-edit).

## 16. Où en sommes-nous ?

**Confirmé :** le VPS est disponible, le mot de passe initial a été remplacé, les ressources ont été vérifiées et la reconnexion après redémarrage a réussi. Le propriétaire a également confirmé que les empreintes SSH vérifiées depuis la console KVM OVH et sa connexion personnelle depuis CMD sont identiques. Le serveur indique qu'aucune mise à jour n'est immédiatement applicable.

**Accès personnel validé :** le propriétaire confirme que `ssh jlg-share` fonctionne depuis Windows avec la configuration par clé décrite ci-dessus.

**Docker validé :** Docker et Compose sont installés ; le conteneur `hello-world` a été téléchargé et exécuté avec succès.

**Pare-feu validé :** UFW est actif avec les règles prévues en IPv4 et IPv6 ; une nouvelle connexion SSH a réussi après son activation.

**SSH renforcé :** la connexion par clé a été testée après application des réglages ; l'authentification SSH par mot de passe et par échange interactif est désactivée. Le retour automatique a été annulé dans la nouvelle session.

**Accès de déploiement validé depuis Windows :** `jlg-deploy` s'authentifie par sa clé dédiée, peut utiliser Docker et écrire dans le répertoire des versions.

**Accès GitHub validé :** les quatre secrets de l'environnement `production` permettent le test SSH, Docker et répertoire de livraison depuis GitHub Actions ; le workflow de vérification a réussi.

**Prochaine étape manuelle :** le propriétaire configure les DNS dans OVH. L'agent vérifiera ensuite leur résolution publique.

**Encore à réaliser :** la configuration des domaines et des secrets applicatifs sur le VPS, le premier déploiement et ses essais, ainsi que la vérification des mises à jour de sécurité automatiques. Aucun déploiement de JLG Share sur le VPS ni activation du déploiement continu n'a été confirmé à ce stade.

Le [guide de déploiement](DEPLOIEMENT.md) décrit l'architecture et les étapes prévues pour la suite. La clé personnelle d'administration et la future clé GitHub de déploiement doivent rester distinctes. Aucun mot de passe, aucune phrase secrète et aucune clé privée ne doivent être ajoutés à cette documentation.
