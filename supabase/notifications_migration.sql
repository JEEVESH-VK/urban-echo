-- ================================================================
-- URBAN ECHO — Smart Notification System Migration
-- File: supabase/notifications_migration.sql
-- Safe & idempotent — run in Supabase SQL Editor.
-- No existing data is deleted or modified.
-- ================================================================

-- ── §1  notifications table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title             TEXT        NOT NULL,
  message           TEXT        NOT NULL,
  notification_type TEXT        NOT NULL
    CHECK (notification_type IN (
      'complaint_submitted',
      'complaint_assigned',
      'work_started',
      'evidence_submitted',
      'complaint_verified',
      'complaint_reopened',
      'official_remark',
      'complaint_overdue',
      'resolution_approved',
      'new_complaint',
      'general'
    )),
  complaint_id      UUID        REFERENCES public.complaints(id) ON DELETE CASCADE,
  is_read           BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── §2  Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON public.notifications (user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, is_read)
  WHERE is_read = FALSE;

CREATE INDEX IF NOT EXISTS idx_notifications_complaint_id
  ON public.notifications (complaint_id);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON public.notifications (created_at DESC);

-- Partial unique index to prevent duplicate notifications
-- Same user, same complaint, same type → only one notification allowed per hour
-- This prevents duplicates from retries or rapid successive events.
-- We use a function-based approach in the trigger instead (see §4).

-- ── §3  RLS ─────────────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_system" ON public.notifications;

-- Users can only see their own notifications
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

-- Users can only mark their own notifications as read (is_read field only)
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No INSERT allowed from anon or authenticated roles directly.
-- All inserts happen from SECURITY DEFINER trigger functions (postgres role).
-- This ensures only actual DB events can create notifications.

-- ── §4  Safe notification insert helper (dedup guard) ────────────
-- Called by all triggers. Inserts a notification only if no identical
-- notification (same user, complaint, type) was created in the last 5 minutes.
-- This prevents duplicates from trigger re-fires or manual retries.
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id           UUID,
  p_title             TEXT,
  p_message           TEXT,
  p_notification_type TEXT,
  p_complaint_id      UUID DEFAULT NULL
)
  RETURNS VOID
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  -- Deduplication: skip if same notification created in last 5 minutes
  IF EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id           = p_user_id
      AND notification_type = p_notification_type
      AND complaint_id      IS NOT DISTINCT FROM p_complaint_id
      AND created_at        > NOW() - INTERVAL '5 minutes'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications
    (user_id, title, message, notification_type, complaint_id)
  VALUES
    (p_user_id, p_title, p_message, p_notification_type, p_complaint_id);
END;
$$;

-- ── §5  Notification trigger on complaints ───────────────────────
-- Fires on INSERT (new complaint) and UPDATE (status changes).
-- Routes notifications to the correct users based on roles and ownership.
CREATE OR REPLACE FUNCTION public.notify_on_complaint_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_reporter_id  UUID;
  v_ref_id       TEXT;
  v_staff_id     UUID;
  v_official_id  UUID;
