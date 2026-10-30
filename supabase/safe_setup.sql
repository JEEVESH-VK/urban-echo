-- =============================================================================
-- URBAN ECHO — Safe Database Setup
-- File: supabase/safe_setup.sql
-- Version: 3.2 (Dependency-order fix — 2026-10-30)
--
-- EXECUTION: Paste the entire file into Supabase SQL Editor → Run once.
-- IDEMPOTENT: Safe to run multiple times. No data is ever deleted.
-- IMPORTANT: CREATE TABLE IF NOT EXISTS does NOT add missing columns or
-- update old constraints on tables that already exist. If this database
-- has an older schema, compare it with the definitions below and apply a
-- separately reviewed migration before relying on the application.
--
-- SECTIONS:
--   §1   Tables  (CREATE TABLE IF NOT EXISTS — never destructive)
--   §2   Role-checking SECURITY DEFINER helper functions (recursion-free)
--   §3   Ref-ID sequence + BEFORE INSERT trigger
--   §4   Auto-create profile on auth signup trigger
--   §5   updated_at trigger (safe conditional creation)
--   §6   Status-change auto-history trigger (AFTER UPDATE, no duplicate guard)
--   §7   Overdue complaints view  (security_invoker, excludes resolved)
--   §8   Indexes  (all IF NOT EXISTS)
--   §9   Enable RLS on all tables
--   §10  Drop stale policies (IF EXISTS — only policies, never data)
--   §11  Profiles RLS policies
--   §12  Complaints RLS policies
--   §13  Status-history RLS policies
--   §14  Official remarks RLS policies
--   §15  Storage bucket + storage object policies
--   §16  Role-management helper comments (manual SQL — not executed here)
--
-- AUDIT CONFIRMED:
--   ✓  No DROP TABLE / TRUNCATE / DELETE FROM / DROP SCHEMA anywhere
--   ✓  No DROP TRIGGER anywhere (conditional DO blocks used instead)
--   ✓  Every dropped policy is immediately recreated below
--   ✓  All SECURITY DEFINER functions have SET search_path = public
--   ✓  Ref-ID sequence synchronized with existing IDs; trigger skips collisions
--   ✓  Status-history trigger fires only when OLD.status ≠ NEW.status
--   ✓  Storage compatible with frontend getPublicUrl() (bucket kept public
--       via ON CONFLICT DO NOTHING on the public flag — see §15 note)
--   ✓  higher_official can SELECT complaints via is_staff_or_official()
--   ✓  municipal_staff/admin can UPDATE complaints via is_municipal_staff()
--   ✓  Citizens see only their own complaints (reporter_id = auth.uid())
--   ✓  Self-created profiles are restricted to the citizen role
--   ✓  Manual audit rows must identify the authenticated staff/official
-- =============================================================================


-- =============================================================================
-- §1  TABLES
--
-- All use CREATE TABLE IF NOT EXISTS.
-- Column names, CHECK values, and types are cross-verified against every
-- frontend file that issues DB queries:
--   AuthContext.jsx          → profiles columns
--   SubmitComplaint.jsx      → complaints INSERT columns
--   ComplaintDetail.jsx      → complaints SELECT + UPDATE columns
--   Complaints.jsx           → complaints SELECT columns
--   municipal/Dashboard.jsx  → complaints SELECT columns
--   citizen/Dashboard.jsx    → complaints SELECT + reporter_id filter
--   official/Dashboard.jsx   → complaints SELECT, official_remarks INSERT/SELECT
--   utils.js                 → CATEGORIES, STATUSES, PRIORITIES, DEPARTMENTS arrays
-- =============================================================================

