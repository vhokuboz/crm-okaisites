-- Espera "sem interesse": o contatado que respondeu não ter interesse fica em status = 'contatado'
-- com lost_reason = 'sem_interesse' até a data em next_action_at (3 dias úteis), porque encerrar
-- apaga o preview e ele ainda pode mudar de ideia. Na data, o job diário (pg_cron 06h BRT, já
-- agendado na migração 20261117120000) marca perdido e apaga o preview. O descarte por falta de
-- resposta deixa de pegar quem está em espera. Função igual à da migração 20261117220000, mais isso.

comment on column public.prospects.lost_reason is
  'Motivo da perda/descarte: visualizou_sem_resposta e sem_interesse (app), sem_resposta (descarte automático). Com status = contatado, sem_interesse marca a espera até o encerramento automático em next_action_at. Limpo ao voltar ao funil. Nulo = desconhecido ou manual.';

create or replace function private.descartar_sem_resposta()
returns integer
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  max_cobrancas constant integer := 1;
  nota_descarte constant text := 'Descartado automaticamente: sem resposta à abordagem nem à cobrança.';
  nota_espera constant text := 'Encerrado automaticamente: respondeu sem interesse e o prazo de espera terminou.';
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  jwt text;
  r record;
  n integer := 0;
begin
  select decrypted_secret into jwt
  from vault.decrypted_secrets
  where name = 'encerrar_hospedagem_jwt';

  for r in
    with descartados as (
      update public.prospects
      set status = 'descartado',
          lost_reason = 'sem_resposta',
          next_action_at = null,
          last_reminded_at = null,
          notes = case when coalesce(notes, '') = '' then nota_descarte else notes || E'\n\n' || nota_descarte end
      where status = 'contatado'
        and contact_attempts >= max_cobrancas
        and next_action_at < hoje
        and lost_reason is distinct from 'sem_interesse'
      returning slug, landing_page_url, suspended_at, service_ended_at
    ),
    encerrados as (
      update public.prospects
      set status = 'perdido',
          next_action_at = null,
          last_reminded_at = null,
          notes = case when coalesce(notes, '') = '' then nota_espera else notes || E'\n\n' || nota_espera end
      where status = 'contatado'
        and lost_reason = 'sem_interesse'
        and next_action_at <= hoje
      returning slug, landing_page_url, suspended_at, service_ended_at
    )
    select * from descartados
    union all
    select * from encerrados
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
