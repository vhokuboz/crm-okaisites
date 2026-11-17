-- Motivo da perda, para o tracking (e um follow-up futuro) de quem foi perdido por um motivo
-- conhecido. Primeiro valor: 'visualizou_sem_resposta', gravado pelo item "Visualizou e não
-- respondeu" do menu do card (viu a abordagem e deixou o prazo passar). Motivo novo entra aqui,
-- no check, e em LostReason (src/lib/database.types.ts).
--
-- Quem escreve: o app. Nulo = sem motivo registrado (perdido manual, ou ainda no funil). Voltar
-- ao funil limpa o campo (statusTransitionPatch); o histórico fica em prospect_events.

alter table public.prospects
  add column lost_reason text
    check (lost_reason in ('visualizou_sem_resposta'));

comment on column public.prospects.lost_reason is
  'Motivo da perda (visualizou_sem_resposta). Gravado pelo app ao marcar perdido; limpo ao voltar ao funil.';

-- Os 4 contatados marcados como perdidos em 17/11/2026 (16h29-16h31 BRT) foram exatamente esse caso:
-- abordados pelo WhatsApp, visualizaram e não responderam em 3 dias.
update public.prospects p
set lost_reason = 'visualizou_sem_resposta'
where p.status = 'perdido'
  and exists (
    select 1 from public.prospect_events e
    where e.prospect_id = p.id
      and e.kind = 'status'
      and e.from_status = 'contatado'
      and e.to_status = 'perdido'
      and e.at between '2026-11-17 19:29:00+00' and '2026-11-17 19:31:00+00'
  );
