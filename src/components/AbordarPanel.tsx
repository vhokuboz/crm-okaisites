import { useEffect, useState } from 'react'
import type { ContactChannel, Prospect } from '../lib/database.types'
import type { OnUpdate } from '../lib/useProspects'
import { whatsappUrl } from '../lib/domain'
import {
  CHANNEL_LABEL,
  abordagemKind,
  abordagemPatch,
  abordagemText,
  availableChannels,
  instagramDmUrl,
  suggestedChannel,
} from '../lib/queueActions'
import { InstagramIcon, WhatsAppIcon } from './QuickActions'

/*
  Painel "Abordar", aberto dentro do card. O envio continua sendo do Vitor:
  aqui só se junta print + mensagem + conversa aberta, e se registra o canal.

  - Celular: "Compartilhar" abre a folha do sistema com o print e o texto;
    escolhe-se WhatsApp ou Instagram e envia.
  - Computador: o botão do canal copia o print (WhatsApp, onde o texto já vai
    no link) ou a mensagem (Instagram, que não aceita texto no link) e abre a
    conversa. O outro item se copia pelos botões de baixo.
  - Depois: "Enviei por ..." grava contato/cobrança com o canal; a cobrança
    seguinte sugere o outro canal.

  O print é baixado quando o painel abre: navigator.share e clipboard.write
  precisam do clique do usuário, e esperar o download dentro do clique faz o
  Safari recusar.
*/

const BTN =
  'hit inline-flex min-h-9 items-center justify-center gap-1.5 rounded-sm border border-rule px-2.5 py-1.5 text-body transition-colors hover:bg-paper disabled:opacity-50'
const BTN_STRONG =
  'hit inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-sm bg-ink px-3.5 py-2 text-body font-medium text-paper transition-opacity hover:opacity-85 disabled:opacity-50'

function ChannelIcon({ channel, size = 14 }: { channel: ContactChannel; size?: number }) {
  if (channel === 'whatsapp') return <WhatsAppIcon size={size} />
  if (channel === 'instagram') return <InstagramIcon size={size} />
  return null
}

