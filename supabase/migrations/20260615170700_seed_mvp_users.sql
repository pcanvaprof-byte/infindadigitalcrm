-- Seed MVP accounts in auth.users with confirmed email so client-side
-- signInWithPassword used by the local auth shim always succeeds.

create extension if not exists pgcrypto;

do $$
declare
  seed record;
begin
  for seed in
    select * from (values
      ('danielly@infinda.com', 'danielly123', 'Danielly', 'admin'),
      ('valdinei@infinda.com', 'valdinei123', 'Valdinei', 'consultor')
    ) as s(email, password, name, role)
  loop
    if not exists (select 1 from auth.users where email = seed.email) then
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data,
        confirmation_token, email_change, email_change_token_new, recovery_token
      ) values (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        seed.email,
        crypt(seed.password, gen_salt('bf')),
        now(), now(), now(),
        jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
        jsonb_build_object('name', seed.name, 'role', seed.role),
        '', '', '', ''
      );
    end if;
  end loop;
end $$;
