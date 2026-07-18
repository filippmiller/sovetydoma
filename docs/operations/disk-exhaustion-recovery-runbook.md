# Disk Exhaustion Recovery Runbook (Shared VPS 89.169.44.37)

This runbook covers detection, triage, emergency cleanup, and the permanent safeguards installed on 2026-07-18 after the P0 incident where `/dev/sda1` hit 154/154 GB, PostgreSQL PANICed, and dynamic articles on 1001sovet.ru returned 503.

Access: `ssh -i ~/.ssh/timeweb_1001sovet root@89.169.44.37` (Timeweb VPS, shared by many projects: supabase stack, zoopolis, ocf, ferma2, medkarta, gdeuslugi, iamcaptain, teplo — ~48 containers).

## Symptoms

- `df -h /` shows `/` at 95–100%.
- Dynamic article pages on 1001sovet.ru return 503 while static pages still work.
- Supabase logs / `docker logs supabase-db` show PostgreSQL `PANIC: could not write to file ... No space left on device`.
- Other tenants on the VPS (zoopolis, ferma2, etc.) fail with disk-write errors at the same time.

## Instant Triage (fast, bounded commands only)

Never run recursive `du` on `/var/lib/docker` or `/` — on this loaded VPS it hangs for minutes. Use these instead:

```bash
df -h /                                                          # overall state
journalctl --disk-usage                                          # journald footprint
find /var/lib/docker/containers -name '*-json.log' -size +100M -exec du -m {} \; | sort -rn | head
docker system df                                                 # images/volumes/build cache (may be slow; skip if so)
docker ps -q | wc -l                                             # expected: 48
```

Primary offenders, in historical order of likelihood:

1. Docker json-file container logs (unbounded before 2026-07-18 for pre-existing containers).
2. systemd journal (unbounded before 2026-07-18).
3. Docker images / build cache (`docker system df` — reclaimable space only, see "Never delete" below).

## Emergency Cleanup Procedure

1. Vacuum journald to a bounded size:

   ```bash
   journalctl --vacuum-size=400M
   ```

2. Truncate oversized container logs **in place** (never `rm` the file — Docker holds the fd):

   ```bash
   mkdir -p /root/docker-log-tail-before-cleanup-$(date +%Y%m%d)
   find /var/lib/docker/containers -name '*-json.log' -size +150M | while read -r f; do
     cid=$(basename "$(dirname "$f")")
     name=$(docker inspect --format '{{.Name}}' "$cid" | tr -d '/')
     tail -n 5000 "$f" > "/root/docker-log-tail-before-cleanup-$(date +%Y%m%d)/$name.log"
     : > "$f"
     echo "truncated $name"
   done
   ```

3. If more space is needed, prune **only** clearly reclaimable cache:

   ```bash
   docker builder prune -f        # build cache only
   ```

4. Verify: `df -h /`, then check production health (see below).

### Never delete

- Docker volumes (`/var/lib/docker/volumes`) — contain Postgres/Supabase data.
- Images that may be needed for rollback. Prune images only with an explicit, reviewed command.
- Container log files themselves — truncate with `: > file` instead.

## Permanent Safeguards (installed 2026-07-18)

### Docker daemon log rotation

`/etc/docker/daemon.json` (backup: `/etc/docker/daemon.json.bak-20260718`):

```json
{
  "dns": ["85.193.93.194", "85.193.93.193", "1.1.1.1"],
  "log-driver": "json-file",
  "log-opts": { "max-size": "50m", "max-file": "3" }
}
```

Caveat: daemon-level `log-opts` apply only to **newly created** containers. Containers created before 2026-07-18 keep unbounded logs until they are recreated (e.g. `docker compose up -d --force-recreate`). The disk watchdog below covers them meanwhile.

### Journald bounds

`/etc/systemd/journald.conf` (backup: `/etc/systemd/journald.conf.bak-20260718`):

- `SystemMaxUse=500M`
- `RuntimeMaxUse=200M`

Verify with `journalctl --disk-usage`.

### Disk watchdog

- Script: `/usr/local/sbin/disk-watch.sh`, cron every 5 minutes (`*/5 * * * *`).
- At ≥ 80%: appends a timestamped `ALERT` line to `/var/log/disk-watch.log`; if `/etc/disk-watch-webhook` exists and contains a URL, POSTs a JSON alert to it (URL is never hardcoded in the script).
- At ≥ 90%: also truncates any docker json log > 100 MB in place, saving the last 2000 lines to `/root/disk-watch-tails/` first; every action is logged.
- Log rotation: `/etc/logrotate.d/disk-watch` (weekly, rotate 8, compress, copytruncate).
- Manual test of the alert path: `DISK_WATCH_FORCE_ALERT=1 /usr/local/sbin/disk-watch.sh`, then `cat /var/log/disk-watch.log`.

To enable the webhook alert, create `/etc/disk-watch-webhook` containing a single URL line (e.g. a Telegram/Slack relay). Keep the URL out of git and docs.

## Docker Restart Caveats

Before any `systemctl restart docker`:

```bash
docker ps -q | xargs docker inspect --format '{{.Name}} {{.HostConfig.RestartPolicy.Name}}'
docker ps -q | wc -l
```

- Containers with `always` or `unless-stopped` come back automatically.
- Containers with an empty or `no` policy do **not** come back — record them and `docker start <name>` manually after.
- As of 2026-07-18 all 48 running containers have `unless-stopped` or `always`; re-check before each restart.
- After restart, wait ~30 s, compare `docker ps -q | wc -l` to the pre-restart count, and spot-check `supabase-db`, `supabase-rest`, `supabase-kong`.

## Production Health Check

```bash
df -h /
docker ps --format '{{.Names}} {{.Status}}' | grep -E 'supabase-db|supabase-rest'
curl -sS -o /dev/null -w '%{http_code}\n' https://1001sovet.ru/
curl -sS -o /dev/null -w '%{http_code}\n' -L https://1001sovet.ru/zdorovie-i-bezopasnost/kak-snizit-davlenie-za-10-minut-bez-tabletok
```

Expected: homepage `200`; article URLs may `301` to a trailing-slash variant — always use `-L` and expect a final `200`. A `503` on dynamic articles with a healthy homepage means Supabase is down — check disk first.

## Escalation

- If cleanup does not bring `/` below 90%, or PostgreSQL does not recover after space is freed (`docker restart supabase-db`), escalate to the project owner immediately — this VPS is shared and every tenant is affected.
- If disk fills repeatedly despite the watchdog, investigate per-container log volume (`docker logs --since 1h <name> | wc -l`) for a log-spamming service and fix the source, or set per-container `log-opts` in that project's compose file.
- Evidence tails from the 2026-07-17/18 incidents: `/root/docker-log-tail-before-cleanup-20260718/`, `/root/docker-log-tail-before-rotation-20260718/`, `/root/disk-watch-tails/`.