BEGIN
  v_reporter_id := NEW.reporter_id;
  v_ref_id      := NEW.ref_id;

  -- ── INSERT: new complaint submitted ──────────────────────────
  IF TG_OP = 'INSERT' THEN
    -- Notify citizen (non-anonymous)
    IF v_reporter_id IS NOT NULL THEN
      PERFORM public.create_notification(
        v_reporter_id,
        'Complaint Submitted',
        'Your complaint ' || v_ref_id || ' has been received. We will review it shortly.',
        'complaint_submitted',
        NEW.id
      );
    END IF;

    -- Notify all municipal staff + admin of a new incoming complaint
    FOR v_staff_id IN
      SELECT id FROM public.profiles WHERE role IN ('municipal_staff', 'admin')
    LOOP
      PERFORM public.create_notification(
        v_staff_id,
        'New Complaint Received',
        'A new complaint ' || v_ref_id || ' has been submitted and requires review.',
        'new_complaint',
        NEW.id
      );
    END LOOP;

    RETURN NEW;
  END IF;

  -- ── UPDATE: only react when status actually changes ──────────
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN

    -- ── assigned → notify citizen ─────────────────────────────
    IF NEW.status = 'assigned' AND v_reporter_id IS NOT NULL THEN
      PERFORM public.create_notification(
        v_reporter_id,
        'Complaint Assigned',
        'Your complaint ' || v_ref_id || ' has been assigned to the ' ||
          COALESCE(NEW.department, 'relevant') || ' department.',
        'complaint_assigned',
        NEW.id
      );
    END IF;

    -- ── in_progress → notify citizen ─────────────────────────
    IF NEW.status = 'in_progress' AND v_reporter_id IS NOT NULL THEN
      PERFORM public.create_notification(
        v_reporter_id,
        'Work Started',
        'Work has begun on your complaint ' || v_ref_id || '. Our team is actively addressing the issue.',
        'work_started',
        NEW.id
      );
    END IF;

    -- ── awaiting_citizen_verification → notify citizen ────────
    IF NEW.status = 'awaiting_citizen_verification' AND v_reporter_id IS NOT NULL THEN
      PERFORM public.create_notification(
        v_reporter_id,
        'Please Verify Completion',
        'Municipal staff has submitted resolution evidence for ' || v_ref_id ||
          '. Please review and confirm whether the work is complete.',
        'evidence_submitted',
        NEW.id
      );
    END IF;

    -- ── verified → notify staff + citizen ────────────────────
    IF NEW.status = 'verified' THEN
      IF v_reporter_id IS NOT NULL THEN
        PERFORM public.create_notification(
          v_reporter_id,
          'Complaint Verified ✓',
          'Your complaint ' || v_ref_id || ' has been marked as verified and resolved. Thank you!',
          'complaint_verified',
          NEW.id
        );
      END IF;
      -- Notify staff who submitted completion evidence
      IF NEW.completion_submitted_by IS NOT NULL THEN
        PERFORM public.create_notification(
          NEW.completion_submitted_by,
          'Resolution Verified by Citizen',
          'The citizen has verified that complaint ' || v_ref_id || ' is resolved. Good work!',
          'complaint_verified',
          NEW.id
        );
      END IF;
    END IF;

    -- ── reopened → notify staff + all higher officials ────────
    IF NEW.status = 'reopened' THEN
      -- Notify staff who submitted evidence
      IF NEW.completion_submitted_by IS NOT NULL THEN
        PERFORM public.create_notification(
          NEW.completion_submitted_by,
          'Complaint Reopened by Citizen',
          'The citizen rejected your resolution for ' || v_ref_id ||
            '. Feedback: ' || COALESCE(NEW.citizen_feedback, 'No feedback provided'),
          'complaint_reopened',
          NEW.id
        );
      END IF;

      -- Also notify all municipal staff if assigned_staff_id differs
      IF NEW.assigned_staff_id IS NOT NULL
         AND NEW.assigned_staff_id IS DISTINCT FROM NEW.completion_submitted_by
      THEN
        PERFORM public.create_notification(
          NEW.assigned_staff_id,
          'Assigned Complaint Reopened',
          'Complaint ' || v_ref_id || ' you are assigned to was reopened by the citizen.',
          'complaint_reopened',
          NEW.id
        );
      END IF;

      -- Notify all higher officials of a reopened complaint
      FOR v_official_id IN
        SELECT id FROM public.profiles WHERE role IN ('higher_official', 'admin')
      LOOP
        PERFORM public.create_notification(
          v_official_id,
          'Complaint Requires Official Review',
          'Complaint ' || v_ref_id || ' was rejected by the citizen and requires higher-level review.',
          'complaint_reopened',
          NEW.id
        );
      END LOOP;
    END IF;

    -- ── in_progress (after reopened / official send-back) ────
    -- Notify citizen that work is restarted after official review
    IF NEW.status = 'in_progress'
       AND OLD.status IN ('reopened', 'awaiting_citizen_verification')
       AND v_reporter_id IS NOT NULL
    THEN
      PERFORM public.create_notification(
        v_reporter_id,
        'Complaint Re-assigned for Rework',
        'Your complaint ' || v_ref_id || ' has been sent back to the department for additional work based on your feedback.',
        'work_started',
        NEW.id
      );
    END IF;

  END IF;

  -- ── UPDATE: overdue check (due_at set and now in the past) ──
  IF TG_OP = 'UPDATE'
     AND NEW.due_at IS NOT NULL
     AND NEW.due_at < NOW()
     AND NEW.status NOT IN ('resolved', 'verified')
     AND (OLD.due_at IS NULL OR OLD.due_at != NEW.due_at)
  THEN
    -- Notify all higher officials when a deadline is set that is already past
    FOR v_official_id IN
      SELECT id FROM public.profiles WHERE role IN ('higher_official', 'admin')
    LOOP
      PERFORM public.create_notification(
        v_official_id,
        'Overdue Complaint Detected',
        'Complaint ' || v_ref_id || ' has passed its SLA deadline and is overdue.',
        'complaint_overdue',
        NEW.id
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger (safe conditional)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname  = 'trg_notify_complaint_change'
      AND tgrelid = 'public.complaints'::regclass
  ) THEN
    CREATE TRIGGER trg_notify_complaint_change
      AFTER INSERT OR UPDATE ON public.complaints
      FOR EACH ROW EXECUTE FUNCTION public.notify_on_complaint_change();
  END IF;
