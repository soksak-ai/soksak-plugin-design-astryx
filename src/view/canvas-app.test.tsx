// @vitest-environment jsdom
// 캔버스 앱 통합 검증(§7 View law·Selection law·Toolbar law) — 3-패널 프레임 안에서 선택 아웃라인·캔버스
// 클릭→canvas.select·TSX 내보내기 오버레이·스토어 프레이밍(canvas.set 진실)을 실제 React 렌더로 친다.
// 실 astryx 배럴로 트리를 낮춰 data-node-id 가 DOM 에 도달하는지까지 눈으로(단언으로) 확인한다.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act } from "react";
import { createElement } from "react";
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
import { createRoot } from "react-dom/client";
import { CanvasApp } from "./canvas-app";
import type { RenderConfig } from "./model";
import type { RunnerModules } from "../render-core";
import type { CanvasControls, CommandOutcome, DesignDoc, DesignPage, Selection } from "../types";

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

function lightRender(): RenderConfig {
  return {
    modules: MODULES,
    themeObjects: {},
    themeContext: Astryx.ThemeContext as unknown as RenderConfig["themeContext"],
    controlledInputs: new Set<string>(),
    astryxCss: "",
    themeCssMap: {},
  };
}

// Stack(root) > Button(btn) 트리 페이지.
function treeDoc(): DesignDoc {
  const page: DesignPage = {
    id: "pg",
    name: "Page",
    source: {
      kind: "tree",
      root: {
        id: "root",
        type: "Stack",
        props: {},
        children: [{ id: "btn", type: "Button", props: { label: "Go" }, children: [] }],
      },
    },
  };
  return { version: 1, activeTheme: "neutral", mode: "system", pages: [page], seq: 10 };
}

interface Store {
  doc: DesignDoc;
  preview: { activePageId: string | null };
  selection: Selection | null;
  canvasControls: CanvasControls;
}

function makeStore(over?: Partial<Store>): Store {
  return {
    doc: treeDoc(),
    preview: { activePageId: "pg" },
    selection: null,
    canvasControls: { width: "fill", background: "" },
    ...over,
  };
}

function createEmitter() {
  let version = 0;
  const listeners = new Set<() => void>();
  return {
    notify() {
      version++;
      for (const l of listeners) l();
    },
    subscribe(cb: () => void) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getVersion: () => version,
  };
}

function mount(
  store: Store,
  execute: (name: string, params?: Record<string, unknown>) => Promise<CommandOutcome>,
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const emitter = createEmitter();
  const root = createRoot(container);
  act(() => {
    root.render(
      createElement(CanvasApp, {
        store,
        execute,
        render: lightRender(),
        subscribe: emitter.subscribe,
        getVersion: emitter.getVersion,
      }),
    );
  });
  return { container, emitter };
}

const okExec = async (): Promise<CommandOutcome> => ({ ok: true, code: "OK", message: "" });

describe("CanvasApp — 3-패널 프레임 통합", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("트리 페이지가 canvas-root 안에 실물 렌더되고 각 노드에 data-node-id 가 붙는다", () => {
    const { container } = mount(makeStore(), okExec);
    expect(container.querySelector(".canvas-root")).toBeTruthy();
    expect(container.querySelector('[data-node-id="root"]')).toBeTruthy();
    expect(container.querySelector('[data-node-id="btn"]')).toBeTruthy();
  });

  it("선택 노드에 아웃라인을 얹고 나머지는 벗긴다(§7 Selection law)", () => {
    const { container } = mount(makeStore({ selection: { pageId: "pg", nodeId: "btn" } }), okExec);
    const btn = container.querySelector('[data-node-id="btn"]') as HTMLElement;
    const root = container.querySelector('[data-node-id="root"]') as HTMLElement;
    expect(btn.style.outline).toContain("4f8cff");
    expect(root.style.outline).toBe("");
  });

  it("캔버스 클릭 → 가장 가까운 data-node-id → canvas.select(§7 All-elements clause)", () => {
    const execute = vi.fn(okExec);
    const { container } = mount(makeStore(), execute);
    const btn = container.querySelector('[data-node-id="btn"]') as HTMLElement;
    act(() => {
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(execute).toHaveBeenCalledWith("canvas.select", { pageId: "pg", nodeId: "btn" });
  });

  it("프레이밍은 스토어 canvasControls 가 진실 — 배경이 뷰포트에 반영된다(§7 Toolbar law)", () => {
    const { container } = mount(
      makeStore({ canvasControls: { width: "fill", background: "red" } }),
      okExec,
    );
    const viewport = container.querySelector(".canvas-viewport") as HTMLElement;
    expect(viewport.style.background).toBe("red");
  });

  it("TSX 내보내기 → export.tsx 결과를 astryx CodeBlock 오버레이로 낮춘다(코드·파일명 실물 렌더)", async () => {
    const execute = vi.fn(async (name: string): Promise<CommandOutcome> => {
      if (name === "export.tsx") {
        return { ok: true, code: "OK", message: "", data: { tsx: "EXPORTED_CODE", filename: "page.tsx" } };
      }
      return { ok: true, code: "OK", message: "" };
    });
    const { container } = mount(makeStore(), execute);
    const btn = [...container.querySelectorAll<HTMLElement>("button")].find(
      (b) => b.textContent?.includes("TSX 내보내기"),
    );
    expect(btn).toBeTruthy();
    await act(async () => {
      btn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(execute).toHaveBeenCalledWith("export.tsx", { pageId: "pg" });
    // 크루드 textarea 폐기 → CodeBlock(<pre>)이 코드 본문을 낮춘다. 파일명은 헤더 라벨로.
    const overlay = container.querySelector(".export-overlay") as HTMLElement;
    expect(overlay).toBeTruthy();
    expect(overlay.querySelector("pre")).toBeTruthy();
    expect(overlay.textContent).toContain("EXPORTED_CODE");
    expect(overlay.textContent).toContain("page.tsx");
    expect(container.querySelector("textarea")).toBeNull();
  });

  it("TSX 내보내기 실패 → EmptyState 오류 표면(빈 화면·코드 블록 없음)", async () => {
    const execute = vi.fn(async (name: string): Promise<CommandOutcome> => {
      if (name === "export.tsx") {
        return { ok: false, code: "ERR_EXPORT", message: "직렬화에 실패했습니다." };
      }
      return { ok: true, code: "OK", message: "" };
    });
    const { container } = mount(makeStore(), execute);
    const btn = [...container.querySelectorAll<HTMLElement>("button")].find(
      (b) => b.textContent?.includes("TSX 내보내기"),
    );
    await act(async () => {
      btn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const overlay = container.querySelector(".export-overlay") as HTMLElement;
    expect(overlay).toBeTruthy();
    expect(overlay.textContent).toContain("직렬화에 실패했습니다.");
    expect(overlay.querySelector("pre")).toBeNull();
  });

  it("페이지가 없으면 캔버스는 안내 표면(빈 화면 금지)", () => {
    const store = makeStore({ doc: { version: 1, activeTheme: "neutral", mode: "system", pages: [], seq: 0 }, preview: { activePageId: null } });
    const { container } = mount(store, okExec);
    expect(container.textContent).toContain("No pages yet");
  });
});
