# Shared Mailcow Infrastructure

Last verified: 2026-06-01.

## Purpose

Mailcow on the Hetzner host is the shared mailbox platform for projects that need
real IMAP/webmail inboxes. Keep app/transactional mail on Resend where possible;
use Mailcow for human/editor mailboxes and compliance addresses.

## Host

- SSH: `ssh root@89.167.42.128`
- Hostname: `vps-main`
- Mailcow path: `/opt/mailcow-dockerized`
- Public mail hostname: `mail.filippmiller.com`
- Mailcow UI: `https://mail.filippmiller.com/`
- IMAP: `mail.filippmiller.com:993`
- SMTP submission: `mail.filippmiller.com:587` with STARTTLS
- SMTPS: `mail.filippmiller.com:465`
- PTR/rDNS: `89.167.42.128 -> mail.filippmiller.com`

## Operational Fixes Applied

- Restored the missing `unbound-mailcow` service:
  `cd /opt/mailcow-dockerized && docker compose up -d unbound-mailcow`.
- Fixed the Coolify/Traefik route in `/data/coolify/proxy/dynamic/mailcow.yaml`
  to target stable Docker DNS:
  `https://mailcowdockerized-nginx-mailcow-1:8443`.
- Synced the valid Traefik Let's Encrypt certificate for `mail.filippmiller.com`
  into Mailcow so SMTP/IMAP clients do not see Mailcow's self-signed cert.
- Installed a daily systemd timer:
  `sync-mailcow-cert-from-traefik.timer`.

Repo copies of the cert-sync assets:

- `scripts/ops/sync-mailcow-cert-from-traefik.sh`
- `scripts/ops/sync-mailcow-cert-from-traefik.service`
- `scripts/ops/sync-mailcow-cert-from-traefik.timer`

## SovetyDoma Mail Domain

Mailcow domain: `1001sovet.ru`

Mailboxes created:

- `admin@1001sovet.ru`
- `peter.ivanov@1001sovet.ru`
- `maryana.sidorova@1001sovet.ru`
- `petr.pupkin@1001sovet.ru`
- `andrey.rybakov@1001sovet.ru`

Aliases created:

- `postmaster@1001sovet.ru -> admin@1001sovet.ru`
- `abuse@1001sovet.ru -> admin@1001sovet.ru`
- `dmarc@1001sovet.ru -> admin@1001sovet.ru`
- `contact@1001sovet.ru -> admin@1001sovet.ru`
- `developer@1001sovet.ru -> admin@1001sovet.ru`
- `dev@1001sovet.ru -> admin@1001sovet.ru`
- `petr.ivanov@1001sovet.ru -> peter.ivanov@1001sovet.ru`

Mailbox credentials are not committed. They are stored locally at:
`C:\Users\filip\.secrets\1001sovet-mailcow-mailboxes.env`.

## DNS At reg.ru

Status: verified on 2026-06-01 via Cloudflare `1.1.1.1`, Google `8.8.8.8`,
and Quad9 `9.9.9.9`.

| Type | Host | Value | Priority |
|------|------|-------|----------|
| MX | `@` | `mail.filippmiller.com.` | `10` |
| TXT | `@` | `v=spf1 mx ip4:89.167.42.128 ~all` | |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@1001sovet.ru; ruf=mailto:dmarc@1001sovet.ru; fo=1` | |
| TXT | `dkim._domainkey` | See DKIM value below | |

DKIM value:

```text
v=DKIM1;k=rsa;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAt4Phb2KEQ31ZbkXZ+8cG9YCnRMEX8ChxfWPWR2oQVlSJuy34nqoZT9/ExDKCk7C7smFj+wVA8cw7dGQKVUBFtXFxeCTYskpmYIp4N5QfPGtFoj+5dUGcpEnwh7JYCAbEVfWiJgPapsLA33zb12FymZW8kjq3BeXzR3NE2BnMOJFPiKiA6GeyPR8PAWWu+9IjnMcD+BQ29Z9dPLGDn9vadnOUelsm+AIF4Kv+Q4A93QU2bkGT+eFtaZSPkbQazLsVc+enuVSQCUZ84GZKxoOPSjniynoJmU5648Aw7ZotWQeWTXE4an1St/r9W6AZ4UEhrF0j7xArDeKBoQuGJvKGMQIDAQAB
```

Do not point users at `mail.1001sovet.ru` unless a matching certificate is added.
Use `mail.filippmiller.com` for IMAP/SMTP settings.

## Verification Commands

```bash
ssh root@89.167.42.128 "cd /opt/mailcow-dockerized && docker compose ps"
curl -I https://mail.filippmiller.com/
```

Local TLS/auth checks used during setup:

- IMAP TLS/login succeeded for `admin@1001sovet.ru` on port 993.
- SMTP STARTTLS/login succeeded for `admin@1001sovet.ru` on port 587.
- SMTP/IMAP certs validated against Let's Encrypt R13, expiring 2026-07-06.

Inbound public delivery is now DNS-routed to Mailcow. A local residential SMTP
probe reached Mailcow but was rejected by Spamhaus sender-IP policy before RCPT;
that confirms port 25 is public and anti-spam is active. A full live delivery
test should be run from Gmail or another normal mail provider.