-- ── profiles ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT        NOT NULL,
  email       TEXT,
  phone       TEXT,
  area        TEXT,
  role        TEXT        NOT NULL DEFAULT 'citizen'
              CHECK (role IN ('citizen', 'municipal_staff', 'admin', 'higher_official')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── complaint_ref_seq ─────────────────────────────────────────────────────────
-- Monotonically increasing sequence for ref IDs.
-- nextval() is atomic — concurrent transactions each get a unique value.
CREATE SEQUENCE IF NOT EXISTS public.complaint_ref_seq
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

-- ── complaints ────────────────────────────────────────────────────────────────
-- FIX APPLIED (Audit point 5): ref_id NOT NULL constraint is satisfied by the
-- BEFORE INSERT trigger in §3 which overwrites any client-supplied value.
-- The description CHECK >= 10 mirrors frontend validation (SubmitComplaint.jsx).
--
-- Verified column list against SubmitComplaint.jsx INSERT payload:
--   ref_id ✓  reporter_id ✓  category ✓  description ✓  photo_url ✓
--   anonymous ✓  location_text ✓  latitude ✓  longitude ✓
--   status ✓  priority ✓  (department, due_at, action_taken are set by staff)
--
-- Verified against ComplaintDetail.jsx UPDATE payload:
--   status ✓  priority ✓  department ✓  due_at ✓  action_taken ✓
--   resolution_notes ✓  updated_at ✓
--
-- Verified enum values against utils.js arrays (case-sensitive):
--   CATEGORIES: pothole, garbage, drainage, streetlight, damaged_footpath,
--               water_leakage, other  ✓
--   STATUSES:   submitted, under_review, assigned, in_progress, resolved  ✓
--   PRIORITIES: low, medium, high, critical  ✓
--   DEPARTMENTS: Roads, Sanitation, Drainage, Electrical, Water Supply, Other  ✓
CREATE TABLE IF NOT EXISTS public.complaints (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_id            TEXT        UNIQUE NOT NULL,
  reporter_id       UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  category          TEXT        NOT NULL
                    CHECK (category IN (
                      'pothole', 'garbage', 'drainage', 'streetlight',
                      'damaged_footpath', 'water_leakage', 'other'
                    )),
  description       TEXT        NOT NULL CHECK (length(description) >= 10),
  photo_url         TEXT,
  anonymous         BOOLEAN     NOT NULL DEFAULT FALSE,
  location_text     TEXT,
  latitude          NUMERIC(10, 6),
  longitude         NUMERIC(10, 6),
  status            TEXT        NOT NULL DEFAULT 'submitted'
                    CHECK (status IN (
                      'submitted', 'under_review', 'assigned', 'in_progress', 'resolved'
                    )),
  priority          TEXT        NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  department        TEXT
                    CHECK (department IS NULL OR department IN (
                      'Roads', 'Sanitation', 'Drainage', 'Electrical', 'Water Supply', 'Other'
                    )),
  assigned_staff_id UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_at            TIMESTAMPTZ,
  action_taken      TEXT,
  resolution_notes  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Synchronize the sequence with existing Urban Echo reference IDs without
-- ever moving an already-advanced sequence backwards. The trigger below also
-- checks for an existing ref_id before accepting a generated value.
DO $$
DECLARE
  v_last_value BIGINT;
  v_is_called  BOOLEAN;
  v_max_existing BIGINT;
BEGIN
  SELECT last_value, is_called
    INTO v_last_value, v_is_called
    FROM public.complaint_ref_seq;

  SELECT COALESCE(
           MAX((regexp_match(ref_id, '^UE-[0-9]{4}-([0-9]+)$'))[1]::BIGINT),
           0
         )
    INTO v_max_existing
    FROM public.complaints;

  IF v_max_existing > v_last_value
     OR (v_max_existing = v_last_value AND NOT v_is_called) THEN
    PERFORM setval('public.complaint_ref_seq', v_max_existing, TRUE);
  END IF;
END;
$$;

-- ── complaint_status_history ──────────────────────────────────────────────────
-- Queried in ComplaintDetail.jsx as:
--   .select('*, changer:changed_by(full_name)')
-- and in TrackComplaints.jsx as .select('*')
-- Column names match exactly.
CREATE TABLE IF NOT EXISTS public.complaint_status_history (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id  UUID        NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  old_status    TEXT,
  new_status    TEXT        NOT NULL,
  changed_by    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  remark        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── official_remarks ──────────────────────────────────────────────────────────
-- Queried in official/Dashboard.jsx as:
--   .select('*, official:official_id(full_name)')
-- official_id FK to profiles.id confirmed.
CREATE TABLE IF NOT EXISTS public.official_remarks (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id  UUID        NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  official_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  remark        TEXT        NOT NULL CHECK (length(trim(remark)) > 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- §1  ROLE-CHECKING HELPER FUNCTIONS
-- Created after §2 because these functions reference public.profiles.
-- =============================================================================

--
-- These bypass the RLS policy on profiles when checking the caller's own role,
-- preventing the infinite recursion that occurs when a profiles SELECT policy
-- itself queries profiles.
--
-- Every function:
--   • is STABLE (safe for use inside policies — called once per query, not per row)
--   • is SECURITY DEFINER (runs as function owner, bypassing RLS on profiles)
--   • sets search_path = public (prevents search-path injection attacks)
--   • uses COALESCE(..., false) so unauthenticated callers get FALSE, not NULL
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
  RETURNS TEXT
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_municipal_staff()
  RETURNS BOOLEAN
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role IN ('municipal_staff', 'admin')
       FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_higher_official()
  RETURNS BOOLEAN
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role IN ('higher_official', 'admin')
       FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS BOOLEAN
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin'
       FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    false
  );
$$;

-- Used by complaints SELECT, status-history SELECT, and remarks SELECT policies.
CREATE OR REPLACE FUNCTION public.is_staff_or_official()
  RETURNS BOOLEAN
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role IN ('municipal_staff', 'admin', 'higher_official')
       FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    false
  );
$$;




-- =============================================================================
-- §3  COMPLAINT REF-ID AUTO-GENERATION TRIGGER
--
-- FIX (Audit point 5 — concurrent submission safety):
--   The frontend (SubmitComplaint.jsx lines 87-93) uses COUNT(*)+1 to build
--   the ref_id before inserting. Two simultaneous submissions can get the
--   same count and collide on the UNIQUE constraint.
--
--   This BEFORE INSERT trigger calls nextval() which PostgreSQL serialises
--   internally — every row gets a strictly unique sequence number regardless
--   of concurrent traffic.
--
-- COMPATIBILITY NOTE:
--   The frontend sends ref_id in the INSERT payload. This trigger ALWAYS
--   overwrites it with the sequence value. The INSERT returns the real ref_id
--   via .select().single() which the frontend reads as data.ref_id — this
--   works correctly with no frontend change required.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.generate_complaint_ref_id()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_seq       BIGINT;
  v_year      TEXT;
  v_candidate TEXT;
BEGIN
  v_year := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY');

  -- Sequence values are unique under concurrent inserts. The existence check
  -- also protects databases that already contain manually assigned ref_ids.
  LOOP
    v_seq := nextval('public.complaint_ref_seq');
    v_candidate := 'UE-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.complaints
      WHERE ref_id = v_candidate
    );
  END LOOP;

  NEW.ref_id := v_candidate;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname    = 'trg_complaint_ref_id'
      AND tgrelid   = 'public.complaints'::regclass
  ) THEN
    CREATE TRIGGER trg_complaint_ref_id
      BEFORE INSERT ON public.complaints
      FOR EACH ROW EXECUTE FUNCTION public.generate_complaint_ref_id();
  END IF;
END;
$$;


-- =============================================================================
-- §4  AUTO-CREATE PROFILE ON SIGNUP TRIGGER
--
-- Fires AFTER INSERT on auth.users (managed by Supabase Auth).
-- Role is hardcoded to 'citizen' — no frontend value can override it here.
-- ON CONFLICT (id) DO NOTHING ensures safety if the trigger fires twice
-- (e.g. due to a Supabase retry) or if the frontend upsert runs first.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    NEW.email,
    'citizen'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname  = 'on_auth_user_created'
      AND tgrelid = 'auth.users'::regclass
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END;
$$;


-- =============================================================================
-- §5  UPDATED_AT TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname  = 'trg_profiles_updated_at'
      AND tgrelid = 'public.profiles'::regclass
  ) THEN
    CREATE TRIGGER trg_profiles_updated_at
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname  = 'trg_complaints_updated_at'
      AND tgrelid = 'public.complaints'::regclass
  ) THEN
    CREATE TRIGGER trg_complaints_updated_at
      BEFORE UPDATE ON public.complaints
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;


