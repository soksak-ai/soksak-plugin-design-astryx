---
name: soksak-design-astryx
description: Use when designing a screen, page, UI, app, or mockup by talking inside soksak — drive the Astryx design plugin entirely by CLI/MCP commands (`sok plugin.soksak-plugin-design-astryx.*`). A page is one of two kinds: apply one of Astryx's 619 shipped TSX templates as a tsx page (source is the truth, rendered losslessly) and edit it with page.code.set, or compose a component tree by command (create pages, add/set/move/find components) on a tree page. Set the theme and light/dark/system mode, preview it live in an in-app canvas view, and export TSX. You edit only through commands and LOOK at the rendered canvas. Headless: works without opening the GUI. 디자인, 화면, UI, 앱, 목업, 와이어프레임, 페이지 만들기, 템플릿 적용, TSX 편집, 컴포넌트 추가, 레이아웃, 테마, 미리보기, TSX 내보내기도 여기. デザイン, 画面, モックアップ, テンプレート, ワイヤーフレーム, レイアウト, コンポーネント, テーマ, プレビュー.
---

# soksak Astryx design — design by talking

The design document is a set of Astryx pages (`@astryxdesign/core`) — each a typed component tree or an original TSX program — not a freeform drawing surface. You compose typed components or apply a template, set a theme, and mount the result live in an **in-app canvas view** where Astryx components render directly in the app webview, bound to the same document the commands mutate — every command re-renders instantly. Then **look at the pixels**. Every capability is a command over `sok` CLI, MCP, and the e2e socket. The plugin holds one working document per project (the single source of truth), persists it to `app.data`, and re-hydrates across windows.

This is Meta's Astryx design system. Follow its doctrine — the sections below are the doctrine, adapted to this plugin's command surface. The failure mode of AI design is the generic-prototype look: content dropped into a page with no frame, everything wrapped in cards, hand-set colors and pixels fighting the theme. The doctrine below exists to prevent exactly that.

## 0. Bootstrap ritual — discover, don't guess

Before ANY design work, load the doctrine and the live surface. Never design from memory of a component that may not exist, or props you assume:

```
sok plugin.soksak-plugin-design-astryx.docs.get topic=principles   # the design laws
sok plugin.soksak-plugin-design-astryx.docs.get topic=tokens       # the token vocabulary
sok plugin.soksak-plugin-design-astryx.docs.get topic=theme        # theme + light/dark mode
sok plugin.soksak-plugin-design-astryx.catalog.list                # the 99 real component types
sok plugin.soksak-plugin-design-astryx.template.list               # frames you can start from
```

`docs.list` enumerates every doctrine topic; `docs.get topic=<t>` returns one. Names and params are the registry's truth — confirm them, never guess:

```
sok commands | grep plugin.soksak-plugin-design-astryx
sok help plugin.soksak-plugin-design-astryx.<command>
```

## 1. Frame first — the #1 law

**Decide the frame before you add a single piece of content.** Content-first composition produces the generic-prototype look. Pick the frame from the app's shape:

- **Nav app** (a product with destinations) → a horizontal split: a `SideNav` rail beside a scrollable content `Section`. `AppShell` is Astryx's semantic app shell, but see the v1 slot note below.
- **Multi-pane tool** (editor, console, inspector layouts) → a horizontal `Stack` of `Section` panes: rail, content, inspector.
- **Docs / forms / marketing** → a plain vertical column: one `VStack` (cap the width) or `FormLayout` for forms. No shell, no side rail.

**Budget the fixed regions in px** before filling them — the frame's proportions are the design. Fixed structural widths: side nav 240–280, icon rail 64–72, inspector 340–420, facet/filter rail 220–260. The content region flexes to fill the rest. (Fixed region widths are the ONE place raw px is correct; everywhere else — gap, padding, color, radius — use tokens, §4.)

**Container policy** — how a region holds its content:
- Dense, scannable data → **rows, edge-to-edge**: `Table`, or `List` of `Item`. No card around each row.
- Dashboards, galleries, pickers → **card grids**: a `Grid` of `Card`.
- Reading/structure → **Sections**. `Section` is the correct way to create page regions; it is not a card.

**v1 slot note (read this before reaching for AppShell/Layout).** The runner feeds a node's structural composition through `node.children` only (§5). `AppShell` (`topNav`/`sideNav`/`banner`) and `Layout` (`header`/`footer`/`start`/`end`) expose their regions as separate ReactNode *slot props*, and slot props take text only in v1 — a live component tree cannot be routed into them. So realize every multi-region frame through the single children channel: a horizontal `Stack`/`Grid` whose children are `SideNav` and `Section` panes. `LayoutPanel` and `LayoutContent` are not catalog types — never add them (`INVALID_TYPE`).

