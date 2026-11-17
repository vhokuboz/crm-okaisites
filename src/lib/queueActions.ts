import { MAX_COBRANCAS, addBusinessDaysISO, addDaysISO, daysFromToday, instagramHandle, whatsappUrl } from './domain.ts'
import type { ContactChannel, Prospect, ProspectUpdate } from './database.types.ts'

/** Adiar um prospect: a nova data de retorno, a partir de hoje. */
export const SNOOZE_OPTIONS = [
  { label: 'Amanhã', days: 1 },
  { label: 'Em 3 dias', days: 3 },
  { label: 'Em 1 semana', days: 7 },
] as const

export function snoozePatch(days: number): ProspectUpdate {
  return { next_action_at: addDaysISO(days) }
}

/** Em triagem o prospect ainda esta sendo avaliado: nao se registra contato (nem se pula o protótipo). */
export function canContact(p: Pick<Prospect, 'status'>): boolean {
  return p.status !== 'triagem'
}

/**
 * "Registrei contato": antes do primeiro contato vira "contatado" (a regra de
 * transição agenda o retorno); nos demais casos soma o retorno de 3 dias.
 */
export function contactPatch(p: Pick<Prospect, 'status'>, now = new Date()): ProspectUpdate {
  const antesDoContato = p.status === 'triagem' || p.status === 'prototipado'
  return {
    last_contacted_at: now.toISOString(),
    ...(antesDoContato ? { status: 'contatado' as const } : { next_action_at: addDaysISO(3) }),
  }
}

/** "Cobrei de novo": só faz sentido para quem já foi contatado, com o retorno vencido e cobranças sobrando. */
export function canRepeat(p: Pick<Prospect, 'status' | 'next_action_at' | 'contact_attempts'>): boolean {
  return (
    p.status === 'contatado' &&
    p.contact_attempts < MAX_COBRANCAS &&
    !!p.next_action_at &&
    daysFromToday(p.next_action_at) <= 0
  )
}

export function repeatPatch(p: Pick<Prospect, 'contact_attempts'>): ProspectUpdate {
  return { next_action_at: addBusinessDaysISO(3), contact_attempts: p.contact_attempts + 1 }
}

/**
 * "Visualizou e não respondeu": viu a abordagem e deixou o prazo passar. Cobrar pela outra rede
 * não muda isso, então vai direto para perdido (a transição limpa a data de retorno e o lembrete).
 */
export function canMarkIgnored(p: Pick<Prospect, 'status'>): boolean {
  return p.status === 'contatado'
}

export function ignoredPatch(): ProspectUpdate {
  return { status: 'perdido' }
}

/** Botão "Copiar cobrança": contatado com retorno vencido e já classificado como singular/plural. */
export function canCopyCobranca(p: Pick<Prospect, 'status' | 'next_action_at' | 'contact_attempts' | 'tratamento' | 'landing_page_url'>): boolean {
  return canRepeat(p) && !!p.tratamento && !!p.landing_page_url
}

/** Mensagem de follow-up por substituição de variáveis: singular usa o primeiro nome, plural o nome do espaço. */
export function cobrancaMessage(p: Pick<Prospect, 'name' | 'city' | 'tratamento' | 'landing_page_url'>): string {
  const cidade = p.city.split('/')[0].trim()
  const origem = cidade ? `, de ${cidade}` : ''
  const aviso = 'Há alguns dias deixei uma mensagem por aqui e imagino que tenha se perdido no meio das outras. 😊'
  if (p.tratamento === 'plural')
    return `Olá! Aqui é o Vitor Okubo${origem}. ${aviso}

Resumindo: montei por conta própria uma amostra de página para ${p.name}, para vocês verem como o espaço pode aparecer na internet e receber contatos pelo WhatsApp:
${p.landing_page_url}

Se der, dê uma olhada e me diga o que acharam. Sem compromisso! Se preferirem, também posso explicar por aqui ou por telefone.`
  return `Olá, ${p.name.split(' ')[0]}! Aqui é o Vitor Okubo${origem}. ${aviso}

Resumindo: montei por conta própria uma amostra de página com o seu nome, para você ver como seu trabalho pode aparecer na internet e receber contatos pelo WhatsApp:
${p.landing_page_url}

Se der, dê uma olhada e me diga o que achou. Sem compromisso! Se preferir, também posso explicar por aqui ou por telefone.`
}

