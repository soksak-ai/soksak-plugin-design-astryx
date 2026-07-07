# soksak-plugin-design-astryx — v1 Contract

This is the constitution. Every implementer builds strictly to this document. The TypeScript twin of these laws lives in `src/types.ts`; when prose and `types.ts` disagree, `types.ts` wins for shapes and this document wins for behavior.

Plugin id tokens: `design`, `astryx`. Command first segments never equal or abbreviate those tokens.

---

## 1. Identity and scope

The plugin is a headless design-document engine. Every capability is a registry command; there is no GUI surface owned by this plugin. The plugin renders by writing a self-contained preview to disk and pointing a dependency browser plugin at it. External LLMs drive it through `sok` CLI, MCP, and the bundled skill.

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

`OK`, `NOT_FOUND`, `INVALID_TYPE`, `INVALID_PROP`, `INVALID_TARGET`, `INVALID_ARG`, `DUPLICATE`, `TEMPLATE_UNKNOWN`, `TEMPLATE_UNAVAILABLE`, `THEME_UNKNOWN`, `COMPILE_FAILED`, `PREVIEW_FAILED`, `DEP_MISSING`, `EXPORT_FAILED`.

Two codes are new in v2:

- `TEMPLATE_UNAVAILABLE` — the template id exists but `available === false` (a missing or compile-time-only dependency; §13). `template.apply` returns it with the template's `reason`. Distinct from `TEMPLATE_UNKNOWN` (id not in `templates.json`).
- `COMPILE_FAILED` — `page.code.set` was given TSX that does not compile under the runner's sucrase config (§7). The failure envelope carries the compiler error in `data.diagnostics` (§4).

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
- Behavior: sets `activeTheme` and, when `mode` is given, the color mode. `gothic` is dark-only: a call whose **effective** mode is `light` (explicit `mode:"light"`, or an omitted `mode` while the stored mode is `light`) is rejected with `INVALID_PROP`. `mode` validation and the gothic gate run **before** `activeTheme` mutates, so a rejected call leaves the doc untouched. `mode` persists in the doc (§11); an omitted `mode` preserves the stored mode. When a preview is currently open, it re-emits the artifact with the new theme/mode and navigates the browser; a browser failure does not fail the command (the theme/mode change is the primary effect) and surfaces as `previewRefreshed=false`.
- → `{ theme, mode, previewRefreshed }` (`mode` = the effective mode applied)
- errs: `THEME_UNKNOWN`, `INVALID_PROP` (mode not one of light/dark/system, or gothic with an effective light mode)
- message: `테마 {theme}·모드 {mode} 적용{previewRefreshed ? " (미리보기 갱신)" : ""}.`

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
- Behavior: replaces a **tsx page**'s `code`. Validates by compiling `code` in-process under the runner's exact sucrase config (§7) — the same transform the runner runs, so bad code is rejected at the gate. On compile failure returns `COMPILE_FAILED` with the compiler error in `data.diagnostics` (and a summary in `message`); the page is left untouched. On success sets `source = { kind:"tsx", code }` (preserving any existing `origin`). A tree page returns `INVALID_TARGET` (kind gate, §2) — there is no in-place tree→tsx conversion; seed a tsx page via `page.create kind=tsx` or `template.apply`.
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
- Behavior: writes the preview artifact for the page (§7), then drives a browser plugin (§7 fallback order) to the artifact URL.
- → `{ url, engine }` (`engine` = `"chromium"` | `"native"`)
- errs: `NOT_FOUND` (page), `PREVIEW_FAILED` (write or drive), `DEP_MISSING` (no browser available)
- message: `미리보기 열림({engine}).`

### preview.refresh
- params: `{ pageId?: string }`
- Behavior: re-writes the artifact for the currently-previewed page (or the given `pageId`) and navigates the browser. Fails when no preview is open.
- → `{ url, engine }`
- errs: `NOT_FOUND` (no open preview / page absent), `PREVIEW_FAILED`, `DEP_MISSING`
- message: `미리보기 갱신({engine}).`

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

## 7. Preview law

### Artifact

A preview is a standalone document written to disk: `index.html` + `runner.js`, with the design injected inline. `index.html` contains, in order:

1. `<style>` blocks embedding, in exactly this order: `core/src/reset.css` → `core/dist/astryx.css` → the active theme's `dist/theme.css`.
2. `<script>window.__DESIGN__ = { theme, mode, page };</script>` (the `DesignPayload` for the page; `page` is the `RunnerPage` — `{ kind:"tree", root }` or `{ kind:"tsx", code }`; `mode` is the color mode from §9, defaulted to `system` by the command layer).
3. `<script src="./runner.js"></script>` — a sibling `file://` script. The document never relies on `fetch()` (blocked under `file://`).

