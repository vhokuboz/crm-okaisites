// Monta a requisição de workflow_dispatch pro GitHub Actions do repo
// agent-okaisites que republica o preview do slug (deploy-pages.yml sem
// production = branch preview, URL preview-<slug>.okaisites.com.br). O
// workflow recria o projeto Cloudflare Pages se o descarte o apagou; os
// arquivos do site continuam em clientes/<slug> no repo.
const REPO = 'vhokuboz/agent-okaisites'
const WORKFLOW = 'deploy-pages.yml'

export function buildDispatchRequest(
  slug: string,
  token: string,
): { url: string; init: RequestInit } {
  return {
    url: `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    init: {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ ref: 'main', inputs: { slug } }),
    },
  }
}