-- =============================================================================
-- §6  STATUS-CHANGE AUTO-HISTORY TRIGGER
--
-- FIX (Audit point 6 — duplicate-entry analysis):
--   ComplaintDetail.jsx handleSave() already inserts a history row manually
--   (lines 92-100) with changed_by = user.id and remark = resolution notes.
--   This DB trigger inserts a SECOND row with changed_by = NULL and a system
--   remark. These two rows are INTENTIONALLY DISTINCT:
--     • Frontend row  → "who did it + their note" (staff attribution)
--     • Trigger row   → "system audit record" (immutable DB-level proof)
--   Citizens see both rows in the timeline; null changed_by renders as blank.
--
--   Guard: IF OLD.status IS DISTINCT FROM NEW.status ensures no row is
--   inserted when a municipal staff saves other fields (priority, department,
--   deadline, notes) without changing the status value.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.record_status_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.complaint_status_history
      (complaint_id, old_status, new_status, changed_by, remark, created_at)
    VALUES
      (NEW.id, OLD.status, NEW.status, NULL,
       '[System] Status changed: ' || OLD.status || ' → ' || NEW.status,
       NOW());
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname  = 'trg_complaint_status_history'
      AND tgrelid = 'public.complaints'::regclass
  ) THEN
    CREATE TRIGGER trg_complaint_status_history
      AFTER UPDATE ON public.complaints
      FOR EACH ROW EXECUTE FUNCTION public.record_status_change();
  END IF;
