alter table public.feedback_events
  drop constraint if exists feedback_events_kind_check;

alter table public.feedback_events
  add constraint feedback_events_kind_check
  check (
    kind = any (array[
      'helped',
      'not_helped',
      'tried',
      'worked',
      'not_worked',
      'want_try',
      'verdict_yes',
      'verdict_no',
      'view'
    ]::text[])
  );
