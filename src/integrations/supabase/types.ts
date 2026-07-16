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
      adjustment_notes: {
        Row: {
          autor_nome: string | null
          client_id: string
          created_at: string
          id: string
          nota: string
          organization_id: string
          proposal_id: string | null
          synced_adjustment_id: string | null
          user_id: string
        }
        Insert: {
          autor_nome?: string | null
          client_id: string
          created_at?: string
          id?: string
          nota: string
          organization_id?: string
          proposal_id?: string | null
          synced_adjustment_id?: string | null
          user_id?: string
        }
        Update: {
          autor_nome?: string | null
          client_id?: string
          created_at?: string
          id?: string
          nota?: string
          organization_id?: string
          proposal_id?: string | null
          synced_adjustment_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adjustment_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adjustment_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adjustment_notes_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adjustment_notes_synced_adjustment_id_fkey"
            columns: ["synced_adjustment_id"]
            isOneToOne: false
            referencedRelation: "proposal_adjustments"
            referencedColumns: ["id"]
          },
        ]
      }
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
      api_key_audit_log: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          id: string
          ip: string | null
          method: string
          organization_id: string
          status: number
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          id?: string
          ip?: string | null
          method: string
          organization_id: string
          status: number
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          ip?: string | null
          method?: string
          organization_id?: string
          status?: number
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_key_audit_log_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_key_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          organization_id: string
          prefix: string
          revoked_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          key_hash: string
          last_used_at?: string | null
          name: string
          organization_id: string
          prefix: string
          revoked_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string
          prefix?: string
          revoked_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_presets: {
        Row: {
          created_at: string
          id: string
          mentoria_bonif: number
          mentoria_descricao: string
          mentoria_meses: number
          mentoria_valor: number
          nome: string
          organization_id: string
          site_descricao: string
          site_intervalo_dias: number
          site_parcelas: number
          site_valor: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mentoria_bonif?: number
          mentoria_descricao?: string
          mentoria_meses?: number
          mentoria_valor?: number
          nome: string
          organization_id?: string
          site_descricao?: string
          site_intervalo_dias?: number
          site_parcelas?: number
          site_valor?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          mentoria_bonif?: number
          mentoria_descricao?: string
          mentoria_meses?: number
          mentoria_valor?: number
          nome?: string
          organization_id?: string
          site_descricao?: string
          site_intervalo_dias?: number
          site_parcelas?: number
          site_valor?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          {
            foreignKeyName: "briefings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_prospect_import_audit"
            referencedColumns: ["prospect_id"]
          },
          {
            foreignKeyName: "briefings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_prospects_with_state"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "briefings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          {
            foreignKeyName: "cad_leads_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "v_prospect_import_audit"
            referencedColumns: ["prospect_id"]
          },
          {
            foreignKeyName: "cad_leads_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "v_prospects_with_state"
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
      cad_niche_templates: {
        Row: {
          corpo: string
          created_at: string
          created_by: string | null
          id: string
          is_current: boolean
          niche_key: string
          organization_id: string
          updated_at: string
          version: number
        }
        Insert: {
          corpo: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          niche_key: string
          organization_id?: string
          updated_at?: string
          version?: number
        }
        Update: {
          corpo?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          niche_key?: string
          organization_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cad_niche_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cad_notifications: {
        Row: {
          created_at: string
          handled_at: string | null
          handled_by: string | null
          id: string
          kind: Database["public"]["Enums"]["cad_notif_kind"]
          lead_id: string
          organization_id: string
          payload: Json
        }
        Insert: {
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["cad_notif_kind"]
          lead_id: string
          organization_id?: string
          payload?: Json
        }
        Update: {
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["cad_notif_kind"]
          lead_id?: string
          organization_id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "cad_notifications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "cad_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cad_notifications_organization_id_fkey"
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
          niche_key: string | null
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
          niche_key?: string | null
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
          niche_key?: string | null
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
      client_billing_items: {
        Row: {
          client_id: string
          created_at: string
          descricao: string
          id: string
          metodo: string | null
          observacao: string | null
          ordem: number
          organization_id: string
          pago_em: string | null
          status: string
          tipo: string
          updated_at: string
          valor: number
          vencimento: string
        }
        Insert: {
          client_id: string
          created_at?: string
          descricao: string
          id?: string
          metodo?: string | null
          observacao?: string | null
          ordem?: number
          organization_id?: string
          pago_em?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor?: number
          vencimento: string
        }
        Update: {
          client_id?: string
          created_at?: string
          descricao?: string
          id?: string
          metodo?: string | null
          observacao?: string | null
          ordem?: number
          organization_id?: string
          pago_em?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_billing_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_billing_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_events: {
        Row: {
          client_id: string
          created_at: string
          id: string
          organization_id: string
          payload: Json
          type: string
          user_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          organization_id?: string
          payload?: Json
          type: string
          user_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          payload?: Json
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          activated_at: string | null
          ajustes_escopo: string | null
          ajustes_prazo: string | null
          ajustes_proxima_acao: string | null
          ajustes_updated_at: string | null
          churned_at: string | null
          city: string | null
          cnpj: string | null
          company: string
          contact_name: string | null
          contract_term_months: number | null
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
          origem: string | null
          origem_detalhe: string | null
          owner_name: string | null
          permuta_value: number | null
          phone: string | null
          pipeline_stage: Database["public"]["Enums"]["pipeline_stage"]
          plano_code: string | null
          prospect_id: string | null
          segment: string | null
          site_one_time_value: number | null
          site_recurring_value: number | null
          source_ref: string | null
          state: string | null
          tags: string[]
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          activated_at?: string | null
          ajustes_escopo?: string | null
          ajustes_prazo?: string | null
          ajustes_proxima_acao?: string | null
          ajustes_updated_at?: string | null
          churned_at?: string | null
          city?: string | null
          cnpj?: string | null
          company: string
          contact_name?: string | null
          contract_term_months?: number | null
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
          origem?: string | null
          origem_detalhe?: string | null
          owner_name?: string | null
          permuta_value?: number | null
          phone?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"]
          plano_code?: string | null
          prospect_id?: string | null
          segment?: string | null
          site_one_time_value?: number | null
          site_recurring_value?: number | null
          source_ref?: string | null
          state?: string | null
          tags?: string[]
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          activated_at?: string | null
          ajustes_escopo?: string | null
          ajustes_prazo?: string | null
          ajustes_proxima_acao?: string | null
          ajustes_updated_at?: string | null
          churned_at?: string | null
          city?: string | null
          cnpj?: string | null
          company?: string
          contact_name?: string | null
          contract_term_months?: number | null
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
          origem?: string | null
          origem_detalhe?: string | null
          owner_name?: string | null
          permuta_value?: number | null
          phone?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"]
          plano_code?: string | null
          prospect_id?: string | null
          segment?: string | null
          site_one_time_value?: number | null
          site_recurring_value?: number | null
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
          {
            foreignKeyName: "clients_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: true
            referencedRelation: "v_prospect_import_audit"
            referencedColumns: ["prospect_id"]
          },
          {
            foreignKeyName: "clients_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: true
            referencedRelation: "v_prospects_with_state"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_plans: {
        Row: {
          client_id: string
          created_at: string
          cronograma: Json
          entregas: Json
          id: string
          investimento_gestao: number | null
          investimento_trafego: number | null
          objetivo: string | null
          organization_id: string
          plano_code: string | null
          updated_at: string
          validade_dias: number
        }
        Insert: {
          client_id: string
          created_at?: string
          cronograma?: Json
          entregas?: Json
          id?: string
          investimento_gestao?: number | null
          investimento_trafego?: number | null
          objetivo?: string | null
          organization_id?: string
          plano_code?: string | null
          updated_at?: string
          validade_dias?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          cronograma?: Json
          entregas?: Json
          id?: string
          investimento_gestao?: number | null
          investimento_trafego?: number | null
          objetivo?: string | null
          organization_id?: string
          plano_code?: string | null
          updated_at?: string
          validade_dias?: number
        }
        Relationships: [
          {
            foreignKeyName: "commercial_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          {
            foreignKeyName: "company_profiles_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "v_prospect_import_audit"
            referencedColumns: ["prospect_id"]
          },
          {
            foreignKeyName: "company_profiles_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "v_prospects_with_state"
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
          {
            foreignKeyName: "company_visits_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "v_prospect_import_audit"
            referencedColumns: ["prospect_id"]
          },
          {
            foreignKeyName: "company_visits_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "v_prospects_with_state"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_eventos: {
        Row: {
          actor_id: string | null
          actor_type: string
          contrato_id: string
          created_at: string
          id: string
          ip: string | null
          organization_id: string
          payload: Json
          tipo: string
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string
          contrato_id: string
          created_at?: string
          id?: string
          ip?: string | null
          organization_id?: string
          payload?: Json
          tipo: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          contrato_id?: string
          created_at?: string
          id?: string
          ip?: string | null
          organization_id?: string
          payload?: Json
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "contrato_eventos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_eventos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "op_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_eventos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          aceites: Json
          assinado_em: string | null
          assinatura_ip: string | null
          assinatura_nome: string | null
          assinatura_payload: string | null
          assinatura_tipo: string | null
          assinatura_user_agent: string | null
          cancelado_em: string | null
          cancelado_motivo: string | null
          created_at: string
          dados_bancarios: Json
          dados_pessoa: Json
          dia_vencimento: number | null
          escopo: Json
          formalizado_em: string | null
          id: string
          metodo_pagamento: string | null
          numero: string
          observacoes_financeiras: string | null
          organization_id: string
          parcelamento_implantacao: number | null
          pdf_gerado_em: string | null
          pdf_url: string | null
          prazo_implantacao_dias: number | null
          prazo_minimo_meses: number
          proposal_id: string | null
          status: string
          tipo_pessoa: string | null
          updated_at: string
          user_id: string
          valor_implantacao: number
          valor_investimento_midia: number | null
          valor_mensal: number
        }
        Insert: {
          aceites?: Json
          assinado_em?: string | null
          assinatura_ip?: string | null
          assinatura_nome?: string | null
          assinatura_payload?: string | null
          assinatura_tipo?: string | null
          assinatura_user_agent?: string | null
          cancelado_em?: string | null
          cancelado_motivo?: string | null
          created_at?: string
          dados_bancarios?: Json
          dados_pessoa?: Json
          dia_vencimento?: number | null
          escopo?: Json
          formalizado_em?: string | null
          id?: string
          metodo_pagamento?: string | null
          numero: string
          observacoes_financeiras?: string | null
          organization_id?: string
          parcelamento_implantacao?: number | null
          pdf_gerado_em?: string | null
          pdf_url?: string | null
          prazo_implantacao_dias?: number | null
          prazo_minimo_meses?: number
          proposal_id?: string | null
          status?: string
          tipo_pessoa?: string | null
          updated_at?: string
          user_id?: string
          valor_implantacao?: number
          valor_investimento_midia?: number | null
          valor_mensal?: number
        }
        Update: {
          aceites?: Json
          assinado_em?: string | null
          assinatura_ip?: string | null
          assinatura_nome?: string | null
          assinatura_payload?: string | null
          assinatura_tipo?: string | null
          assinatura_user_agent?: string | null
          cancelado_em?: string | null
          cancelado_motivo?: string | null
          created_at?: string
          dados_bancarios?: Json
          dados_pessoa?: Json
          dia_vencimento?: number | null
          escopo?: Json
          formalizado_em?: string | null
          id?: string
          metodo_pagamento?: string | null
          numero?: string
          observacoes_financeiras?: string | null
          organization_id?: string
          parcelamento_implantacao?: number | null
          pdf_gerado_em?: string | null
          pdf_url?: string | null
          prazo_implantacao_dias?: number | null
          prazo_minimo_meses?: number
          proposal_id?: string | null
          status?: string
          tipo_pessoa?: string | null
          updated_at?: string
          user_id?: string
          valor_implantacao?: number
          valor_investimento_midia?: number | null
          valor_mensal?: number
        }
        Relationships: [
          {
            foreignKeyName: "contratos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
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
            foreignKeyName: "deals_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "v_prospect_import_audit"
            referencedColumns: ["prospect_id"]
          },
          {
            foreignKeyName: "deals_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "v_prospects_with_state"
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
      op_client_interactions: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          interaction_date: string
          interaction_type: string
          next_followup_at: string | null
          notes: string | null
          organization_id: string
          owner_id: string
          title: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          interaction_date?: string
          interaction_type: string
          next_followup_at?: string | null
          notes?: string | null
          organization_id?: string
          owner_id?: string
          title: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          interaction_date?: string
          interaction_type?: string
          next_followup_at?: string | null
          notes?: string | null
          organization_id?: string
          owner_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "op_client_interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "op_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "op_client_interactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      op_clientes: {
        Row: {
          created_at: string
          email: string | null
          empresa: string | null
          id: string
          nome: string
          observacoes: string | null
          organization_id: string
          responsavel_id: string | null
          status: Database["public"]["Enums"]["op_cliente_status"]
          telefone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          empresa?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          organization_id?: string
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["op_cliente_status"]
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          empresa?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          organization_id?: string
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["op_cliente_status"]
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "op_clientes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      op_contract_renewals: {
        Row: {
          client_id: string
          contract_end: string
          contract_start: string | null
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          owner_id: string
          renewal_status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          contract_end: string
          contract_start?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          owner_id: string
          renewal_status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          contract_end?: string
          contract_start?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          owner_id?: string
          renewal_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "op_contract_renewals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "op_contract_renewals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      op_deployments: {
        Row: {
          assigned_to: string | null
          category: string
          client_id: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          organization_id: string
          owner_id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category: string
          client_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id?: string
          owner_id: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          client_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id?: string
          owner_id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "op_deployments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "op_deployments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      op_entregas: {
        Row: {
          cliente_id: string | null
          created_at: string
          descricao: string | null
          id: string
          ordem: number
          organization_id: string
          prazo: string | null
          responsavel_id: string | null
          status: Database["public"]["Enums"]["op_entrega_status"]
          tipo: Database["public"]["Enums"]["op_entrega_tipo"]
          titulo: string
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          ordem?: number
          organization_id?: string
          prazo?: string | null
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["op_entrega_status"]
          tipo?: Database["public"]["Enums"]["op_entrega_tipo"]
          titulo: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          ordem?: number
          organization_id?: string
          prazo?: string | null
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["op_entrega_status"]
          tipo?: Database["public"]["Enums"]["op_entrega_tipo"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "op_entregas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "op_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "op_entregas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      op_onboarding: {
        Row: {
          analytics_connected: boolean
          client_id: string
          cnpj: string | null
          company_name: string | null
          created_at: string
          facebook: string | null
          goal_type: string | null
          google_ads_connected: boolean
          id: string
          instagram: string | null
          meta_ads_connected: boolean
          organization_id: string
          owner_id: string
          status: string
          tag_manager_connected: boolean
          updated_at: string
          website: string | null
          youtube: string | null
        }
        Insert: {
          analytics_connected?: boolean
          client_id: string
          cnpj?: string | null
          company_name?: string | null
          created_at?: string
          facebook?: string | null
          goal_type?: string | null
          google_ads_connected?: boolean
          id?: string
          instagram?: string | null
          meta_ads_connected?: boolean
          organization_id?: string
          owner_id: string
          status?: string
          tag_manager_connected?: boolean
          updated_at?: string
          website?: string | null
          youtube?: string | null
        }
        Update: {
          analytics_connected?: boolean
          client_id?: string
          cnpj?: string | null
          company_name?: string | null
          created_at?: string
          facebook?: string | null
          goal_type?: string | null
          google_ads_connected?: boolean
          id?: string
          instagram?: string | null
          meta_ads_connected?: boolean
          organization_id?: string
          owner_id?: string
          status?: string
          tag_manager_connected?: boolean
          updated_at?: string
          website?: string | null
          youtube?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "op_onboarding_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "op_onboarding_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      op_trafego_campanhas: {
        Row: {
          cliente_id: string
          cliques: number | null
          conta_id: string | null
          conversoes: number | null
          cpa: number | null
          created_at: string
          gasto: number | null
          id: string
          impressoes: number | null
          nome: string
          organization_id: string
          periodo_fim: string | null
          periodo_inicio: string | null
          plataforma: Database["public"]["Enums"]["op_plataforma"]
          roas: number | null
          status: string
          ultima_sync: string | null
          updated_at: string
          verba: number | null
        }
        Insert: {
          cliente_id: string
          cliques?: number | null
          conta_id?: string | null
          conversoes?: number | null
          cpa?: number | null
          created_at?: string
          gasto?: number | null
          id?: string
          impressoes?: number | null
          nome: string
          organization_id?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          plataforma: Database["public"]["Enums"]["op_plataforma"]
          roas?: number | null
          status?: string
          ultima_sync?: string | null
          updated_at?: string
          verba?: number | null
        }
        Update: {
          cliente_id?: string
          cliques?: number | null
          conta_id?: string | null
          conversoes?: number | null
          cpa?: number | null
          created_at?: string
          gasto?: number | null
          id?: string
          impressoes?: number | null
          nome?: string
          organization_id?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          plataforma?: Database["public"]["Enums"]["op_plataforma"]
          roas?: number | null
          status?: string
          ultima_sync?: string | null
          updated_at?: string
          verba?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "op_trafego_campanhas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "op_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "op_trafego_campanhas_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "op_trafego_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "op_trafego_campanhas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      op_trafego_contas: {
        Row: {
          cliente_id: string
          conta_id_externa: string | null
          created_at: string
          id: string
          nome_conta: string
          objetivo: string | null
          organization_id: string
          plataforma: Database["public"]["Enums"]["op_plataforma"]
          status: string
          updated_at: string
          verba_mensal: number | null
        }
        Insert: {
          cliente_id: string
          conta_id_externa?: string | null
          created_at?: string
          id?: string
          nome_conta: string
          objetivo?: string | null
          organization_id?: string
          plataforma: Database["public"]["Enums"]["op_plataforma"]
          status?: string
          updated_at?: string
          verba_mensal?: number | null
        }
        Update: {
          cliente_id?: string
          conta_id_externa?: string | null
          created_at?: string
          id?: string
          nome_conta?: string
          objetivo?: string | null
          organization_id?: string
          plataforma?: Database["public"]["Enums"]["op_plataforma"]
          status?: string
          updated_at?: string
          verba_mensal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "op_trafego_contas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "op_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "op_trafego_contas_organization_id_fkey"
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
      plan_templates: {
        Row: {
          campaigns: Json
          code: string
          created_at: string
          deliveries: Json
          mensalidade: number
          name: string
          updated_at: string
        }
        Insert: {
          campaigns?: Json
          code: string
          created_at?: string
          deliveries?: Json
          mensalidade?: number
          name: string
          updated_at?: string
        }
        Update: {
          campaigns?: Json
          code?: string
          created_at?: string
          deliveries?: Json
          mensalidade?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      proposal_adjustments: {
        Row: {
          autor_cargo: string | null
          autor_nome: string | null
          created_at: string
          id: string
          mensagem: string
          origem: string
          proposal_id: string
          resolvido_em: string | null
          resolvido_por: string | null
          status: string
          synced_note_id: string | null
        }
        Insert: {
          autor_cargo?: string | null
          autor_nome?: string | null
          created_at?: string
          id?: string
          mensagem: string
          origem: string
          proposal_id: string
          resolvido_em?: string | null
          resolvido_por?: string | null
          status?: string
          synced_note_id?: string | null
        }
        Update: {
          autor_cargo?: string | null
          autor_nome?: string | null
          created_at?: string
          id?: string
          mensagem?: string
          origem?: string
          proposal_id?: string
          resolvido_em?: string | null
          resolvido_por?: string | null
          status?: string
          synced_note_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_adjustments_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_adjustments_synced_note_id_fkey"
            columns: ["synced_note_id"]
            isOneToOne: false
            referencedRelation: "adjustment_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_events: {
        Row: {
          actor_id: string | null
          actor_type: string
          created_at: string
          event_type: string
          id: string
          payload: Json
          proposal_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          proposal_id: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_events_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_items: {
        Row: {
          area: string | null
          catalog_item_id: string | null
          categoria: string | null
          cobranca: Database["public"]["Enums"]["cobranca_tipo"]
          created_at: string
          descricao: string | null
          entregaveis: string[]
          id: string
          nome: string
          ordem: number
          prazo_dias: number | null
          proposal_id: string
          quantidade: number
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          area?: string | null
          catalog_item_id?: string | null
          categoria?: string | null
          cobranca?: Database["public"]["Enums"]["cobranca_tipo"]
          created_at?: string
          descricao?: string | null
          entregaveis?: string[]
          id?: string
          nome: string
          ordem?: number
          prazo_dias?: number | null
          proposal_id: string
          quantidade?: number
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          area?: string | null
          catalog_item_id?: string | null
          categoria?: string | null
          cobranca?: Database["public"]["Enums"]["cobranca_tipo"]
          created_at?: string
          descricao?: string | null
          entregaveis?: string[]
          id?: string
          nome?: string
          ordem?: number
          prazo_dias?: number | null
          proposal_id?: string
          quantidade?: number
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_notes: {
        Row: {
          autor_cargo: string | null
          autor_nome: string | null
          created_at: string
          id: string
          mensagem: string
          organization_id: string
          proposal_id: string
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          autor_cargo?: string | null
          autor_nome?: string | null
          created_at?: string
          id?: string
          mensagem: string
          organization_id: string
          proposal_id: string
          tipo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          autor_cargo?: string | null
          autor_nome?: string | null
          created_at?: string
          id?: string
          mensagem?: string
          organization_id?: string
          proposal_id?: string
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_notes_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_versions: {
        Row: {
          conteudo_json: Json
          created_at: string
          id: string
          observacoes: string | null
          proposal_id: string
          valor_avulso: number
          valor_implantacao: number
          valor_mensal: number
          version_number: number
        }
        Insert: {
          conteudo_json?: Json
          created_at?: string
          id?: string
          observacoes?: string | null
          proposal_id: string
          valor_avulso?: number
          valor_implantacao?: number
          valor_mensal?: number
          version_number: number
        }
        Update: {
          conteudo_json?: Json
          created_at?: string
          id?: string
          observacoes?: string | null
          proposal_id?: string
          valor_avulso?: number
          valor_implantacao?: number
          valor_mensal?: number
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_versions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          client_id: string | null
          contract_status: Database["public"]["Enums"]["contract_status"]
          converted_at: string | null
          created_at: string
          current_version_id: string | null
          deal_id: string | null
          decided_at: string | null
          desconto_pct: number
          escopo: string | null
          expired_at: string | null
          first_viewed_at: string | null
          id: string
          lead_id: string | null
          motivo_aprovacao: string | null
          motivo_perda: string | null
          numero: string
          organization_id: string | null
          pdf_generated_at: string | null
          pdf_url: string | null
          prazo: string | null
          proxima_acao: string | null
          proxima_acao_em: string | null
          proxima_acao_responsavel: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["proposal_status"]
          titulo: string
          token_publico: string
          updated_at: string
          user_id: string
          valid_until: string | null
          validade_dias: number
          valor_avulso: number
          valor_implantacao: number
          valor_mensal: number
        }
        Insert: {
          client_id?: string | null
          contract_status?: Database["public"]["Enums"]["contract_status"]
          converted_at?: string | null
          created_at?: string
          current_version_id?: string | null
          deal_id?: string | null
          decided_at?: string | null
          desconto_pct?: number
          escopo?: string | null
          expired_at?: string | null
          first_viewed_at?: string | null
          id?: string
          lead_id?: string | null
          motivo_aprovacao?: string | null
          motivo_perda?: string | null
          numero: string
          organization_id?: string | null
          pdf_generated_at?: string | null
          pdf_url?: string | null
          prazo?: string | null
          proxima_acao?: string | null
          proxima_acao_em?: string | null
          proxima_acao_responsavel?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          titulo?: string
          token_publico?: string
          updated_at?: string
          user_id: string
          valid_until?: string | null
          validade_dias?: number
          valor_avulso?: number
          valor_implantacao?: number
          valor_mensal?: number
        }
        Update: {
          client_id?: string | null
          contract_status?: Database["public"]["Enums"]["contract_status"]
          converted_at?: string | null
          created_at?: string
          current_version_id?: string | null
          deal_id?: string | null
          decided_at?: string | null
          desconto_pct?: number
          escopo?: string | null
          expired_at?: string | null
          first_viewed_at?: string | null
          id?: string
          lead_id?: string | null
          motivo_aprovacao?: string | null
          motivo_perda?: string | null
          numero?: string
          organization_id?: string | null
          pdf_generated_at?: string | null
          pdf_url?: string | null
          prazo?: string | null
          proxima_acao?: string | null
          proxima_acao_em?: string | null
          proxima_acao_responsavel?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          titulo?: string
          token_publico?: string
          updated_at?: string
          user_id?: string
          valid_until?: string | null
          validade_dias?: number
          valor_avulso?: number
          valor_implantacao?: number
          valor_mensal?: number
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
          performed_by?: string
          skipped_count?: number
          total_rows?: number
          updated_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_imports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "prospect_interactions_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "v_prospect_import_audit"
            referencedColumns: ["prospect_id"]
          },
          {
            foreignKeyName: "prospect_interactions_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "v_prospects_with_state"
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
          {
            foreignKeyName: "prospect_touchpoints_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "v_prospect_import_audit"
            referencedColumns: ["prospect_id"]
          },
          {
            foreignKeyName: "prospect_touchpoints_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "v_prospects_with_state"
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
          import_id: string | null
          imported_at: string | null
          imported_by: string | null
          instagram: string
          last_contact_at: string | null
          next_contact_at: string | null
          organization_id: string
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
          import_id?: string | null
          imported_at?: string | null
          imported_by?: string | null
          instagram?: string
          last_contact_at?: string | null
          next_contact_at?: string | null
          organization_id?: string
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
          import_id?: string | null
          imported_at?: string | null
          imported_by?: string | null
          instagram?: string
          last_contact_at?: string | null
          next_contact_at?: string | null
          organization_id?: string
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
        Relationships: [
          {
            foreignKeyName: "prospects_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "prospect_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          owner_name: string | null
          team_id: string
          team_role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          owner_name?: string | null
          team_id: string
          team_role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          owner_name?: string | null
          team_id?: string
          team_role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      user_lead_state: {
        Row: {
          cadence_status: string
          cadence_step: number
          closed_at: string | null
          closed_reason: string | null
          created_at: string
          id: string
          last_contact_at: string | null
          next_contact_at: string | null
          notes: string | null
          organization_id: string
          prospect_id: string
          response_status: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cadence_status?: string
          cadence_step?: number
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          id?: string
          last_contact_at?: string | null
          next_contact_at?: string | null
          notes?: string | null
          organization_id?: string
          prospect_id: string
          response_status?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cadence_status?: string
          cadence_step?: number
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          id?: string
          last_contact_at?: string | null
          next_contact_at?: string | null
          notes?: string | null
          organization_id?: string
          prospect_id?: string
          response_status?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_lead_state_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_lead_state_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "v_prospect_import_audit"
            referencedColumns: ["prospect_id"]
          },
          {
            foreignKeyName: "user_lead_state_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "v_prospects_with_state"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      cad_notifications_v: {
        Row: {
          created_at: string | null
          empresa: string | null
          handled_at: string | null
          id: string | null
          kind: Database["public"]["Enums"]["cad_notif_kind"] | null
          last_response_at: string | null
          lead_id: string | null
          next_action_at: string | null
          organization_id: string | null
          payload: Json | null
          responsavel: string | null
          stage: Database["public"]["Enums"]["cad_stage"] | null
          telefone: string | null
          temperatura: Database["public"]["Enums"]["cad_temp"] | null
          whatsapp: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cad_notifications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "cad_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cad_notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_timeline: {
        Row: {
          client_id: string | null
          created_at: string | null
          data: Json | null
          kind: string | null
        }
        Relationships: []
      }
      op_contracts: {
        Row: {
          contract_value: number | null
          empresa: string | null
          id: string | null
          monthly_value: number | null
          origem: string | null
          signed_at: string | null
          source: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          contract_value?: never
          empresa?: string | null
          id?: string | null
          monthly_value?: number | null
          origem?: never
          signed_at?: string | null
          source?: never
          status?: string | null
          user_id?: string | null
        }
        Update: {
          contract_value?: never
          empresa?: string | null
          id?: string | null
          monthly_value?: number | null
          origem?: never
          signed_at?: string | null
          source?: never
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      op_dashboard_exec_metrics: {
        Row: {
          campanhas_ativas: number | null
          campanhas_encerradas: number | null
          campanhas_pausadas: number | null
          clientes_ativos: number | null
          clientes_com_implantacao_pendente: number | null
          clientes_inativos: number | null
          clientes_sem_campanha_ativa: number | null
          clientes_sem_onboarding: number | null
          contratos_vencendo_30d: number | null
          deployments_andamento: number | null
          deployments_concluidos: number | null
          deployments_total: number | null
          interacoes_30d: number | null
          onboarding_concluido: number | null
          onboarding_em_configuracao: number | null
          onboarding_pendente: number | null
          total_clientes: number | null
        }
        Relationships: []
      }
      op_onboarding_progress: {
        Row: {
          client_id: string | null
          id: string | null
          organization_id: string | null
          owner_id: string | null
          progress: number | null
          status: string | null
          steps_done: number | null
          steps_total: number | null
        }
        Insert: {
          client_id?: string | null
          id?: string | null
          organization_id?: string | null
          owner_id?: string | null
          progress?: never
          status?: string | null
          steps_done?: never
          steps_total?: never
        }
        Update: {
          client_id?: string | null
          id?: string | null
          organization_id?: string | null
          owner_id?: string | null
          progress?: never
          status?: string | null
          steps_done?: never
          steps_total?: never
        }
        Relationships: [
          {
            foreignKeyName: "op_onboarding_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "op_onboarding_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      op_renewals_status: {
        Row: {
          client_id: string | null
          computed_status: string | null
          contract_end: string | null
          contract_start: string | null
          created_at: string | null
          days_to_expire: number | null
          id: string | null
          notes: string | null
          organization_id: string | null
          owner_id: string | null
          renewal_status: string | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          computed_status?: never
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string | null
          days_to_expire?: never
          id?: string | null
          notes?: string | null
          organization_id?: string | null
          owner_id?: string | null
          renewal_status?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          computed_status?: never
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string | null
          days_to_expire?: never
          id?: string | null
          notes?: string | null
          organization_id?: string | null
          owner_id?: string | null
          renewal_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "op_contract_renewals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "op_contract_renewals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_prospect_import_audit: {
        Row: {
          city: string | null
          cnpj: string | null
          company: string | null
          created_at: string | null
          import_file_name: string | null
          import_id: string | null
          import_inserted_count: number | null
          import_performed_by: string | null
          import_total_rows: number | null
          imported_at: string | null
          imported_by: string | null
          organization_id: string | null
          prospect_id: string | null
          segment: string | null
          source: string | null
          state: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospects_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "prospect_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      v_prospects_with_state: {
        Row: {
          cadence_status: string | null
          cadence_step: number | null
          city: string | null
          closed_at: string | null
          closed_reason: string | null
          cnpj: string | null
          company: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string | null
          instagram: string | null
          last_contact_at: string | null
          next_contact_at: string | null
          organization_id: string | null
          owner_name: string | null
          phone: string | null
          potential: string | null
          private_notes: string | null
          response_status: string | null
          segment: string | null
          source: string | null
          state: string | null
          state_id: string | null
          status: string | null
          updated_at: string | null
          whatsapp: string | null
        }
        Relationships: []
      }
      vw_contratos_kpis: {
        Row: {
          arr: number | null
          assinados: number | null
          ativos: number | null
          cancelados: number | null
          mrr: number | null
          pendentes: number | null
          ticket_medio: number | null
        }
        Relationships: []
      }
      vw_proposal_conversion: {
        Row: {
          decididas: number | null
          enviadas: number | null
          tempo_medio_decisao_h: number | null
          tempo_medio_visualizacao_h: number | null
          visualizadas: number | null
        }
        Relationships: []
      }
      vw_proposal_funnel_full: {
        Row: {
          status: string | null
          total: number | null
          valor_total: number | null
        }
        Relationships: []
      }
      vw_proposal_kpis: {
        Row: {
          aprovadas: number | null
          enviadas: number | null
          expiradas: number | null
          rascunho: number | null
          rejeitadas: number | null
          taxa_aprovacao: number | null
          ticket_medio: number | null
          total: number | null
          valor_perdido: number | null
          valor_total_aprovado: number | null
          valor_total_enviado: number | null
          visualizadas: number | null
        }
        Relationships: []
      }
      vw_proposal_revenue_forecast: {
        Row: {
          competencia_mes: string | null
          propostas: number | null
          tipo: string | null
          valor: number | null
        }
        Relationships: []
      }
      vw_proposal_timeline: {
        Row: {
          actor_id: string | null
          actor_type: string | null
          created_at: string | null
          event_type: string | null
          id: string | null
          payload: Json | null
          proposal_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_events_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
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
      _can_see_cad_lead: { Args: { _lead: string }; Returns: boolean }
      _can_see_client: { Args: { _client: string }; Returns: boolean }
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
      cad_mark_all_notifications_handled: { Args: never; Returns: number }
      cad_mark_notification_handled: {
        Args: { p_id: string }
        Returns: undefined
      }
      cad_metrics_serie_30d: {
        Args: never
        Returns: {
          dia: string
          enviadas: number
          respostas: number
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
      cad_niche_pack_edited_keys: {
        Args: never
        Returns: {
          niche_key: string
          stages_edited: number
        }[]
      }
      cad_niche_pack_reset: {
        Args: {
          _niche_key: string
          _stage?: Database["public"]["Enums"]["cad_stage"]
        }
        Returns: number
      }
      cad_niche_pack_stages: {
        Args: { _niche_key: string }
        Returns: {
          corpo: string
          is_override: boolean
          stage: Database["public"]["Enums"]["cad_stage"]
          titulo: string
          version: number
        }[]
      }
      cad_niche_pack_upsert: {
        Args: {
          _corpo: string
          _niche_key: string
          _stage: Database["public"]["Enums"]["cad_stage"]
          _titulo: string
        }
        Returns: string
      }
      cad_niche_template_reset: {
        Args: { _niche_key: string }
        Returns: number
      }
      cad_niche_template_restore_version: {
        Args: { _version_id: string }
        Returns: string
      }
      cad_niche_template_save: {
        Args: { _corpo: string; _niche_key: string }
        Returns: string
      }
      cad_refresh_notifications: { Args: never; Returns: number }
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
      cadencia_followup_comparativo: {
        Args: { _days?: number }
        Returns: {
          desvio: number
          dia: string
          pct_aderencia: number
          previstos: number
          realizados: number
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
      create_proposal_from_source: {
        Args: { p_deal_id: string; p_prospect_id: string; p_titulo: string }
        Returns: string
      }
      create_proposal_version: {
        Args: { p_conteudo: Json; p_observacoes: string; p_proposal_id: string }
        Returns: string
      }
      criar_contrato_from_proposta: {
        Args: { p_proposal_id: string }
        Returns: string
      }
      current_org_id: { Args: never; Returns: string }
      current_org_role: { Args: never; Returns: string }
      dashboard_current_org_id: { Args: never; Returns: string }
      dashboard_metrics: { Args: never; Returns: Json }
      finalizar_contrato: {
        Args: {
          p_assinatura_nome: string
          p_assinatura_payload: string
          p_assinatura_tipo: string
          p_contrato_id: string
          p_ip?: string
          p_ua?: string
        }
        Returns: undefined
      }
      gen_briefing_token: { Args: never; Returns: string }
      gen_proposal_token: { Args: never; Returns: string }
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
      get_or_create_lead_state: {
        Args: { _prospect: string }
        Returns: {
          cadence_status: string
          cadence_step: number
          closed_at: string | null
          closed_reason: string | null
          created_at: string
          id: string
          last_contact_at: string | null
          next_contact_at: string | null
          notes: string | null
          organization_id: string
          prospect_id: string
          response_status: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_lead_state"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_proposal_by_token: { Args: { p_token: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_member_of_org: { Args: { _org: string }; Returns: boolean }
      is_org_admin: { Args: { _org: string }; Returns: boolean }
      log_evt: {
        Args: {
          p_actor_type?: string
          p_payload?: Json
          p_proposal_id: string
          p_tipo: string
        }
        Returns: string
      }
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
      register_proposal_send: {
        Args: {
          p_canal: string
          p_destino: string
          p_mensagem: string
          p_proposal_id: string
        }
        Returns: undefined
      }
      register_proposal_view: {
        Args: { p_referrer: string; p_token: string; p_ua: string }
        Returns: undefined
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
      submit_proposal_decision: {
        Args: {
          p_cargo: string
          p_decisao: string
          p_documento: string
          p_mensagem: string
          p_nome: string
          p_token: string
          p_ua: string
        }
        Returns: Json
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
          organization_id: string | null
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
      app_role: "admin" | "consultor"
      cad_msg_direction: "out" | "in" | "system"
      cad_msg_tipo: "whatsapp" | "email" | "ligacao" | "nota" | "sistema"
      cad_notif_kind: "overdue" | "last_attempt" | "response_pending"
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
      cobranca_tipo: "implantacao" | "mensal" | "avulso"
      contract_status:
        | "nao_gerado"
        | "gerado"
        | "enviado"
        | "assinado"
        | "cancelado"
      op_cliente_status: "ativo" | "pausado" | "offboarding" | "encerrado"
      op_entrega_status: "backlog" | "em_andamento" | "revisao" | "entregue"
      op_entrega_tipo:
        | "criativo"
        | "relatorio"
        | "otimizacao"
        | "reuniao"
        | "outro"
      op_plataforma: "meta_ads" | "google_ads" | "tiktok_ads" | "linkedin_ads"
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
      proposal_status:
        | "rascunho"
        | "enviada"
        | "visualizada"
        | "ajustes_solicitados"
        | "aprovada"
        | "rejeitada"
        | "expirada"
        | "convertida"
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
      app_role: ["admin", "consultor"],
      cad_msg_direction: ["out", "in", "system"],
      cad_msg_tipo: ["whatsapp", "email", "ligacao", "nota", "sistema"],
      cad_notif_kind: ["overdue", "last_attempt", "response_pending"],
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
      cobranca_tipo: ["implantacao", "mensal", "avulso"],
      contract_status: [
        "nao_gerado",
        "gerado",
        "enviado",
        "assinado",
        "cancelado",
      ],
      op_cliente_status: ["ativo", "pausado", "offboarding", "encerrado"],
      op_entrega_status: ["backlog", "em_andamento", "revisao", "entregue"],
      op_entrega_tipo: [
        "criativo",
        "relatorio",
        "otimizacao",
        "reuniao",
        "outro",
      ],
      op_plataforma: ["meta_ads", "google_ads", "tiktok_ads", "linkedin_ads"],
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
      proposal_status: [
        "rascunho",
        "enviada",
        "visualizada",
        "ajustes_solicitados",
        "aprovada",
        "rejeitada",
        "expirada",
        "convertida",
      ],
    },
  },
} as const
