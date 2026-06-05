-- Keep database category constraints in sync with the expanded public taxonomy.
-- Safe to re-run in environments where one of these tables does not exist yet.

do $$
declare
  allowed_categories constant text :=
    '''kulinaria'', ''dom-i-uborka'', ''dacha-i-ogorod'', ''layfkhaki'', ''ekonomiya'', ''rybalka'', ' ||
    '''zdorovie-i-bezopasnost'', ''semya-i-deti'', ''krasota-i-uhod'', ''otdyh-i-puteshestviya'', ''pokupki-i-tehnika''';
  c record;
begin
  if to_regclass('public.notification_topic_subscriptions') is not null then
    for c in
      select con.conname
      from pg_constraint con
      join pg_attribute att
        on att.attrelid = con.conrelid
       and att.attnum = any(con.conkey)
      where con.conrelid = 'public.notification_topic_subscriptions'::regclass
        and con.contype = 'c'
        and att.attname = 'category_slug'
    loop
      execute format('alter table public.notification_topic_subscriptions drop constraint %I', c.conname);
    end loop;

    execute 'alter table public.notification_topic_subscriptions add constraint notification_topic_subscriptions_category_slug_check check (category_slug in (' || allowed_categories || ')) not valid';
    execute 'alter table public.notification_topic_subscriptions validate constraint notification_topic_subscriptions_category_slug_check';
  end if;

  if to_regclass('public.articles_publication_index') is not null then
    for c in
      select con.conname
      from pg_constraint con
      join pg_attribute att
        on att.attrelid = con.conrelid
       and att.attnum = any(con.conkey)
      where con.conrelid = 'public.articles_publication_index'::regclass
        and con.contype = 'c'
        and att.attname = 'category_slug'
    loop
      execute format('alter table public.articles_publication_index drop constraint %I', c.conname);
    end loop;

    execute 'alter table public.articles_publication_index add constraint articles_publication_index_category_slug_check check (category_slug in (' || allowed_categories || ')) not valid';
    execute 'alter table public.articles_publication_index validate constraint articles_publication_index_category_slug_check';
  end if;

  if to_regclass('public.content_matrix') is not null then
    for c in
      select con.conname
      from pg_constraint con
      join pg_attribute att
        on att.attrelid = con.conrelid
       and att.attnum = any(con.conkey)
      where con.conrelid = 'public.content_matrix'::regclass
        and con.contype = 'c'
        and att.attname = 'category'
    loop
      execute format('alter table public.content_matrix drop constraint %I', c.conname);
    end loop;

    execute 'alter table public.content_matrix add constraint content_matrix_category_check check (category in (' || allowed_categories || ')) not valid';
    execute 'alter table public.content_matrix validate constraint content_matrix_category_check';
  end if;

  if to_regclass('public.user_articles') is not null then
    for c in
      select con.conname
      from pg_constraint con
      join pg_attribute att
        on att.attrelid = con.conrelid
       and att.attnum = any(con.conkey)
      where con.conrelid = 'public.user_articles'::regclass
        and con.contype = 'c'
        and att.attname = 'category'
    loop
      execute format('alter table public.user_articles drop constraint %I', c.conname);
    end loop;

    execute 'alter table public.user_articles add constraint user_articles_category_check check (category in (' || allowed_categories || ')) not valid';
    execute 'alter table public.user_articles validate constraint user_articles_category_check';
  end if;
end $$;