## 2. App archetypes — frame recipes

Each recipe is a working v1 tree (root `Stack`, then children). Set fixed rail/inspector widths; let content flex.

- **Tracker / list app** → root `Stack direction=horizontal`, children `[ SideNav (Items), Section (content, `isScrollable`) ]`. Content is **rows only** (Table or List/Item) — never card-wrapped rows.
- **Console / dashboard** → root `Stack direction=horizontal`, children `[ SideNav, Section ]`; inside the Section a `TabList` for sections, a `Grid` of `Card` for stat widgets, and a `Table` for the data region.
- **Messaging** → root `Stack direction=horizontal`, children `[ Section (conversation rail 260–300), Section (message stream), Section (context 320–380) ]`. The stream is `List`/`Item` — **no cards in the stream**.
- **Media library** → root `VStack`; a `TopNav`-style header row, then a `Grid` of `Card` (the gallery).
- **Settings** → root `VStack` (cap width ~720), a `SideNav` or `TabList` for sections, and each group a `Section` containing a `FormLayout`.

## 3. Anti-patterns — never do these

- **Card soup** — never wrap each list/table row in a `Card`. Rows go in `Table` or `List`/`Item`, edge-to-edge.
- **Nested cards** — a `Card` never contains another `Card`. Flatten, or use `Section`.
- **Cards as page structure** — page regions are `Section`, never `Card`. A card is a discrete, self-contained object.
- **Badge misuse** — `Badge` is for counts and enumerated categories/states only. Live status → `StatusDot`; a removable tag/chip → `Token`.
- **Invented props/types** — never pass a prop you did not read in `catalog.doc`, and never add a type absent from `catalog.list`. Unknown prop → `INVALID_PROP`; unknown type → `INVALID_TYPE`.
- **Raw hex / raw px** — never hand-set colors or spacing to fight the theme. Use the token scale (§4). The sole px exception is fixed frame-region widths (§1).
- **Style-object layout hacks** — reach for the component's own props first (`variant`, `size`, `gap`, `padding`, `direction`, `align`). A style object is a last-resort escape hatch, and even then it carries tokens, not literals.

## 4. Conventions — predict an unfamiliar component

Astryx is regular. Before reading a doc, you can already guess the shape; `catalog.doc` confirms it:

- **Booleans read `is`/`has`** — `isDisabled`, `isLoading`, `isSelected`, `hasDividers`.
- **Handlers read `on<Verb>`** — `onClick`, `onChange`, `onRemove`. Callbacks are not JSON: v1 rejects them (`INVALID_PROP`) and the preview is non-interactive. **Omit every handler** in the design tree.
- **`label` is required on interactive components** — `Button`, `Item`, `StatusDot`, `Token` demand `label`.
- **Inputs are controlled** (`value` + `onChange`). In the design tree write `value` only, as a static prop; skip `onChange`. The preview renders the static value.
- **`size` is `sm | md | lg`.** Direction/edge words are **`start`/`end`, never `left`/`right`** (`startContent`, `endContent`, `paddingInline`).
- **Spacing is a step scale** — `gap`, `padding`, `paddingBlock`, `paddingInline` take a step, not px: `0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10`. Each step is 4px, so `gap={4}` = 16px.
- **Radius nests** — inner < element < container < page. Let components carry their own radius; don't flatten it.
- **Surface hierarchy** — body < surface < card < popover. Stack surfaces in that order; don't put a body surface on top of a card.
- **Tokens speak roles** — `var(--color-accent)`, `var(--color-background-surface)`, `var(--color-text-secondary)`, `var(--spacing-*)`, `var(--radius-*)`. Status colors (`success`/`warning`/`error`) are for status only, never decoration.

## 5. Two page kinds — tree vs tsx

A page's source is one of two kinds. Pick the kind before you build:

