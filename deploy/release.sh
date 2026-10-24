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
export APP_VERSION="$release"
cd "$folder"
docker compose --project-name jlg-share --env-file "$root/.env" config --quiet
docker compose --project-name jlg-share --env-file "$root/.env" build app
if ! docker compose --project-name jlg-share --env-file "$root/.env" up -d --wait --wait-timeout 120; then
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
