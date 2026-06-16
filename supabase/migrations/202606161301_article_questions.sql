begin;
-- Feature 6: Article Q&A table (article_questions)
-- Simplified Q&A per article: one row = one question + optional answer.

create table if not exists public.article_questions (
  id uuid primary key default gen_random_uuid(),
  article_slug text not null,
  question text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  answer text null,
  created_at timestamptz default now(),
  ip_hash text null
);

-- Index for fast lookups by article + status
CREATE INDEX IF NOT EXISTS idx_article_questions_article_status ON public.article_questions(article_slug, status);
CREATE INDEX IF NOT EXISTS idx_article_questions_status_created ON public.article_questions(status, created_at desc);

-- Enable RLS
alter table public.article_questions enable row level security;

-- Default-deny: service_role explicit all access
CREATE POLICY "service_role all access on article_questions" ON public.article_questions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Anon can INSERT only with status='pending' (moderated)
CREATE POLICY "anon can ask questions" ON public.article_questions
  FOR INSERT TO anon WITH CHECK (status = 'pending');

-- Public can only SELECT approved rows
CREATE POLICY "public sees approved questions only" ON public.article_questions
  FOR SELECT TO public USING (status = 'approved');

-- Rate-limit trigger: reuse enforce_ugc_rate_limit pattern
-- Scope: article_question, 4/min, 30/hr (same as comments)
CREATE OR REPLACE FUNCTION public.tg_rate_limit_article_questions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.enforce_ugc_rate_limit('article_question', 60, 4);
  PERFORM public.enforce_ugc_rate_limit('article_question', 3600, 30);
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_rate_limit_article_questions ON public.article_questions;
CREATE TRIGGER trg_rate_limit_article_questions
  BEFORE INSERT ON public.article_questions
  FOR EACH ROW EXECUTE FUNCTION public.tg_rate_limit_article_questions();

-- Moderator policy: admin/moderator can manage all rows
CREATE POLICY "moderators manage article_questions" ON public.article_questions
  FOR ALL TO public USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = any(array['moderator','admin'])
    )
  );

commit;
