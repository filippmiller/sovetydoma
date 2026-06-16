begin;
-- Feature 8: Favorites 2.0 — named collections

-- Collections table: named buckets of articles owned by a user
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  is_public boolean not null default false,
  created_at timestamptz default now(),
  unique(owner_id, slug)
);

-- Collection items: many-to-many link
create table if not exists public.collection_items (
  collection_id uuid not null references public.collections(id) on delete cascade,
  article_slug text not null,
  primary key (collection_id, article_slug)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_collections_owner ON public.collections(owner_id);
CREATE INDEX IF NOT EXISTS idx_collections_public_slug ON public.collections(is_public, slug) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_collection_items_collection ON public.collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_article ON public.collection_items(article_slug);

-- Enable RLS
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;

-- Default-deny: service_role explicit all access
CREATE POLICY "service_role all access on collections" ON public.collections
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role all access on collection_items" ON public.collection_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Owner full CRUD on collections
CREATE POLICY "owner can manage own collections" ON public.collections
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Owner full CRUD on collection_items via collection ownership
CREATE POLICY "owner can manage own collection items" ON public.collection_items
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.collections c
      WHERE c.id = collection_items.collection_id AND c.owner_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.collections c
      WHERE c.id = collection_items.collection_id AND c.owner_id = auth.uid()
    )
  );

-- Public can only SELECT public collections
CREATE POLICY "public can view public collections" ON public.collections
  FOR SELECT TO public USING (is_public = true);

-- Public can only SELECT items of public collections
CREATE POLICY "public can view public collection items" ON public.collection_items
  FOR SELECT TO public USING (
    EXISTS (
      SELECT 1 FROM public.collections c
      WHERE c.id = collection_items.collection_id AND c.is_public = true
    )
  );

-- Moderator policy on collections (admin/moderator can manage all)
CREATE POLICY "moderators manage collections" ON public.collections
  FOR ALL TO public USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = any(array['moderator','admin'])
    )
  );

CREATE POLICY "moderators manage collection_items" ON public.collection_items
  FOR ALL TO public USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = any(array['moderator','admin'])
    )
  );

-- Rate-limit triggers: moderate limits for collection creation (2/10min, 10/day)
CREATE OR REPLACE FUNCTION public.tg_rate_limit_collections()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.enforce_ugc_rate_limit('collections', 600, 2);
  PERFORM public.enforce_ugc_rate_limit('collections', 86400, 10);
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_rate_limit_collections ON public.collections;
CREATE TRIGGER trg_rate_limit_collections
  BEFORE INSERT ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.tg_rate_limit_collections();

-- Moderate rate limit on collection_items (12/10min, 50/day) — bulk adds
CREATE OR REPLACE FUNCTION public.tg_rate_limit_collection_items()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.enforce_ugc_rate_limit('collection_items', 600, 12);
  PERFORM public.enforce_ugc_rate_limit('collection_items', 86400, 50);
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_rate_limit_collection_items ON public.collection_items;
CREATE TRIGGER trg_rate_limit_collection_items
  BEFORE INSERT ON public.collection_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_rate_limit_collection_items();

commit;