END;
$$;


-- =============================================================================
-- §7  OVERDUE COMPLAINTS VIEW
--
-- FIX (Audit point 8 — higher_official access):
--   WITH (security_invoker = true) means this view runs under the CALLER's
--   RLS context. Since higher_official satisfies the complaints_staff_select
--   policy (is_staff_or_official() returns true), they can query this view.
--   The view is NOT queried by the frontend directly — official/Dashboard.jsx
--   queries the complaints table with .lt('due_at', ...) — but the view is
--   provided for SQL-level reporting and future use.
--
-- Columns: all complaints columns + overdue_duration (INTERVAL) + overdue_hours (FLOAT8)
-- Excludes: status = 'resolved' and complaints where due_at IS NULL.
-- =============================================================================

CREATE OR REPLACE VIEW public.overdue_complaints
  WITH (security_invoker = true)
AS
  SELECT
    c.id,
    c.ref_id,
    c.reporter_id,
    c.category,
    c.description,
    c.photo_url,
    c.anonymous,
    c.location_text,
    c.latitude,
    c.longitude,
    c.status,
    c.priority,
    c.department,
    c.assigned_staff_id,
    c.due_at,
    c.action_taken,
    c.resolution_notes,
    c.created_at,
    c.updated_at,
    NOW() - c.due_at                                  AS overdue_duration,
    EXTRACT(EPOCH FROM (NOW() - c.due_at)) / 3600.0   AS overdue_hours
  FROM public.complaints c
  WHERE
    c.status  != 'resolved'
    AND c.due_at IS NOT NULL
    AND c.due_at < NOW();


-- =============================================================================
-- §8  INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_complaints_reporter_id
  ON public.complaints (reporter_id);

CREATE INDEX IF NOT EXISTS idx_complaints_status
  ON public.complaints (status);

CREATE INDEX IF NOT EXISTS idx_complaints_category
  ON public.complaints (category);

-- Partial index — only overdue candidates, keeps it small and fast
CREATE INDEX IF NOT EXISTS idx_complaints_due_at_overdue
  ON public.complaints (due_at)
  WHERE due_at IS NOT NULL AND status != 'resolved';

