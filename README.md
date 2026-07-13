# soksak-plugin-design-astryx

Design by talking, for the soksak terminal app.

The design document is a set of Astryx pages (`@astryxdesign/core`) — each a component tree or original TSX. Every capability is a command, so you build a page, set a theme, preview it in an in-app canvas view, and export TSX with no GUI — over the `sok` CLI, as MCP tools, or the e2e socket. The plugin holds one working document per project (the single source of truth), persisted to `app.data`; the canvas view, when open, mounts the Astryx components live and re-renders on every command. External LLMs drive it through the bundled skill (`contributes.skill`).

## What it is

- **Two page kinds.** A page is either a **tree** — an Astryx component tree (`{ id, type, props, children }`) edited a node at a time by `comp.*` — or **tsx** — original `'use client'` TSX source where the source is the truth, seeded from a shipped template or `page.create kind=tsx` and edited whole by `page.code.set`. Rich pages start as tsx; command-composed pages are trees.
- **Full scope.** Every renderable component export of `@astryxdesign/core` `0.1.3` (no whitelist) for tree pages, all 7 packaged themes, all 619 shipped Astryx CLI templates as verbatim tsx (605 available, 14 unavailable with honest reasons), and TSX export for both kinds.
- **Headless-complete.** Create pages, add/set/move/find components, apply templates, edit TSX, set the theme, preview, and export entirely by command. The document is the single source of truth; views only reflect it.
- **Theme-driven.** The theme is document-level. Components read color, spacing, radius, and typography from the active theme's tokens; a design should hold across all 7 themes rather than fight them with inline styles.

## Command surface

All commands take one JSON params object and return the v1 message envelope `{ ok, code, message, data? }`.

