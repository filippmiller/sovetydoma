alter table public.notification_recipients
  add column if not exists last_delivery_at timestamptz;

create index if not exists notification_recipients_last_delivery_at_idx
  on public.notification_recipients (last_delivery_at asc nulls first);