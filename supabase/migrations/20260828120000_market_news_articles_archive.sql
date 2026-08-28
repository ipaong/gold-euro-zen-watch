-- Migration: 20260828120000_market_news_articles_archive.sql
-- Description: Historical archive for market news articles.
-- Allows the app to auto-archive live articles and serve them to Time Machine.

CREATE TABLE IF NOT EXISTS public.market_news_articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  url TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  tag TEXT,
  impact TEXT DEFAULT 'low',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast Time Machine queries filtering by published_at <= asOf
CREATE INDEX IF NOT EXISTS idx_market_news_articles_published_at
  ON public.market_news_articles (published_at DESC);

-- Enable RLS
ALTER TABLE public.market_news_articles ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read market news articles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'market_news_articles' AND policyname = 'Anyone can read market news articles'
  ) THEN
    CREATE POLICY "Anyone can read market news articles"
      ON public.market_news_articles
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- Allow system / authenticated / anon to insert and upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'market_news_articles' AND policyname = 'Allow insert on market news articles'
  ) THEN
    CREATE POLICY "Allow insert on market news articles"
      ON public.market_news_articles
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'market_news_articles' AND policyname = 'Allow update on market news articles'
  ) THEN
    CREATE POLICY "Allow update on market news articles"
      ON public.market_news_articles
      FOR UPDATE
      TO anon, authenticated
      USING (true);
  END IF;
END $$;
