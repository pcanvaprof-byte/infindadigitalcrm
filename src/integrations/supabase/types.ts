export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      briefings: {
        Row: {
          cliente_nome: string | null
          created_at: string
          email: string | null
          empresa: string | null
          id: string
          lead_id: string | null
          respostas_json: Json
          resumo_ia: string | null
          servico: string | null
          status: string
          telefone: string | null
          tipo: string
          token_publico: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cliente_nome?: string | null
          created_at?: string
          email?: string | null
          empresa?: string | null
          id?: string
          lead_id?: string | null
          respostas_json?: Json
          resumo_ia?: string | null
          servico?: string | null
          status?: string
          telefone?: string | null
          tipo?: string
          token_publico: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cliente_nome?: string | null
          created_at?: string
          email?: string | null
          empresa?: string | null
          id?: string
          lead_id?: string | null
          respostas_json?: Json
          resumo_ia?: string | null
          servico?: string | null
          status?: string
          telefone?: string | null
          tipo?: string
          token_publico?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "briefings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      company_addresses: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          created_at: string | null
          id: string
          logradouro: string | null
          numero: string | null
          profile_id: string
          regiao: string | null
          uf: string | null
          user_id: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          created_at?: string | null
          id?: string
          logradouro?: string | null
          numero?: string | null
          profile_id: string
          regiao?: string | null
          uf?: string | null
          user_id: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          created_at?: string | null
          id?: string
          logradouro?: string | null
          numero?: string | null
          profile_id?: string
          regiao?: string | null
          uf?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_addresses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_enrichment_logs: {
        Row: {
          cnpj: string | null
          created_at: string | null
          id: string
          message: string | null
          payload: Json | null
          profile_id: string | null
          status: string
          step: string
          user_id: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          payload?: Json | null
          profile_id?: string | null
          status: string
          step: string
          user_id: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          payload?: Json | null
          profile_id?: string | null
          status?: string
          step?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_enrichment_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_locations: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string
          lat: number | null
          lon: number | null
          profile_id: string
          source: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          lat?: number | null
          lon?: number | null
          profile_id: string
          source?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          lat?: number | null
          lon?: number | null
          profile_id?: string
          source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_locations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_market_data: {
        Row: {
          cidade: string | null
          fetched_at: string | null
          fonte: string | null
          id: string
          idh: number | null
          municipio_ibge_id: string | null
          pib_per_capita: number | null
          pib_total: number | null
          populacao: number | null
          uf: string | null
          user_id: string
        }
        Insert: {
          cidade?: string | null
          fetched_at?: string | null
          fonte?: string | null
          id?: string
          idh?: number | null
          municipio_ibge_id?: string | null
          pib_per_capita?: number | null
          pib_total?: number | null
          populacao?: number | null
          uf?: string | null
          user_id: string
        }
        Update: {
          cidade?: string | null
          fetched_at?: string | null
          fonte?: string | null
          id?: string
          idh?: number | null
          municipio_ibge_id?: string | null
          pib_per_capita?: number | null
          pib_total?: number | null
          populacao?: number | null
          uf?: string | null
          user_id?: string
        }
        Relationships: []
      }
      company_profiles: {
        Row: {
          capital_social: number | null
          cnae_principal: string | null
          cnae_principal_desc: string | null
          cnaes_secundarios: Json | null
          cnpj: string
          created_at: string | null
          data_abertura: string | null
          email: string | null
          id: string
          natureza_juridica: string | null
          nome_fantasia: string | null
          porte: string | null
          prospect_id: string | null
          raw: Json | null
          razao_social: string | null
          situacao: string | null
          socios: Json | null
          telefone_1: string | null
          telefone_2: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          capital_social?: number | null
          cnae_principal?: string | null
          cnae_principal_desc?: string | null
          cnaes_secundarios?: Json | null
          cnpj: string
          created_at?: string | null
          data_abertura?: string | null
          email?: string | null
          id?: string
          natureza_juridica?: string | null
          nome_fantasia?: string | null
          porte?: string | null
          prospect_id?: string | null
          raw?: Json | null
          razao_social?: string | null
          situacao?: string | null
          socios?: Json | null
          telefone_1?: string | null
          telefone_2?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          capital_social?: number | null
          cnae_principal?: string | null
          cnae_principal_desc?: string | null
          cnaes_secundarios?: Json | null
          cnpj?: string
          created_at?: string | null
          data_abertura?: string | null
          email?: string | null
          id?: string
          natureza_juridica?: string | null
          nome_fantasia?: string | null
          porte?: string | null
          prospect_id?: string | null
          raw?: Json | null
          razao_social?: string | null
          situacao?: string | null
          socios?: Json | null
          telefone_1?: string | null
          telefone_2?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_profiles_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      company_scores: {
        Row: {
          breakdown: Json | null
          calculated_at: string | null
          classificacao: string | null
          id: string
          lead_score: number | null
          market_score: number | null
          profile_id: string
          user_id: string
        }
        Insert: {
          breakdown?: Json | null
          calculated_at?: string | null
          classificacao?: string | null
          id?: string
          lead_score?: number | null
          market_score?: number | null
          profile_id: string
          user_id: string
        }
        Update: {
          breakdown?: Json | null
          calculated_at?: string | null
          classificacao?: string | null
          id?: string
          lead_score?: number | null
          market_score?: number | null
          profile_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_scores_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_visits: {
        Row: {
          cnpj: string | null
          contato_nome: string | null
          created_at: string | null
          endereco_snapshot: string | null
          id: string
          lat: number | null
          lon: number | null
          observacoes: string | null
          profile_id: string | null
          prospect_id: string | null
          resultado: string | null
          status: string
          user_id: string
          visited_at: string
        }
        Insert: {
          cnpj?: string | null
          contato_nome?: string | null
          created_at?: string | null
          endereco_snapshot?: string | null
          id?: string
          lat?: number | null
          lon?: number | null
          observacoes?: string | null
          profile_id?: string | null
          prospect_id?: string | null
          resultado?: string | null
          status?: string
          user_id: string
          visited_at?: string
        }
        Update: {
          cnpj?: string | null
          contato_nome?: string | null
          created_at?: string | null
          endereco_snapshot?: string | null
          id?: string
          lat?: number | null
          lon?: number | null
          observacoes?: string | null
          profile_id?: string | null
          prospect_id?: string | null
          resultado?: string | null
          status?: string
          user_id?: string
          visited_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_visits_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_visits_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_imports: {
        Row: {
          created_at: string
          error_count: number
          errors: Json
          file_name: string
          id: string
          inserted_count: number
          performed_by: string
          skipped_count: number
          total_rows: number
          updated_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          error_count?: number
          errors?: Json
          file_name: string
          id?: string
          inserted_count?: number
          performed_by?: string
          skipped_count?: number
          total_rows?: number
          updated_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          error_count?: number
          errors?: Json
          file_name?: string
          id?: string
          inserted_count?: number
          performed_by?: string
          skipped_count?: number
          total_rows?: number
          updated_count?: number
          user_id?: string
        }
        Relationships: []
      }
      prospect_interactions: {
        Row: {
          by_name: string
          created_at: string
          id: string
          kind: string
          prospect_id: string
          text: string
          user_id: string
        }
        Insert: {
          by_name?: string
          created_at?: string
          id?: string
          kind: string
          prospect_id: string
          text?: string
          user_id: string
        }
        Update: {
          by_name?: string
          created_at?: string
          id?: string
          kind?: string
          prospect_id?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_interactions_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          city: string
          cnpj: string | null
          company: string
          created_at: string
          email: string
          id: string
          instagram: string
          owner_name: string
          phone: string
          potential: string
          segment: string
          source: string
          state: string
          status: string
          updated_at: string
          user_id: string
          whatsapp: string
        }
        Insert: {
          city?: string
          cnpj?: string | null
          company: string
          created_at?: string
          email?: string
          id?: string
          instagram?: string
          owner_name?: string
          phone?: string
          potential?: string
          segment?: string
          source?: string
          state?: string
          status?: string
          updated_at?: string
          user_id: string
          whatsapp?: string
        }
        Update: {
          city?: string
          cnpj?: string | null
          company?: string
          created_at?: string
          email?: string
          id?: string
          instagram?: string
          owner_name?: string
          phone?: string
          potential?: string
          segment?: string
          source?: string
          state?: string
          status?: string
          updated_at?: string
          user_id?: string
          whatsapp?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_briefing_by_token: {
        Args: { p_token: string }
        Returns: {
          cliente_nome: string
          created_at: string
          email: string
          empresa: string
          id: string
          lead_id: string
          respostas_json: Json
          servico: string
          status: string
          telefone: string
          tipo: string
          token_publico: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
