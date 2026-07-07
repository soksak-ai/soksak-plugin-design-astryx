// @vitest-environment jsdom
// 캔버스 뷰 마운트 검증(§7 View law) — 가벼운 RenderConfig(실 react+astryx 배럴, 스텁 테마·소량 CSS)를
// 주입해 shadow 마운트→라이브 재렌더→테마 스왑→tsx 렌더→오류 표면을 jsdom 에서 실제로 돌린다.
// notify 로만 재렌더된다(useSyncExternalStore) — 명령이 스토어를 바꾸고 onChange→notify 하는 경로의 대역.
import { describe, it, expect, beforeEach } from "vitest";
import { act } from "react";
import * as React from "react";
import * as ReactJsxRuntime from "react/jsx-runtime";
import * as Astryx from "@astryxdesign/core";
import * as AstryxTheme from "@astryxdesign/core/theme";
import * as AstryxThemeSyntax from "@astryxdesign/core/theme/syntax";
import * as AstryxHooks from "@astryxdesign/core/hooks";
import * as HeroiconsOutline24 from "@heroicons/react/24/outline";
import * as HeroiconsSolid24 from "@heroicons/react/24/solid";
import * as HeroiconsSolid20 from "@heroicons/react/20/solid";
import * as Lucide from "lucide-react";
import { buildCanvasView } from "./mount";
import type { RenderConfig, CanvasStore } from "./model";
import type { RunnerModules } from "../render-core";
import type { DesignDoc, DesignPage } from "../types";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MODULES: RunnerModules = {
  react: React,
  jsxRuntime: ReactJsxRuntime,
  core: Astryx,
  coreTheme: AstryxTheme,
  coreThemeSyntax: AstryxThemeSyntax,
  coreHooks: AstryxHooks,
  heroiconsOutline24: HeroiconsOutline24,
  heroiconsSolid24: HeroiconsSolid24,
  heroiconsSolid20: HeroiconsSolid20,
  lucide: Lucide,
};

// 소량 CSS — 재작성(:root→:host)과 7블록 주입을 관찰하려는 값. 실 빌드 CSS 의 형태만 흉내.
const ASTRYX_CSS = ":root, .xhash { --astryx-x: 1px; }";
const THEME_CSS_MAP: Record<string, string> = {
  neutral: ':root { color-scheme: light dark; } [data-astryx-theme="neutral"] { --tone: n; }',
  gothic: ':root { color-scheme: dark; } [data-astryx-theme="gothic"] { --tone: g; }',
};

function lightRender(): RenderConfig {
  return {
    modules: MODULES,
    themeObjects: {}, // 스텁 — ctx.theme=null → useTheme 가 기본 토큰으로 폴백(크래시 없음).
    themeContext: Astryx.ThemeContext as unknown as RenderConfig["themeContext"],
    controlledInputs: new Set<string>(),
    astryxCss: ASTRYX_CSS,
    themeCssMap: THEME_CSS_MAP,
    // polyfill 미주입 → 건너뜀(jsdom 레이아웃 없음).
  };
}

// 트리 페이지 헬퍼 — 배럴 Text 를 children 문자열로 렌더(smoke 선례와 동형).
function treePage(id: string, name: string, text: string): DesignPage {
  return {
    id,
    name,
    source: {
      kind: "tree",
      root: {
        id: `${id}-r`,
        type: "Stack",
        props: {},
        children: [{ id: `${id}-t`, type: "Text", props: { children: text }, children: [] }],
      },
    },
  };
}

function tsxPage(id: string, name: string, code: string): DesignPage {
  return { id, name, source: { kind: "tsx", code } };
}

function makeStore(pages: DesignPage[], activePageId: string | null): CanvasStore & {
  doc: DesignDoc;
  preview: { activePageId: string | null };
} {
  return {
    doc: { version: 1, activeTheme: "neutral", mode: "system", pages, seq: 100 },
    preview: { activePageId },
  };
}

const FAKE_CTX = { projectId: "_test", viewId: "canvas", setTitle: () => {} };

function mountInto(store: CanvasStore, render: RenderConfig) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const view = buildCanvasView({ store, execute: async () => ({ ok: true, code: "OK", message: "" }), render });
  act(() => {
    view.provider.mount(container, FAKE_CTX);
  });
  return { container, view };
}

