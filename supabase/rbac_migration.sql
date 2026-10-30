-- URBAN ECHO — RBAC migration v1.1
-- Run AFTER safe_setup.sql v3.2.
-- No application tables or rows are dropped or deleted.

-- A. Email-confirmation helper: checks only the current caller.
CREATE OR REPLACE FUNCTION public.is_email_confirmed()
  RETURNS BOOLEAN
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (SELECT email_confirmed_at IS NOT NULL
       FROM auth.users
      WHERE id = auth.uid()
      LIMIT 1),
    false
  );
$$;

-- B. Signup trigger: all self-signups are citizens, regardless of metadata.
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

-- C. Privileged role provisioning. Call only from Supabase SQL Editor as postgres.
CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  p_email TEXT,
  p_role TEXT,
  p_full_name TEXT DEFAULT NULL
)
  RETURNS TEXT
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_confirmed_at TIMESTAMPTZ;
  v_email TEXT;
  v_name TEXT;
BEGIN
  v_email := lower(trim(p_email));

  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'Email address is required';
  END IF;

  IF p_role IS NULL OR p_role NOT IN
     ('municipal_staff', 'higher_official', 'admin') THEN
    RAISE EXCEPTION
      'Invalid role. Allowed: municipal_staff, higher_official, admin';
  END IF;

  SELECT id, email_confirmed_at,
         COALESCE(raw_user_meta_data->>'full_name', v_email)
    INTO v_user_id, v_confirmed_at, v_name
    FROM auth.users
   WHERE lower(email) = v_email
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN format(
      'No Auth account found for %s. Invite the user through Supabase Authentication > Users, have them accept the invitation, then run this function again.',
      v_email
    );
  END IF;

  IF v_confirmed_at IS NULL THEN
    RETURN format(
      'The email for %s is not confirmed. Complete the invitation/verification before assigning a privileged role.',
      v_email
    );
  END IF;

  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    v_user_id,
    COALESCE(NULLIF(trim(p_full_name), ''), v_name, v_email),
    v_email,
    p_role
  )
  ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role,
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        updated_at = NOW();

  RETURN format('Success: %s has been assigned role %s.', v_email, p_role);
END;
$$;

-- PostgreSQL grants EXECUTE to PUBLIC by default. Revoke that default grant too.
-- The function owner (normally postgres) can still call it from SQL Editor.
REVOKE ALL PRIVILEGES
ON FUNCTION public.admin_set_user_role(TEXT, TEXT, TEXT)
FROM PUBLIC, anon, authenticated, service_role;

-- This helper only returns the current caller's own confirmation state.
REVOKE ALL PRIVILEGES
ON FUNCTION public.is_email_confirmed()
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.is_email_confirmed()
TO authenticated;

-- USAGE:
-- 1. Supabase Dashboard > Authentication > Users > Invite User.
-- 2. User accepts invitation and completes password setup.
-- 3. Run the appropriate command below in SQL Editor as postgres:
--
-- SELECT public.admin_set_user_role(
--   'staff@example.com', 'municipal_staff', 'Municipal Staff'
-- );
--
-- SELECT public.admin_set_user_role(
--   'official@example.com', 'higher_official', 'Higher Official'
-- );
--
-- Existing confirmed citizen accounts may also be promoted, but only if
-- their owners are trusted and authorized.

-- Verify the privileged accounts:
-- SELECT id, email, role, created_at
-- FROM public.profiles
-- WHERE role IN ('municipal_staff', 'higher_official', 'admin')
-- ORDER BY role, created_at;

-- Verify API roles cannot call the provisioning function:
-- SELECT
--   has_function_privilege('anon',
--     'public.admin_set_user_role(text,text,text)', 'EXECUTE') AS anon_can_execute,
--   has_function_privilege('authenticated',
--     'public.admin_set_user_role(text,text,text)', 'EXECUTE') AS authenticated_can_execute,
--   has_function_privilege('service_role',
--     'public.admin_set_user_role(text,text,text)', 'EXECUTE') AS service_role_can_execute;
-- Expected: all three values FALSE.
--
-- NOTE: Creating is_email_confirmed() does not automatically enforce email
-- confirmation in all RLS policies. The frontend must still check
-- email_confirmed_at before allowing a user into a portal.