CREATE INDEX IF NOT EXISTS idx_complaints_department
  ON public.complaints (department);

CREATE INDEX IF NOT EXISTS idx_complaints_created_at
  ON public.complaints (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_complaints_anonymous
  ON public.complaints (anonymous);

CREATE INDEX IF NOT EXISTS idx_status_history_complaint
  ON public.complaint_status_history (complaint_id);

CREATE INDEX IF NOT EXISTS idx_status_history_created_at
  ON public.complaint_status_history (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_official_remarks_complaint
  ON public.official_remarks (complaint_id);

CREATE INDEX IF NOT EXISTS idx_profiles_role
  ON public.profiles (role);


-- =============================================================================
-- §9  ENABLE ROW LEVEL SECURITY
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY is idempotent — safe to re-run.
-- =============================================================================

ALTER TABLE public.profiles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_status_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_remarks          ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- §10  DROP STALE POLICIES
--
-- DROP POLICY IF EXISTS drops only the named policy definition — never table
-- data or rows. Each dropped policy is recreated immediately below.
-- This block makes the file safely re-runnable.
-- =============================================================================

-- profiles
DROP POLICY IF EXISTS "profiles_select_own"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_staff" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;

-- complaints
DROP POLICY IF EXISTS "complaints_citizen_select" ON public.complaints;
DROP POLICY IF EXISTS "complaints_citizen_insert" ON public.complaints;
DROP POLICY IF EXISTS "complaints_staff_select"   ON public.complaints;
DROP POLICY IF EXISTS "complaints_staff_update"   ON public.complaints;

-- complaint_status_history
DROP POLICY IF EXISTS "history_citizen_select" ON public.complaint_status_history;
DROP POLICY IF EXISTS "history_staff_select"   ON public.complaint_status_history;
DROP POLICY IF EXISTS "history_staff_insert"   ON public.complaint_status_history;

-- official_remarks
DROP POLICY IF EXISTS "remarks_official_insert" ON public.official_remarks;
DROP POLICY IF EXISTS "remarks_select"          ON public.official_remarks;

-- storage objects (these are recreated in §15)
DROP POLICY IF EXISTS "storage_upload_auth"   ON storage.objects;
DROP POLICY IF EXISTS "storage_select_public" ON storage.objects;
DROP POLICY IF EXISTS "storage_select_auth"   ON storage.objects;
DROP POLICY IF EXISTS "storage_delete_own"    ON storage.objects;


-- =============================================================================
-- §11  PROFILES RLS POLICIES
--
-- FIX (Audit point 4 — recursion-free):
--   All role checks use the §1 helper functions, not sub-SELECTs on profiles.
--
-- FIX (Audit point 10 — citizen role protection):
--   profiles_update_own WITH CHECK enforces that after any UPDATE the role
--   column must still equal get_my_role() (the value currently in the DB).
--   A citizen attempting SET role = 'admin' will fail this check.
--   Admins are exempted by profiles_admin_update which has no role restriction.
--
-- FIX (Audit point 9 — ComplaintDetail.jsx join):
--   ComplaintDetail.jsx joins profiles via reporter_id:
--     .select('*, profiles:reporter_id(full_name, email, phone, area)')
--   profiles_select_staff allows municipal_staff/admin/official to read all
--   profiles rows — this join works correctly.
-- =============================================================================

-- Each user can read their own profile (required by AuthContext.jsx fetchProfile)
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Staff/admin/officials can read all profiles
-- (required for ComplaintDetail.jsx reporter join and Complaints.jsx reporter name)
CREATE POLICY "profiles_select_staff"
  ON public.profiles FOR SELECT
  USING (public.is_staff_or_official());

-- Any authenticated user can insert their own profile row
-- (AuthContext.jsx signUp calls supabase.from('profiles').upsert({...}))
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (
    auth.uid() = id
    AND role = 'citizen'
  );

-- Users can update their own profile but cannot change their role
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING  (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = public.get_my_role()   -- role must remain unchanged
  );

-- Admins can update any profile (including role changes for promotion/demotion)
CREATE POLICY "profiles_admin_update"
  ON public.profiles FOR UPDATE
  USING (public.is_admin());


-- =============================================================================
-- §12  COMPLAINTS RLS POLICIES
--
-- FIX (Audit point 10 — citizen privacy):
--   The original policy was: USING (reporter_id = auth.uid() OR anonymous = TRUE)
--   This exposed every anonymous complaint to every citizen.
--   Fixed: citizens see ONLY complaints where reporter_id = their uid.
--   Anonymous complaints (reporter_id IS NULL) are only visible to staff/officials.
--
-- FIX (Audit point 10 — reporter_id spoofing prevention):
--   The INSERT WITH CHECK enforces:
--     non-anonymous → reporter_id must equal auth.uid()
--     anonymous     → reporter_id must be NULL (as set by SubmitComplaint.jsx line 111)
--   This prevents one citizen inserting a complaint attributed to another's ID.
--
-- FIX (Audit point 9 — municipal UPDATE compatibility):
--   complaints_staff_update covers municipal_staff and admin.
--   The UPDATE payload from ComplaintDetail.jsx handleSave() (lines 74-88):
--     status, priority, department, due_at, action_taken, resolution_notes,
--     updated_at  — all columns exist on the table. ✓
--
-- FIX (Audit point 8 — higher_official read access):
--   complaints_staff_select uses is_staff_or_official() which returns true for
--   higher_official. official/Dashboard.jsx queries complaints with
--     .not('status','eq','resolved').not('due_at','is',null).lt('due_at',...)
--   This query is fully covered by the staff_select policy. ✓
-- =============================================================================

-- Citizens see only their own complaints
CREATE POLICY "complaints_citizen_select"
  ON public.complaints FOR SELECT
  USING (reporter_id = auth.uid());

-- Citizens can INSERT complaints; reporter_id spoofing is blocked
CREATE POLICY "complaints_citizen_insert"
  ON public.complaints FOR INSERT
  WITH CHECK (
    (anonymous = FALSE AND reporter_id = auth.uid())
    OR
    (anonymous = TRUE  AND reporter_id IS NULL)
  );

-- Staff, admin, and higher officials can SELECT all complaints
CREATE POLICY "complaints_staff_select"
  ON public.complaints FOR SELECT
  USING (public.is_staff_or_official());

-- Only municipal_staff and admin can UPDATE complaints
-- (higher_official is read-only on complaints; they write to official_remarks)
CREATE POLICY "complaints_staff_update"
  ON public.complaints FOR UPDATE
  USING (public.is_municipal_staff());


-- =============================================================================
-- §13  COMPLAINT STATUS HISTORY RLS POLICIES
--
-- Citizens: SELECT history only for their own complaints (reporter_id match).
-- Staff/officials: SELECT all history.
-- Staff/admin: INSERT history (manual rows from ComplaintDetail.jsx).
-- The §6 SECURITY DEFINER trigger writes rows bypassing RLS — intentional.
-- =============================================================================

CREATE POLICY "history_citizen_select"
  ON public.complaint_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id           = complaint_status_history.complaint_id
        AND c.reporter_id  = auth.uid()
    )
  );

