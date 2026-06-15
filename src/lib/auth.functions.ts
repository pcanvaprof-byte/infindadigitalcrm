import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { SEED_ACCOUNTS } from "./mvp-accounts";

export const ensureMvpCloudUser = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ email: z.string().email(), password: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const seed = SEED_ACCOUNTS.find(
      (account) =>
        account.email.toLowerCase() === data.email.trim().toLowerCase() &&
        account.password === data.password,
    );

    if (!seed) return { ok: false as const, error: "Email ou senha inválidos." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) throw listError;

    const existing = usersData.users.find(
      (user) => user.email?.toLowerCase() === seed.email.toLowerCase(),
    );
    const userData = { name: seed.name, role: seed.role };

    if (existing) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
        password: seed.password,
        email_confirm: true,
        user_metadata: userData,
      });
      if (error) throw error;
      return { ok: true as const };
    }

    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: seed.email,
      password: seed.password,
      email_confirm: true,
      user_metadata: userData,
    });

    if (error) throw error;
    return { ok: true as const };
  });