// Gerado a partir do schema do Supabase (projeto brwfbyxthuqwwwzlzbwj).
// Para atualizar depois de mudar o banco:
//   npx supabase gen types typescript --project-id brwfbyxthuqwwwzlzbwj > src/lib/database.types.ts

export type Database = {
  public: {
    Tables: {
      prospect_events: {
        Row: {
          at: string
          backfilled: boolean
          from_status: Database['public']['Enums']['prospect_status'] | null
          id: number
          kind: string
          prospect_id: string
          to_status: Database['public']['Enums']['prospect_status'] | null
        }
        // Somente leitura no app: quem escreve é o gatilho prospects_record_events.
        Insert: never
        Update: never
        Relationships: []
      }
      prospects: {
        Row: {
          address: string | null
          approach_message: string | null
          business_status: string | null
          cep: string | null
          city: string
          contact: string | null
          contact_attempts: number
          contract_generated_at: string | null
          cpf_cnpj: string | null
          created_at: string
          deal_value: number | null
          deposit_paid_amount: number | null
          docs_received: boolean
          email: string | null
          facebook: string | null
          final_paid_amount: number | null
          free_until: string | null
          last_reminded_at: string | null
          paid_until: string | null
          service_ended_at: string | null
          service_started_at: string | null
          suspended_at: string | null
          tratamento: 'singular' | 'plural' | null
          vistoria_at: string | null
          vistoria_ok: boolean | null
          vistoria_achados: VistoriaAchado[] | null
          abordagem_print_url: string | null
          last_contact_channel: ContactChannel | null
          lost_reason: LostReason | null
          google_cid: string | null
          google_last_review_at: string | null
          google_place_id: string | null
          google_rating: number | null
          google_reviews_count: number | null
          id: string
          instagram: string | null
          instagram_last_post_at: string | null
          landing_page_url: string | null
          last_contacted_at: string | null
          legal_name: string | null
          link_bio: string | null
          monthly_fee: number | null
          name: string
          next_action_at: string | null
          notes: string | null
          preview_images: string[] | null
          problem: string | null
          prospected_at: string
          revision_count: number
          rg: string | null
          segment: string
          slug: string | null
          source_url: string | null
          status: Database['public']['Enums']['prospect_status']
          updated_at: string
          website: string | null
          website_quality: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          approach_message?: string | null
          business_status?: string | null
          cep?: string | null
          city?: string
          contact?: string | null
          contact_attempts?: number
          contract_generated_at?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          deal_value?: number | null
          deposit_paid_amount?: number | null
          docs_received?: boolean
          email?: string | null
          facebook?: string | null
          final_paid_amount?: number | null
          free_until?: string | null
          last_reminded_at?: string | null
          paid_until?: string | null
          service_ended_at?: string | null
          service_started_at?: string | null
          suspended_at?: string | null
          tratamento?: 'singular' | 'plural' | null
          vistoria_at?: string | null
          vistoria_ok?: boolean | null
          vistoria_achados?: VistoriaAchado[] | null
          abordagem_print_url?: string | null
          last_contact_channel?: ContactChannel | null
          lost_reason?: LostReason | null
          google_cid?: string | null
          google_last_review_at?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_reviews_count?: number | null
          id?: string
          instagram?: string | null
          instagram_last_post_at?: string | null
          landing_page_url?: string | null
          last_contacted_at?: string | null
          legal_name?: string | null
          link_bio?: string | null
          monthly_fee?: number | null
          name: string
          next_action_at?: string | null
          notes?: string | null
          preview_images?: string[] | null
          problem?: string | null
          prospected_at?: string
          revision_count?: number
          rg?: string | null
          segment: string
          slug?: string | null
          source_url?: string | null
          status?: Database['public']['Enums']['prospect_status']
          updated_at?: string
          website?: string | null
          website_quality?: string | null
          whatsapp?: string | null
        }
        Update: Partial<Database['public']['Tables']['prospects']['Insert']>
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: {
      prospect_status:
        | 'novo'
        | 'triagem'
        | 'prototipado'
        | 'contatado'
        | 'briefing'
        | 'aguardando_pendencias'
        | 'refinamento'
        | 'em_analise'
        | 'entrega'
        | 'aguardando_pagamento'
        | 'finalizado'
        | 'respondeu'
        | 'negociando'
        | 'fechado'
        | 'perdido'
        | 'descartado'
    }
    CompositeTypes: Record<never, never>
  }
}

export type Prospect = Database['public']['Tables']['prospects']['Row']
export type ProspectUpdate = Database['public']['Tables']['prospects']['Update']
export type ProspectStatus = Database['public']['Enums']['prospect_status']

/** Canal do contato registrado; a cobrança sugere o outro. */
export type ContactChannel = 'whatsapp' | 'instagram' | 'email'
/**
 * Motivo da perda/descarte (check da migração 20261117220000). sem_resposta = descarte automático. Nulo = desconhecido ou manual.
 * sem_interesse em quem ainda está em `contatado` marca a espera antes do encerramento (isEsperaSemInteresse, em domain.ts).
 */
export type LostReason = 'visualizou_sem_resposta' | 'sem_interesse' | 'sem_resposta'

/** Achado da vistoria automática do preview (agent-okaisites/prospeccao/scripts/vistoria-abordagem.mjs). */
export type VistoriaAchado = { severidade: 'erro' | 'aviso'; regra: string; mensagem: string }