`runner.js` is the prebuilt runner bundle (built by `scripts/build-runner.mjs`, embedded in `main.js` as a string — §11). It reads `window.__DESIGN__` and branches on `page.kind`, then wraps the mounted result in the core root `<Theme>` (which stamps `document.documentElement` — safe inside the dedicated preview document) and renders. Compile and runtime errors render as **visible error surfaces, never a blank page** (the existing `ErrorBox` / `NodeBoundary`).

### Tree path

`page.kind === "tree"`: the runner resolves each `node.type` by name from the bundled `@astryxdesign/core` barrel and lowers the tree to React elements (unchanged from v1; §2 children/prop laws). An unknown `node.type` renders an `ErrorBox` naming it.

### TSX path (v2)

`page.kind === "tsx"`: the runner compiles `page.code` with the **exact sucrase config from Learn Gate B** and executes it under a require-shim:

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
- The runner mounts the module's **default export** (compile-based resolution, per Gate: exactly one real `export default function` per template — text-scan dual-default hits are inside template-literal code samples, so a regex must never be used to find the default).
- Deferred `setTimeout` timers (chat/login demos) and a single failing `fetch` (one code-sample block, offline) must be tolerated: they fire post-mount and must not crash the page.

### Asset placeholder law (v2)

At render time the runner rewrites image sources that are **relative or absolute paths with no URL scheme** (`./x`, `../x`, `/x`) to an **inline neutral SVG placeholder** `data:` URI — an honest placeholder for an asset the preview cannot resolve under `file://`. Sources with a scheme (`http:`, `https:`, `data:`) pass through untouched (the corpus references only remote absolute images; a network-blocked remote image shows the browser's broken-image glyph, never a throw). Every `<img>` also carries an `onerror` fallback to the same placeholder. This is documented honest degradation, not silent breakage.

### Size law (v2)

The runner bundle reports its byte size (build log / `generated/` artifact). v2 adds `sucrase`, heroicons (`24/outline`, `24/solid`, `20/solid`), and `lucide-react` to the bundle on top of the v1 `react` + `react-dom` + `@astryxdesign/core` payload. That growth is **accepted and stated** — it is the cost of lossless TSX rendering (the v1 runner baseline was ~0.94 MB; the v2 bundle is larger and its size is recorded, never hidden).

### Storage API (pinned)

Artifacts are written with `app.fs.writeText(absPath, content)`. TRANSPORT IS HTTP — the plugin owns a local static server (`scripts/preview-server.cjs`, node built-ins only, bound to 127.0.0.1, root-jailed to `.preview/`), spawned via `app.process` ("process" permission) through a login shell (`/bin/sh -lc "exec node …"` — GUI apps do not inherit shell PATH). The server prints `PORT=<n>`; the preview URL is `http://127.0.0.1:<port>/<pageId>.html`. The server is reused while alive, respawned on death, and killed on plugin deactivate. `file://` transport is FORBIDDEN — it treats every document as a unique security origin, which broke fetch-dependent code (the anchor polyfill, astryx image hooks) and is why the original astryx operates behind a dev server. `app.fs.url` is equally forbidden: its blob URL is scoped to the app-webview document and no external engine can resolve it. Preview artifacts live FLAT in the single `${ctx.dir}/.preview/` directory (`${pageId}.html` + one shared `runner.js`) — core `writeText` never creates parent directories, so per-page subdirectories are forbidden; the tracked `.preview/.gitkeep` guarantees the directory exists. `ctx.dir` is the plugin install directory (`PluginContext.dir`). `.preview/` contents are git-ignored (except `.gitkeep`). `writeText` requires `fs:write`; the preview server requires `process`.

### Cross-plugin invocation (pinned)

The plugin drives a browser plugin by executing the browser plugin's registry commands. Inside a handler, use the injected `inv.execute(name, params?)` (from the `PluginInvocation` context) — never `app.commands.execute` — so origin/correlation inherit (spec §5). The command name is `plugin.<targetId>.<cmd>`. Authorization requires (a) the `commands` permission and (b) `<targetId>` declared in `manifest.dependencies` (call-boundary enforcement). Both browser plugins are declared (§8), and their `open`/`navigate`/`ping` are non-destructive, so `commands` suffices.

### Browser drive + fallback order (pinned)

Preferred engine is Chromium (`soksak-plugin-browser-chromium`); fallback is native (`soksak-plugin-browser-native`). Availability is probed with the universal `ping` command (registered when the plugin is enabled):

1. `inv.execute("plugin.soksak-plugin-browser-chromium.ping")` → `ok` ⇒ engine = chromium.
2. else `inv.execute("plugin.soksak-plugin-browser-native.ping")` → `ok` ⇒ engine = native.
3. else return `err("DEP_MISSING", …)`.

Then:

- Open: `inv.execute("plugin.<engineId>.open", { url })` where `url` is the `app.fs.url(indexPath)` value.
- Refresh / navigate: `inv.execute("plugin.<engineId>.navigate", { url })` (same url; the file bytes changed, so the browser reloads the new content).

A non-`ok` outcome from `open`/`navigate` maps to `PREVIEW_FAILED`. The chosen engine is recorded in the store so `preview.refresh` and `theme.set` reuse it.

`open` param shape: `{ url?: string }`. `navigate` param shape: `{ url: string }`. `ping` param shape: `{}`. (Verified from the shipped browser bundles.)

---

## 8. Dependencies law

`plugin.json` `dependencies` (plugin↔plugin, pinned):

```
"dependencies": {
  "soksak-plugin-browser-chromium": "^0.1.0",
  "soksak-plugin-browser-native": "^2.0.0"
}
```

Both are required so either browser command is callable (the call boundary denies undeclared cross-plugin calls). Installing this plugin cascades installation of both browsers. Enablement stays per-plugin and user-consented; `DEP_MISSING` occurs only when neither browser is enabled at drive time (both `ping` fail).

No `libraries` and no `sidecars` entries: the preview reaches the Chromium engine indirectly through the browser plugin's own sidecar declaration, not this plugin's.

---

## 9. Theme law (decided: re-emit)

The preview embeds **only the active theme's** `dist/theme.css`. `theme.set` changes `activeTheme` and, when a preview is open, re-emits `index.html` with the new theme block and navigates. Re-emit is chosen over embedding all seven and toggling a `data-astryx-theme` attribute, because the shipped `theme.css` files target `:root` (not a per-theme scoped selector), so concatenating all seven would collide on `:root` variables (last wins). Re-emitting one theme is both correct and smaller. The seven theme CSS payloads are still all embedded in `main.js` (a build-time map, §11) so re-emit needs no disk read.

`ThemeName` and the fixed 7-theme set live in `src/types.ts` (`THEMES`). `theme.set` rejects any name outside it with `THEME_UNKNOWN`.

### Color mode (decided)

`DesignDoc.mode` (`ColorMode` = `light` | `dark` | `system`) rides through the store into `DesignPayload.mode` and on to the runner, which resolves it (the Astryx theme CSS uses `light-dark()`; `system` follows the OS). `theme.set` threads it (§5). Mode is a document-level property (like `activeTheme`), persisted (§11); it is optional on `DesignDoc`/`DesignPayload` and read as `system` when absent, so pre-mode docs need no migration.

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
- `app.data.kv.watch` keeps multiple windows of the same project consistent (re-hydrate on external change).

Commands are headless-complete: they never require a view. The preview engine choice and the last-previewed `pageId`/`url` live in the store (not persisted — session state).

---

## 12. Build law

`main.js` is a single ESM bundle imported as a blob; it cannot read sibling files at runtime. Therefore all generated artifacts embed as string defines at build time (`build.mjs`, the erd precedent):

- `__CATALOG_JSON__` ← `generated/catalog.json`
- `__TEMPLATES_JSON__` ← `generated/templates.json` (verbatim-TSX `TemplateEntry[]`, §13)
- `__RUNNER_JS__` ← `generated/runner.js` (the prebuilt runner bundle — v2 embeds sucrase + heroicons + lucide, §7)
- `__ASTRYX_CSS__` ← `generated/astryx.css` (reset.css + dist/astryx.css concatenated)
- `__THEME_CSS_MAP__` ← `generated/theme-css.json` (`{ "<theme>": "<theme.css>" }`, 7 entries)

`build.mjs` throws when any generated file is missing (no silent partial output). The pipeline order is fixed by `package.json`: `gen` (catalog + templates) → `build:runner` (runner.js, astryx.css, theme-css.json) → `build.mjs` (main.js). `.gitignore` adds `.preview/*` (with `.gitkeep` tracked) and `generated/`; `main.js` is committed.

`build.mjs` is owned by the contract; `scripts/gen-catalog.mjs`, `scripts/gen-templates.mjs`, `scripts/build-runner.mjs`, `src/plugin-entry.ts`, `runner/`, and `skill/SKILL.md` are built by implementers to this contract.

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
- `available` = whether the runner can render it: `true` when every `requires` entry resolves in the runner's require-shim (§7). `false` when the file needs a module the bundle does not carry, or a **compile-time-only** transform the runner does not run.
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

612/619 files expose exactly one genuine top-level `export default function` (a React component); the runner mounts `module.default`. Two files (`pages/ide`, `pages/documentation-technical`) contain extra `export default` text **inside template-literal code samples** — esbuild/sucrase compile exactly one real default for each, so default resolution MUST be compile-based, never a regex text scan. 7 files carry no default (`themes/*/icons.tsx`, named-only icon helpers consumed by `pages/theme-showcase`) — helper modules, not standalone mountable pages; they enter `templates.json` as `available:false` with reason `helper module (no default export to mount)`.

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
- **Runtime** — `import()`=0, `requestAnimationFrame`=0, `setInterval`=0, `localStorage`=0; `setTimeout` in 10 files (post-mount demo timers), one real `fetch` (offline-rejecting code-sample block). The preview needs no loader and no polyfill beyond a real DOM.

---

Version: 2.0.0
Spec: soksak-plugin-spec@1
Core: @astryxdesign/core 0.1.3
