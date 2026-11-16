# CRM Okai — regras para o agente

## Documentação de bibliotecas (Context7)

React 19, TanStack Query 5, Tailwind 4, Vite 7 e supabase-js mudaram de API depois do treino do modelo. Antes de escrever ou alterar código que usa uma delas, consulte o MCP `context7` (`resolve-library-id` → `query-docs` com a pergunta concreta) e siga a API que ele devolver, não a lembrada.

## Componentes de UI (shadcn)

Antes de escrever do zero um primitivo de interface (dialog, sheet/drawer, select, combobox, popover, tooltip, tabs, dropdown, toast), procure no MCP `shadcn` e instale com `npx shadcn@4.23.0 add <item>` — versão fixada, a mesma do `.mcp.json`. O item cai em `src/components/ui/`.

Os componentes de `src/components/` são escritos à mão e já funcionam: migrar um deles para shadcn só quando o pedido for essa migração.

Depois de cada `add`, ajuste o componente ao tema:

- **Cor sempre pelos tokens da marca.** O `@theme` de `src/index.css` é a fonte da verdade (papel, cartão, tinta, filete, carimbo, ocre). O bloco "Ponte shadcn/ui" logo abaixo aponta os nomes do shadcn (`bg-background`, `bg-primary`, `border-border`, `ring`…) para esses tokens; cor nova entra no `@theme`, nunca como valor solto no componente.
- **`muted` é do CRM:** `text-muted` é a cor de texto secundário (100+ usos). No componente shadcn, troque `bg-muted` por `bg-faded`.
- **Tema só claro:** o app não tem `.dark`; variantes `dark:` que vierem no componente ficam inertes e podem ser removidas.

## Antes de dar como concluído

`npm run typecheck`, `npm test` e `npm run build` passando.