export type QueueFilters = { query: string; segment: string; status: string }

const plain = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Busca por nome, segmento ou cidade (sem acento e sem caixa), mais segmento e status exatos. */
export function matchesFilters(
  p: Pick<Prospect, 'name' | 'segment' | 'city' | 'status'>,
  f: QueueFilters,
): boolean {
  if (f.segment && p.segment !== f.segment) return false
  if (f.status && p.status !== f.status) return false
  const q = plain(f.query.trim())
  if (!q) return true
  return plain(`${p.name} ${p.segment} ${p.city ?? ''}`).includes(q)
}

/* --------------------------------------------------------------- abordar --- */

export const CHANNEL_LABEL: Record<ContactChannel, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  email: 'E-mail',
}

type AbordarFields = Pick<
  Prospect,
  | 'status'
  | 'next_action_at'
  | 'contact_attempts'
  | 'tratamento'
  | 'landing_page_url'
  | 'approach_message'
  | 'name'
  | 'city'
  | 'whatsapp'
  | 'contact'
  | 'instagram'
  | 'last_contact_channel'
>

/** Canais de mensagem que o registro tem: WhatsApp (número) e Instagram (handle). */
export function availableChannels(p: AbordarFields): ContactChannel[] {
  const out: ContactChannel[] = []
  if (whatsappUrl(p as Prospect)) out.push('whatsapp')
  if (instagramHandle(p.instagram)) out.push('instagram')
  return out
}

/**
 * Qual mensagem o "Abordar" envia agora: a cobrança quando o retorno venceu e
 * ainda há cobranças, a abordagem quando o protótipo está pronto; null quando
 * não há o que enviar (o card mostra os botões antigos).
 */
export function abordagemKind(p: AbordarFields): 'abordagem' | 'cobranca' | null {
  if (canCopyCobranca(p)) return 'cobranca'
  if (p.status === 'prototipado' && p.approach_message?.trim() && p.landing_page_url?.trim()) return 'abordagem'
  return null
}

export function abordagemText(p: AbordarFields): string | null {
  const kind = abordagemKind(p)
  if (kind === 'cobranca') return cobrancaMessage(p)
  if (kind === 'abordagem') return p.approach_message
  return null
}

/**
 * Canal sugerido: na cobrança, o outro canal em relação ao último contato
 * (mesma mensagem na outra rede); no primeiro contato, WhatsApp quando houver.
 */
export function suggestedChannel(p: AbordarFields): ContactChannel | null {
  const canais = availableChannels(p)
  if (canais.length === 0) return null
  if (abordagemKind(p) === 'cobranca' && p.last_contact_channel) {
    const outro = canais.find((c) => c !== p.last_contact_channel)
    if (outro) return outro
  }
  return canais[0]
}

/** DM do Instagram: abre a conversa com o perfil (no app, no celular). */
export function instagramDmUrl(value: string | null): string | null {
  const handle = instagramHandle(value)
  return handle ? `https://ig.me/m/${handle.replace(/^@/, '')}` : null
}

/** Registrar o envio pelo "Abordar": contato (1ª vez) ou cobrança, sempre com o canal. */
export function abordagemPatch(p: AbordarFields, channel: ContactChannel, now = new Date()): ProspectUpdate {
  if (abordagemKind(p) === 'cobranca')
    return { ...repeatPatch(p), last_contacted_at: now.toISOString(), last_contact_channel: channel }
  return { ...contactPatch(p, now), last_contact_channel: channel }
}
