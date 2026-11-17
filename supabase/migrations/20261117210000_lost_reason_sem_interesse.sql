-- Segundo motivo de perda: 'sem_interesse', quando o lead respondeu dizendo não ter interesse.
-- Quem não se sabe se viu a abordagem fica com lost_reason nulo (motivo desconhecido).

alter table public.prospects drop constraint prospects_lost_reason_check;
alter table public.prospects
  add constraint prospects_lost_reason_check
    check (lost_reason in ('visualizou_sem_resposta', 'sem_interesse'));

comment on column public.prospects.lost_reason is
  'Motivo da perda (visualizou_sem_resposta, sem_interesse). Gravado pelo app ao marcar perdido; limpo ao voltar ao funil. Nulo = desconhecido.';

-- Responderam sem interesse (informado pelo Vitor em 17/11/2026).
update public.prospects
set lost_reason = 'sem_interesse'
where status = 'perdido'
  and name in ('Josiane Aguiar', 'Ana Leonel', 'Marina Aleixo', 'Andréia Wenceslau', 'Jéssica Julião');
