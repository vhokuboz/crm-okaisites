import { isEsperaSemInteresse } from './domain.ts'
import type { Prospect, ProspectStatus, ProspectUpdate } from './database.types.ts'

/** Campos editáveis da ficha, como ficam nos inputs (número e data viram texto). */
export type DrawerDraft = {
  name: string
  segment: string
  city: string
  notes: string
  approach: string
  email: string
  landing: string
  whatsapp: string
  status: ProspectStatus
  nextAction: string
  dealValue: string
  monthlyFee: string
  docsReceived: boolean
  depositPaidAmount: string
  finalPaidAmount: string
}

const COLUMN = {
  name: 'name',
  segment: 'segment',
  city: 'city',
  notes: 'notes',
  approach: 'approach_message',
  email: 'email',
  landing: 'landing_page_url',
  whatsapp: 'whatsapp',
  status: 'status',
  nextAction: 'next_action_at',
  dealValue: 'deal_value',
  monthlyFee: 'monthly_fee',
  docsReceived: 'docs_received',
  depositPaidAmount: 'deposit_paid_amount',
  finalPaidAmount: 'final_paid_amount',
} as const satisfies Record<keyof DrawerDraft, keyof ProspectUpdate>

const FIELDS = Object.keys(COLUMN) as (keyof DrawerDraft)[]

export function draftFromProspect(p: Prospect): DrawerDraft {
  return {
    name: p.name,
    segment: p.segment,
    city: p.city,
    notes: p.notes ?? '',
    approach: p.approach_message ?? '',
    email: p.email ?? '',
    landing: p.landing_page_url ?? '',
    whatsapp: p.whatsapp ?? '',
    status: p.status,
    nextAction: p.next_action_at ?? '',
    dealValue: p.deal_value?.toString() ?? '',
    monthlyFee: p.monthly_fee?.toString() ?? '',
    docsReceived: p.docs_received,
    depositPaidAmount: p.deposit_paid_amount?.toString() ?? '',
    finalPaidAmount: p.final_paid_amount?.toString() ?? '',
  }
}

/** Campos que o usuário mudou em relação ao que foi carregado na ficha. */
export function editedFields(draft: DrawerDraft, base: DrawerDraft): (keyof DrawerDraft)[] {
  return FIELDS.filter((k) => draft[k] !== base[k])
}

/** O registro mudou por baixo: campo sem edição local acompanha o valor novo; campo editado fica como está. */
export function rebaseDraft(draft: DrawerDraft, base: DrawerDraft, incoming: DrawerDraft): DrawerDraft {
  return Object.fromEntries(
    FIELDS.map((k) => [k, draft[k] === base[k] ? incoming[k] : draft[k]]),
  ) as DrawerDraft
}

/** O rascunho inteiro como colunas do banco: é o que as regras automáticas do Salvar leem. */
export function draftValues(d: DrawerDraft, p: Prospect): ProspectUpdate {
  return {
    name: d.name.trim() || p.name,
    segment: d.segment.trim() || p.segment,
    city: d.city.trim() || p.city,
    notes: d.notes || null,
    approach_message: d.approach || null,
    email: d.email.trim() || null,
    landing_page_url: d.landing.trim() || null,
    whatsapp: d.whatsapp.trim() || null,
    status: d.status,
    // Na espera a data é o encerramento: limpar o campo mantém a que estava, senão o cliente nunca encerraria.
    next_action_at: d.nextAction || (isEsperaSemInteresse(p) && d.status === 'contatado' ? p.next_action_at : null),
    deal_value: d.dealValue.trim() ? Number(d.dealValue) : null,
    monthly_fee: d.monthlyFee.trim() ? Number(d.monthlyFee) : null,
    docs_received: d.docsReceived,
    deposit_paid_amount: d.depositPaidAmount.trim() ? Number(d.depositPaidAmount) : null,
    final_paid_amount: d.finalPaidAmount.trim() ? Number(d.finalPaidAmount) : null,
  }
}

/** Só as colunas editadas: salvar não pode regravar valores antigos de campos que o usuário não tocou. */
export function editedPatch(draft: DrawerDraft, base: DrawerDraft, values: ProspectUpdate): ProspectUpdate {
  return Object.fromEntries(
    editedFields(draft, base).map((k) => [COLUMN[k], values[COLUMN[k]]]),
  ) as ProspectUpdate
}
