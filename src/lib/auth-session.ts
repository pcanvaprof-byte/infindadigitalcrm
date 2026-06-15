import { supabase } from "@/integrations/supabase/client";

export async function getCurrentCloudUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}