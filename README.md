# soksak-plugin-design-astryx

Design by talking, for the soksak terminal app.

The design document is a component tree of Astryx components (`@astryxdesign/core`). Every capability is a command, so you build a page, set a theme, preview it in a browser view, and export TSX with no GUI — over the `sok` CLI, as MCP tools, or the e2e socket. The plugin holds one working document per project (the single source of truth), persisted to `app.data`; a browser view, when open, only renders it. External LLMs drive it through the bundled skill (`contributes.skill`).

## What it is

- **Two page kinds.** A page is either a **tree** — an Astryx component tree (`{ id, type, props, children }`) edited a node at a time by `comp.*` — or **tsx** — original `'use client'` TSX source where the source is the truth, seeded from a shipped template or `page.create kind=tsx` and edited whole by `page.code.set`. Rich pages start as tsx; command-composed pages are trees.
- **Full scope.** Every renderable component export of `@astryxdesign/core` `0.1.3` (no whitelist) for tree pages, all 7 packaged themes, all 619 shipped Astryx CLI templates as verbatim tsx (612 available, 7 unavailable with honest reasons), and TSX export for both kinds.
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
| `theme.set` | `{ theme, mode? }` | Sets `activeTheme` and light/dark `mode`; re-emits an open preview. |
| `theme.list` | `{}` | `{ themes, active }` — the 7 themes. |
| `template.list` | `{ kind?, includeUnavailable? }` | Available templates + counts/reasons of the unavailable. |
| `template.apply` | `{ id, pageId?, name? }` | Creates a tsx page from a template's verbatim code. |
| `catalog.list` | `{ group?, query? }` | Lists catalog components. |
| `catalog.doc` | `{ type }` | Full catalog entry: props, enums, defaults, `acceptsChildren`. |
| `preview.open` | `{ pageId }` | Writes the preview artifact and opens a browser view. |
| `preview.refresh` | `{ pageId? }` | Re-emits and reloads the current preview. |
| `export.tsx` | `{ pageId }` | TSX for the page (a tsx page's `code` verbatim, or the tree serializer). |

Error `code` is a closed set: `NOT_FOUND`, `INVALID_TYPE`, `INVALID_PROP`, `INVALID_TARGET`, `INVALID_ARG`, `DUPLICATE`, `TEMPLATE_UNKNOWN`, `TEMPLATE_UNAVAILABLE`, `THEME_UNKNOWN`, `COMPILE_FAILED`, `PREVIEW_FAILED`, `DEP_MISSING`, `EXPORT_FAILED`.

## Preview architecture

`preview.open` writes a self-contained document to the flat `.preview/` directory under the plugin install directory: `<pageId>.html` + a shared `runner.js`, with the design injected inline as `window.__DESIGN__ = { theme, mode, page }`. `index.html` embeds CSS in order (`reset.css` → `astryx.css` → the active theme's `theme.css`), then the injected design, then the sibling `runner.js` (a prebuilt bundle). The runner branches on `page.kind`: a **tree** page resolves each `node.type` from the `@astryxdesign/core` barrel and renders the tree; a **tsx** page is compiled with sucrase and mounted through a require-shim that resolves `react`, the `@astryxdesign/core` barrel, heroicons, and lucide from the bundle — its default export is mounted losslessly. Both wrap in the core `<Theme>`; compile/runtime errors render as visible error surfaces, never blank. The document is loaded via `file://` and never uses `fetch()`.

The plugin then drives a browser dependency plugin to the artifact URL: `soksak-plugin-browser-chromium` is preferred, `soksak-plugin-browser-native` is the fallback, probed via each plugin's `ping`. `preview.refresh` and a theme change re-emit the artifact and reload the same URL. Both browser plugins are declared in `plugin.json` `dependencies`, so installing this plugin cascades their installation; `DEP_MISSING` occurs only when neither is enabled at drive time.

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
sok plugin.soksak-plugin-design-astryx.preview.open pageId=<p>
sok window.snapshot            # capture the browser view and read the pixels
sok plugin.soksak-plugin-design-astryx.export.tsx pageId=<p>
```

The bundled `soksak-design-astryx` skill (`contributes.skill`) carries the full tree model and workflow for AI agents.

## Build

```
npm install
npm test
npm run build   # gen catalog + templates → build runner → bundle main.js (esbuild)
```

`npm run build` runs, in order, `scripts/gen-catalog.mjs` and `scripts/gen-templates.mjs` (generate `generated/catalog.json` and `generated/templates.json` from `@astryxdesign/core` and `@astryxdesign/cli`), `scripts/build-runner.mjs` (the runner bundle and embedded CSS), then `build.mjs` (bundle `src` → committed `main.js`). `.preview/` and `generated/` are git-ignored; `main.js` is committed.

## License

This plugin is built on [Astryx](https://github.com/facebook/astryx) — `@astryxdesign/core` and the seven `@astryxdesign/theme-*` packages — which is Meta's design system, MIT licensed. The plugin depends on and bundles precompiled Astryx distribution; `@stylexjs/stylex` stays pinned to `0.18.3`.

한국어 설명은 [README.ko.md](README.ko.md) 참고.
