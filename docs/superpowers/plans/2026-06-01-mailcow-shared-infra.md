# Mailcow Shared Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the existing Hetzner Mailcow instance and prepare it as the shared mailbox platform for SovetyDoma and future projects.

**Architecture:** Mailcow remains on the existing Hetzner/Coolify host at `89.167.42.128`, behind Traefik for web UI access. Mailcow handles human/editor inboxes; Resend remains the preferred transactional email sender. Certificates for SMTP/IMAP are synchronized from Traefik's ACME store into Mailcow because Traefik owns public ports 80/443.

**Tech Stack:** Mailcow Dockerized, Docker Compose, Coolify Traefik, systemd timer, reg.ru DNS, Resend for app mail.

---

### Task 1: Inventory And Backup

**Files:**
- Read: `/opt/mailcow-dockerized/mailcow.conf`
- Read: `/data/coolify/proxy/dynamic/mailcow.yaml`
- Create on server: `/root/mailcow-pre-1001sovet-<timestamp>/`

- [x] Confirm SSH access to `root@89.167.42.128`.
- [x] Confirm Mailcow containers and ports are present.
- [x] Back up `mailcow.conf`, `docker-compose.yml`, and core Mailcow DB tables.

### Task 2: Stabilize Core Mailcow

**Files:**
- Modify on server: `/data/coolify/proxy/dynamic/mailcow.yaml`

- [x] Restore missing `unbound-mailcow` with `docker compose up -d unbound-mailcow`.
- [x] Replace stale Traefik backend IP with `mailcowdockerized-nginx-mailcow-1`.
- [x] Verify `https://mail.filippmiller.com/` returns 200.

### Task 3: Fix Mail Protocol TLS

**Files:**
- Create: `scripts/ops/sync-mailcow-cert-from-traefik.sh`
- Create: `scripts/ops/sync-mailcow-cert-from-traefik.service`
- Create: `scripts/ops/sync-mailcow-cert-from-traefik.timer`
- Install on server: `/usr/local/sbin/sync-mailcow-cert-from-traefik.sh`
- Install on server: `/etc/systemd/system/sync-mailcow-cert-from-traefik.service`
- Install on server: `/etc/systemd/system/sync-mailcow-cert-from-traefik.timer`

- [x] Extract `mail.filippmiller.com` certificate from `/data/coolify/proxy/acme.json`.
- [x] Install it into `/opt/mailcow-dockerized/data/assets/ssl/`.
- [x] Restart only Mailcow `postfix`, `dovecot`, and `nginx`.
- [x] Enable daily certificate sync timer.
- [x] Verify TLS on 993, 465, and 587 STARTTLS.

### Task 4: Provision SovetyDoma Domain

**Files:**
- Secret local file: `C:\Users\filip\.secrets\1001sovet-mailcow-mailboxes.env`
- Docs: `docs/mailcow-shared-infra.md`

- [x] Add Mailcow domain `1001sovet.ru`.
- [x] Generate DKIM selector `dkim`.
- [x] Create editor/admin mailboxes.
- [x] Create operational aliases.
- [x] Store generated mailbox credentials only in the local secrets file.
- [x] Verify IMAP and SMTP auth for `admin@1001sovet.ru`.

### Task 5: DNS Cutover

**Files:**
- Docs: `docs/mailcow-shared-infra.md`

- [x] Produce exact reg.ru DNS records.
- [x] User adds MX/SPF/DKIM/DMARC records at reg.ru.
- [x] After DNS propagation, verify public MX and TXT records.
- [ ] Send and receive a real email test with Gmail or another normal mail provider.

### Task 6: Reusable Project Workflow

**Files:**
- Docs: `docs/mailcow-shared-infra.md`

- [x] Document shared host, mailbox strategy, cert sync, and DNS pattern.
- [ ] For each future project, repeat: add Mailcow domain, create mailbox/aliases, add DNS, verify.
