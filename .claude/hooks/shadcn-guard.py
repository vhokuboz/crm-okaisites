#!/usr/bin/env python3
"""PreToolUse (Write|Edit): componente de UI novo vem do shadcn, não da cabeça do modelo.

- Arquivo NOVO em src/components/ui/ -> bloqueado: só o CLI do shadcn cria lá.
- Arquivo NOVO .tsx em src/ com nome de primitivo (Dialog, Modal, Select...) ->
  bloqueado.
- Edit (ou Write sobre arquivo existente) fora de src/components/ui/ que
  ACRESCENTA marcação de primitivo feita à mão (role="tooltip", <dialog,
  aria-haspopup...) -> bloqueado. Mexer em marcação que já estava no trecho
  original (os modais atuais) passa.
Saída: o marcador `shadcn: sem equivalente` no texto novo ou no arquivo
(o agente procurou no MCP shadcn e nada serve).
"""
import json, os, re, sys

data = json.load(sys.stdin)
tool = data.get("tool_name")
if tool not in ("Write", "Edit"):
    sys.exit(0)
inp = data.get("tool_input", {})
path = inp.get("file_path", "")
root = os.environ.get("CLAUDE_PROJECT_DIR", data.get("cwd", ""))
rel = os.path.relpath(path, root) if os.path.isabs(path) else path
if not rel.startswith("src/"):
    sys.exit(0)
MARCADOR = "shadcn: sem equivalente"
existe = os.path.exists(path)

if existe:
    if rel.startswith("src/components/ui/") or not rel.endswith((".tsx", ".jsx")):
        sys.exit(0)
    atual = open(path, encoding="utf-8", errors="replace").read()
    if tool == "Edit":
        velho, novo = inp.get("old_string", ""), inp.get("new_string", "")
    else:
        velho, novo = atual, inp.get("content", "")
    if MARCADOR in novo or MARCADOR in atual:
        sys.exit(0)
    MARCAS = [r'role=["\'](tooltip|dialog|alertdialog|menu|menubar|menuitem|listbox|option|tablist|tab|tabpanel|combobox|switch|slider|radiogroup)["\']',
              r"<dialog\b", r"aria-haspopup", r"aria-modal", r"\.showModal\(", r"\bpopover=", r"popovertarget"]
    novas = [m for m in MARCAS if len(re.findall(m, novo)) > len(re.findall(m, velho))]
    if novas:
        print(
            f"Bloqueado: esta edição em {rel} acrescenta marcação de primitivo de UI feita à mão "
            f"({', '.join(novas)}). Procure o primitivo no MCP `shadcn`, instale com "
            "`npx shadcn@4.23.0 add <item>` e use-o importando de '@/components/ui/...'. "
            "Se procurou e nenhum item serve, inclua no código `// shadcn: sem equivalente — <o que foi procurado>`.",
            file=sys.stderr,
        )
        sys.exit(2)
    sys.exit(0)

ADD = "Procure no MCP `shadcn` (search_items_in_registries / view_items_in_registries) e instale com `npx shadcn@4.23.0 add <item>`; depois ajuste ao tema conforme o CLAUDE.md."

if rel.startswith("src/components/ui/"):
    print(f"Bloqueado: {rel} é componente shadcn e não deve ser escrito à mão. {ADD}", file=sys.stderr)
    sys.exit(2)

PRIMITIVOS = r"(Dialog|Modal|Sheet|Drawer|Select|Combobox|Popover|Tooltip|Tabs?|Dropdown|Menu|Menubar|ContextMenu|Toast|Sonner|Accordion|Collapsible|Checkbox|Switch|Slider|Radio(Group)?|Calendar|DatePicker|Command|HoverCard|AlertDialog|Toggle(Group)?|Pagination|Table|Skeleton|Progress|Avatar|Badge|Breadcrumb|Carousel|Input(OTP)?|Textarea|Form|Label|Separator|ScrollArea|Resizable|Sidebar|NavigationMenu)"
name = os.path.splitext(os.path.basename(rel))[0]
if rel.endswith(".tsx") and re.search(PRIMITIVOS, name) and MARCADOR not in inp.get("content", ""):
    print(
        f"Bloqueado: {rel} parece um primitivo de UI. {ADD} "
        "Se o shadcn já tem o primitivo, componha o componente sobre o de src/components/ui/ "
        "(importando de '@/components/ui/...'). Se procurou e nenhum item serve, inclua no arquivo "
        "o comentário `// shadcn: sem equivalente — <o que foi procurado>` e escreva de novo.",
        file=sys.stderr,
    )
    sys.exit(2)
