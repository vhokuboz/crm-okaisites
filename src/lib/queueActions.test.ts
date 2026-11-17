/// <reference types="node" />
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addBusinessDaysISO, addDaysISO } from './domain.ts'
import { canContact, canCopyCobranca, canMarkIgnored, cobrancaMessage, canRepeat, contactPatch, ignoredPatch, matchesFilters, repeatPatch, snoozePatch } from './queueActions.ts'

test('canMarkIgnored / ignoredPatch - só contatado, e vira perdido', () => {
  assert.equal(canMarkIgnored({ status: 'contatado' }), true)
  for (const status of ['prototipado', 'negociando', 'perdido', 'descartado'] as const)
    assert.equal(canMarkIgnored({ status }), false)
  assert.deepEqual(ignoredPatch(), { status: 'perdido', lost_reason: 'visualizou_sem_resposta' })
})

test('snoozePatch - agenda a partir de hoje', () => {
  assert.equal(snoozePatch(3).next_action_at, addDaysISO(3))
})

test('contactPatch - antes do contato vira contatado, sem data (a transição agenda)', () => {
  const patch = contactPatch({ status: 'prototipado' })
  assert.equal(patch.status, 'contatado')
  assert.equal(patch.next_action_at, undefined)
  assert.ok(patch.last_contacted_at)
})

test('contactPatch - depois do contato soma 3 dias e mantém o status', () => {
  const patch = contactPatch({ status: 'contatado' })
  assert.equal(patch.status, undefined)
  assert.equal(patch.next_action_at, addDaysISO(3))
})

test('canRepeat - só contatado com retorno vencido ou de hoje e cobranças sobrando', () => {
  assert.equal(canRepeat({ status: 'contatado', next_action_at: addDaysISO(-1), contact_attempts: 0 }), true)
  assert.equal(canRepeat({ status: 'contatado', next_action_at: addDaysISO(-1), contact_attempts: 1 }), false)
  assert.equal(canRepeat({ status: 'contatado', next_action_at: addDaysISO(2), contact_attempts: 0 }), false)
  assert.equal(canRepeat({ status: 'prototipado', next_action_at: addDaysISO(-1), contact_attempts: 0 }), false)
  assert.equal(canRepeat({ status: 'contatado', next_action_at: null, contact_attempts: 0 }), false)
})

test('repeatPatch - soma tentativa e agenda 3 dias úteis', () => {
  const patch = repeatPatch({ contact_attempts: 2 })
  assert.equal(patch.contact_attempts, 3)
  assert.equal(patch.next_action_at, addBusinessDaysISO(3))
})

test('matchesFilters - ignora acento e caixa, e combina segmento e status', () => {
  const p = { name: 'Clínica São José', segment: 'Dentista', city: 'Bauru', status: 'novo' } as const
  const none = { query: '', segment: '', status: '' }
  assert.equal(matchesFilters(p, { ...none, query: 'clinica sao jose' }), true)
  assert.equal(matchesFilters(p, { ...none, query: 'BAURU' }), true)
  assert.equal(matchesFilters(p, { ...none, query: 'advogado' }), false)
  assert.equal(matchesFilters(p, { ...none, segment: 'Dentista', status: 'novo' }), true)
  assert.equal(matchesFilters(p, { ...none, status: 'triagem' }), false)
})

test('canContact - triagem nao registra contato; as demais etapas sim', () => {
  assert.equal(canContact({ status: 'triagem' }), false)
  assert.equal(canContact({ status: 'prototipado' }), true)
  assert.equal(canContact({ status: 'contatado' }), true)
})

test('cobrancaMessage - singular usa o primeiro nome, plural usa o nome do espaço', () => {
  const url = 'https://x.example'
  const s = cobrancaMessage({ name: 'Guilherme Montanari', city: 'Lins/SP', tratamento: 'singular', landing_page_url: url })
  assert.ok(s.startsWith('Olá, Guilherme! Aqui é o Vitor Okubo, de Lins. '))
  assert.ok(s.includes(`${url}\n`) && s.includes('com o seu nome'))
  const pl = cobrancaMessage({ name: 'Espaço Wallon', city: '', tratamento: 'plural', landing_page_url: url })
  assert.ok(pl.startsWith('Olá! Aqui é o Vitor Okubo. '))
  assert.ok(pl.includes('para Espaço Wallon'))
})

