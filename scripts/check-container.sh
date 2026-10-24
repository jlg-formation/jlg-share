#!/usr/bin/env bash
set -euo pipefail
name="jlg-share-check-${GITHUB_RUN_ID:-$$}"
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT
hash="$(docker run --rm --network none jlg-share:check bun -e 'console.log(await Bun.password.hash("ci-container-only"))')"
docker run -d --name "$name" --read-only --tmpfs /tmp \
  --tmpfs /data:uid=1000,gid=1000 \
  -p 127.0.0.1:4175:3000 \
  -e HOST=0.0.0.0 -e APP_ORIGIN=http://127.0.0.1:4175 \
  -e ADMIN_PASSWORD_HASH="$hash" jlg-share:check >/dev/null
for attempt in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:4175/api/health >/dev/null; then
    break
  fi
  sleep 1
done
curl --fail --silent http://127.0.0.1:4175/api/health | grep -q '"ok":true'
directory="$(mktemp -d)"
trap 'docker rm -f "$name" >/dev/null 2>&1 || true; rm -rf -- "$directory"' EXIT
curl --fail --silent http://127.0.0.1:4175/theme.js > "$directory/theme.js"
cmp public/theme.js "$directory/theme.js"
curl --fail --silent http://127.0.0.1:4175/favicon.png > "$directory/favicon.png"
cmp public/favicon.png "$directory/favicon.png"
echo 'Image exécutée : santé, thème et favicon validés.'
