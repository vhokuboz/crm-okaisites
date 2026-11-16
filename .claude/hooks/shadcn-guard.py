#!/usr/bin/env python3
"""PreToolUse (Write): componente de UI novo vem do shadcn, não da cabeça do modelo.

- Arquivo NOVO em src/components/ui/ -> bloqueado: só o CLI do shadcn cria lá.
- Arquivo NOVO .tsx em src/ com nome de primitivo (Dialog, Modal, Select...) ->
  bloqueado, a menos que o conteúdo tenha o marcador `shadcn: sem equivalente`
  (o agente procurou no MCP shadcn e nada serve).
Editar arquivo existente nunca é bloqueado.
"""
import json, os, re, sys

data = json.load(sys.stdin)
if data.get("tool_name") != "Write":
    sys.exit(0)
inp = data.get("tool_input", {})
path = inp.get("file_path", "")
root = os.environ.get("CLAUDE_PROJECT_DIR", data.get("cwd", ""))
rel = os.path.relpath(path, root) if os.path.isabs(path) else path
if os.path.exists(path) or not rel.startswith("src/"):
    sys.exit(0)

ADD = "Procure no MCP `shadcn` (search_items_in_registries / view_items_in_registries) e instale com `npx shadcn@4.23.0 add <item>`; depois ajuste ao tema conforme o CLAUDE.md."

if rel.startswith("src/components/ui/"):
    print(f"Bloqueado: {rel} é componente shadcn e não deve ser escrito à mão. {ADD}", file=sys.stderr)
    sys.exit(2)

PRIMITIVOS = r"(Dialog|Modal|Sheet|Drawer|Select|Combobox|Popover|Tooltip|Tabs?|Dropdown|Menu|Menubar|ContextMenu|Toast|Sonner|Accordion|Collapsible|Checkbox|Switch|Slider|Radio(Group)?|Calendar|DatePicker|Command|HoverCard|AlertDialog|Toggle(Group)?|Pagination|Table|Skeleton|Progress|Avatar|Badge|Breadcrumb|Carousel|Input(OTP)?|Textarea|Form|Label|Separator|ScrollArea|Resizable|Sidebar|NavigationMenu)"
name = os.path.splitext(os.path.basename(rel))[0]
if rel.endswith(".tsx") and re.search(PRIMITIVOS, name) and "shadcn: sem equivalente" not in inp.get("content", ""):
    print(
        f"Bloqueado: {rel} parece um primitivo de UI. {ADD} "
        "Se o shadcn já tem o primitivo, componha o componente sobre o de src/components/ui/ "
        "(importando de '@/components/ui/...'). Se procurou e nenhum item serve, inclua no arquivo "
        "o comentário `// shadcn: sem equivalente — <o que foi procurado>` e escreva de novo.",
        file=sys.stderr,
    )
    sys.exit(2)
