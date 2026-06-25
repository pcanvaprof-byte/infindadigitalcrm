import { supabase } from "@/integrations/supabase/client";

// RPCs created by migration 20260706_multi_tenant_core.sql.
// Cast to any until generated Database types are regenerated.
const rpc = (supabase.rpc as unknown) as (
  name: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

export type Organization = {
  id: string;
  name: string;
  slug: string | null;
  role: string;
  is_active: boolean;
  plan?: OrgPlan;
};

export type OrgPlan = "start" | "growth" | "scale";

export async function listMyOrganizations(): Promise<Organization[]> {
  const { data, error } = await rpc("my_organizations");
  if (error) throw error;
  return (data ?? []) as Organization[];
}

export async function setActiveOrganization(orgId: string): Promise<void> {
  const { error } = await rpc("set_active_org", { p_org: orgId });
  if (error) throw error;
}

export async function currentOrgId(): Promise<string | null> {
  const { data, error } = await rpc("current_org_id");
  if (error) throw error;
  return (data as string | null) ?? null;
}