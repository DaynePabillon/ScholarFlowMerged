-- 030_add_follow_up_status_to_ss_consultation.sql
-- Adds dedicated follow-up status for consultation concerns.

ALTER TABLE public.ss_consultation
ADD COLUMN IF NOT EXISTS follow_up_status text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ss_consultation_follow_up_status_check'
  ) THEN
    ALTER TABLE public.ss_consultation
    ADD CONSTRAINT ss_consultation_follow_up_status_check
    CHECK (
      follow_up_status IS NULL
      OR follow_up_status = ANY (ARRAY['overdue'::text, 'open'::text, 'resolved'::text])
    );
  END IF;
END $$;

-- Backfill from existing data while preserving any valid status values.
UPDATE public.ss_consultation
SET follow_up_status = CASE
  WHEN LOWER(TRIM(COALESCE(status, ''))) IN ('overdue', 'open', 'resolved')
    THEN LOWER(TRIM(status))
  WHEN COALESCE(TRIM("conAction"), '') = '' OR COALESCE(TRIM("conConcerns"), '') = ''
    THEN 'open'
  WHEN LOWER(COALESCE("conConcerns", '')) LIKE '%blocker%'
    OR LOWER(COALESCE("conConcerns", '')) LIKE '%risk%'
    THEN 'overdue'
  ELSE 'resolved'
END
WHERE follow_up_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_ss_consultation_follow_up_status
ON public.ss_consultation (follow_up_status);
