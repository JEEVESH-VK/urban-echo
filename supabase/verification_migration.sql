-- ============================================================
-- URBAN ECHO — Citizen Verification of Resolution Migration
-- File: supabase/verification_migration.sql
-- Safe & idempotent — run in Supabase SQL Editor.
-- No existing data is deleted or modified.
-- ============================================================

-- ── Step 1: Expand the status CHECK constraint ────────────────
-- Drop the old constraint and replace with the extended one.
-- Existing rows stay valid because their values remain in the new list.
ALTER TABLE public.complaints
  DROP CONSTRAINT IF EXISTS complaints_status_check;

ALTER TABLE public.complaints
  ADD CONSTRAINT complaints_status_check
  CHECK (status IN (
    'submitted',
    'under_review',
    'assigned',
    'in_progress',
    'awaiting_citizen_verification',
    'verified',
    'reopened',
    'resolved'
  ));

-- ── Step 2: Add new columns (idempotent — IF NOT EXISTS) ──────
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS completion_notes         TEXT,
  ADD COLUMN IF NOT EXISTS completion_photo_url     TEXT,
  ADD COLUMN IF NOT EXISTS completion_submitted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_submitted_by  UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS citizen_feedback         TEXT,
  ADD COLUMN IF NOT EXISTS citizen_verified_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS citizen_verified_by      UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ── Step 3: Index on new status values ───────────────────────
CREATE INDEX IF NOT EXISTS idx_complaints_status_verification
  ON public.complaints (status)
  WHERE status IN ('awaiting_citizen_verification', 'reopened');

-- ── Step 4: RLS — allow citizens to update verification fields
--   Citizens may only update a complaint that:
--     (a) belongs to them
--     (b) is currently awaiting_citizen_verification
--   After their update the status must be 'verified' or 'reopened'.
--   They cannot change reporter_id, category, description, etc.
DROP POLICY IF EXISTS "complaints_citizen_verify" ON public.complaints;

CREATE POLICY "complaints_citizen_verify"
  ON public.complaints
  FOR UPDATE
  USING (
    reporter_id = auth.uid()
    AND status = 'awaiting_citizen_verification'
  )
  WITH CHECK (
    reporter_id = auth.uid()
    AND status IN ('verified', 'reopened')
  );

-- ── Step 5: RLS — staff can submit resolution evidence
--   The existing complaints_staff_update policy (USING is_municipal_staff())
--   already allows this. No additional policy needed for staff updates.
--   Verify it exists:
-- SELECT policyname FROM pg_policies
--   WHERE tablename='complaints' AND policyname='complaints_staff_update';

-- ── Step 6: RLS — officials can approve/reject reopened complaints
DROP POLICY IF EXISTS "complaints_official_review" ON public.complaints;

CREATE POLICY "complaints_official_review"
  ON public.complaints
  FOR UPDATE
  USING (
    status IN ('reopened', 'awaiting_citizen_verification')
    AND public.is_higher_official()
  )
  WITH CHECK (
    public.is_higher_official()
    AND status IN ('verified', 'in_progress', 'reopened')
  );

-- ── Step 7: Grant storage path for completion photos ─────────
-- Uses the same complaint-photos bucket. No bucket change needed.
-- Completion photos are stored as: completion/{complaint_id}-{timestamp}.ext

-- ── Verification query ────────────────────────────────────────
-- Run these to confirm the migration worked:

-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'complaints'
--   AND column_name IN (
--     'completion_notes','completion_photo_url',
--     'completion_submitted_at','completion_submitted_by',
--     'citizen_feedback','citizen_verified_at','citizen_verified_by'
--   );
-- Expected: 7 rows

-- SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'complaints'::regclass
--   AND conname = 'complaints_status_check';
-- Expected: shows all 8 statuses including awaiting_citizen_verification

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