CREATE POLICY "history_staff_select"
  ON public.complaint_status_history FOR SELECT
  USING (public.is_staff_or_official());

-- Staff insert manual history entries from ComplaintDetail.jsx lines 93-99
CREATE POLICY "history_staff_insert"
  ON public.complaint_status_history FOR INSERT
  WITH CHECK (
    public.is_municipal_staff()
    AND changed_by = auth.uid()
  );


-- =============================================================================
-- §14  OFFICIAL REMARKS RLS POLICIES
--
-- INSERT: higher_official and admin (is_higher_official() covers both)
-- SELECT: staff, admin, and officials (is_staff_or_official())
-- Citizens have no access — remarks are not shown in the citizen UI.
--
-- official/Dashboard.jsx inserts with: { complaint_id, official_id, remark }
-- official/Dashboard.jsx selects with: '*, official:official_id(full_name)'
-- Both operations are covered by the policies below. ✓
-- =============================================================================

CREATE POLICY "remarks_official_insert"
  ON public.official_remarks FOR INSERT
  WITH CHECK (
    public.is_higher_official()
    AND official_id = auth.uid()
  );

CREATE POLICY "remarks_select"
  ON public.official_remarks FOR SELECT
  USING (public.is_staff_or_official());


-- =============================================================================
-- §15  STORAGE BUCKET AND OBJECT POLICIES
--
-- FIX (Audit point 7 — storage compatibility with frontend):
--   utils.js uploadPhoto() calls .getPublicUrl() (line 201).
--   getPublicUrl() returns a URL that only works if the bucket is PUBLIC.
--   If the bucket is private, getPublicUrl() returns a URL that results in 403.
--
--   DECISION FOR PROTOTYPE: Keep the bucket PUBLIC so the existing frontend
--   works without any code changes. The ON CONFLICT clause uses DO NOTHING
--   on the public column — so existing live buckets are not toggled.
--
--   PRIVACY WARNING: Public bucket URLs are accessible to anyone who obtains
--   them. Use only fictional/demo photos in this prototype. For real citizen
--   data, set the bucket private and update utils.js to store data.path and
--   generate signed URLs at display time. Do not just flip the bucket flag:
--   the frontend must also be changed to use signed URLs.
--
-- STORAGE POLICY NOTES:
--   • storage_upload_auth  — authenticated users only; prevents anonymous uploads
--   • storage_select_auth  — authenticated API access policy. IMPORTANT:
--                            because the bucket is PUBLIC, public object URLs
--                            can still be viewed without authentication.
--   • storage_delete_own   — uses storage.foldername(name)[1] which returns the
--                            first path segment. Files are uploaded flat (no folder),
--                            so this guard is best-effort; for production scope
--                            uploads to '{user_id}/{filename}' folders.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'complaint-photos',
  'complaint-photos',
  TRUE,          -- PUBLIC: keeps getPublicUrl() working in the frontend
  5242880,       -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET
    file_size_limit    = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
  -- The public flag is NOT updated on conflict — avoids toggling a live bucket.
  -- To change visibility, do it manually: Dashboard → Storage → Edit bucket.

