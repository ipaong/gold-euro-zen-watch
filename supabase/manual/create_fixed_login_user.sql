-- XAUEUR Signal Lab — fixed Login account
-- Run this file manually in the Supabase SQL Editor with owner/service-role privileges.
-- This creates or updates one email/password account without sending a confirmation email.
-- Fixed credentials used by the current Login-only UI:
--   email:    admin@xaueur-signal-lab.com
--   password: XAUEUR-Lab-2026!
--
-- Change the two literals below before using this outside a private demo/staging project.
-- `confirmed_at` is intentionally omitted: Supabase exposes it as a generated column.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_email text := 'admin@xaueur-signal-lab.com';
  v_password text := 'XAUEUR-Lab-2026!';
  v_user_id uuid;
  v_now timestamptz := timezone('utc'::text, now());
BEGIN
  SELECT id
    INTO v_user_id
    FROM auth.users
   WHERE lower(email) = lower(v_email)
   LIMIT 1;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000'::uuid,
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      v_now,
      '',
      '',
      '',
      '',
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      '{}'::jsonb,
      v_now,
      v_now
    );
  ELSE
    UPDATE auth.users
       SET encrypted_password = crypt(v_password, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, v_now),
           confirmation_token = coalesce(confirmation_token, ''),
           recovery_token = coalesce(recovery_token, ''),
           email_change_token_new = coalesce(email_change_token_new, ''),
           email_change = coalesce(email_change, ''),
           raw_app_meta_data = jsonb_build_object(
             'provider', 'email',
             'providers', jsonb_build_array('email')
           ),
           updated_at = v_now
     WHERE id = v_user_id;
  END IF;

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email',
    v_user_id::text,
    v_now,
    v_now
  )
  ON CONFLICT DO NOTHING;
END
$$;

-- Verify the account is present, confirmed, and linked to the email identity.
SELECT
  u.id,
  u.email,
  u.email_confirmed_at,
  u.confirmed_at,
  i.provider,
  i.provider_id
FROM auth.users AS u
LEFT JOIN auth.identities AS i
  ON i.user_id = u.id
 AND i.provider = 'email'
WHERE lower(u.email) = lower('admin@xaueur-signal-lab.com');
