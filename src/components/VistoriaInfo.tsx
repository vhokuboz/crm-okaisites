import type { Prospect } from '../lib/database.types'
import { formatDateBR, vistoriaAchados } from '../lib/domain'

/*
  Resultado da vistoria automática do preview (vistoria-abordagem.mjs, no fim do
  lote diário). Erro tira o card de "Encaminhar proposta" e o leva para
  "Vistoria reprovou"; aviso só aparece. Sem vistoria ainda, uma linha discreta.
*/
export function VistoriaInfo({ prospect: p }: { prospect: Prospect }) {
  if (!p.landing_page_url) return null
  if (!p.vistoria_at) return <p className="mt-2.5 text-xs text-muted">Vistoria do preview pendente</p>

  const achados = vistoriaAchados(p)
  const erros = achados.filter((a) => a.severidade === 'erro').length
  const avisos = achados.length - erros
  const resumo =
    p.vistoria_ok === false
      ? `Vistoria reprovou: ${erros} erro${erros === 1 ? '' : 's'}`
      : `Vistoria ok${avisos ? ` · ${avisos} aviso${avisos === 1 ? '' : 's'}` : ''}`
  const tom = p.vistoria_ok === false ? 'font-semibold text-seal-ink' : 'text-muted'
  const quando = formatDateBR(p.vistoria_at.slice(0, 10))

  if (achados.length === 0)
    return (
      <p className="mt-2.5 text-xs text-muted" title={`Vistoria em ${quando}`}>
        {resumo}
      </p>
    )

  return (
    <details className="mt-2.5 text-xs" open={p.vistoria_ok === false}>
      <summary className={`hit cursor-pointer ${tom}`}>
        {resumo} <span className="font-normal text-muted">({quando})</span>
      </summary>
      <ul className="mt-1.5 space-y-1 pl-1">
        {achados.map((a, i) => (
          <li key={i} className={`break-words ${a.severidade === 'erro' ? 'text-seal-ink' : 'text-muted'}`}>
            <span className="font-semibold">{a.regra}</span>: {a.mensagem}
          </li>
        ))}
      </ul>
    </details>
  )
}