- **tsx page (source is truth)** — original `'use client'` TSX. Create it with `template.apply <id>` (one of Astryx's 619 shipped templates, rendered losslessly) or `page.create kind=tsx` (starter code), edit it whole with `page.code.set`, read it with `page.code.get`. **This is the shortest path to a rich, dense screen** — a template is a complete program, not a wireframe. The `comp.*` family does NOT apply (it returns `INVALID_TARGET`).
- **tree page (command-composed)** — an Astryx component tree edited a node at a time by `comp.*`. Create it with `page.create` (default `kind=tree`). Use it when you compose incrementally by command. `page.code.*` does NOT apply here — use `export.tsx` to read serialized code.

`export.tsx` hands off working code from either kind. The tree model below governs **tree pages**.

## 5.1 Tree model — read before mutating

- **A node = `{ id, type, props, children }`.** `type` is an Astryx catalog name. `props` are JSON scalars/text. `children` is the **only** structural composition channel.
- **`children` is gated.** A node holds children only when the catalog marks `acceptsChildren === true`. `comp.add` into a leaf (`acceptsChildren=false`, e.g. `Item`, `Badge`, `StatusDot`) returns `INVALID_TARGET`. Check with `catalog.doc type=<Type>`.
- **Text is a prop; components are children — never both.** A visible label is a string prop (`label`, or `children` as a string on a text node). Nested components go in `node.children`. A node MUST NOT carry a `children` prop while `node.children` is non-empty (`INVALID_PROP`).
- **Ids are `p<n>` (page) / `n<n>` (node)** from one monotonic `seq`, never reused. Each page has exactly one root; the root is never moved or removed. `comp.add` never creates a root — `page.create` and `template.apply` do.

## 6. Workflow — from prompt to code

```
# BOOTSTRAP (§0): docs.get principles/tokens/theme, catalog.list, template.list

# THEME + MODE — the palette is document-level; set it before judging anything visual
sok plugin.soksak-plugin-design-astryx.theme.list
sok plugin.soksak-plugin-design-astryx.theme.set theme=matcha mode=dark

# RICH PAGE (§5) — apply a shipped template as a tsx page (lossless, the shortest path)
sok plugin.soksak-plugin-design-astryx.template.list kind=page
sok plugin.soksak-plugin-design-astryx.template.apply id=<templateId> name='Console'
#   edit the tsx source whole (compiled at the gate):
sok plugin.soksak-plugin-design-astryx.page.code.set pageId=<p> code='<TSX>'
#   or FRAME FIRST (§1) — compose a tree page a node at a time:
sok plugin.soksak-plugin-design-astryx.page.create name='Console'
sok plugin.soksak-plugin-design-astryx.comp.set pageId=<p> nodeId=<rootId> \
  props='{"direction":"horizontal","height":"fill"}'

# COMPOSE — frame regions first, then their content; address parents by id
sok plugin.soksak-plugin-design-astryx.comp.add pageId=<p> type=SideNav
sok plugin.soksak-plugin-design-astryx.comp.add pageId=<p> type=Section props='{"isScrollable":true}'
sok plugin.soksak-plugin-design-astryx.comp.add pageId=<p> parentId=<sectionId> type=Table
sok plugin.soksak-plugin-design-astryx.comp.set  pageId=<p> nodeId=<btnId> props='{"size":"lg"}'

# RENDER + LOOK — the whole point
sok plugin.soksak-plugin-design-astryx.preview.open pageId=<p>   # opens/focuses the in-app canvas tab
sok window.snapshot        # capture the app window; READ the PNG (soksak-dev / soksak-debug skill)
# iterate: every mutation re-renders the canvas live; nudge an explicit re-render if needed
sok plugin.soksak-plugin-design-astryx.preview.refresh pageId=<p>

# HAND OFF working code
sok plugin.soksak-plugin-design-astryx.export.tsx pageId=<p>
```

**The canvas is the verification, not a nicety.** `preview.open` selects the page as the canvas's active page and opens (or focuses) the in-app canvas tab, which mounts the Astryx components directly in the app webview (Shadow DOM), live-bound to the document. Every mutating command re-renders the active page in place — no server, no browser, no artifact on disk; `preview.refresh` and `theme.set` are explicit re-render nudges, not navigation. Never claim a design is done from tree structure alone — snapshot the window, read the pixels, fix what looks wrong, look again.

**A `Table` inside a `Card` bleeds edge-to-edge on its own** (the container padding system) — never hand-compensate its margins.

**Exported TSX is static.** `export.tsx` serializes the tree to a compilable file wrapped in `<Theme>`. It carries no handlers or state (they were never in the tree) — add interactivity in code after export.

## 7. Command reference (26)

All commands take one JSON params object and return the v1 envelope `{ ok, code, message, data? }`. Prefix every name with `plugin.soksak-plugin-design-astryx.`.

| Command | Params | Effect |
|---|---|---|
| `ping` | `{}` | `{ version, catalogCount, templateCount }` — load/version check. |
| `state` | `{}` | `{ activeTheme, pageCount, pages[] }` — document summary. |
| `docs.list` | `{}` | Doctrine topics available to `docs.get`. |
| `docs.get` | `{ topic }` | One doctrine document (`principles`, `tokens`, `theme`, …). |
| `page.create` | `{ name, kind? }` | New page; `kind` `tree` (default, root `Stack`) or `tsx` (starter code). |
| `page.list` | `{}` | `{ pages[] }`. |
| `page.rename` | `{ pageId, name }` | Rename a page. |
| `page.duplicate` | `{ pageId, name? }` | Deep-clone a page with fresh ids (tree) or verbatim `code` (tsx). |
| `page.remove` | `{ pageId }` | Remove a page. |
| `page.code.get` | `{ pageId }` | A tsx page's `code` (tree page → `INVALID_TARGET`). |
| `page.code.set` | `{ pageId, code }` | Replace a tsx page's `code`; compiled at the gate (`COMPILE_FAILED` on bad code, diagnostics in `data`). |
| `comp.add` | `{ pageId, type, parentId?, index?, props? }` | Add a node under `parentId` (default root) at `index`. Tree pages only. |
| `comp.set` | `{ pageId, nodeId, props, replace? }` | Merge (or replace) props; a `null` value deletes a key. Tree pages only. |
| `comp.move` | `{ pageId, nodeId, parentId, index? }` | Reparent a node (rejects cycles / the root). Tree pages only. |
| `comp.remove` | `{ pageId, nodeId }` | Remove a node and its subtree (not the root). Tree pages only. |
| `comp.get` | `{ pageId, nodeId }` | The full subtree. Tree pages only. |
| `comp.find` | `{ pageId?, type?, propContains? }` | Locate matching nodes. Tree pages only. |
| `theme.set` | `{ theme, mode? }` | Set the active theme and light/dark/system mode; the mounted canvas re-renders live. |
| `theme.list` | `{}` | `{ themes, active }` — the 7 themes. |
| `template.list` | `{ kind?, includeUnavailable? }` | Available templates + counts/reasons of unavailable ones. |
| `template.apply` | `{ id, pageId?, name? }` | Create a tsx page from a template's verbatim code (unavailable → `TEMPLATE_UNAVAILABLE`). |
| `catalog.list` | `{ group?, query? }` | Catalog components. |
| `catalog.doc` | `{ type }` | Full entry: props, enums, defaults, `acceptsChildren`. |
| `preview.open` | `{ pageId }` | Select the page and open/focus the in-app canvas tab. |
| `preview.refresh` | `{ pageId? }` | Force an explicit canvas re-render (headless no-op when no view is open). |
| `export.tsx` | `{ pageId }` | TSX for the page — a tsx page's `code` verbatim, or the tree serializer. |

The 7 themes: `butter`, `chocolate`, `gothic`, `matcha`, `neutral`, `stone`, `y2k`; `mode` is `light`, `dark`, or `system` (default `system`). `gothic` is dark-only — an effective `light` mode is rejected with `INVALID_PROP`.

Every `comp.*` command on a **tsx page** returns `INVALID_TARGET` pointing to `page.code.*`; `page.code.*` on a **tree page** returns `INVALID_TARGET` pointing to `comp.*` / `export.tsx`.

## 8. Envelope and failure

- Every command returns **`{ ok, code, message, data? }`** — branch on `ok`, never on a legacy `error` field. On failure `code` is a closed set (`NOT_FOUND`, `INVALID_TYPE`, `INVALID_PROP`, `INVALID_TARGET`, `INVALID_ARG`, `DUPLICATE`, `TEMPLATE_UNKNOWN`, `TEMPLATE_UNAVAILABLE`, `THEME_UNKNOWN`, `COMPILE_FAILED`, `PREVIEW_FAILED`, `EXPORT_FAILED`) and `message` is human prose; `data` carries the result. `COMPILE_FAILED` (bad `page.code.set` TSX) also carries the compiler error in `data.diagnostics`.
- It is **headless-complete** — you never open a GUI to design. The document is the single source of truth; the canvas view only renders it, and every editing command works with no view open.
- The canvas is in-app: there is no browser dependency and no artifact on disk. `preview.open` fails with `PREVIEW_FAILED` only when the canvas view cannot open (e.g. no active project).