| Command | Params | Result |
|---|---|---|
| `ping` | `{}` | `{ version, catalogCount, templateCount }` — load/version check. |
| `state` | `{}` | `{ activeTheme, pageCount, pages[] }` — document summary. |
| `docs.list` | `{}` | Doctrine topics available to `docs.get`. |
| `docs.get` | `{ topic }` | One doctrine document (`principles`, `tokens`, `theme`, …). |
| `page.create` | `{ name, kind? }` | Creates a page; `kind` `tree` (default, root `Stack`) or `tsx` (starter code). |
| `page.list` | `{}` | `{ pages[] }`. |
| `page.rename` | `{ pageId, name }` | Renames a page. |
| `page.duplicate` | `{ pageId, name? }` | Clones a page (fresh ids for tree, verbatim `code` for tsx). |
| `page.remove` | `{ pageId }` | Removes a page. |
| `page.code.get` | `{ pageId }` | A tsx page's `code` (tree page → `INVALID_TARGET`). |
| `page.code.set` | `{ pageId, code }` | Replaces a tsx page's `code`; compiled at the gate. |
| `comp.add` | `{ pageId, type, parentId?, index?, props? }` | Adds a node under `parentId` (default root). Tree pages only. |
| `comp.set` | `{ pageId, nodeId, props, replace? }` | Merges (or replaces) props; a `null` value deletes a key. Tree pages only. |
| `comp.move` | `{ pageId, nodeId, parentId, index? }` | Reparents a node (rejects cycles / the root). Tree pages only. |
| `comp.remove` | `{ pageId, nodeId }` | Removes a node and its subtree (not the root). Tree pages only. |
| `comp.get` | `{ pageId, nodeId }` | Returns the full subtree. Tree pages only. |
| `comp.find` | `{ pageId?, type?, propContains? }` | Searches for matching nodes. Tree pages only. |
| `theme.set` | `{ theme, mode? }` | Sets `activeTheme` and light/dark/system `mode`; the mounted canvas re-renders live. |
| `theme.list` | `{}` | `{ themes, active }` — the 7 themes. |
| `template.list` | `{ kind?, includeUnavailable? }` | Available templates + counts/reasons of the unavailable. |
| `template.apply` | `{ id, pageId?, name? }` | Creates a tsx page from a template's verbatim code. |
| `catalog.list` | `{ group?, query? }` | Lists catalog components. |
| `catalog.doc` | `{ type }` | Full catalog entry: props, enums, defaults, `acceptsChildren`. |
| `preview.open` | `{ pageId }` | Selects the page and opens/focuses the in-app canvas view. |
| `preview.refresh` | `{ pageId? }` | Forces an explicit canvas re-render (no-op when no view is open). |
| `canvas.select` | `{ pageId?, nodeId }` | Sets the view-session selection (the same field the structure-tree and canvas clicks write); `pageId` defaults to the active page, `nodeId` null clears to page-only. Non-null `nodeId` must name a live tree-page node → else `NOT_FOUND`. |
| `canvas.set` | `{ viewport?, background? }` | Sets the view-session framing: `viewport` `fill`/`1280`/`768`/`375` (bad value → `INVALID_PROP` with `data.validValues`), `background` a CSS color or `neutral`/`''` for the default. At least one required. |
| `export.tsx` | `{ pageId }` | TSX for the page (a tsx page's `code` verbatim, or the tree serializer). |

Error `code` is a closed set: `NOT_FOUND`, `INVALID_TYPE`, `INVALID_PROP`, `INVALID_TARGET`, `INVALID_ARG`, `DUPLICATE`, `TEMPLATE_UNKNOWN`, `TEMPLATE_UNAVAILABLE`, `THEME_UNKNOWN`, `COMPILE_FAILED`, `PREVIEW_FAILED`, `EXPORT_FAILED`.

## Canvas architecture

The primary design surface is an in-app **canvas view** (a plugin view, id `canvas`, opened by the `design-astryx` program from the `+` menu), not a browser document. `preview.open` opens or focuses the canvas tab; there is no http server.

The view renders in a **Chromium engine-sidecar surface** (`browser-chromium`, `soksak-spec-sidecar-browser`) hosted in **offscreen mode** (docs/SIDECARS.md §8): the engine paints via shared texture into a module-owned layer, and the view's DOM cell keeps every input event — forwarded over the protocol (`mouse`/`wheel`/`key`/`ime`; `src/app/input-forward.ts`, contract-tested). astryx requires CSS anchor positioning (Chrome 125+), which the app webview (WKWebView) lacks — only the rendering engine changes; the model, commands, and persistence stay in plugin JS (headless preserved: everything works from the CLI with no view open). The shell is a static `file://standalone.html` artifact (React, the astryx barrel, the render core, and all theme CSS baked in). Live state flows over the **cefQuery bridge** — no eval, no code strings: the page subscribes once (persistent query) and the host pushes a ViewStore snapshot on every store notify, so every command (`comp.*`, `page.*`, `theme.set`, `template.apply`, `page.code.set`) re-renders the active page instantly; toolbar/tree/inspector interactions come back as `execute` queries into the same command registry the CLI uses.

The view chrome is a three-pane frame dogfooded from Astryx itself (Layout + LayoutPanel + LayoutContent): a **structure** panel (left, ~260px), the canvas (center), and an **inspector** panel (right, ~320px), with a toolbar header above. Every control is a command client (headless and UI stay one truth):

- **Toolbar header** — page selector, theme (7) + mode (light/dark/system) selectors driving `theme.set`, viewport/background framing driving `canvas.set`, and the `TSX 내보내기` (`export.tsx`) button.
- **Structure panel** — a `TreeList` projecting the active page's node tree (tsx pages show a single read-only `⌁ code` row). Clicking a node routes through `canvas.select`.
- **Inspector panel** — a prop form for the selected node built from its `catalog.doc` schema (enum → Selector, boolean → Switch, spacing → stepper, string/number/style → text), dispatching `comp.set` on edit.
- **Canvas** — clicking a rendered node routes through `canvas.select`; the selection highlights in both the tree and the canvas. Framing (`canvas.set`) and selection (`canvas.select`) are view-local view-session state: not part of the document, not persisted, per-window, but fully commandable so an LLM can frame or select headlessly.

The rendering core (reused from the earlier transport) branches on `page.kind`: a **tree** page resolves each `node.type` from the `@astryxdesign/core` barrel and renders the tree; a **tsx** page is compiled with sucrase and mounted through a require-shim that resolves `react`, the `@astryxdesign/core` barrel, heroicons, and lucide from the bundle — its default export is mounted losslessly. Compile and runtime errors render as visible error surfaces, never a blank page.

## Usage

Discover the live command surface (names/params evolve — never guess):

```
sok commands | grep plugin.soksak-plugin-design-astryx
sok help plugin.soksak-plugin-design-astryx.<command>
```

Build, preview, and look:

```
sok plugin.soksak-plugin-design-astryx.theme.set theme=matcha
sok plugin.soksak-plugin-design-astryx.page.create name='Landing'
sok plugin.soksak-plugin-design-astryx.comp.add pageId=<p> type=Card
sok plugin.soksak-plugin-design-astryx.comp.add pageId=<p> parentId=<cardId> type=Button \
  props='{"label":"Get started","variant":"primary"}'
sok plugin.soksak-plugin-design-astryx.preview.open pageId=<p>   # open the in-app canvas view
sok window.snapshot            # capture the app window and read the pixels
sok plugin.soksak-plugin-design-astryx.export.tsx pageId=<p>
```

The bundled `soksak-design-astryx` skill (`contributes.skill`) carries the full tree model and workflow for AI agents.

## Build

```
npm install
npm test
npm run build   # gen catalog + templates → build CSS → bundle main.js (esbuild)
```

`npm run build` runs, in order, `scripts/gen-catalog.mjs` and `scripts/gen-templates.mjs` (generate `generated/catalog.json` and `generated/templates.json` from `@astryxdesign/core` and `@astryxdesign/cli`), the `build:css` step (`generated/astryx.css` + the 7-theme `generated/theme-css.json`, baked into the standalone shell), then `build.mjs` (bundle `src` → committed `main.js`; the render core and its libraries are part of `main.js`'s import graph). `generated/` is git-ignored; `main.js` is committed.

## License

This plugin is built on [Astryx](https://github.com/facebook/astryx) — `@astryxdesign/core` and the seven `@astryxdesign/theme-*` packages — which is Meta's design system, MIT licensed. The plugin depends on and bundles precompiled Astryx distribution; `@stylexjs/stylex` stays pinned to `0.18.3`.

한국어 설명은 [README.ko.md](README.ko.md) 참고.
