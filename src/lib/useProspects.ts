import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { canEnterContatado, closesHostedSite, discardPatch, encerrarEsperaPatch, esperaApagaPreview, isCobrancaExpirada, isEsperaVencida, reopensHostedSite, saiDaEspera, statusTransitionPatch, todayInSaoPauloISO } from './domain'
import { createLoadGate } from './loadGate'
import { serviceStartPatch } from './service'
import type { Prospect, ProspectUpdate } from './database.types'

/** `ids`: prospects que o Desfazer regravaria. */
type Toast = { id: number; message: string; undo: () => void; ids: string[] }

type State = {
  prospects: Prospect[]
  loading: boolean
  error: string | null
  toast: Toast | null
}

/** `undoLabel` ("Marcado como contatado") liga o aviso com Desfazer apos salvar. */
/** `confirmed`: o chamador já pediu confirmação ao usuário (ex.: DiscardModal), então não repete o confirm nativo. */
export type OnUpdate = (
  id: string,
  patch: ProspectUpdate,
  undoLabel?: string,
  opts?: { confirmed?: boolean },
) => Promise<boolean>

/** Aplica o mesmo tipo de mudanca a varios prospects; devolve quantos foram salvos. */
export type OnUpdateMany = (
  items: { id: string; patch: ProspectUpdate }[],
  label: string,
) => Promise<number>

type WriteResult = { ok: boolean; revert: ProspectUpdate | null; hosted: boolean }

