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
          client_id: string | null
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
          client_id?: string | null
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
          client_id?: string | null
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
            foreignKeyName: "briefings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "briefings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_categorias: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
          slug: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          slug: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          slug?: string
        }
        Relationships: []
      }
      catalog_items: {
        Row: {
          area_responsavel: Database["public"]["Enums"]["catalog_area"]
          ativo: boolean
          beneficios: string[]
          categoria_id: string | null
          cobranca: Database["public"]["Enums"]["catalog_cobranca"]
          codigo: string | null
          complexidade: Database["public"]["Enums"]["catalog_complexidade"]
          created_at: string
          created_by: string | null
          descricao_completa: string | null
          descricao_curta: string | null
          entregaveis: string[]
          id: string
          nao_incluso: string[]
          nome_comercial: string
          nome_interno: string | null
          objetivo: string | null
          observacoes_internas: string | null
          ordem: number
          prazo_estimado_dias: number | null
          prioridade: number
          subcategoria: string | null
          tags: string[]
          tempo_execucao_horas: number | null
          tipo: Database["public"]["Enums"]["catalog_tipo"]
          updated_at: string
          valor_avulso: number
          valor_implantacao: number
          valor_mensal: number
        }
        Insert: {
          area_responsavel?: Database["public"]["Enums"]["catalog_area"]
          ativo?: boolean
          beneficios?: string[]
          categoria_id?: string | null
          cobranca?: Database["public"]["Enums"]["catalog_cobranca"]
          codigo?: string | null
          complexidade?: Database["public"]["Enums"]["catalog_complexidade"]
          created_at?: string
          created_by?: string | null
          descricao_completa?: string | null
          descricao_curta?: string | null
          entregaveis?: string[]
          id?: string
          nao_incluso?: string[]
          nome_comercial: string
          nome_interno?: string | null
          objetivo?: string | null
          observacoes_internas?: string | null
          ordem?: number
          prazo_estimado_dias?: number | null
          prioridade?: number
          subcategoria?: string | null
          tags?: string[]
          tempo_execucao_horas?: number | null
          tipo?: Database["public"]["Enums"]["catalog_tipo"]
          updated_at?: string
          valor_avulso?: number
          valor_implantacao?: number
          valor_mensal?: number
        }
        Update: {
          area_responsavel?: Database["public"]["Enums"]["catalog_area"]
          ativo?: boolean
          beneficios?: string[]
          categoria_id?: string | null
          cobranca?: Database["public"]["Enums"]["catalog_cobranca"]
          codigo?: string | null
          complexidade?: Database["public"]["Enums"]["catalog_complexidade"]
          created_at?: string
          created_by?: string | null
          descricao_completa?: string | null
          descricao_curta?: string | null
          entregaveis?: string[]
          id?: string
          nao_incluso?: string[]
          nome_comercial?: string
          nome_interno?: string | null
          objetivo?: string | null
          observacoes_internas?: string | null
          ordem?: number
          prazo_estimado_dias?: number | null
          prioridade?: number
          subcategoria?: string | null
          tags?: string[]
          tempo_execucao_horas?: number | null
          tipo?: Database["public"]["Enums"]["catalog_tipo"]
          updated_at?: string
          valor_avulso?: number
          valor_implantacao?: number
          valor_mensal?: number
        }
        Relationships: [
          {
            foreignKeyName: "catalog_items_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "catalog_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_relacionamentos: {
        Row: {
          created_at: string
          id: string
          item_id: string
          ordem: number
          relacionado_id: string
          tipo: Database["public"]["Enums"]["catalog_rel_tipo"]
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          ordem?: number
          relacionado_id: string
          tipo: Database["public"]["Enums"]["catalog_rel_tipo"]
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          ordem?: number
          relacionado_id?: string
          tipo?: Database["public"]["Enums"]["catalog_rel_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "catalog_relacionamentos_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_relacionamentos_relacionado_id_fkey"
            columns: ["relacionado_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          city: string | null
          cnpj: string | null
          company: string
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          instagram: string | null
          notes: string | null
          owner_name: string | null
          phone: string | null
          prospect_id: string | null
          segment: string | null
          state: string | null
          tags: string[]
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          city?: string | null
          cnpj?: string | null
          company: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          instagram?: string | null
          notes?: string | null
          owner_name?: string | null
          phone?: string | null
          prospect_id?: string | null
          segment?: string | null
          state?: string | null
          tags?: string[]
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          city?: string | null
          cnpj?: string | null
          company?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          instagram?: string | null
          notes?: string | null
          owner_name?: string | null
          phone?: string | null
          prospect_id?: string | null
          segment?: string | null
          state?: string | null
          tags?: string[]
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: true
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
      deal_activities: {
        Row: {
          created_at: string
          deal_id: string
          id: string
          kind: string
          meta: Json
          text: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          id?: string
          kind: string
          meta?: Json
          text?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          id?: string
          kind?: string
          meta?: Json
          text?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_stages: {
        Row: {
          id: string
          is_lost: boolean
          is_meeting: boolean
          is_proposal: boolean
          is_won: boolean
          label: string
          position: number
          tone: string | null
        }
        Insert: {
          id: string
          is_lost?: boolean
          is_meeting?: boolean
          is_proposal?: boolean
          is_won?: boolean
          label: string
          position: number
          tone?: string | null
        }
        Update: {
          id?: string
          is_lost?: boolean
          is_meeting?: boolean
          is_proposal?: boolean
          is_won?: boolean
          label?: string
          position?: number
          tone?: string | null
        }
        Relationships: []
      }
      deals: {
        Row: {
          client_id: string
          closed_at: string | null
          created_at: string
          expected_close: string | null
          id: string
          notes: string | null
          owner_name: string | null
          prospect_id: string | null
          stage_id: string
          title: string
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          client_id: string
          closed_at?: string | null
          created_at?: string
          expected_close?: string | null
          id?: string
          notes?: string | null
          owner_name?: string | null
          prospect_id?: string | null
          stage_id?: string
          title: string
          updated_at?: string
          user_id: string
          value?: number
        }
        Update: {
          client_id?: string
          closed_at?: string | null
          created_at?: string
          expected_close?: string | null
          id?: string
          notes?: string | null
          owner_name?: string | null
          prospect_id?: string | null
          stage_id?: string
          title?: string
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "deals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "deal_stages"
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
      prospect_touchpoints: {
        Row: {
          created_at: string
          enviado_em: string
          id: string
          mensagem: string | null
          prospect_id: string
          resultado: string
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enviado_em?: string
          id?: string
          mensagem?: string | null
          prospect_id: string
          resultado?: string
          tipo: string
          user_id: string
        }
        Update: {
          created_at?: string
          enviado_em?: string
          id?: string
          mensagem?: string | null
          prospect_id?: string
          resultado?: string
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_touchpoints_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          cadence_status: string
          cadence_step: number
          city: string
          closed_at: string | null
          closed_reason: string | null
          cnpj: string | null
          company: string
          created_at: string
          email: string
          id: string
          instagram: string
          last_contact_at: string | null
          next_contact_at: string | null
          owner_name: string
          phone: string
          potential: string
          response_status: string
          segment: string
          source: string
          state: string
          status: string
          updated_at: string
          user_id: string
          whatsapp: string
        }
        Insert: {
          cadence_status?: string
          cadence_step?: number
          city?: string
          closed_at?: string | null
          closed_reason?: string | null
          cnpj?: string | null
          company: string
          created_at?: string
          email?: string
          id?: string
          instagram?: string
          last_contact_at?: string | null
          next_contact_at?: string | null
          owner_name?: string
          phone?: string
          potential?: string
          response_status?: string
          segment?: string
          source?: string
          state?: string
          status?: string
          updated_at?: string
          user_id: string
          whatsapp?: string
        }
        Update: {
          cadence_status?: string
          cadence_step?: number
          city?: string
          closed_at?: string | null
          closed_reason?: string | null
          cnpj?: string | null
          company?: string
          created_at?: string
          email?: string
          id?: string
          instagram?: string
          last_contact_at?: string | null
          next_contact_at?: string | null
          owner_name?: string
          phone?: string
          potential?: string
          response_status?: string
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
      _infinda_log_activity: {
        Args: { p_kind: string; p_lead: string; p_text: string; p_user: string }
        Returns: undefined
      }
      acoes_hoje: {
        Args: { _limit?: number }
        Returns: {
          cadence_step: number
          company: string
          dias_atraso: number
          id: string
          last_contact_at: string
          next_contact_at: string
          whatsapp: string
        }[]
      }
      close_cadence: {
        Args: { _note?: string; _prospect_id: string; _reason: string }
        Returns: undefined
      }
      convert_prospect_to_client: {
        Args: {
          p_deal_title?: string
          p_deal_value?: number
          p_prospect_id: string
        }
        Returns: {
          client_id: string
          created: boolean
          deal_id: string
        }[]
      }
      dashboard_metrics: { Args: never; Returns: Json }
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
      set_briefing_resumo_ia: {
        Args: { p_resumo: string; p_token: string }
        Returns: undefined
      }
      snooze_prospect: {
        Args: { _days: number; _prospect_id: string }
        Returns: string
      }
      update_briefing_by_token: {
        Args: { p_respostas: Json; p_status?: string; p_token: string }
        Returns: {
          client_id: string | null
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
        SetofOptions: {
          from: "*"
          to: "briefings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      catalog_area:
        | "comercial"
        | "marketing"
        | "desenvolvimento"
        | "design"
        | "ia"
        | "suporte"
        | "outros"
      catalog_cobranca: "implantacao" | "mensal" | "avulso"
      catalog_complexidade: "baixa" | "media" | "alta"
      catalog_rel_tipo: "complemento" | "dependencia"
      catalog_tipo: "servico" | "pacote" | "complemento" | "bonus"
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
    Enums: {
      catalog_area: [
        "comercial",
        "marketing",
        "desenvolvimento",
        "design",
        "ia",
        "suporte",
        "outros",
      ],
      catalog_cobranca: ["implantacao", "mensal", "avulso"],
      catalog_complexidade: ["baixa", "media", "alta"],
      catalog_rel_tipo: ["complemento", "dependencia"],
      catalog_tipo: ["servico", "pacote", "complemento", "bonus"],
    },
  },
} as const
