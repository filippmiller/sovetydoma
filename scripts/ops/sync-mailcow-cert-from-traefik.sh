#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-mail.filippmiller.com}"
MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
ACME_JSON="${ACME_JSON:-/data/coolify/proxy/acme.json}"

cd "$MAILCOW_DIR"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

jq -r --arg domain "$DOMAIN" \
  '.letsencrypt.Certificates[] | select(.domain.main == $domain) | .certificate' \
  "$ACME_JSON" | base64 -d > "$tmp_dir/cert.pem"

jq -r --arg domain "$DOMAIN" \
  '.letsencrypt.Certificates[] | select(.domain.main == $domain) | .key' \
  "$ACME_JSON" | base64 -d > "$tmp_dir/key.pem"

openssl x509 -in "$tmp_dir/cert.pem" -noout -subject -issuer -dates >/dev/null

if cmp -s "$tmp_dir/cert.pem" data/assets/ssl/cert.pem && cmp -s "$tmp_dir/key.pem" data/assets/ssl/key.pem; then
  echo "mailcow certificate already current for $DOMAIN"
  exit 0
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
cp data/assets/ssl/cert.pem "data/assets/ssl/cert.pem.bak-$stamp"
cp data/assets/ssl/key.pem "data/assets/ssl/key.pem.bak-$stamp"

install -m 0644 "$tmp_dir/cert.pem" data/assets/ssl/cert.pem
install -m 0600 "$tmp_dir/key.pem" data/assets/ssl/key.pem

docker compose restart postfix-mailcow dovecot-mailcow nginx-mailcow >/dev/null
echo "mailcow certificate synced for $DOMAIN"
