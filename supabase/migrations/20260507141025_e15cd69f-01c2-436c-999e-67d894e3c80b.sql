CREATE TABLE public.user_times (
  user_id TEXT PRIMARY KEY,
  times JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_times ENABLE ROW LEVEL SECURITY;

-- ID-based simple auth (no password). Public access by user_id is intentional per spec.
CREATE POLICY "anyone can read user_times" ON public.user_times FOR SELECT USING (true);
CREATE POLICY "anyone can insert user_times" ON public.user_times FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone can update user_times" ON public.user_times FOR UPDATE USING (true);
CREATE POLICY "anyone can delete user_times" ON public.user_times FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_times_touch BEFORE UPDATE ON public.user_times
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();