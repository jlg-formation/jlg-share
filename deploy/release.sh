#!/usr/bin/env bash
set -euo pipefail
release="${1:?Identifiant Git requis}"
[[ "$release" =~ ^[a-f0-9]{40}$ ]] || { echo 'Identifiant Git invalide'; exit 1; }
root=/opt/jlg-share
folder="$root/releases/$release"
[[ -d "$folder" && -f "$root/.env" ]] || { echo 'Version ou configuration absente'; exit 1; }
exec 9>"$root/deploy.lock"
flock -n 9 || { echo 'Un déploiement est déjà en cours'; exit 1; }
previous="$(readlink "$root/current" || true)"
domain="$(sed -n 's/^APP_DOMAIN=//p' "$root/.env")"
media_domain="$(sed -n 's/^MEDIA_DOMAIN=//p' "$root/.env")"
[[ "$domain" =~ ^[a-zA-Z0-9.-]+$ && "$media_domain" =~ ^[a-zA-Z0-9.-]+$ ]] || { echo 'Domaines invalides'; exit 1; }
export APP_VERSION="$release"
cd "$folder"
docker compose --project-name jlg-share --env-file "$root/.env" config --quiet
docker compose --project-name jlg-share --env-file "$root/.env" build app
check_release() {
  docker compose --project-name jlg-share --env-file "$root/.env" up -d --wait --wait-timeout 120 || return 1
  curl --fail --silent --show-error --retry 18 --retry-all-errors --retry-delay 5 --max-time 10 "https://$domain/api/health" || return 1
  curl --fail --silent --show-error --max-time 15 "https://$domain/theme.js" | cmp public/theme.js - || return 1
  curl --fail --silent --show-error --max-time 15 "https://$domain/favicon.png" | cmp public/favicon.png - || return 1
  curl --fail --silent --show-error --retry 12 --retry-all-errors --retry-delay 5 --max-time 10 "https://$media_domain/" >/dev/null || return 1
}
if ! check_release; then
  if [[ -n "$previous" && -d "$previous" ]]; then
    echo 'Échec : retour à la version précédente.'
    cd "$previous"
    export APP_VERSION="$(basename "$previous")"
    docker compose --project-name jlg-share --env-file "$root/.env" up -d --wait --wait-timeout 120
  fi
  exit 1
fi
ln -sfn "$folder" "$root/current"
printf 'Version déployée : %s\n' "$release"
