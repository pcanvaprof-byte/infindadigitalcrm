import { supabase } from "@/integrations/supabase/client";

export type Organization = {
  id: string;
  name: string;
  slug: string | null;
  role: string;
  is_active: boolean;
};

export async function listMyOrganizations(): Promise<Organization[]> {
  const { data, error } = await supabase.rpc("my_organizations");
  if (error) throw error;
  return (data ?? []) as Organization[];
}

export async function setActiveOrganization(orgId: string): Promise<void> {
  const { error } = await supabase.rpc("set_active_org", { p_org: orgId });
  if (error) throw error;
}

export async function currentOrgId(): Promise<string | null> {
  const { data, error } = await supabase.rpc("current_org_id");
  if (error) throw error;
  return (data as string | null) ?? null;
}