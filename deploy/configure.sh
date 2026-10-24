#!/usr/bin/env bash
set -euo pipefail
root=/opt/jlg-share
read -r password_hash
read -r acme_email
[[ "$password_hash" =~ ^\$argon2(id|i|d)\$[a-zA-Z0-9=,+/$.-]+$ ]] || { echo 'Hachage invalide'; exit 1; }
[[ "$acme_email" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]] || { echo 'Adresse de contact invalide'; exit 1; }
[[ -d "$root/releases" && -w "$root" ]] || { echo 'Répertoires non préparés'; exit 1; }
[[ ! -e "$root/.env" && ! -L "$root/.env" ]] || { echo 'Configuration existante : aucune modification effectuée'; exit 1; }
umask 077
temporary="$(mktemp "$root/.env.XXXXXX")"
trap 'rm -f -- "$temporary"' EXIT
key="$(openssl rand -hex 16)"
secret="$(openssl rand -hex 32)"
{
  printf 'APP_DOMAIN=share.jlg-consulting.com\n'
  printf 'MEDIA_DOMAIN=media.jlg-consulting.com\n'
  printf 'ACME_EMAIL=%s\n' "$acme_email"
  printf "ADMIN_PASSWORD_HASH='%s'\n" "$password_hash"
  printf 'LIVEKIT_API_KEY=%s\n' "$key"
  printf 'LIVEKIT_API_SECRET=%s\n' "$secret"
} > "$temporary"
# Le lien atomique échoue si une configuration est apparue entre-temps.
ln "$temporary" "$root/.env"
echo 'Configuration de production créée avec les droits 600 ; aucun service démarré.'
