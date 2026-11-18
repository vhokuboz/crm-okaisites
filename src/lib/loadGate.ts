/**
 * Decide se a resposta de uma leitura ainda pode ir para a tela. Vale só a carga mais recente, e nenhuma
 * que tenha convivido com uma escrita: ela pode trazer o registro de antes e desfazer na tela o que foi gravado.
 */
export function createLoadGate() {
  let lastLoad = 0
  let writeEpoch = 0
  let writing = 0

  return {
    /** Chamar ao iniciar a leitura; a função devolvida diz, na chegada, se a resposta vale. */
    startLoad(): () => boolean {
      const load = ++lastLoad
      const epoch = writeEpoch
      return () => load === lastLoad && epoch === writeEpoch && writing === 0
    },
    /** Chamar ao iniciar a escrita; a função devolvida marca o fim dela. */
    startWrite(): () => void {
      writeEpoch++
      writing++
      return () => {
        writeEpoch++
        writing--
      }
    },
  }
}