test('canCopyCobranca - exige retorno vencido, tratamento e link', () => {
  const ok = { status: 'contatado' as const, next_action_at: addDaysISO(-1), contact_attempts: 0, tratamento: 'plural' as const, landing_page_url: 'u' }
  assert.equal(canCopyCobranca(ok), true)
  assert.equal(canCopyCobranca({ ...ok, next_action_at: addDaysISO(2) }), false)
  assert.equal(canCopyCobranca({ ...ok, tratamento: null }), false)
  assert.equal(canCopyCobranca({ ...ok, landing_page_url: null }), false)
})

/* --------------------------------------------------------------- abordar --- */
import { abordagemKind, abordagemPatch, abordagemText, availableChannels, instagramDmUrl, suggestedChannel } from './queueActions.ts'

const base = {
  status: 'prototipado' as const,
  next_action_at: null,
  contact_attempts: 0,
  tratamento: 'singular' as const,
  landing_page_url: 'https://x.pages.dev',
  approach_message: 'Oi! Montei uma amostra.',
  name: 'Ana Souza',
  city: 'Bauru/SP',
  whatsapp: '5514999990000',
  contact: null,
  instagram: '@ana.souza',
  last_contact_channel: null,
}

test('abordagemKind - abordagem no prototipado, cobrança no contatado vencido, null no resto', () => {
  assert.equal(abordagemKind(base), 'abordagem')
  assert.equal(abordagemKind({ ...base, approach_message: ' ' }), null)
  const cobr = { ...base, status: 'contatado' as const, next_action_at: addDaysISO(-1) }
  assert.equal(abordagemKind(cobr), 'cobranca')
  assert.equal(abordagemKind({ ...cobr, next_action_at: addDaysISO(2) }), null)
  assert.equal(abordagemKind({ ...cobr, contact_attempts: 1 }), null)
})

test('abordagemText - cobrança usa a mensagem de follow-up', () => {
  assert.equal(abordagemText(base), base.approach_message)
  const t = abordagemText({ ...base, status: 'contatado', next_action_at: addDaysISO(-1) })
  assert.match(t ?? '', /Há alguns dias/)
})

test('availableChannels / suggestedChannel - WhatsApp primeiro, cobrança troca de canal', () => {
  assert.deepEqual(availableChannels(base), ['whatsapp', 'instagram'])
  assert.deepEqual(availableChannels({ ...base, whatsapp: null }), ['instagram'])
  assert.equal(suggestedChannel(base), 'whatsapp')
  const cobr = { ...base, status: 'contatado' as const, next_action_at: addDaysISO(-1), last_contact_channel: 'whatsapp' as const }
  assert.equal(suggestedChannel(cobr), 'instagram')
  assert.equal(suggestedChannel({ ...cobr, instagram: null }), 'whatsapp')
  assert.equal(suggestedChannel({ ...base, whatsapp: null, instagram: null }), null)
})

test('instagramDmUrl - handle ou URL viram ig.me', () => {
  assert.equal(instagramDmUrl('@ana.souza'), 'https://ig.me/m/ana.souza')
  assert.equal(instagramDmUrl('https://instagram.com/ana.souza/'), 'https://ig.me/m/ana.souza')
  assert.equal(instagramDmUrl(null), null)
})

test('abordagemPatch - 1º contato vira contatado; cobrança soma tentativa e grava o contato', () => {
  const now = new Date('2026-11-17T12:00:00Z')
  const p1 = abordagemPatch(base, 'whatsapp', now)
  assert.equal(p1.status, 'contatado')
  assert.equal(p1.last_contact_channel, 'whatsapp')
  assert.equal(p1.last_contacted_at, now.toISOString())
  const p2 = abordagemPatch({ ...base, status: 'contatado', next_action_at: addDaysISO(-1), contact_attempts: 0 }, 'instagram', now)
  assert.equal(p2.status, undefined)
  assert.equal(p2.contact_attempts, 1)
  assert.equal(p2.next_action_at, addBusinessDaysISO(3))
  assert.equal(p2.last_contact_channel, 'instagram')
  assert.equal(p2.last_contacted_at, now.toISOString())
})
