// Augmenta o Database gerado com tabelas que o `supabase gen types`
// ainda não publicou neste ambiente. Use `dbExt` em vez de `(supabase as any)`
// para manter tipagem nas queries em tabelas como `prospect_touchpoints`.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database as Base } from "./types";
import { supabase } from "./client";

export type ProspectTouchpointRow = {
  id: string;
  prospect_id: string;
  user_id: string;
  tipo: string;
  mensagem: string | null;
  resultado: string | null;
  by_name: string | null;
  enviado_em: string;
};

export type ProspectTouchpointInsert = {
  id?: string;
  prospect_id: string;
  user_id: string;
  tipo: string;
  mensagem?: string | null;
  resultado?: string | null;
  by_name?: string | null;
  enviado_em?: string;
};

type ExtraTables = {
  prospect_touchpoints: {
    Row: ProspectTouchpointRow;
    Insert: ProspectTouchpointInsert;
    Update: Partial<ProspectTouchpointInsert>;
    Relationships: [];
  };
  // Tabelas existentes no banco externo cujo tipo ainda não foi
  // regenerado neste workspace. Mantemos shapes permissivos para que
  // `dbExt.from(...)` aceite as queries em uso sem `as any` espalhado.
  prospects: {
    Row: Record<string, any>;
    Insert: Record<string, any>;
    Update: Record<string, any>;
    Relationships: [];
  };
  prospect_imports: {
    Row: Record<string, any>;
    Insert: Record<string, any>;
    Update: Record<string, any>;
    Relationships: [];
  };
  cad_leads: {
    Row: Record<string, any>;
    Insert: Record<string, any>;
    Update: Record<string, any>;
    Relationships: [];
  };
  user_lead_state: {
    Row: Record<string, any>;
    Insert: Record<string, any>;
    Update: Record<string, any>;
    Relationships: [];
  };
  v_prospects_with_state: {
    Row: Record<string, any>;
    Insert: Record<string, any>;
    Update: Record<string, any>;
    Relationships: [];
  };
};

export type DatabaseExt = Omit<Base, "public"> & {
  public: Omit<Base["public"], "Tables"> & {
    Tables: Base["public"]["Tables"] & ExtraTables;
  };
};

// Cliente reaproveitado com tipos estendidos. A asserção é centralizada
// aqui — call sites não precisam mais usar `as any`.
export const dbExt = supabase as unknown as SupabaseClient<DatabaseExt>;