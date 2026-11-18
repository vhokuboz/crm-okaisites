/// <reference types="node" />
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { draftFromProspect, draftValues, editedFields, editedPatch, rebaseDraft } from './drawerDraft.ts'
import { statusTransitionPatch } from './domain.ts'
import type { Prospect } from './database.types.ts'

const prospect = {
  name: 'Ana',
  segment: 'Dentista',
  city: 'Bauru',
  notes: null,
  approach_message: 'Oi',
  email: null,
  landing_page_url: 'https://x.pages.dev',
  whatsapp: null,
  status: 'prototipado',
  next_action_at: '2026-11-23',
  deal_value: 1500.5,
  monthly_fee: null,
  docs_received: false,
  deposit_paid_amount: null,
  final_paid_amount: null,
  lost_reason: null,
} as unknown as Prospect

test('editedPatch - sem edição não envia nada', () => {
  const base = draftFromProspect(prospect)
  assert.deepEqual(editedFields(base, base), [])
  assert.deepEqual(editedPatch(base, base, draftValues(base, prospect)), {})
})

test('editedPatch - envia só a coluna editada, nunca o status antigo do rascunho', () => {
  const base = draftFromProspect(prospect)
  const draft = { ...base, nextAction: '2026-12-08' }
  assert.deepEqual(editedPatch(draft, base, draftValues(draft, prospect)), { next_action_at: '2026-12-08' })
})

test('editedPatch - converte o valor editado para a coluna', () => {
  const base = draftFromProspect(prospect)
  const draft = { ...base, approach: '', dealValue: '2000' }
  assert.deepEqual(editedPatch(draft, base, draftValues(draft, prospect)), { approach_message: null, deal_value: 2000 })
})

test('rebaseDraft - sem edição acompanha o registro; com edição preserva', () => {
  const base = draftFromProspect(prospect)
  const incoming = draftFromProspect({ ...prospect, status: 'briefing', notes: 'nota do job', next_action_at: '2026-11-30' })
  const draft = { ...base, nextAction: '2026-12-08' }
  const rebased = rebaseDraft(draft, base, incoming)
  assert.equal(rebased.status, 'briefing')
  assert.equal(rebased.notes, 'nota do job')
  assert.equal(rebased.nextAction, '2026-12-08')
  assert.deepEqual(editedFields(rebased, incoming), ['nextAction'])
})

test('rebaseDraft - encerrado por baixo não deixa a ficha com edição fantasma', () => {
  const espera = { ...prospect, status: 'contatado', lost_reason: 'sem_interesse' } as Prospect
  const base = draftFromProspect(espera)
  const incoming = draftFromProspect({ ...espera, status: 'perdido', next_action_at: null, notes: 'Encerrado' })
  assert.deepEqual(editedFields(rebaseDraft(base, base, incoming), incoming), [])
})

test('draftValues - limpar a data na espera mantém a data; saindo da espera, limpa', () => {
  const espera = { ...prospect, status: 'contatado', lost_reason: 'sem_interesse' } as Prospect
  const base = draftFromProspect(espera)
  const limpa = { ...base, nextAction: '' }
  assert.equal(draftValues(limpa, espera).next_action_at, '2026-11-23')
  assert.equal(draftValues({ ...limpa, status: 'briefing' }, espera).next_action_at, null)
  assert.equal(draftValues(limpa, prospect).next_action_at, null)
})

test('editedPatch - mudar só o status deixa a data automática da transição valer', () => {
  const base = draftFromProspect(prospect)
  const draft = { ...base, status: 'aguardando_pendencias' as const }
  const patch = editedPatch(draft, base, draftValues(draft, prospect))
  assert.deepEqual(patch, { status: 'aguardando_pendencias' })
  assert.notEqual(statusTransitionPatch(prospect, patch).next_action_at, prospect.next_action_at)
})
