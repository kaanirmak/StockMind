-- Existing ownership policies remain in force for all reads and writes.
ALTER TABLE public.watchlist_items ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS watchlist_items_order_idx ON public.watchlist_items(watchlist_id, position);
-- Full replica identity lets authenticated clients reconcile deleted rows.
ALTER TABLE public.watchlist_items REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'watchlist_items') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.watchlist_items;
  END IF;
END $$;
