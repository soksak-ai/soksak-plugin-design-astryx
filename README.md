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
| `export.tsx` | `{ pageId }` | TSX for the page (a tsx page's `code` verbatim, or the tree serializer). |

Error `code` is a closed set: `NOT_FOUND`, `INVALID_TYPE`, `INVALID_PROP`, `INVALID_TARGET`, `INVALID_ARG`, `DUPLICATE`, `TEMPLATE_UNKNOWN`, `TEMPLATE_UNAVAILABLE`, `THEME_UNKNOWN`, `COMPILE_FAILED`, `PREVIEW_FAILED`, `EXPORT_FAILED`.

## Canvas architecture

The primary design surface is an in-app **canvas view** (a plugin view, id `canvas`, opened by the `design-astryx` program from the `+` menu), not a browser document. `preview.open` opens or focuses the canvas tab; there is no http server, no `file://` artifact, and no browser dependency.

The view mounts the active page's Astryx components **directly** as a React tree inside a Shadow DOM in the app webview, live-bound to the same module store the commands mutate — so every command (`comp.*`, `page.*`, `theme.set`, `template.apply`, `page.code.set`) re-renders the active page instantly, with no navigation and no disk emission. The Shadow DOM contains a global CSS reset (the erd precedent): the view injects `reset.css` → `astryx.css` (with `:root` rewritten to `:host`) → all 7 theme blocks into the shadow, and carries the active theme on the shadow-host wrapper via `data-astryx-theme` + `color-scheme`; switching theme or mode swaps those attributes in place.

The view chrome is a toolbar above the rendering area, whose controls are all command clients (headless and UI stay one truth):

- **Page selector** — lists the doc's pages and selects the active one.
- **Theme (7) + mode (light/dark/system) selectors** — drive `theme.set`.
- **Canvas controls** — viewport-width presets (`fill` / `1280` / `768` / `375`) and canvas background. These are view-local framing: not part of the document, not persisted, and per-window.

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

`npm run build` runs, in order, `scripts/gen-catalog.mjs` and `scripts/gen-templates.mjs` (generate `generated/catalog.json` and `generated/templates.json` from `@astryxdesign/core` and `@astryxdesign/cli`), the `build:css` step (`generated/astryx.css` + the 7-theme `generated/theme-css.json`, injected into the canvas shadow), then `build.mjs` (bundle `src` → committed `main.js`; the render core and its libraries are part of `main.js`'s import graph). `generated/` is git-ignored; `main.js` is committed.

## License

This plugin is built on [Astryx](https://github.com/facebook/astryx) — `@astryxdesign/core` and the seven `@astryxdesign/theme-*` packages — which is Meta's design system, MIT licensed. The plugin depends on and bundles precompiled Astryx distribution; `@stylexjs/stylex` stays pinned to `0.18.3`.

한국어 설명은 [README.ko.md](README.ko.md) 참고.
