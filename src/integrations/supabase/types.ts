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
      ai_insights: {
        Row: {
          area: string
          created_at: string
          created_by: string | null
          id: string
          model: string | null
          organization_id: string
          payload: Json
          recommendations: Json
          scope: string
          summary: string
        }
        Insert: {
          area: string
          created_at?: string
          created_by?: string | null
          id?: string
          model?: string | null
          organization_id: string
          payload?: Json
          recommendations?: Json
          scope?: string
          summary: string
        }
        Update: {
          area?: string
          created_at?: string
          created_by?: string | null
          id?: string
          model?: string | null
          organization_id?: string
          payload?: Json
          recommendations?: Json
          scope?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
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
          token_publico?: string
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
      cad_leads: {
        Row: {
          cargo: string | null
          closed_at: string | null
          closed_reason: string | null
          created_at: string
          email: string | null
          empresa: string
          id: string
          last_contact_at: string | null
          last_response_at: string | null
          next_action_at: string | null
          notes: string | null
          organization_id: string
          owner_id: string
          primeira_abordagem_at: string
          prospect_id: string | null
          responsavel: string | null
          stage: Database["public"]["Enums"]["cad_stage"]
          telefone: string | null
          temperatura: Database["public"]["Enums"]["cad_temp"]
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          cargo?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          email?: string | null
          empresa: string
          id?: string
          last_contact_at?: string | null
          last_response_at?: string | null
          next_action_at?: string | null
          notes?: string | null
          organization_id?: string
          owner_id?: string
          primeira_abordagem_at?: string
          prospect_id?: string | null
          responsavel?: string | null
          stage?: Database["public"]["Enums"]["cad_stage"]
          telefone?: string | null
          temperatura?: Database["public"]["Enums"]["cad_temp"]
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          cargo?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          email?: string | null
          empresa?: string
          id?: string
          last_contact_at?: string | null
          last_response_at?: string | null
          next_action_at?: string | null
          notes?: string | null
          organization_id?: string
          owner_id?: string
          primeira_abordagem_at?: string
          prospect_id?: string | null
          responsavel?: string | null
          stage?: Database["public"]["Enums"]["cad_stage"]
          telefone?: string | null
          temperatura?: Database["public"]["Enums"]["cad_temp"]
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cad_leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cad_leads_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      cad_messages: {
        Row: {
          author_id: string | null
          created_at: string
          direction: Database["public"]["Enums"]["cad_msg_direction"]
          id: string
          lead_id: string
          mensagem: string | null
          organization_id: string
          stage_at_send: Database["public"]["Enums"]["cad_stage"] | null
          status: string
          tipo: Database["public"]["Enums"]["cad_msg_tipo"]
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["cad_msg_direction"]
          id?: string
          lead_id: string
          mensagem?: string | null
          organization_id?: string
          stage_at_send?: Database["public"]["Enums"]["cad_stage"] | null
          status?: string
          tipo: Database["public"]["Enums"]["cad_msg_tipo"]
        }
        Update: {
          author_id?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["cad_msg_direction"]
          id?: string
          lead_id?: string
          mensagem?: string | null
          organization_id?: string
          stage_at_send?: Database["public"]["Enums"]["cad_stage"] | null
          status?: string
          tipo?: Database["public"]["Enums"]["cad_msg_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "cad_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "cad_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cad_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cad_pack_favorites: {
        Row: {
          created_at: string
          organization_id: string | null
          pack_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id?: string | null
          pack_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string | null
          pack_key?: string
          user_id?: string
        }
        Relationships: []
      }
      cad_template_packs: {
        Row: {
          categoria: string
          created_at: string
          descricao: string | null
          icon: string | null
          id: string
          is_system: boolean
          nome: string
          objetivo: string | null
          organization_id: string | null
          pack_key: string
          segmento: string | null
          tags: string[]
          updated_at: string
          variables: Json
        }
        Insert: {
          categoria?: string
          created_at?: string
          descricao?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean
          nome: string
          objetivo?: string | null
          organization_id?: string | null
          pack_key: string
          segmento?: string | null
          tags?: string[]
          updated_at?: string
          variables?: Json
        }
        Update: {
          categoria?: string
          created_at?: string
          descricao?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean
          nome?: string
          objetivo?: string | null
          organization_id?: string | null
          pack_key?: string
          segmento?: string | null
          tags?: string[]
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "cad_template_packs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cad_templates: {
        Row: {
          corpo: string
          id: string
          is_system: boolean
          organization_id: string | null
          pack_key: string
          stage: Database["public"]["Enums"]["cad_stage"]
          titulo: string
          updated_at: string
        }
        Insert: {
          corpo: string
          id?: string
          is_system?: boolean
          organization_id?: string | null
          pack_key?: string
          stage: Database["public"]["Enums"]["cad_stage"]
          titulo: string
          updated_at?: string
        }
        Update: {
          corpo?: string
          id?: string
          is_system?: boolean
          organization_id?: string | null
          pack_key?: string
          stage?: Database["public"]["Enums"]["cad_stage"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cad_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
          slug: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          organization_id?: string
          slug: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          organization_id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_categorias_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
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
          {
            foreignKeyName: "catalog_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
          relacionado_id: string
          tipo: Database["public"]["Enums"]["catalog_rel_tipo"]
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          ordem?: number
          organization_id?: string
          relacionado_id: string
          tipo: Database["public"]["Enums"]["catalog_rel_tipo"]
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          ordem?: number
          organization_id?: string
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
            foreignKeyName: "catalog_relacionamentos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          activated_at: string | null
          churned_at: string | null
          city: string | null
          cnpj: string | null
          company: string
          contact_name: string | null
          contract_value: number
          created_at: string
          created_from: string | null
          current_step: string | null
          email: string | null
          financial_status: Database["public"]["Enums"]["client_financial_status"]
          id: string
          instagram: string | null
          lc_contract_status: Database["public"]["Enums"]["client_lc_contract_status"]
          mensalidade: number | null
          next_action_date: string | null
          notes: string | null
          onboarding_status: Database["public"]["Enums"]["client_onboarding_status"]
          operations_locked: boolean
          organization_id: string
          owner_name: string | null
          phone: string | null
          pipeline_stage: Database["public"]["Enums"]["pipeline_stage"]
          plano_code: string | null
          prospect_id: string | null
          segment: string | null
          source_ref: string | null
          state: string | null
          tags: string[]
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          activated_at?: string | null
          churned_at?: string | null
          city?: string | null
          cnpj?: string | null
          company: string
          contact_name?: string | null
          contract_value?: number
          created_at?: string
          created_from?: string | null
          current_step?: string | null
          email?: string | null
          financial_status?: Database["public"]["Enums"]["client_financial_status"]
          id?: string
          instagram?: string | null
          lc_contract_status?: Database["public"]["Enums"]["client_lc_contract_status"]
          mensalidade?: number | null
          next_action_date?: string | null
          notes?: string | null
          onboarding_status?: Database["public"]["Enums"]["client_onboarding_status"]
          operations_locked?: boolean
          organization_id?: string
          owner_name?: string | null
          phone?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"]
          plano_code?: string | null
          prospect_id?: string | null
          segment?: string | null
          source_ref?: string | null
          state?: string | null
          tags?: string[]
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          activated_at?: string | null
          churned_at?: string | null
          city?: string | null
          cnpj?: string | null
          company?: string
          contact_name?: string | null
          contract_value?: number
          created_at?: string
          created_from?: string | null
          current_step?: string | null
          email?: string | null
          financial_status?: Database["public"]["Enums"]["client_financial_status"]
          id?: string
          instagram?: string | null
          lc_contract_status?: Database["public"]["Enums"]["client_lc_contract_status"]
          mensalidade?: number | null
          next_action_date?: string | null
          notes?: string | null
          onboarding_status?: Database["public"]["Enums"]["client_onboarding_status"]
          operations_locked?: boolean
          organization_id?: string
          owner_name?: string | null
          phone?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"]
          plano_code?: string | null
          prospect_id?: string | null
          segment?: string | null
          source_ref?: string | null
          state?: string | null
          tags?: string[]
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          organization_id: string
          text: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          id?: string
          kind: string
          meta?: Json
          organization_id?: string
          text?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          id?: string
          kind?: string
          meta?: Json
          organization_id?: string
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
          {
            foreignKeyName: "deal_activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
          position?: number
          tone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          client_id: string
          closed_at: string | null
          created_at: string
          expected_close: string | null
          id: string
          notes: string | null
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
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
            foreignKeyName: "deals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      op_campaigns: {
        Row: {
          campaign_name: string
          client_id: string | null
          created_at: string
          id: string
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          campaign_name: string
          client_id?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_name?: string
          client_id?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "op_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "op_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_goals: {
        Row: {
          created_at: string
          custo_marketing: number
          id: string
          meta_receita: number
          month: number | null
          organization_id: string
          updated_at: string
          year: number | null
        }
        Insert: {
          created_at?: string
          custo_marketing?: number
          id?: string
          meta_receita?: number
          month?: number | null
          organization_id?: string
          updated_at?: string
          year?: number | null
        }
        Update: {
          created_at?: string
          custo_marketing?: number
          id?: string
          meta_receita?: number
          month?: number | null
          organization_id?: string
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "org_goals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          joined_at: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          joined_at?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          active_template_pack: string
          created_at: string
          created_by: string | null
          default_seed_pack: string | null
          id: string
          name: string
          slug: string | null
        }
        Insert: {
          active_template_pack?: string
          created_at?: string
          created_by?: string | null
          default_seed_pack?: string | null
          id?: string
          name: string
          slug?: string | null
        }
        Update: {
          active_template_pack?: string
          created_at?: string
          created_by?: string | null
          default_seed_pack?: string | null
          id?: string
          name?: string
          slug?: string | null
        }
        Relationships: []
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
          by_name: string | null
          created_at: string
          enviado_em: string
          id: string
          mensagem: string | null
          organization_id: string
          prospect_id: string
          resultado: string
          tipo: string
          user_id: string
        }
        Insert: {
          by_name?: string | null
          created_at?: string
          enviado_em?: string
          id?: string
          mensagem?: string | null
          organization_id?: string
          prospect_id: string
          resultado?: string
          tipo: string
          user_id: string
        }
        Update: {
          by_name?: string | null
          created_at?: string
          enviado_em?: string
          id?: string
          mensagem?: string | null
          organization_id?: string
          prospect_id?: string
          resultado?: string
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_touchpoints_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
      user_active_org: {
        Row: {
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_active_org_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _apply_tenant_isolation: { Args: { p_table: string }; Returns: undefined }
      _bi_org: { Args: never; Returns: string }
      _cad_seed_system_pack: {
        Args: {
          _categoria: string
          _descricao: string
          _icon: string
          _nome: string
          _objetivo: string
          _openers: Json
          _pack_key: string
          _segmento: string
          _tags: string[]
        }
        Returns: undefined
      }
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
      bi_best_channels: { Args: never; Returns: Json }
      bi_best_contact_hours: { Args: never; Returns: Json }
      bi_churn_risk: { Args: never; Returns: Json }
      bi_clients_perdidos: { Args: never; Returns: Json }
      bi_dashboard: { Args: { p_area?: string }; Returns: Json }
      bi_financial_kpis: { Args: never; Returns: Json }
      bi_funnel_bottlenecks: { Args: never; Returns: Json }
      bi_lost_opportunities: { Args: never; Returns: Json }
      bi_revenue_forecast: { Args: never; Returns: Json }
      bi_top_campaigns: { Args: never; Returns: Json }
      cad_apply_pack: { Args: { _pack_key: string }; Returns: boolean }
      cad_create_custom_pack: {
        Args: {
          _categoria?: string
          _descricao?: string
          _icon?: string
          _nome: string
          _pack_key: string
        }
        Returns: string
      }
      cad_create_pack_with_templates: {
        Args: {
          _categoria: string
          _descricao: string
          _icon: string
          _items: Json
          _nome: string
          _pack_key: string
        }
        Returns: string
      }
      cad_dashboard_metrics: { Args: never; Returns: Json }
      cad_delete_pack: { Args: { _pack_key: string }; Returns: boolean }
      cad_get_default_seed_pack: { Args: never; Returns: string }
      cad_get_pack_templates: {
        Args: { _pack_key: string }
        Returns: {
          corpo: string
          stage: Database["public"]["Enums"]["cad_stage"]
          titulo: string
        }[]
      }
      cad_import_from_prospects: { Args: { p_ids?: string[] }; Returns: number }
      cad_list_packs: {
        Args: never
        Returns: {
          categoria: string
          descricao: string
          icon: string
          is_active: boolean
          is_favorite: boolean
          is_system: boolean
          nome: string
          objetivo: string
          pack_key: string
          segmento: string
          tags: string[]
          template_count: number
        }[]
      }
      cad_move_stage: {
        Args: {
          p_lead: string
          p_stage: Database["public"]["Enums"]["cad_stage"]
        }
        Returns: undefined
      }
      cad_next_action_for_stage: {
        Args: {
          p_base: string
          p_stage: Database["public"]["Enums"]["cad_stage"]
        }
        Returns: string
      }
      cad_next_stage: {
        Args: { p_stage: Database["public"]["Enums"]["cad_stage"] }
        Returns: Database["public"]["Enums"]["cad_stage"]
      }
      cad_register_response: {
        Args: { p_lead: string; p_mensagem: string }
        Returns: string
      }
      cad_register_send: {
        Args: {
          p_advance?: boolean
          p_lead: string
          p_mensagem: string
          p_tipo: Database["public"]["Enums"]["cad_msg_tipo"]
        }
        Returns: string
      }
      cad_resolve_template: {
        Args: { _stage: Database["public"]["Enums"]["cad_stage"] }
        Returns: {
          corpo: string
          is_override: boolean
          pack_key: string
          titulo: string
        }[]
      }
      cad_seed_templates: { Args: { p_org: string }; Returns: undefined }
      cad_set_default_seed_pack: {
        Args: { _pack_key: string }
        Returns: boolean
      }
      cad_toggle_favorite: { Args: { _pack_key: string }; Returns: boolean }
      cad_update_pack_meta: {
        Args: {
          _categoria: string
          _descricao: string
          _icon: string
          _nome: string
          _objetivo: string
          _pack_key: string
          _segmento: string
          _tags: string[]
        }
        Returns: boolean
      }
      cad_upsert_template: {
        Args: {
          _corpo: string
          _pack_key: string
          _stage: Database["public"]["Enums"]["cad_stage"]
          _titulo: string
        }
        Returns: undefined
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
      current_org_id: { Args: never; Returns: string }
      dashboard_current_org_id: { Args: never; Returns: string }
      dashboard_metrics: { Args: never; Returns: Json }
      gen_briefing_token: { Args: never; Returns: string }
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
      is_member_of_org: { Args: { _org: string }; Returns: boolean }
      is_org_admin: { Args: { _org: string }; Returns: boolean }
      my_organizations: {
        Args: never
        Returns: {
          id: string
          is_active: boolean
          name: string
          role: string
          slug: string
        }[]
      }
      set_active_org: { Args: { p_org: string }; Returns: undefined }
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
      cad_msg_direction: "out" | "in" | "system"
      cad_msg_tipo: "whatsapp" | "email" | "ligacao" | "nota" | "sistema"
      cad_stage:
        | "followup_1"
        | "followup_2"
        | "followup_3"
        | "followup_4"
        | "followup_5"
        | "followup_6"
        | "followup_7"
        | "interessado"
        | "reuniao_agendada"
        | "proposta_enviada"
        | "negociacao"
        | "fechado"
        | "perdido"
      cad_temp: "quente" | "morno" | "frio"
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
      client_financial_status:
        | "pendente"
        | "confirmado"
        | "recorrente"
        | "inadimplente"
      client_lc_contract_status: "nao_gerado" | "enviado" | "assinado"
      client_onboarding_status: "pendente" | "em_andamento" | "concluido"
      pipeline_stage:
        | "PROSPECCAO"
        | "CADENCIA"
        | "FECHADO"
        | "REUNIAO_INICIAL"
        | "PROPOSTA"
        | "CONTRATO"
        | "ASSINATURA"
        | "PAGAMENTO_CONFIRMADO"
        | "IMPLANTACAO"
        | "ATIVO"
        | "CHURNED"
        | "PERDIDO"
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
      cad_msg_direction: ["out", "in", "system"],
      cad_msg_tipo: ["whatsapp", "email", "ligacao", "nota", "sistema"],
      cad_stage: [
        "followup_1",
        "followup_2",
        "followup_3",
        "followup_4",
        "followup_5",
        "followup_6",
        "followup_7",
        "interessado",
        "reuniao_agendada",
        "proposta_enviada",
        "negociacao",
        "fechado",
        "perdido",
      ],
      cad_temp: ["quente", "morno", "frio"],
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
      client_financial_status: [
        "pendente",
        "confirmado",
        "recorrente",
        "inadimplente",
      ],
      client_lc_contract_status: ["nao_gerado", "enviado", "assinado"],
      client_onboarding_status: ["pendente", "em_andamento", "concluido"],
      pipeline_stage: [
        "PROSPECCAO",
        "CADENCIA",
        "FECHADO",
        "REUNIAO_INICIAL",
        "PROPOSTA",
        "CONTRATO",
        "ASSINATURA",
        "PAGAMENTO_CONFIRMADO",
        "IMPLANTACAO",
        "ATIVO",
        "CHURNED",
        "PERDIDO",
      ],
    },
  },
} as const
