# soksak-plugin-design-astryx — v1 Contract

This is the constitution. Every implementer builds strictly to this document. The TypeScript twin of these laws lives in `src/types.ts`; when prose and `types.ts` disagree, `types.ts` wins for shapes and this document wins for behavior.

Plugin id tokens: `design`, `astryx`. Command first segments never equal or abbreviate those tokens.

---

## 1. Identity and scope

The plugin is a headless design-document engine **plus an in-app canvas view** (a plugin program). Every editing capability is a registry command — the document is headless-complete and drives from `sok` CLI, MCP, and the bundled skill with no view open. The **primary design surface** is the canvas view: it mounts Astryx components **directly** as a React tree inside a Shadow DOM in the app webview, **live-bound to the same module store** the commands mutate, so every command re-renders the active page instantly. There is no artifact on disk, no navigation, no server, no browser dependency (§7). The view and the commands are one truth (the toolbar is itself a command client, §7 Toolbar law).

### v2 → v3 pivot (canvas view, browser preview removed)

v3 replaces the v2 browser-preview transport (http server + `file://`-forbidden artifacts driven into a dependency browser plugin) with an in-app canvas view. Rationale — the owner's architecture verdict (the primary surface is a panel program, not a browser document) plus the erd precedent (erd mounts its whole React app inside `attachShadow` to contain a global CSS reset). The Astryx TSX/tree rendering core is **reused** verbatim as the view's rendering engine; only the transport changes. The removed artifacts are enumerated in §7 (Legacy-removal law).

### Two page kinds (v2 law)

A page's source is one of two kinds (§2):

