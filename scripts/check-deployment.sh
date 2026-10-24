#!/usr/bin/env bash
set -euo pipefail
directory="$(mktemp -d)"
trap 'rm -rf -- "$directory"' EXIT
root="$directory/root"
mkdir -p "$root/releases" "$directory/bin"
sed "s|^root=/opt/jlg-share$|root=$root|" deploy/configure.sh > "$directory/configure.sh"
printf '%s\n' '$argon2id$v=19$m=65536,t=2,p=1$testSalt$testHash' 'test@example.test' | bash "$directory/configure.sh"
[[ "$(stat -c %a "$root/.env")" = 600 ]]
before="$(sha256sum "$root/.env")"
if printf '%s\n' '$argon2id$v=19$m=65536,t=2,p=1$otherSalt$otherHash' 'other@example.test' | bash "$directory/configure.sh"; then
  echo 'Erreur : la configuration existante a été écrasée'; exit 1
fi
[[ "$(sha256sum "$root/.env")" = "$before" ]]
sed "s|^root=/opt/jlg-share$|root=$root|" deploy/release.sh > "$directory/release.sh"
previous=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
current=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
for release in "$previous" "$current"; do
  mkdir -p "$root/releases/$release/public"
  printf 'theme-fixture' > "$root/releases/$release/public/theme.js"
  printf 'favicon-fixture' > "$root/releases/$release/public/favicon.png"
done
cat > "$directory/bin/docker" <<'EOF'
#!/usr/bin/env bash
printf '%s %s\n' "$APP_VERSION" "$*" >> "$DEPLOY_TEST_LOG"
if [[ "$APP_VERSION" = bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb ]]; then
  if [[ "${FAIL_DEPLOY_TEST:-}" = start && "$*" = *' up '* ]]; then exit 1; fi
  if [[ "${FAIL_DEPLOY_TEST:-}" = build && "$*" = *' build '* ]]; then exit 1; fi
fi
EOF
cat > "$directory/bin/curl" <<'EOF'
#!/usr/bin/env bash
if [[ "${FAIL_DEPLOY_TEST:-}" = https ]]; then exit 22; fi
case "${!#}" in
  */theme.js) printf 'theme-fixture';;
  */favicon.png) printf 'favicon-fixture';;
  *) printf '{"ok":true}';;
esac
EOF
chmod +x "$directory/bin/docker" "$directory/bin/curl"
export PATH="$directory/bin:$PATH"
export DEPLOY_TEST_LOG="$directory/commands.log"
ln -s "$root/releases/$previous" "$root/current"
bash "$directory/release.sh" "$current"
[[ "$(readlink "$root/current")" = "$root/releases/$current" ]]
for failure in start https build; do
  ln -sfn "$root/releases/$previous" "$root/current"
  : > "$DEPLOY_TEST_LOG"
  export FAIL_DEPLOY_TEST="$failure"
  if bash "$directory/release.sh" "$current"; then
    echo "Erreur : le déploiement a ignoré l'échec $failure"; exit 1
  fi
  [[ "$(readlink "$root/current")" = "$root/releases/$previous" ]]
  if [[ "$failure" != build ]]; then
    grep -q "^$previous .* up -d --wait" "$DEPLOY_TEST_LOG"
  fi
done
echo 'Configuration non écrasée, livraison et retours arrière validés avec des services simulés.'