function shadowHtml(container: HTMLElement): string {
  return container.shadowRoot?.innerHTML ?? "";
}

describe("buildCanvasView — shadow 마운트", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("shadow 를 붙이고 canvas-root 를 그린다(CSS 는 :root→:host 재작성해 주입)", () => {
    const store = makeStore([treePage("p1", "One", "Alpha")], "p1");
    const { container } = mountInto(store, lightRender());
    const shadow = container.shadowRoot;
    expect(shadow).toBeTruthy();
    const style = shadow!.querySelector("style");
    expect(style).toBeTruthy();
    // :root 가 :host 로 재작성됨 — 원문 ":root" 는 없어야.
    expect(style!.textContent).toContain(":host, .xhash");
    expect(style!.textContent).not.toContain(":root, .xhash");
    // 7(여기선 2) 테마 블록이 전부 주입됨.
    expect(style!.textContent).toContain('[data-astryx-theme="neutral"]');
    expect(style!.textContent).toContain('[data-astryx-theme="gothic"]');
    // canvas-root 가 활성 테마를 든다.
    const root = shadow!.querySelector(".canvas-root") as HTMLElement;
    expect(root).toBeTruthy();
    expect(root.getAttribute("data-astryx-theme")).toBe("neutral");
    // 활성 트리 페이지가 렌더됨.
    expect(shadowHtml(container)).toContain("Alpha");
  });

  it("store 변이 후 notify 로 활성 페이지가 라이브 갱신된다", () => {
    const store = makeStore([treePage("a", "A", "Alpha"), treePage("b", "B", "Beta")], "a");
    const { container, view } = mountInto(store, lightRender());
    expect(shadowHtml(container)).toContain("Alpha");
    expect(shadowHtml(container)).not.toContain("Beta");
    // 활성 페이지 전환(preview.refresh 의 대역) → notify.
    store.preview.activePageId = "b";
    act(() => {
      view.notify();
    });
    expect(shadowHtml(container)).toContain("Beta");
    expect(shadowHtml(container)).not.toContain("Alpha");
  });

  it("theme.set 대역: activeTheme 변이+notify 로 shadow 래퍼 테마가 스왑된다", () => {
    const store = makeStore([treePage("p1", "One", "Alpha")], "p1");
    const { container, view } = mountInto(store, lightRender());
    const root = () => container.shadowRoot!.querySelector(".canvas-root") as HTMLElement;
    expect(root().getAttribute("data-astryx-theme")).toBe("neutral");
    expect(root().style.colorScheme).toBe("light dark"); // system → "light dark".
    store.doc = { ...store.doc, activeTheme: "gothic", mode: "system" };
    act(() => {
      view.notify();
    });
    expect(root().getAttribute("data-astryx-theme")).toBe("gothic");
    expect(root().style.colorScheme).toBe("dark"); // gothic 은 다크 전용.
  });

  it("tsx 페이지를 default export 로 마운트한다", () => {
    const code =
      "'use client';\nexport default function P(){ return <div>TSX-RENDERED</div>; }";
    const store = makeStore([tsxPage("t1", "TSX", code)], "t1");
    const { container } = mountInto(store, lightRender());
    expect(shadowHtml(container)).toContain("TSX-RENDERED");
  });

  it("깨진 tsx 는 빈 화면이 아니라 보이는 오류 표면", () => {
    const broken = "export default function B(){ return <div>unterminated }";
    const store = makeStore([tsxPage("t2", "Broken", broken)], "t2");
    const { container } = mountInto(store, lightRender());
    const html = shadowHtml(container);
    expect(html).toContain("Compile failed");
  });

  it("페이지가 없으면 안내 표면(빈 화면 금지)", () => {
    const store = makeStore([], null);
    const { container } = mountInto(store, lightRender());
    expect(shadowHtml(container)).toContain("No pages yet");
  });

  it("unmount 이 shadow 트리를 회수한다(재마운트 안전)", () => {
    const store = makeStore([treePage("p1", "One", "Alpha")], "p1");
    const { container, view } = mountInto(store, lightRender());
    act(() => {
      view.provider.unmount!(container);
    });
    // 재마운트(같은 container) 는 shadowRoot 재사용·정상 렌더.
    act(() => {
      view.provider.mount(container, FAKE_CTX);
    });
    expect(shadowHtml(container)).toContain("Alpha");
  });
});
