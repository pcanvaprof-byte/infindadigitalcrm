-- Force-confirm seed MVP accounts so signInWithPassword works without email confirmation.
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
    confirmed_at      = COALESCE(confirmed_at, now())
WHERE email IN ('danielly@infinda.com', 'valdinei@infinda.com');