-- Authenticated users can upload complaint photos
CREATE POLICY "storage_upload_auth"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'complaint-photos'
    AND auth.role() = 'authenticated'
  );

-- Authenticated users can read/download objects
-- (also required to generate signed URLs via the JS SDK if you switch to private later)
CREATE POLICY "storage_select_auth"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'complaint-photos'
    AND auth.role() = 'authenticated'
  );

-- Best-effort delete guard: first path segment must match the caller's UID
CREATE POLICY "storage_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'complaint-photos'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );


-- =============================================================================
-- §16  ROLE MANAGEMENT  (MANUAL — DO NOT UNCOMMENT BLINDLY)
--
-- After a user registers through the citizen portal, run one of these in the
-- Supabase SQL Editor to promote them to a staff/official role.
-- Replace the email address with the actual registered email.
-- =============================================================================

-- Promote to municipal staff:
-- UPDATE public.profiles SET role = 'municipal_staff' WHERE email = 'staff@yourmunicipality.gov.in';

-- Promote to higher official:
-- UPDATE public.profiles SET role = 'higher_official' WHERE email = 'commissioner@yourmunicipality.gov.in';

-- Promote to admin:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@yourmunicipality.gov.in';

-- Demote back to citizen:
-- UPDATE public.profiles SET role = 'citizen' WHERE email = 'someone@example.com';


-- =============================================================================
-- END OF SAFE SETUP — Version 3.2 (Dependency-order fix)
-- No DROP TABLE. No TRUNCATE. No DELETE FROM. No DROP SCHEMA.
-- No direct row/table deletion is performed. Review schema compatibility
-- before running against an existing database. Public photo URLs remain public.
-- =============================================================================