export function useProspects() {
  const [state, setState] = useState<State>({ prospects: [], loading: true, error: null, toast: null })

  const [gate] = useState(createLoadGate)

  /** `background`: recarga que o usuário não pediu. Não apaga aviso ainda não lido e, se falhar, fica em silêncio. */
  const load = useCallback(async (background = false) => {
    const isFresh = gate.startLoad()
    const { data, error } = await supabase
      .from('prospects')
      .select('*')
      .order('name', { ascending: true })

    if (!isFresh()) return
    if (error) {
      // Mantem o que ja estava na tela: falha de rede nao pode virar "base vazia".
      // Em segundo plano so avisa se a primeira carga ainda nao terminou: ela foi invalidada por esta.
      setState((s) => (!background || s.loading ? { ...s, loading: false, error: error.message } : s))
      return
    }
    setState((s) => ({ ...s, prospects: data ?? [], loading: false, error: background ? s.error : null }))
  }, [gate])

  useEffect(() => {
    void load()
  }, [load])

  // Aba antiga volta a ver o banco ao reaparecer (o job das 06h pode ter encerrado alguém). O rascunho
  // da ficha aberta fica: o Drawer só o recarrega ao trocar de prospect ou depois de salvar.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') void load(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  // Leitura sincrona do estado atual, sem depender do timing do setState.
  const ref = useRef<Prospect[]>([])
  ref.current = state.prospects

  /**
   * Escreve otimista: a tela responde na hora e o registro volta ao valor
   * anterior se o banco recusar (uma policy negando, por exemplo). Devolve
   * tambem o patch que desfaz a escrita. So grava se o status no banco ainda for o que a tela conhece:
   * senao uma aba antiga reabriria (ou alteraria) um cliente que ja foi encerrado.
   * `apagaHospedagem` false grava o encerramento sem chamar encerrar-hospedagem.
   */
  const write = useCallback(async (id: string, patch: ProspectUpdate, confirmed = false, apagaHospedagem = true): Promise<WriteResult> => {
    const previous = ref.current.find((p) => p.id === id)
    if (previous && patch.status === 'contatado' && !canEnterContatado(previous)) {
      setState((s) => ({ ...s, error: `"${previous.name}" já passou de Contatado e não pode voltar.` }))
      return { ok: false, revert: null, hosted: false }
    }
    const hosted = !!previous && closesHostedSite(previous, patch)

    if (previous && hosted && !confirmed) {
      const ok = window.confirm(
        `Isso vai apagar a hospedagem do site de "${previous.name}" no Cloudflare Pages. Confirmar?`,
      )
      if (!ok) return { ok: false, revert: null, hosted }
    }
    // Descartado/perdido que respondeu depois: o descarte apagou o preview, então voltar ao funil
    // republica a página (mesmo slug, mesma URL) pelo deploy de preview do agent-okaisites.
    const reopens = !!previous && reopensHostedSite(previous, patch)
    if (previous && reopens && !confirmed) {
      const ok = window.confirm(
        `"${previous.name}" volta para o funil. Republicar o preview do site (deploy de alguns minutos)?`,
      )
      if (!ok) return { ok: false, revert: null, hosted }
    }

    const finalPatch: ProspectUpdate = previous
      ? serviceStartPatch(previous, statusTransitionPatch(previous, patch))
      : patch

    setState((s) => ({
      ...s,
      // O Desfazer de uma ação da espera não vale mais depois que o cliente saiu dela.
      toast: previous && saiDaEspera(previous, patch) && s.toast?.ids.includes(id) ? null : s.toast,
      prospects: s.prospects.map((p) => (p.id === id ? { ...p, ...finalPatch } : p)),
    }))

    const updating = supabase.from('prospects').update(finalPatch).eq('id', id)
    const finishWrite = gate.startWrite()
    // maybeSingle: 0 linhas volta como data nula, sem se confundir com um erro real do banco.
    const { data, error } = await Promise.resolve(
      (previous ? updating.eq('status', previous.status) : updating).select().maybeSingle(),
    ).finally(finishWrite)

    if (error) {
      setState((s) => ({
        ...s,
        error: `Não foi possível salvar: ${error.message}`,
        prospects: previous ? s.prospects.map((p) => (p.id === id ? previous : p)) : s.prospects,
      }))
      return { ok: false, revert: null, hosted }
    }

    if (!data) {
      setState((s) => ({
        ...s,
        error: `${previous ? `"${previous.name}"` : 'Este cliente'} mudou fora desta tela e nada foi salvo. Os dados foram recarregados: confira antes de repetir.`,
        prospects: previous ? s.prospects.map((p) => (p.id === id ? previous : p)) : s.prospects,
      }))
      await load(true)
      return { ok: false, revert: null, hosted: false }
    }

    setState((s) => ({
      ...s,
      error: null,
      prospects: s.prospects.map((p) => (p.id === id ? data : p)),
    }))

    if (previous && hosted && apagaHospedagem) {
      void supabase.functions
        .invoke('encerrar-hospedagem', { body: { slug: previous.slug } })
        .then(({ error: fnError }) => {
          if (fnError) {
            setState((s) => ({
              ...s,
              error: `Hospedagem não removida automaticamente: ${fnError.message}`,
            }))
          }
        })
    }

    if (previous && reopens) {
      void supabase.functions
        .invoke('republicar-preview', { body: { slug: previous.slug } })
        .then(({ error: fnError }) => {
          if (fnError) {
            setState((s) => ({
              ...s,
              error: `Preview não republicado automaticamente: ${fnError.message}`,
            }))
          }
        })
    }

    // Desfazer regrava so os campos que a acao tocou, com o valor de antes.
    const revert = previous && !saiDaEspera(previous, patch)
      ? (Object.fromEntries(
          Object.keys(finalPatch).map((k) => [k, previous[k as keyof Prospect]]),
        ) as ProspectUpdate)
      : null
    return { ok: true, revert, hosted }
  }, [load, gate])

  const showToast = useCallback((message: string, undo: () => void, ids: string[] = []) => {
    setState((s) => ({ ...s, toast: { id: Date.now(), message, undo, ids } }))
  }, [])

  const update = useCallback<OnUpdate>(
    async (id, patch, undoLabel, opts) => {
      const r = await write(id, patch, opts?.confirmed)
      // Escrita que apaga hospedagem nao tem volta: sem Desfazer.
      if (r.ok && undoLabel && r.revert && !r.hosted) {
        const revert = r.revert
        showToast(undoLabel, () => void update(id, revert, 'Desfeito'), [id])
      }
      return r.ok
    },
    [write, showToast],
  )

  /** Varias escritas em sequencia, com um unico aviso cujo Desfazer reverte todas. */
  const updateMany = useCallback<OnUpdateMany>(
    async (items, label) => {
      const reverts: { id: string; patch: ProspectUpdate }[] = []
      let done = 0
      for (const { id, patch } of items) {
        const r = await write(id, patch)
        if (!r.ok) continue
        done++
        if (r.revert && !r.hosted) reverts.push({ id, patch: r.revert })
      }
      if (reverts.length > 0) {
        showToast(`${label} (${done})`, () => {
          void (async () => {
            for (const rv of reverts) await write(rv.id, rv.patch)
            showToast('Desfeito', () => {})
          })()
        }, reverts.map((rv) => rv.id))
      }
      return done
    },
    [write, showToast],
  )

  // Descarte automático e fim da espera "sem interesse": quem encerra de verdade é
  // private.descartar_sem_resposta() (pg_cron, 06h BRT, migração 20261118120000). Este sweep é a
  // reserva: roda uma vez, quando a primeira carga termina, e só pega o que o cron ainda não pegou
  // (ex.: o job falhou).
  const swept = useRef(false)
  useEffect(() => {
    if (state.loading || swept.current) return
    swept.current = true
    const items = state.prospects
      .filter(isCobrancaExpirada)
      .map((p) => ({
        id: p.id,
        patch: { ...discardPatch(p, 'Descartado automaticamente: sem resposta à abordagem nem à cobrança.'), lost_reason: 'sem_resposta' as const },
      }))
    if (items.length > 0) void updateMany(items, 'Descartados sem resposta')
    // Direto no write com confirmed: o encerramento já foi decidido (sem confirm por cliente) e
    // perdido não volta a contatado, então um aviso com Desfazer não teria o que desfazer.
    const hoje = todayInSaoPauloISO()
    const vencidas = state.prospects.filter((p) => isEsperaVencida(p, hoje))
    void (async () => {
      for (const p of vencidas) await write(p.id, encerrarEsperaPatch(p), true, esperaApagaPreview(p))
    })()
  }, [state.loading, state.prospects, updateMany, write])

  const dismissError = useCallback(() => {
    setState((s) => ({ ...s, error: null }))
  }, [])

  const dismissToast = useCallback(() => setState((s) => ({ ...s, toast: null })), [])

  return { ...state, reload: load, update, updateMany, dismissError, dismissToast }
}
