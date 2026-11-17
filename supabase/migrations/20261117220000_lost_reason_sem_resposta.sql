-- Terceiro motivo de perda: 'sem_resposta', gravado pelo descarte automático
-- (private.descartar_sem_resposta, pg_cron 06h BRT) em quem não respondeu à abordagem nem à
-- cobrança. Separa esse descarte do "Descartar" manual de um contatado, que fica com
-- lost_reason nulo. Função igual à da migração 20261117190000, mais o lost_reason.

alter table public.prospects drop constraint prospects_lost_reason_check;
alter table public.prospects
  add constraint prospects_lost_reason_check
    check (lost_reason in ('visualizou_sem_resposta', 'sem_interesse', 'sem_resposta'));

comment on column public.prospects.lost_reason is
  'Motivo da perda/descarte: visualizou_sem_resposta e sem_interesse (app, ao marcar perdido), sem_resposta (descarte automático). Limpo ao voltar ao funil. Nulo = desconhecido ou manual.';

create or replace function private.descartar_sem_resposta()
returns integer
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  max_cobrancas constant integer := 1;
  nota constant text := 'Descartado automaticamente: sem resposta à abordagem nem à cobrança.';
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  jwt text;
  r record;
  n integer := 0;
begin
  select decrypted_secret into jwt
  from vault.decrypted_secrets
  where name = 'encerrar_hospedagem_jwt';

  for r in
    update public.prospects
    set status = 'descartado',
        lost_reason = 'sem_resposta',
        next_action_at = null,
        last_reminded_at = null,
        notes = case when coalesce(notes, '') = '' then nota else notes || E'\n\n' || nota end
    where status = 'contatado'
      and contact_attempts >= max_cobrancas
      and next_action_at < hoje
    returning slug, landing_page_url, suspended_at, service_ended_at
  loop
    n := n + 1;
    if jwt is not null
       and r.slug is not null
       and coalesce(r.landing_page_url, '') <> ''
       and r.suspended_at is null
       and r.service_ended_at is null then
      perform net.http_post(
        url := 'https://brwfbyxthuqwwwzlzbwj.supabase.co/functions/v1/encerrar-hospedagem',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || jwt,
          'apikey', jwt
        ),
        body := jsonb_build_object('slug', r.slug)
      );
    end if;
  end loop;

  return n;
end;
$fn$;

revoke all on function private.descartar_sem_resposta() from public;
revoke all on function private.descartar_sem_resposta() from anon;
revoke all on function private.descartar_sem_resposta() from authenticated;

-- Descartados automaticamente até aqui: a nota fixa é a marca deles.
update public.prospects
set lost_reason = 'sem_resposta'
where status = 'descartado'
  and lost_reason is null
  and notes like '%Descartado automaticamente: sem resposta%';
