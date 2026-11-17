-- Uma cobrança só: a abordagem vai por uma rede (WhatsApp ou Instagram) e a
-- cobrança, 3 dias úteis depois, pela outra. Sem resposta depois do retorno da
-- cobrança, o prospect é descartado. Mesmo valor de MAX_COBRANCAS
-- (src/lib/domain.ts) e de resumo-abordagem.mjs no agent-okaisites.
--
-- O print da abordagem passa a ser desktop (1440x900): mostra mais conteúdo
-- e atrai mais na conversa.

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

comment on column public.prospects.abordagem_print_url is
  'URL pública (bucket abordagem) do print desktop 1440x900@1.25 que acompanha a mensagem de abordagem.';