export function AbordarPanel({
  prospect: p,
  onUpdate,
  onClose,
}: {
  prospect: Prospect
  onUpdate: OnUpdate
  onClose: () => void
}) {
  const kind = abordagemKind(p)
  const text = abordagemText(p) ?? ''
  const canais = availableChannels(p)
  const sugerido = suggestedChannel(p)
  const printUrl = p.abordagem_print_url
  const [blob, setBlob] = useState<Blob | null>(null)
  const [printFalhou, setPrintFalhou] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [touch] = useState(() => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches)

  useEffect(() => {
    if (!printUrl) return
    let vivo = true
    fetch(printUrl)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => vivo && setBlob(b))
      .catch(() => vivo && setPrintFalhou(true))
    return () => {
      vivo = false
    }
  }, [printUrl])

  const file = blob ? new File([blob], `${p.slug ?? 'preview'}.png`, { type: 'image/png' }) : null
  const podeCompartilhar = touch && !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

  async function copiarPrint(): Promise<boolean> {
    if (!blob) return false
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      return true
    } catch {
      return false
    }
  }

  async function copiarTexto(): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }

  async function compartilhar() {
    if (!file) return
    try {
      await navigator.share({ files: [file], text })
      setAviso('Enviou? Registre abaixo por qual canal.')
    } catch (e) {
      if ((e as DOMException)?.name !== 'AbortError') setAviso('Não deu para compartilhar. Use os botões dos canais.')
    }
  }

  function urlDoCanal(channel: ContactChannel): string | null {
    return channel === 'whatsapp' ? whatsappUrl(p, text) : instagramDmUrl(p.instagram)
  }

  /*
    Roda no clique do link, que é quem abre a conversa. A cópia começa aqui, antes
    de a aba nova tomar o foco, mas o clique não a espera: window.open depois de um
    await perde o gesto do usuário e o Safari bloqueia a aba.
  */
  async function aoAbrir(channel: ContactChannel) {
    const copiou = channel === 'whatsapp' ? await copiarPrint() : await copiarTexto()
    if (channel === 'whatsapp')
      setAviso(
        copiou
          ? 'Print copiado: cole (Ctrl+V) na conversa antes de enviar. A mensagem já está no campo.'
          : 'WhatsApp aberto com a mensagem. Anexe o print com "Copiar print".',
      )
    else
      setAviso(
        copiou
          ? 'Mensagem copiada: cole na conversa e anexe o print com "Copiar print".'
          : 'Instagram aberto. Copie a mensagem e o print pelos botões abaixo.',
      )
  }

  async function registrar(channel: ContactChannel) {
    setBusy(true)
    const ok = await onUpdate(
      p.id,
      abordagemPatch(p, channel),
      `${kind === 'cobranca' ? 'Cobrança' : 'Contato'} registrado (${CHANNEL_LABEL[channel]})`,
    )
    setBusy(false)
    if (ok) onClose()
  }

  if (!kind) return null

  return (
    <div className="space-y-3 rounded-sm border border-rule bg-paper/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted">
          {kind === 'cobranca' ? `Cobrança ${p.contact_attempts + 1}` : 'Primeira abordagem'}
          {sugerido && (
            <>
              {' · sugerido: '}
              <span className="font-semibold text-ink">{CHANNEL_LABEL[sugerido]}</span>
              {kind === 'cobranca' && p.last_contact_channel && p.last_contact_channel !== sugerido
                ? ` (o último foi pelo ${CHANNEL_LABEL[p.last_contact_channel]})`
                : ''}
            </>
          )}
        </p>
        <button type="button" onClick={onClose} className="hit text-xs text-muted underline underline-offset-2 hover:text-ink">
          Fechar
        </button>
      </div>

      {/* Print desktop (1440×900): largura toda do painel, a mensagem logo abaixo. */}
      {printUrl && !printFalhou ? (
        <a href={printUrl} target="_blank" rel="noreferrer noopener" className="block overflow-hidden rounded-sm border border-rule">
          <img src={printUrl} alt={`Print do preview de ${p.name}`} className="aspect-[1440/900] w-full object-cover object-top" />
        </a>
      ) : (
        <p className="rounded-sm border border-dashed border-rule p-2 text-meta text-muted">
          {printFalhou ? 'Print não carregou' : 'Sem print: a vistoria ainda não rodou'}
        </p>
      )}
      <p className="line-clamp-4 whitespace-pre-line text-xs leading-relaxed text-ink/80">{text}</p>

      {podeCompartilhar && (
        <button type="button" onClick={compartilhar} className={BTN_STRONG}>
          Compartilhar print + mensagem
        </button>
      )}

      <div className="grid grid-cols-2 gap-2">
        {canais.map((c) => {
          const url = urlDoCanal(c)
          if (!url) return null
          return (
            <a
              key={c}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => void aoAbrir(c)}
              className={`${BTN} ${c === sugerido ? 'border-deep/40 bg-stage-1 text-deep' : ''}`}
            >
              <ChannelIcon channel={c} />
              Abrir {CHANNEL_LABEL[c]}
            </a>
          )
        })}
        <button
          type="button"
          disabled={!blob}
          onClick={() => void copiarPrint().then((ok) => setAviso(ok ? 'Print copiado.' : 'Não foi possível copiar o print.'))}
          className={BTN}
        >
          Copiar print
        </button>
        <button
          type="button"
          onClick={() => void copiarTexto().then((ok) => setAviso(ok ? 'Mensagem copiada.' : 'Não foi possível copiar a mensagem.'))}
          className={BTN}
        >
          Copiar mensagem
        </button>
      </div>

      {aviso && (
        <p role="status" className="break-words text-xs text-deep">
          {aviso}
        </p>
      )}

      <div className="rule-top space-y-1.5 pt-2.5">
        <p className="text-meta text-muted">Registrar envio</p>
        <div className="grid grid-cols-2 gap-2">
          {(canais.length ? canais : (['whatsapp', 'instagram'] as ContactChannel[])).map((c) => (
            <button key={c} type="button" disabled={busy} onClick={() => void registrar(c)} className={BTN}>
              <ChannelIcon channel={c} />
              Enviei por {CHANNEL_LABEL[c]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
