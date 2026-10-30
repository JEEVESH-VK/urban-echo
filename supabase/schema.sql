-- =========================================================
-- URBAN ECHO – Supabase Database Schema
-- Run this entire script in your Supabase SQL Editor
-- =========================================================

-- =========================================================
-- 1. PROFILES TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  email         TEXT,
  phone         TEXT,
  area          TEXT,
  role          TEXT NOT NULL DEFAULT 'citizen'
                CHECK (role IN ('citizen', 'municipal_staff', 'admin', 'higher_official')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 2. COMPLAINTS TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.complaints (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_id            TEXT UNIQUE NOT NULL,       -- e.g. UE-2026-0001
  reporter_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  category          TEXT NOT NULL
                    CHECK (category IN (
                      'pothole','garbage','drainage','streetlight',
                      'damaged_footpath','water_leakage','other'
                    )),
  description       TEXT NOT NULL,
  photo_url         TEXT,
  anonymous         BOOLEAN NOT NULL DEFAULT FALSE,
  location_text     TEXT,
  latitude          NUMERIC(10,6),
  longitude         NUMERIC(10,6),
  status            TEXT NOT NULL DEFAULT 'submitted'
                    CHECK (status IN (
                      'submitted','under_review','assigned','in_progress','resolved'
                    )),
  priority          TEXT NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low','medium','high','critical')),
  department        TEXT
                    CHECK (department IN (
                      'Roads','Sanitation','Drainage','Electrical','Water Supply','Other'
                    ) OR department IS NULL),
  assigned_staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_at            TIMESTAMPTZ,
  action_taken      TEXT,
  resolution_notes  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 3. COMPLAINT STATUS HISTORY TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.complaint_status_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id  UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  old_status    TEXT,
  new_status    TEXT NOT NULL,
  changed_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  remark        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 4. OFFICIAL REMARKS TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.official_remarks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id  UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  official_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  remark        TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 5. OVERDUE COMPLAINTS VIEW
-- Detects overdue complaints without depending on browser timers
-- =========================================================
CREATE OR REPLACE VIEW public.overdue_complaints AS
  SELECT
    c.*,
    NOW() - c.due_at AS overdue_duration,
    EXTRACT(EPOCH FROM (NOW() - c.due_at)) / 3600 AS overdue_hours
  FROM public.complaints c
  WHERE c.status != 'resolved'
    AND c.due_at IS NOT NULL
    AND c.due_at < NOW();

-- =========================================================
-- 6. INDEXES
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_complaints_reporter_id ON public.complaints(reporter_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status      ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_category    ON public.complaints(category);
CREATE INDEX IF NOT EXISTS idx_complaints_due_at      ON public.complaints(due_at);
CREATE INDEX IF NOT EXISTS idx_complaints_department  ON public.complaints(department);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at  ON public.complaints(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_status_history_complaint ON public.complaint_status_history(complaint_id);
CREATE INDEX IF NOT EXISTS idx_official_remarks_complaint ON public.official_remarks(complaint_id);

-- =========================================================
-- 7. UPDATED_AT TRIGGER
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_complaints_updated_at ON public.complaints;
CREATE TRIGGER set_complaints_updated_at
  BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 8. AUTO-CREATE PROFILE ON SIGNUP TRIGGER
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- 9. ROW LEVEL SECURITY (RLS)
-- =========================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_remarks      ENABLE ROW LEVEL SECURITY;

-- ---- PROFILES ----
-- Users can read their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Municipal staff and admins can read all profiles
CREATE POLICY "profiles_select_staff" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('municipal_staff', 'admin', 'higher_official')
    )
  );

-- Users can update their own profile (but not their role)
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

-- Allow insert during registration (the trigger handles this, but allow direct insert too)
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Admin can update any profile (including role changes)
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ---- COMPLAINTS ----
-- Citizens can read their own complaints
CREATE POLICY "complaints_citizen_select" ON public.complaints
  FOR SELECT USING (
    reporter_id = auth.uid() OR anonymous = TRUE
  );

-- Citizens can insert their own complaints
CREATE POLICY "complaints_citizen_insert" ON public.complaints
  FOR INSERT WITH CHECK (
    reporter_id = auth.uid() OR anonymous = TRUE
  );

-- Staff/admin/official can read ALL complaints
CREATE POLICY "complaints_staff_select" ON public.complaints
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('municipal_staff', 'admin', 'higher_official')
    )
  );

-- Staff/admin can update complaints
CREATE POLICY "complaints_staff_update" ON public.complaints
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('municipal_staff', 'admin')
    )
  );

-- ---- STATUS HISTORY ----
-- Citizens can read history for their own complaints
CREATE POLICY "history_citizen_select" ON public.complaint_status_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.complaints
      WHERE id = complaint_id
        AND reporter_id = auth.uid()
    )
  );

-- Staff/admin/official can read all history
CREATE POLICY "history_staff_select" ON public.complaint_status_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('municipal_staff', 'admin', 'higher_official')
    )
  );

-- Staff/admin can insert history
CREATE POLICY "history_staff_insert" ON public.complaint_status_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('municipal_staff', 'admin')
    )
  );

-- ---- OFFICIAL REMARKS ----
-- Officials/admin can insert remarks
CREATE POLICY "remarks_official_insert" ON public.official_remarks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('higher_official', 'admin')
    )
  );

-- Officials/admin/staff can read remarks
CREATE POLICY "remarks_select" ON public.official_remarks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('higher_official', 'admin', 'municipal_staff')
    )
  );

-- =========================================================
-- 10. STORAGE BUCKET SETUP
-- Run this via Supabase Dashboard > Storage > New Bucket
-- OR run the SQL below (requires storage extension)
-- =========================================================

-- Create the complaint-photos bucket (PUBLIC for viewing)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'complaint-photos',
  'complaint-photos',
  TRUE,
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Any authenticated user can upload
CREATE POLICY "storage_upload_auth" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'complaint-photos' AND auth.role() = 'authenticated'
  );

-- Anyone can view/download (bucket is public)
CREATE POLICY "storage_select_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'complaint-photos');

-- =========================================================
-- 11. ROLE MANAGEMENT HELPER
-- Run this to create/update user roles after user registers
-- =========================================================
-- Example: Make a user a municipal_staff member
-- UPDATE public.profiles SET role = 'municipal_staff' WHERE email = 'staff@municipality.gov.in';

-- Example: Make a user a higher official
-- UPDATE public.profiles SET role = 'higher_official' WHERE email = 'commissioner@municipality.gov.in';

-- Example: Make a user an admin
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@municipality.gov.in';

-- =========================================================
-- SETUP COMPLETE
-- =========================================================
