-- Abordagem assistida: vistoria automática do preview, print para a mensagem,
-- canal de contato e descarte sem resposta rodando no servidor.
--
-- Quem escreve cada parte:
--   vistoria_* e abordagem_print_url: agent-okaisites/prospeccao/scripts/vistoria-abordagem.mjs
--     (chave secreta, no fim do lote diário). O app só lê.
--   last_contact_channel: o app, ao registrar contato/cobrança pelo botão "Abordar".
--   descarte: private.descartar_sem_resposta(), via pg_cron, todo dia às 06h BRT.

-- ---------------------------------------------------------------- colunas ---
alter table public.prospects
  add column vistoria_at timestamptz,
  add column vistoria_ok boolean,
  add column vistoria_achados jsonb,
  add column abordagem_print_url text,
  add column last_contact_channel text
    check (last_contact_channel in ('whatsapp', 'instagram', 'email'));

comment on column public.prospects.vistoria_at is
  'Quando o preview passou pela vistoria automática (vistoria-abordagem.mjs). Nulo = ainda não vistoriado.';
comment on column public.prospects.vistoria_ok is
  'true = nenhum achado de severidade erro. false tira o prospect de "pronto para abordar" até a próxima vistoria passar.';
comment on column public.prospects.vistoria_achados is
  'Lista [{severidade: erro|aviso, regra, mensagem}] da última vistoria. Não vai para notes.';
comment on column public.prospects.abordagem_print_url is
  'URL pública (bucket abordagem) do print de celular 390x844@2x que acompanha a mensagem de abordagem.';
comment on column public.prospects.last_contact_channel is
  'Canal do último contato registrado (whatsapp/instagram/email). A cobrança sugere o outro canal.';

-- ---------------------------------------------------------------- storage ---
-- Público: o print é do preview, que já é uma página pública. Quem sobe é o
-- script com a chave secreta (ignora RLS); ninguém escreve pelo app.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('abordagem', 'abordagem', true, 5242880, array['image/png'])
on conflict (id) do nothing;

-- -------------------------------------------------- descarte sem resposta ---
-- Mesma regra de isCobrancaExpirada (src/lib/domain.ts): contatado, cobranças
-- esgotadas (MAX_COBRANCAS = 2) e o retorno vencido há pelo menos 1 dia. Antes
-- rodava só com o CRM aberto (useProspects.ts); agora roda no servidor, e o
-- sweep do app fica como reserva.
--
-- Para quem tinha site publicado, chama a edge function encerrar-hospedagem
-- (mesmo critério de closesHostedSite). A chamada usa pg_net e é assíncrona:
-- o descarte não espera o GitHub. Se o segredo encerrar_hospedagem_jwt não
-- estiver no Vault, o descarte acontece e a hospedagem fica para o app.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create or replace function private.descartar_sem_resposta()
returns integer
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  nota constant text := 'Descartado automaticamente: sem resposta após 2 cobranças.';
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
      and contact_attempts >= 2
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

-- 09:00 UTC = 06h00 BRT, antes da fila do dia.
select cron.schedule(
  'descartar-sem-resposta',
  '0 9 * * *',
  'select private.descartar_sem_resposta()'
);

-- ------------------------------------------------------------- reverter ---
--   select cron.unschedule('descartar-sem-resposta');
--   drop function if exists private.descartar_sem_resposta();
--   alter table public.prospects drop column vistoria_at, drop column vistoria_ok,
--     drop column vistoria_achados, drop column abordagem_print_url, drop column last_contact_channel;
--   delete from storage.buckets where id = 'abordagem';  -- só com o bucket vazio