- **tree** — a component tree of Astryx components (`@astryxdesign/core` `0.1.3`), edited by the `comp.*` command family. This is the command-driven editing surface.
- **tsx** — original `'use client'` TSX source, where **the source is the truth**. A tsx page is created by `template.apply` (from one of Astryx's 619 shipped templates) or `page.create` with `kind: "tsx"`, and edited whole by `page.code.set`. The runner compiles and mounts it losslessly (§7).

The original unit of Astryx is the **TSX program** — its 619 shipped templates carry hooks, local state, helper components, and typed code. They render **losslessly** through the tsx path; they are never demoted to a tree. The old tree-conversion of templates (static converter + skeleton logic + `templates-report.json`) is **removed legacy** — git remembers; no dead code remains.

Scope is full: every renderable component export of `@astryxdesign/core` (no whitelist) for tree pages, all 7 packaged themes, all 619 shipped Astryx CLI templates as verbatim tsx (605 available; 14 unavailable with honest reasons — 7 missing/compile-time-only modules + 7 icon helper modules with no default export to mount, §13), and TSX export for both kinds.

### Designing workflow (law)

The two kinds are complementary, not ranked:

- **Rich pages → `template.apply` first.** A shipped template is a complete `'use client'` program; applying it seeds a tsx page that renders losslessly. This is the shortest path to a real, dense screen.
- **Command-composition → tree pages.** When the LLM builds a screen incrementally by command (add/set/move a component at a time, addressed by id), use a tree page (`page.create` default `kind:"tree"`) and the `comp.*` family.
- **TSX-level edits → `page.code.set`.** To change a tsx page — including one seeded from a template — replace its `code` whole; the gate compiles it before it lands (§5).

`export.tsx` hands off working code from either kind (§10).

---

## 2. Page and tree model

### Shapes (normative in `src/types.ts`)

```
DesignNode = { id: string, type: string, props: Record<string, JsonValue>, children: DesignNode[] }
PageSource = { kind: "tree", root: DesignNode } | { kind: "tsx", code: string, origin?: string }
DesignPage = { id: string, name: string, source: PageSource }
DesignDoc  = { version: 1, activeTheme: ThemeName, mode?: ColorMode, pages: DesignPage[], seq: number }
ColorMode  = "light" | "dark" | "system"
```

`DesignDoc.mode` is optional (absent in pre-mode docs) and read as `system` when absent (§9, §11).

`JsonValue` is JSON-serializable only. The whole doc persists as one JSON value and injects into the preview as `window.__DESIGN__`.

### Page source law (v2)

A page's `source` is a discriminated union on `kind`:

- **`{ kind: "tree", root }`** — the `comp.*` tree family (add/set/move/remove/get/find) edits `source.root`. `export.tsx` serializes it (§10). This is the command-driven editing surface.
- **`{ kind: "tsx", code, origin? }`** — `code` is original TSX and is the sole truth. `origin` records the `templateId` it came from (when applicable). `page.code.get`/`page.code.set` read and replace `code`; `export.tsx` returns it verbatim (§10). The runner compiles and mounts it (§7). Tree ops do not apply.

**v1 → v2 coercion (in-place, no migration file).** A persisted v1 page was root-only (`{ id, name, root }`). On hydrate, `coerceDoc` rewrites it to `{ id, name, source: { kind: "tree", root } }`. `DesignDoc.version` stays `1` — the page-source law is a superset of the format, so there is no version bump and no migration artifact; the coercion is a hydrate-time rule (§11). A page whose `source` is absent or malformed coerces to an empty tree page (`{ kind: "tree", root: bare Stack }`) rather than throwing.

### Command targeting by kind

The `comp.*` family and any tree op act on **tree pages only**. Invoked on a tsx page, they return `INVALID_TARGET` with an actionable message directing the caller to `page.code.get`/`page.code.set`. Symmetrically, `page.code.get`/`page.code.set` act on **tsx pages only**; on a tree page they return `INVALID_TARGET` directing the caller to the `comp.*` family (or `export.tsx` to read serialized code). `export.tsx`, `page.rename`, `page.duplicate`, `page.remove`, `page.list`, `state`, and `preview.*` are kind-agnostic and act on either.

The `Children law`, `Id generation`, `Invariants`, and `Prop validation law` below govern **tree pages only** (`source.kind === "tree"`). A tsx page has no nodes, no node ids, and no prop validation — its `code` is the truth and is validated by compilation at `page.code.set` (§5).

### Children law (decided)

`node.children` is the **only** structural composition channel. `node.children` is non-empty only when the catalog marks `acceptsChildren === true` for `node.type`. The runner feeds `node.children` into the component's React `children` prop.

Text and scalars are always props. A ReactNode prop filled with **literal text** is a string prop value (e.g. `props.label = "Save"`, or `props.children = "Card Title"` on a text-only node). A ReactNode prop filled with **components** uses `node.children`. These never coexist: when `node.children` is non-empty, `props` must not contain a `children` key.

### Id generation

`DesignDoc.seq` is a monotonic counter, never reused (even after delete). A new page id is `p${++seq}`; a new tree-page node id is `n${++seq}`. Page ids and node ids share the `seq` space, so all ids in a doc are globally unique. A deep copy of a tree page (`page.duplicate`) allocates a fresh id per node from `seq`. A tsx page has no node ids — `page.duplicate` of a tsx page allocates only a fresh page id and copies `code` (and `origin`) verbatim; `template.apply` allocates a fresh page id and needs no node ids.

### Invariants (enforced by command handlers)

- **INV1 single root** — each page has exactly one root node. The root has no parent. The root is never moved or removed.
- **INV2 acyclic** — children form a tree. `comp.move` rejects a target that is the moved node or any of its descendants.
- **INV3 known type** — every `node.type` exists in the catalog. Enforced on `comp.add`, `comp.set` (no-op for type), and template load.
- **INV4 children gate** — `node.children` non-empty ⇒ `catalog[type].acceptsChildren === true`.
- **INV5 no double children** — `props` has no `children` key while `node.children` is non-empty.
- **INV6 unique ids** — every page id and node id across the doc is unique.

### Prop validation law

`comp.add` and `comp.set` validate each incoming prop against `catalog[type].props`:

- Unknown prop name → `INVALID_PROP`.
- Prop whose catalog `type` contains `"=>"` (callback) → `INVALID_PROP`. Callbacks are not JSON-serializable; the preview is non-interactive in v1.
- Prop with a catalog `enum` → value must be a member → else `INVALID_PROP`.
- Prop whose catalog `type` is exactly `"string"`, `"number"`, or `"boolean"` → value must be that primitive → else `INVALID_PROP`. Any other catalog type accepts any `JsonValue` (unions, `ReactNode`, arrays, objects cannot be checked further).
- Setting `props.children` to a string is allowed only when `node.children` is empty (INV5).

Required props are **not** enforced at write time — the tree is built incrementally. `export.tsx` and `preview` render whatever is present.

---

## 3. Error codes (closed set)

The command layer produces exactly these codes (`src/types.ts` `Code`):

`OK`, `NOT_FOUND`, `INVALID_TYPE`, `INVALID_PROP`, `INVALID_TARGET`, `INVALID_ARG`, `DUPLICATE`, `TEMPLATE_UNKNOWN`, `TEMPLATE_UNAVAILABLE`, `THEME_UNKNOWN`, `COMPILE_FAILED`, `PREVIEW_FAILED`, `EXPORT_FAILED`.

- `TEMPLATE_UNAVAILABLE` — the template id exists but `available === false` (a missing or compile-time-only dependency; §13). `template.apply` returns it with the template's `reason`. Distinct from `TEMPLATE_UNKNOWN` (id not in `templates.json`).
- `COMPILE_FAILED` — `page.code.set` was given TSX that does not compile under the render core's sucrase config (§7). The failure envelope carries the compiler error in `data.diagnostics` (§4).
- `PREVIEW_FAILED` — v3 meaning: opening/focusing the canvas view failed (`plugin.view.open` returned non-ok, e.g. no active project). The v2 meaning (artifact write / browser drive) is gone.

**Removed in v3:** `DEP_MISSING` — there is no browser-dependency probe anymore (the canvas is in-app). Any code referencing it is deleted; git remembers (§7 Legacy-removal law).

`PERMISSION_DENIED`, `UNKNOWN_COMMAND`, `INVALID_PARAMS`, `INTERNAL` are core-owned outcomes (produced by `registry.execute`, not by handlers). Handlers never emit them.

---

## 4. Message protocol (v1) and handler convention

The wire outcome is always the symmetric envelope `{ ok, code, message, data? }`. The core `registry.execute`/`normalizeOutcome` builds it. Handlers supply the material:

- **Success** — the handler returns a plain data record (the `data`). The displayed `message` is owned by `register(...).message = (data) => <Korean one-line>`. A handler's own `message` on success is discarded, so the Korean line lives in `spec.message` only (single source).
- **Failure** — the handler returns `err(code, message)` from `src/types.ts` = `{ ok:false, code, message }`, honored verbatim. The `{ ok:false, error }` legacy dialect is forbidden.
- **Failure with diagnostics** — `err(code, message, data)` adds an optional structured `data` to the failure envelope, honoring the symmetric envelope `{ ok, code, message, data }`. The sole v2 user is `page.code.set`'s `COMPILE_FAILED`, whose `data.diagnostics` carries the sucrase compiler error. The human-readable summary is ALSO placed in `message`, so a caller still sees the error even if the core drops failure `data`.

Every `register(...)` call MUST provide `message`; a missing `message` degrades the answer to a label and `plugin.conformance` reports the command as `messagesMissing`. Every command message is command-owned Korean prose.

Command descriptions follow the two-axis i18n rule (`docs/I18N.md`): `spec.description` is an English base string (the LLM discovery surface); `spec.triggers` is the non-English trigger map (language → word). The human label is the manifest `contributes.commands[].title` (`{en,ko}`). The manifest carries no param schemas or descriptions — those live only in the runtime `register(...)` spec.

---

## 5. Command surface (26)

All commands take a single JSON params object and return per §4. `pageId`/`nodeId` are the ids from §2. Below, "→" is the success data record; "errs" is the subset of §3 the handler may return.

Ordering note: `page.create` sets the source once (tree root or starter tsx); `comp.add` never creates a root; a tree page's root is never moved or removed.

**Kind gate (§2).** Every `comp.*` command additionally returns `INVALID_TARGET` when `pageId` names a **tsx page** — the message points to `page.code.get`/`page.code.set`. `page.code.get`/`page.code.set` return `INVALID_TARGET` when `pageId` names a **tree page** — the message points to the `comp.*` family or `export.tsx`. This gate is not repeated in each entry's `errs` below; it is universal for the two families.

### ping
- params: `{}`
- → `{ version, catalogCount, templateCount }`
- errs: none
- message: `Astryx 디자인 플러그인 v{version} — 컴포넌트 {catalogCount}종, 템플릿 {templateCount}개.`

### state
- params: `{}`
- → `{ activeTheme, pageCount, pages: [{ id, name, kind, rootType?, nodeCount? }] }` (`rootType`/`nodeCount` on tree pages only; tsx pages carry `kind: "tsx"`)
- errs: none
- message: `문서: 테마 {activeTheme}, 페이지 {pageCount}개.`

### page.create
- params: `{ name: string, kind?: "tree" | "tsx" }` (`kind` default `tree`)
- Behavior: creates a page of `kind`. `tree` → `source = { kind:"tree", root: bare Stack }` (`{ type:"Stack", props:{}, children:[] }`). `tsx` → `source = { kind:"tsx", code: <starter component> }`, where the starter is a minimal compilable `'use client'` default-export component. To seed a page from a shipped template, use `template.apply` instead (it creates a tsx page from the template code, §13). `page.create` no longer takes a `template` param — that path is `template.apply`.
- → `{ pageId, name, kind, rootType?, nodeCount? }` (`rootType`/`nodeCount` present for tree pages only)
- errs: `INVALID_ARG` (blank name, or bad `kind`)
- message: `{kind} 페이지 '{name}' 생성.`

### page.list
- params: `{}`
- → `{ pages: [{ id, name, kind, rootType?, nodeCount? }] }` (`rootType`/`nodeCount` on tree pages only)
- errs: none
- message: `페이지 {pages.length}개.`

### page.rename
- params: `{ pageId: string, name: string }`
- → `{ pageId, name }`
- errs: `NOT_FOUND`, `INVALID_ARG` (blank name)
- message: `페이지 이름 '{name}' 으로 변경.`

### page.duplicate
- params: `{ pageId: string, name?: string }`
- Behavior: deep-clones the page with fresh ids. Default new name = `"{source name} copy"`.
- → `{ pageId, name, nodeCount }`
- errs: `NOT_FOUND`
- message: `페이지 '{name}' 복제(노드 {nodeCount}개).`

### page.remove
- params: `{ pageId: string }`
- Behavior: removes the page. A doc may hold zero pages.
- → `{ removedId }`
- errs: `NOT_FOUND`
- message: `페이지 삭제.`

### comp.add
- params: `{ pageId: string, type: string, parentId?: string, index?: number, props?: Record<string, JsonValue> }`
- Behavior: adds a node of `type` under `parentId` (default = page root) at `index` (default = append). Validates `type` (INV3), parent `acceptsChildren` (INV4), and props (§2 prop validation).
- → `{ nodeId, node }` (`node` = the created subtree)
- errs: `NOT_FOUND` (page/parent), `INVALID_TYPE`, `INVALID_TARGET` (parent `acceptsChildren=false`), `INVALID_PROP`, `INVALID_ARG` (index out of range)
- message: `{type} 를 {parentId} 아래 추가(노드 {nodeId}).`

### comp.set
- params: `{ pageId: string, nodeId: string, props: Record<string, JsonValue>, replace?: boolean }`
- Behavior: merges `props` into the node (or replaces all props when `replace===true`). A prop value of `null` deletes that key. Validates per §2.
- → `{ nodeId, node }`
- errs: `NOT_FOUND`, `INVALID_PROP`
- message: `{node.type} 속성 갱신.`

### comp.move
- params: `{ pageId: string, nodeId: string, parentId: string, index?: number }`
- Behavior: reparents `nodeId` under `parentId` at `index` (default append).
- → `{ nodeId, parentId, index }`
- errs: `NOT_FOUND`, `INVALID_TARGET` (moving the root, target is the node or a descendant, or target `acceptsChildren=false`), `INVALID_ARG` (index out of range)
- message: `{nodeId} 를 {parentId} 아래로 이동.`

### comp.remove
- params: `{ pageId: string, nodeId: string }`
- Behavior: removes the node and its subtree. The root cannot be removed.
- → `{ removedId, removedCount }`
- errs: `NOT_FOUND`, `INVALID_TARGET` (removing the root)
- message: `노드 {removedCount}개 삭제.`

### comp.get
- params: `{ pageId: string, nodeId: string }`
- → `{ node }` (full subtree)
- errs: `NOT_FOUND`
- message: `{node.type} 노드({nodeId}).`

### comp.find
- params: `{ pageId?: string, type?: string, propContains?: string }`
- Behavior: searches all pages (or one page) for nodes matching `type` (exact) and/or `propContains` (case-insensitive substring over serialized prop values).
- → `{ matches: [{ pageId, nodeId, type }] }`
- errs: `NOT_FOUND` (given `pageId` absent)
- message: `일치 노드 {matches.length}개.`

### theme.set
- params: `{ theme: ThemeName, mode?: ColorMode }` (`ColorMode` = `light` | `dark` | `system`, default `system`)
- Behavior: sets `activeTheme` and, when `mode` is given, the color mode. `gothic` is dark-only: a call whose **effective** mode is `light` (explicit `mode:"light"`, or an omitted `mode` while the stored mode is `light`) is rejected with `INVALID_PROP`. `mode` validation and the gothic gate run **before** `activeTheme` mutates, so a rejected call leaves the doc untouched. `mode` persists in the doc (§11); an omitted `mode` preserves the stored mode. The live canvas view (if mounted) re-renders automatically via `store.onChange` — swapping the shadow host's `data-astryx-theme` attribute and `color-scheme` (§7 Theme law). There is no browser to drive and no artifact to re-emit, so the theme/mode change is purely a store mutation.
- → `{ theme, mode }` (`mode` = the effective mode applied)
- errs: `THEME_UNKNOWN`, `INVALID_PROP` (mode not one of light/dark/system, or gothic with an effective light mode)
- message: `테마 {theme}·모드 {mode} 적용.`

### theme.list
- params: `{}`
- → `{ themes, active }`
- errs: none
- message: `테마 {themes.length}종(현재 {active}).`

### template.list
- params: `{ kind?: "page" | "block", includeUnavailable?: boolean }`
- Behavior: lists templates (§13). By default serves **available** templates only (`available === true`) and reports the unavailable tail as counts + reasons. With `includeUnavailable: true`, the `templates` array also carries the unavailable entries (each with `available` and `reason`).
- → `{ templates: [{ id, kind, name, requires, available, reason? }], available, unavailableCount, unavailable: [{ id, name, reason }] }` (`available` = count of available templates in the listing)
- errs: `INVALID_ARG` (bad kind)
- message: `템플릿 {available}개 사용 가능(미가용 {unavailableCount}개).`

### template.apply
- params: `{ id: string, pageId?: string, name?: string }`
- Behavior: creates a **tsx page** from the template's verbatim `code` (§13). With `pageId`, replaces that page's `source` with `{ kind:"tsx", code, origin: id }` (the target may be either kind — its source is overwritten with the tsx source). Without `pageId`, creates a new tsx page (`name` default = template name). Rejects a template whose `available === false` with `TEMPLATE_UNAVAILABLE` and its `reason`. Inserting a block under an existing node is out of scope.
- → `{ pageId, name, kind: "tsx", origin }`
- errs: `TEMPLATE_UNKNOWN`, `TEMPLATE_UNAVAILABLE` (with reason), `NOT_FOUND` (given `pageId` absent)
- message: `템플릿 '{id}' 적용(tsx 페이지).`

### page.code.get
- params: `{ pageId: string }`
- Behavior: returns the TSX `code` of a **tsx page**. A tree page returns `INVALID_TARGET` (kind gate, §2) pointing to `comp.*`/`export.tsx`.
- → `{ pageId, code, origin? }`
- errs: `NOT_FOUND` (page), `INVALID_TARGET` (page is a tree page)
- message: `{pageId} TSX {code.length}자.`

### page.code.set
- params: `{ pageId: string, code: string }`
- Behavior: replaces a **tsx page**'s `code`. Validates by compiling `code` in-process under the render core's exact sucrase config (§7) — the same transform the render core runs, so bad code is rejected at the gate. On compile failure returns `COMPILE_FAILED` with the compiler error in `data.diagnostics` (and a summary in `message`); the page is left untouched. On success sets `source = { kind:"tsx", code }` (preserving any existing `origin`). A tree page returns `INVALID_TARGET` (kind gate, §2) — there is no in-place tree→tsx conversion; seed a tsx page via `page.create kind=tsx` or `template.apply`.
- → `{ pageId, bytes }` (`bytes` = `code.length`)
- errs: `NOT_FOUND` (page), `INVALID_TARGET` (page is a tree page), `INVALID_ARG` (blank code), `COMPILE_FAILED` (with `data.diagnostics`)
- message: `{pageId} TSX 갱신({bytes}자).`

### catalog.list
- params: `{ group?: string, query?: string }`
- Behavior: lists catalog components, optionally filtered by `group` (exact) or `query` (case-insensitive substring over `type`/`description`).
- → `{ components: [{ type, description, acceptsChildren, propCount }] }`
- errs: none
- message: `컴포넌트 {components.length}종.`

### catalog.doc
- params: `{ type: string }`
- → `{ entry }` (full `CatalogEntry`)
- errs: `INVALID_TYPE` (type not in catalog)
- message: `{type} — 속성 {entry.propCount ?? props length}개.`

### docs.list
- params: `{}`
- Behavior: lists the baked-in Astryx doctrine topics (§14), each with a one-line summary. Sorted by topic id.
- → `{ topics: [{ topic, title, dense, description }] }`
- errs: none
- message: `Astryx 문서 토픽 {topics.length}개.`

### docs.get
- params: `{ topic: string }`
- Behavior: returns the full baked-in doctrine text for `topic` (§14). `dense` reports whether the token-efficient variant was baked.
- → `{ topic, title, dense, description, text }`
- errs: `INVALID_ARG` (blank topic), `NOT_FOUND` (unknown topic)
- message: `{topic} 문서 — {text.length}자.`

### preview.open
- params: `{ pageId: string }`
- Behavior: selects the page as the canvas's active page (sets `store.preview.activePageId` and fires `onChange` so a mounted view re-renders it), then opens or focuses the canvas view. The open call is `inv.execute("plugin.view.open", { view: "soksak-plugin-design-astryx.canvas", placement: "content" })` (spec §5 origin-preserving; not cross-plugin, not danger — `commands` suffices). The `plugin.view.open` content outcome carries `existing`, which maps to `opened` (`false` = focused an already-open tab). Setting the active page **before** the open call means a fresh mount renders the right page immediately.
- → `{ pageId, opened }` (`opened` = `true` when a new tab was created, `false` when an existing canvas tab was focused)
- errs: `NOT_FOUND` (page), `PREVIEW_FAILED` (`plugin.view.open` non-ok — e.g. no active project)
- message: `캔버스 열림(페이지 {pageId}).`

### preview.refresh
- params: `{ pageId?: string }`
- Behavior: selects the active canvas page (the given `pageId`, or keeps the current one) and forces a re-render by firing `store.onChange`. The view is already live-bound (every mutation re-renders, §7 Live law), so this is an **explicit** re-render nudge, not a browser navigation. It is **headless-complete**: when no view is mounted it is a successful no-op (the store's active page is still updated), never a failure — there is no "open preview" precondition anymore.
- → `{ pageId }` (the active page after the call; `null` when the doc has no pages)
- errs: `NOT_FOUND` (given `pageId` absent)
- message: `캔버스 재렌더(페이지 {pageId}).`

### export.tsx
- params: `{ pageId: string }`
- Behavior: emits the page as a compilable TSX file (§10). A **tsx page** returns its `code` verbatim. A **tree page** serializes the tree with the existing serializer.
- → `{ tsx, filename }`
- errs: `NOT_FOUND`, `EXPORT_FAILED`
- message: `TSX 내보내기({filename}).`

---

## 6. Catalog law

`generated/catalog.json` is built by `scripts/gen-catalog.mjs` from `node_modules/@astryxdesign/core`.

### Component set (mechanical, no whitelist)

The catalog set equals the `@astryxdesign/core` `package.json` `exports` keys matching `/^\.\/[A-Z][A-Za-z0-9]*$/` — single-segment, capitalized subpaths. This excludes `./utils`, `./hooks`, `./theme/*`, `./naming`, `*.css`, `*.mjs` docs, and `/utils` sub-exports (e.g. `./Table/utils`). In `0.1.3` this set has **99** entries.

`gen-catalog.mjs` imports the barrel `@astryxdesign/core` and asserts every entry's `importName` is a defined export of the barrel; a phantom entry fails the build.

### Entry source

For each component `Name`, props and description come from `src/{Name}/{Name}.doc.mjs` (the `docs` export, typed by `src/docs-types.ts`). Six exports ship without a `.doc.mjs` in `0.1.3` — `Code`, `HStack`, `Heading`, `InteractiveRoleContext`, `SizeContext`, `VStack`. For these, the generator falls back to the component's `dist/{Name}/index.d.ts` props interface via the TypeScript compiler API to derive `props` and `acceptsChildren`; when even that is empty, `props = {}` and `description = importName`. No component is dropped — the set is complete regardless of doc coverage.

### Entry shape (`CatalogEntry`)

```
{ type, importName, description, props: { name -> { type, required, enum?, default?, description } }, acceptsChildren }
```

- `type === importName === Name`.
- `description` = `doc.usage.description` when present, else `importName`.
- `props[name]` from `doc.props[]` (`PropDoc`): `type` = `PropDoc.type`; `required` = `PropDoc.required === true`; `default` = `PropDoc.default` when present; `description` = `PropDoc.description`; `enum` = the parsed members when `PropDoc.type` is a single-quoted string-literal union (strip quotes), else omitted.
- `acceptsChildren` = a prop named `children` exists whose type is `ReactNode` (or, in the `.d.ts` fallback, a `children` member typed `ReactNode`).

### Completeness test (required)

A vitest test asserts set equality between `Object.keys(catalog.json)` and the mechanical component set recomputed from `core` `package.json`. Drift in either direction fails.

---

## 7. View law (in-app canvas)

The primary design surface is a **plugin view** (`contributes.views` id `canvas`, placement `content`) opened by a **program** (`contributes.programs` id `design-astryx`, `kind:"view"`, `view:"canvas"`). The view mounts Astryx components directly in a Shadow DOM inside the app webview and stays live-bound to the module store. There is no artifact, no `file://`, no http server, no browser plugin.

### Mount law (Shadow DOM, erd precedent)

`app.ui.registerView("canvas", provider)` binds the provider (`"ui"` permission; declared in `contributes.views` or the core rejects it, §0-3). On `provider.mount(container, ctx)`:

1. `container.attachShadow({ mode: "open" })` (reuse `container.shadowRoot` on remount; `replaceChildren()` to clear).
2. Inject CSS into the shadow, in this order, as `<style>` blocks (all embedded at build, §12 — no disk read):
   - `reset.css` (Astryx `core/src/reset.css`) — contained by the shadow boundary, so it never resets app chrome (this is the erd containment reason for the shadow).
   - `astryx.css` (`core/dist/astryx.css`) with every `:root` rewritten to `:host` — verified drop-in: the token blocks ship as `:root, .xhash { … }` selector pairs (13 in `0.1.3`), so the rewrite yields `:host, .xhash { … }` and the tokens land on the shadow host.
   - **all 7 theme `dist/theme.css` blocks** — each is self-scoped by `@scope ([data-astryx-theme="<name>"]) to ([data-astryx-theme])` (verified in `0.1.3`; theme tokens do NOT use `:root`), so injecting all seven is collision-free; only the block matching the host's current `data-astryx-theme` activates. Each theme file's lone `:root { color-scheme: … }` line is `:root`→`:host`-rewritten with the rest and is inert (the host's inline `color-scheme` is authoritative).
3. A wrapper `<div>` inside the shadow carries `data-astryx-theme="<activeTheme>"` and inline `style="color-scheme:<light|dark|light dark>"` (from `mode`, §9). This wrapper is the mount host and the astryx token/theme scope root.
4. `createRoot(wrapper)` and render the active page's React tree via the render core (below). Do **not** let the root `<Theme>` stamp `document.documentElement` — nest/wrap it so it is not the document root (a nested `<Theme>` skips the html sync, verified). The shadow host attributes (step 3) carry the theme, not `documentElement`.

`provider.unmount` calls `root.unmount()` (React effect cleanup chains: timers cleared, listeners removed).

### Live law

The view and the commands share the **same module store** (the erd pattern — one `createStore` instance imported by both `plugin-entry` command registration and the view). The view subscribes to the store's `onChange` hook (`createStore` `opts.onChange`); every mutating command (`comp.*`, `page.*`, `theme.set`, `template.apply`, `page.code.set`) fires `onChange` after it persists, and the view re-renders the **active page** (`store.preview.activePageId`, §11). No file emission, no navigation — the React tree updates in place. `preview.open` sets the active page and fires `onChange`; `preview.refresh` fires `onChange` explicitly. Multi-window consistency rides the existing `app.data.kv.watch` → `rehydrate` → `onChange` path (§11).

### Toolbar law

The view chrome is a toolbar above the rendering area with three control groups, **all of which are command clients** (they call the registry, so headless and UI stay one truth — the toolbar never mutates the store directly):

- **Page selector** — lists the doc's pages (tree + tsx) and selects the active page (drives `preview.open`/`preview.refresh` semantics, i.e. sets `activePageId`).
- **Theme (7) + mode (light/dark/system) selectors** — drive `theme.set` (the same command CLI/MCP use). The live re-render swaps the host `data-astryx-theme`/`color-scheme` (§9).
- **Canvas controls** — viewport-width presets (`fill` / `1280` / `768` / `375`) and canvas background. These are **view-local** framing (`CanvasControls`, `src/types.ts`): they are NOT part of the document, NOT persisted, and per-window — they frame the render, they are not a render result. The boundary is explicit: document state (pages/theme/mode) lives in the store; framing state lives in the view instance.

### Rendering core law (reused engine)

The v2 TSX + tree rendering engine is **reused verbatim** as the view's rendering core, relocated to `src/render-core/` so it is importable by both the view (bundled into `main.js`) and any future runner (the module-shim inputs are identical):

- `src/render-core/tsx.tsx` — the sucrase-based TSX path (moved from `runner/tsx.tsx`).
- `src/render-core/tree.tsx` — the tree renderer (moved from `runner/render.tsx`, which owns `ErrorBox` / `NodeBoundary`).

The view resolves module namespaces (React, the astryx barrel + `theme`/`theme/syntax`/`hooks`, heroicons, lucide) from its own bundle and injects them into the render core — the render core stays un-tied to astryx (the injection seam is unchanged from v2, only the injector moves from `runner/entry.tsx` to the view's `mount`).

**Tree path** (`page.kind === "tree"`): resolve each `node.type` by name from the bundled `@astryxdesign/core` barrel and lower the tree to React elements (§2 children/prop laws). An unknown `node.type` renders an `ErrorBox` naming it.

**TSX path** (`page.kind === "tsx"`): compile `page.code` with the **exact sucrase config from Learn Gate B** and execute it under a require-shim:

```
sucrase.transform(code, {
  transforms: ["typescript", "jsx", "imports"],
  jsxRuntime: "automatic",
  production: true,
  jsxImportSource: "react",
  filePath,
})
```

- `imports` lowers ESM to CommonJS `require()`/`exports` so the shim's `require()` satisfies every module id; `jsxRuntime: "automatic"` is required (templates import only named hooks, never the `React` default, so `classic` would throw `React is not defined`); `production: true` emits the lean `react/jsx-runtime` (no `jsxDEV`).
- The require-shim resolves module ids to the bundle. Capitalized component subpaths forward to the barrel; the three lowercase subpaths carry EXPLICIT bundled namespaces because the barrel does NOT re-export all of their symbols (full-corpus adversarial run proved `githubLight` from `@astryxdesign/core/theme/syntax` is absent from the barrel — barrel-only forwarding rendered it `undefined` and crashed `SyntaxTheme`):
  - `react`, `react/jsx-runtime` (and `react-dom` / `react-dom/client` when imported) → the bundled React runtime.
  - `@astryxdesign/core` **and** every capitalized `@astryxdesign/core/<Subpath>` → the bundled barrel namespace.
  - `@astryxdesign/core/theme` / `@astryxdesign/core/theme/syntax` / `@astryxdesign/core/hooks` → their bundled namespaces (explicit entries, checked before the barrel fallback).
  - `@heroicons/react/24/outline`, `@heroicons/react/24/solid`, `@heroicons/react/20/solid` → bundled heroicons.
  - `lucide-react` → bundled lucide.
  - Any **unknown module** (e.g. `recharts`, `@astryxdesign/lab`, or a raw-runtime `@stylexjs/stylex`) → an honest-unavailable stub whose components render a visible `ErrorBox` naming the module. The gate keeps such templates out (§13), but a hand-written `page.code.set` referencing one must degrade to a visible surface, never a throw.
- The render core mounts the module's **default export** (compile-based resolution, per Gate: exactly one real `export default function` per template — text-scan dual-default hits are inside template-literal code samples, so a regex must never be used to find the default).
- Deferred `setTimeout` timers (chat/login demos) and a single failing `fetch` (one code-sample block, offline) must be tolerated: they fire post-mount and must not crash the page.

Compile and runtime errors render as **visible error surfaces, never a blank page** (`ErrorBox` / `NodeBoundary`).

### Asset placeholder law

At render time the render core rewrites image sources that are **relative or absolute paths with no URL scheme** (`./x`, `../x`, `/x`) to an **inline neutral SVG placeholder** `data:` URI — an honest placeholder for an unresolvable asset. Sources with a scheme (`http:`, `https:`, `data:`) pass through untouched; the app webview loads remote absolute images normally (unlike the old `file://` origin, the in-app document has the app's normal origin, so `network`-class loads are not origin-blocked — but this plugin declares no `network` permission and the corpus needs none at mount). Every `<img>` also carries an `onerror` fallback to the same placeholder. Documented honest degradation, not silent breakage.

### Anchor polyfill law (in-app policy, pinned)

Astryx popover/tooltip/menu surfaces use CSS anchor positioning. The view runs the anchor-positioning polyfill **once per app document** (a module-level idempotent guard, NOT per-mount), and only when `!CSS.supports("anchor-name", "--x")` — when the app webview supports anchor positioning natively the polyfill never runs (zero cost). The polyfill reads inline `<style>` via `innerHTML` (no `fetch`), so it works fully in-app (the `file://`-origin breakage that forced a dev server in the original astryx does not apply). The polyfill is document-wide by design, but it is **INERT for core**: core chrome uses zero anchor-positioned elements (no `anchor-name` / `position-anchor` in core CSS), so a document-wide pass finds nothing to restyle outside astryx surfaces. Honest caveat: a document-wide light-DOM polyfill does not reach into the astryx shadow root's own elements; when the app webview lacks native support, anchored astryx surfaces inside the shadow may position imperfectly — this is a stated limitation, not a crash, and current app-webview versions support anchor positioning natively so the gate skips the polyfill in practice.

### Toast law (pinned)

Astryx `Toast` portals to `document.body`, escaping the shadow root where `astryx.css` lives, so a portaled toast renders **unstyled**. Policy: if astryx exposes a portal-target prop/context, the view SHOULD point it at a shadow-internal container so toasts inherit the injected CSS; absent that hook, the accepted honest degradation is that toasts render unstyled in `document.body`. Toasts are rare in v3 (the tree path is non-interactive — callbacks are stripped, §2 — and only tsx demo `setTimeout` blocks fire them), so this is a documented cosmetic limitation, not a functional gap.

### Theme model (all 7 embedded, host-attr swap)

See §9 — v3 embeds all 7 theme blocks in the shadow and switches by swapping the host `data-astryx-theme` attribute + `color-scheme`; there is no re-emit and no navigation (those were `file://`/browser artifacts).

### Bundle size law

The render core's payload (`react` + `react-dom/client` + `@astryxdesign/core` + `sucrase` + heroicons + `lucide-react`) now bundles **directly into `main.js`** as part of the view's module graph, instead of being embedded as the `__RUNNER_JS__` string (the prebuilt `runner.js`, ~1 MB+ in v2). Net `main.js` byte size stays the **same order of magnitude** — the delta is a wash: the same libraries move out of an embedded string and into `main.js`'s import graph. `__ASTRYX_CSS__` and `__THEME_CSS_MAP__` (7 themes) remain embedded (they are injected into the shadow, §12). The `generated/runner.js` artifact and its `build:runner` embed are dropped (§12).

### Legacy-removal law (pivot record, git remembers)

The v2 browser-preview transport is **DELETED, not deprecated** — the owner's verdict (primary surface = in-app panel program, not a browser document) and the erd precedent (React-in-`attachShadow` for CSS containment) supersede it. Every removed artifact:

- `scripts/preview-server.cjs` — the local http static server.
- `src/preview/server.ts` (+ `server.test.ts`) — the server-lifecycle module.
- `src/preview/emit.ts` / `write.ts` (+ tests) — the `index.html`/`runner.js` disk-emission path (`app.fs.writeText`).
- `src/commands/preview-drive.ts` (+ `preview-drive.test.ts`) — browser probe (`ping`) + drive (`open`/`navigate`) + Chromium→native fallback.
- `runner/entry.tsx` — the standalone `file://` runner app (its namespace-injection role moves into the view's `mount`). `scripts/build-runner.mjs`'s `runner.js` output is dropped.
- `file://` transport law, `app.fs.url` law, the `${ctx.dir}/.preview/` directory + `.preview/.gitkeep`.
- Manifest: the `soksak-plugin-browser-chromium` / `soksak-plugin-browser-native` `dependencies`, and the `process` + `fs:write` permissions.
- Error code `DEP_MISSING`; the `engine`/`url` return fields; the `PreviewSession` `engine`/`url`/`server` store fields (§11).

No dead code and no commented-out transport remain — git is the history.

---

## 8. Dependencies law

`plugin.json` has **no** `dependencies`, no `libraries`, no `sidecars`. The canvas renders in-app (Astryx components mounted in the app webview's Shadow DOM, §7), so there is no browser plugin to call and no cross-plugin dependency to declare. The v2 `soksak-plugin-browser-chromium` / `soksak-plugin-browser-native` dependencies are removed (§7 Legacy-removal law).

Permissions (`plugin.json` `permissions`): `["ui", "commands", "data", "programs"]`.

- `ui` — register the `canvas` view (`app.ui.registerView`).
- `commands` — register this plugin's commands and execute `plugin.view.open` (not cross-plugin, not danger; §7).
- `data` — persist the `DesignDoc` to `app.data.kv` (§11).
- `programs` — contribute the `design-astryx` program (the `+` menu entry that opens the canvas).

Removed vs v2: `process` (no http server) and `fs:write` (no disk artifact — `export.tsx` returns TSX as data, it does not write).

---

## 9. Theme law (decided: all 7 embedded, host-attr swap)

The shadow embeds **all 7** theme `dist/theme.css` blocks (§7 Mount law), not just the active one. Switching theme swaps the shadow-host wrapper's `data-astryx-theme` attribute; only the matching block activates. This is correct and collision-free because the shipped `theme.css` files are `@scope ([data-astryx-theme="<name>"]) to ([data-astryx-theme])`-gated — their tokens do **not** target `:root` (verified in `0.1.3`), so concatenating all seven does not collide. (The v2 re-emit law — embed only the active theme and re-write the `file://` document on `theme.set` — was a workaround for the single-`:root` document origin; it is removed with the browser transport.) The 7 theme CSS payloads are embedded in `main.js` as `__THEME_CSS_MAP__` (§12), so no disk read.

`theme.set` mutates `activeTheme`/`mode` in the store and fires `onChange`; the mounted view swaps the host attribute + `color-scheme` in place (no re-emit, no navigation, §7 Live law). `ThemeName` and the fixed 7-theme set live in `src/types.ts` (`THEMES`). `theme.set` rejects any name outside it with `THEME_UNKNOWN`.

### Color mode (decided)

`DesignDoc.mode` (`ColorMode` = `light` | `dark` | `system`) rides through the store into the view's render, which applies it as the shadow-host wrapper's inline `color-scheme` (`light` → `"light"`, `dark` → `"dark"`, `system` → `"light dark"`). Astryx theme tokens use `light-dark()`, which resolves against the host's `color-scheme` (`system` follows the OS). `theme.set` threads it (§5). Mode is a document-level property (like `activeTheme`), persisted (§11); it is optional on `DesignDoc`/`DesignPayload` and read as `system` when absent, so pre-mode docs need no migration.

`gothic` is dark-only (it ships only dark token values). `theme.set` rejects an effective `light` mode for `gothic` with `INVALID_PROP` **before** mutating, so the doc never lands in an unrenderable theme/mode pair. The gothic gate lives in the command layer (`src/commands/theme-mode.ts`, a pure resolver); theme name validation stays in the model layer (`setTheme`). `system` is always allowed for `gothic` (it renders dark).

---

## 10. Export law

`export.tsx` emits a single compilable TSX file. The emission depends on page kind:

- **tsx page** → the page's `code` verbatim (the source is the truth; §2). No re-serialization.
- **tree page** → the tree serializer below.

### Tree-page serialization

- A named import from the barrel: `import { Theme, <used types…> } from '@astryxdesign/core';`. Only the component types actually present in the tree (plus `Theme`) are imported, deduplicated, sorted.
- A default export function returning the tree wrapped in `<Theme theme="<activeTheme>">…</Theme>`.
- The tree serializes to JSX by these prop rules:
  - `string` value → `prop="value"` when the value has no `"`/`{`/newline, else `prop={"…"}` with a JSON-escaped string.
  - `boolean true` → bare `prop`; `boolean false` → `prop={false}`.
  - `number` → `prop={n}`.
  - array / object / `null` → `prop={<JSON literal>}`.
  - The `children` string prop and `node.children` render as JSX children (text node or nested elements). A leaf with no children and no `children` prop is self-closing (`<Type … />`).
- Indentation is two spaces per depth. The `filename` is derived from the page name (kebab-cased, `.tsx`).

Serialization that cannot represent a value (should not occur given §2 prop validation) returns `err("EXPORT_FAILED", …)`.

---

## 11. State law

One in-memory store holds the working `DesignDoc` (the erd pattern: a single source shared by every command). The store persists to `app.data` (permission `data`), namespace forced to the plugin id by the core:

- kv key: `doc:${projectId}` where `projectId = app.project.current()?.id ?? "_global"`.
- On activate: the store hydrates from `app.data.kv.get(key)`; absent ⇒ a fresh empty doc (`{ version:1, activeTheme:"neutral", mode:"system", pages:[], seq:0 }`). `coerceDoc` defaults a missing/invalid `mode` to `system`, and coerces each page's source: a v1 root-only page (`{ id, name, root }`) becomes `{ id, name, source:{ kind:"tree", root } }`; a page with a missing/malformed `source` becomes an empty tree page (§2). No migration file — the coercion is a hydrate-time rule and `version` stays `1`.
- On every mutation: the store writes back with `app.data.kv.set(key, doc)`.
- `app.data.kv.watch` keeps multiple windows of the same project consistent (re-hydrate on external change → `onChange` → live view re-render, §7).

Commands are headless-complete: they never require a view. The **active canvas page** (`preview.activePageId` — the page the mounted view renders, §7 Live law) is the sole session field; it is NOT persisted. The v2 session fields `engine`/`url`/`server` are removed (there is no browser engine, artifact url, or http server). `CanvasControls` (viewport width, background) is view-local, not stored (§7 Toolbar law).

---

## 12. Build law

`main.js` is a single ESM bundle imported as a blob; it cannot read sibling files at runtime. Therefore all generated artifacts embed as string defines at build time (`build.mjs`, the erd precedent):

- `__CATALOG_JSON__` ← `generated/catalog.json`
- `__TEMPLATES_JSON__` ← `generated/templates.json` (verbatim-TSX `TemplateEntry[]`, §13)
- `__ASTRYX_CSS__` ← `generated/astryx.css` (reset.css + dist/astryx.css concatenated; the view injects it into the shadow with `:root`→`:host` rewrite, §7)
- `__THEME_CSS_MAP__` ← `generated/theme-css.json` (`{ "<theme>": "<theme.css>" }`, 7 entries — all injected into the shadow, §9)

The render core (`src/render-core/`, §7) is NOT an embedded string — it is part of `main.js`'s import graph (the view imports it, and it pulls in `react` + `react-dom/client` + `@astryxdesign/core` + `sucrase` + heroicons + `lucide-react`). The v2 `__RUNNER_JS__` define and the `generated/runner.js` embed are **removed** (§7 Bundle size law).

`build.mjs` throws when any generated file is missing (no silent partial output). The pipeline order is fixed by `package.json`: `gen` (catalog + templates) → `build:css` (astryx.css + theme-css.json) → `build.mjs` (main.js). The v2 `build:runner` step's `runner.js` output is dropped; it emits only the CSS artifacts (rename to `build:css`). `.gitignore` keeps `generated/`; the `.preview/*` + `.preview/.gitkeep` entries are removed (no artifact directory). `main.js` is committed.

`build.mjs` is owned by the contract; `scripts/gen-catalog.mjs`, `scripts/gen-templates.mjs`, the CSS build step, `src/plugin-entry.ts`, `src/render-core/`, the view provider, and `skill/SKILL.md` are built by implementers to this contract.

---

## 13. Template law (v2: verbatim TSX)

`generated/templates.json` is built by `scripts/gen-templates.mjs` from the Astryx CLI templates (`node_modules/@astryxdesign/cli/templates`): **619** shipped templates in `0.1.3` (41 page + 578 block).

### Legacy removal (git remembers)

The v1 tree-conversion machinery is **deleted**, not deprecated: the TypeScript-compiler converter, the page-skeleton logic, and `generated/templates-report.json` with its `TemplateReject`/`TemplatesReport` types are gone. Converting a `'use client'` TSX program (hooks, local state, helper components, typed code) into a static `DesignNode` tree was a demotion; v2 renders the original program losslessly through the runner's tsx path (§7). No dead conversion code stays.

### Verbatim packaging

Each `TemplateEntry` packages the **original TSX source verbatim**:

```
{ id, name, kind: "page" | "block", code, requires: string[], available: boolean, reason? }
```

- `id` = the source-relative slug (`pages/dashboard`, `blocks/components/hero-split`). `kind` = `page` for `pages/*`, `block` otherwise. `name` = a human display name derived from the slug.
- `code` = the file's TSX bytes, unmodified.
- `requires` = the set of module ids the file imports (`react`, `@astryxdesign/core`, `@heroicons/react/24/outline`, `lucide-react`, …).
- `available` = whether the render core can render it: `true` when every `requires` entry resolves in the render core's require-shim (§7). `false` when the file needs a module the bundle does not carry, or a **compile-time-only** transform the render core does not run.
- `reason` (only on `available: false`) = a machine-readable cause.

### Mechanical completeness (required)

**ALL 619 templates enter** `templates.json` — available and unavailable alike. A vitest test asserts `sourceCount === entries.length` (the count of scanned source TSX equals the count of entries). There is no reject bucket and no silent drop: an unrenderable template is present with `available: false` and a `reason`, never absent.

### Availability census (Learn Gate, cited)

Of 619 templates, **605 are available** and **14 are unavailable** (7 module-blocked + 7 icon helpers with no default export):

- **604** render on `react` + `@astryxdesign/core` + bundled heroicons alone.
- **8** additionally need bundled `lucide-react` (present in the bundle) — available.
- **7 unavailable**, by reason:
  - `recharts (not installed)` — `pages/dashboard`, `pages/dashboard-portfolio` (2).
  - `@astryxdesign/lab (not installed)` — `pages/table-page-chart`, `pages/table-page-heatmap-status`, `pages/table-page-shoe-store-heatmap` (3).
  - `@stylexjs/stylex compile-time transform required` — `pages/kanban-board`, `pages/shell-top-nav` (2). StyleX is installed at `0.18.3` but is compile-time CSS-in-JS: `stylex.create`/`props` emit no CSS at runtime without the StyleX babel/postcss transform, which the runner's esbuild bundle does not run, so these render visually broken. Honest `available: false`, not a bundling attempt.

`@astryxdesign/lab` and `recharts` are **not installed** (5 templates); `@stylexjs/stylex` is installed but unusable at runtime (2 templates). These flags are honest, not a promise to bundle them.

### Export shape (mount law, cited)

612/619 files expose exactly one genuine top-level `export default function` (a React component); the render core mounts `module.default`. Two files (`pages/ide`, `pages/documentation-technical`) contain extra `export default` text **inside template-literal code samples** — esbuild/sucrase compile exactly one real default for each, so default resolution MUST be compile-based, never a regex text scan. 7 files carry no default (`themes/*/icons.tsx`, named-only icon helpers consumed by `pages/theme-showcase`) — helper modules, not standalone mountable pages; they enter `templates.json` as `available:false` with reason `helper module (no default export to mount)`.

### `template.list` and `template.apply`

`template.list` serves `available` templates by default and reports the unavailable tail as counts + reasons (§5). `template.apply` creates a tsx page from `code` and rejects an `available: false` template with `TEMPLATE_UNAVAILABLE` + `reason` (§5).

---

## 14. Docs law

`generated/docs.json` + `generated/docs-report.json` + `src/docs/docs.embedded.ts` are built by `scripts/gen-docs.mjs` from the official Astryx doctrine (`node_modules/@astryxdesign/cli/docs/*.doc.mjs`, Meta-authored). These back the `docs.list` / `docs.get` commands (§5).

### Topic set (mechanical, no whitelist)

The topic set equals the source files ending in `.doc.mjs` (the `.doc.dense.mjs` and `.doc.<lang>.mjs` variants are excluded); the suffix is stripped to the topic id. In `0.1.3` this set has **17** topics.

### Variant selection (dense-preferred)

Per topic, when `<topic>.doc.dense.mjs` exists it is baked (Meta's token-efficient LLM compression — `layout`, `principles`, `theme`, `tokens` in `0.1.3`); otherwise `<topic>.doc.mjs`. The dense file exports `docsDense`, the plain file `docs`. The chosen variant is recorded per topic as `dense: boolean`.

### Baked at build (not fetched)

The doctrine is compiled into the plugin at build time — never fetched at runtime (matching the catalog/template precedent). `gen-docs.mjs` renders every section to plain text (`prose`, `list` with `ordered`/`unordered`/`do`/`dont` styles, `code`, `table`; `null` content slots skipped) and emits `{ <topic>: { title, dense, description, text } }`. `title` = the doc's `title`, or a Title-Cased topic id for dense docs. `description` = the doc's `description` (the `docs.list` one-liner). `text` = the full rendered doctrine (the `docs.get` body).

The runtime imports the committed source `src/docs/docs.embedded.ts` (not `generated/docs.json`) so the bundle and vitest always resolve it without a `build.mjs` define or a pipeline hook. `generated/docs.json` is the equivalent artifact + test fixture; a drift test asserts the two are identical.

### Mechanical completeness (required)

`scripts/gen-docs.test.ts` recomputes the topic set from the source directory (same rule) and asserts set equality with `Object.keys(docs.json)` and with `docs-report.json` `topics`. Drift in either direction fails; `gen-docs.mjs` throws if any discovered topic fails to resolve or renders empty — no silent drop, no empty entry.

---

## 15. Upgrade governance

`@astryxdesign/*` pins are **exact** `0.1.3` (`package.json`), never a caret range. The catalog (§6), templates (§13), and docs (§14) are all mechanically derived from these pinned packages, so a version bump can shift the component set, template conversions, and doctrine topics at once.

Upgrades go through the Astryx CLI codemods, not hand edits: run `npx astryx upgrade --apply` (applies the pinned-version codemods), bump the exact pins, then regenerate every derived artifact (`npm run gen` for catalog + templates, `node scripts/gen-docs.mjs` for docs) and rebuild the runner/CSS. The generators' completeness tests (catalog §6, templates §13, docs §14) are the acceptance gate: any drift they surface is reconciled in the derivation, never by weakening the test.

---

## 16. Learn Gate citations (v2 evidence)

The v2 laws rest on a mechanical census of the 619-template corpus (trusted, cited here so the contract carries its own evidence):

- **Compile** — sucrase `{ transforms:["typescript","jsx","imports"], jsxRuntime:"automatic", production:true, jsxImportSource:"react" }` compiles all 619/619 with zero failures; esbuild's tsx loader is likewise clean. No `satisfies`/`enum`/`namespace`/decorators anywhere — baseline typescript+jsx only.
- **Shim** — barrel forwarding for capitalized subpaths + three explicit lowercase namespaces (`theme`, `theme/syntax`, `hooks`). The Gate A "barrel-only" verdict missed lowercase subpaths; the full-corpus adversarial run corrected it.
- **Exports** — 612/619 have exactly one real `export default function`; the 2 apparent dual-defaults are template-literal code samples (compile-based resolution required). 7 no-default files are icon helpers.
- **Assets** — no local/bundled asset dependency; every image is a remote absolute URL (Meta CDN + a few favicons). `next/image`=0, relative/local `img src`=0, imported image modules=0. The placeholder law (§7) covers scheme-less paths defensively.
- **Runtime** — `import()`=0, `requestAnimationFrame`=0, `setInterval`=0, `localStorage`=0; `setTimeout` in 10 files (post-mount demo timers), one real `fetch` (offline-rejecting code-sample block). The canvas needs no loader; the anchor-positioning polyfill runs only when the app webview lacks native support and is gated + inert for core (§7 Anchor polyfill law).

---

Version: 3.0.0
Spec: soksak-spec-plugin@0.0.1
Core: @astryxdesign/core 0.1.3