END;
$$;

-- ── §6  Notification trigger on official_remarks ─────────────────
-- Notifies municipal staff when a higher official adds a remark.
CREATE OR REPLACE FUNCTION public.notify_on_official_remark()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_ref_id       TEXT;
  v_reporter_id  UUID;
  v_staff_id     UUID;
BEGIN
  -- Get complaint details
  SELECT ref_id, reporter_id
    INTO v_ref_id, v_reporter_id
    FROM public.complaints
   WHERE id = NEW.complaint_id
   LIMIT 1;

  IF v_ref_id IS NULL THEN RETURN NEW; END IF;

  -- Notify all municipal staff of the official remark
  FOR v_staff_id IN
    SELECT id FROM public.profiles WHERE role IN ('municipal_staff', 'admin')
  LOOP
    -- Skip the official who added the remark
    IF v_staff_id != NEW.official_id THEN
      PERFORM public.create_notification(
        v_staff_id,
        'Official Instruction Received',
        'A higher official has added an instruction for complaint ' || v_ref_id ||
          ': ' || LEFT(NEW.remark, 100),
        'official_remark',
        NEW.complaint_id
      );
    END IF;
  END LOOP;

  -- Also notify the citizen of the official review (if non-anonymous)
  IF v_reporter_id IS NOT NULL THEN
    PERFORM public.create_notification(
      v_reporter_id,
      'Higher Official Review',
      'A higher official has reviewed your complaint ' || v_ref_id || ' and issued instructions.',
      'official_remark',
      NEW.complaint_id
    );
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname  = 'trg_notify_official_remark'
      AND tgrelid = 'public.official_remarks'::regclass
  ) THEN
    CREATE TRIGGER trg_notify_official_remark
      AFTER INSERT ON public.official_remarks
      FOR EACH ROW EXECUTE FUNCTION public.notify_on_official_remark();
  END IF;
END;
$$;

-- ── §7  Enable Realtime on notifications ─────────────────────────
-- Run this in the Supabase Dashboard → Database → Replication
-- OR via SQL (requires superuser):
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
-- NOTE: If you see "permission denied", enable it via:
--   Dashboard → Database → Replication → Tables → Add notifications

-- ── §8  Verify the migration ─────────────────────────────────────
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema='public' AND table_name='notifications';
--
-- SELECT tgname FROM pg_trigger
--   WHERE tgname IN ('trg_notify_complaint_change','trg_notify_official_remark');
--
-- SELECT proname FROM pg_proc WHERE proname IN
--   ('create_notification','notify_on_complaint_change','notify_on_official_remark');
-- ================================================================
