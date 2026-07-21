// @vitest-environment jsdom
// 레일 패널 앱 검증 — 방출된 구조/인스펙터 패널이 캔버스와 같은 스냅샷 스토어에서 파생해 실물 렌더되는지.
// 상태는 호스트 스토어가 소유하고 이 앱은 스냅샷을 그리는 순수 뷰다(캔버스 앱과 동일 계약).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act } from "react";
import { createElement } from "react";
import * as Astryx from "@astryxdesign/core";
import { createRoot } from "react-dom/client";
import { RailPanelApp } from "./rail-panel";
import type { RenderConfig } from "./model";
import type { CanvasControls, CommandOutcome, DesignDoc, DesignPage, Selection } from "../types";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// 패널은 render.modules 를 안 쓴다(트리 낮춤은 캔버스 소유) — 테마 컨텍스트만 실물로 공급.
function lightRender(): RenderConfig {
  return {
    modules: {} as RenderConfig["modules"],
    themeObjects: {},
    themeContext: Astryx.ThemeContext as unknown as RenderConfig["themeContext"],
    controlledInputs: new Set<string>(),
    astryxCss: "",
    themeCssMap: {},
  };
}

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

const okExec = async (): Promise<CommandOutcome> => ({ ok: true, code: "OK", message: "" });

function mount(slot: "structure" | "inspector", store: Store, execute = okExec) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const emitter = createEmitter();
  const root = createRoot(container);
  act(() => {
    root.render(
      createElement(RailPanelApp, {
        slot,
        store,
        execute,
        render: lightRender(),
        subscribe: emitter.subscribe,
        getVersion: emitter.getVersion,
      }),
    );
  });
  return { container, emitter, store };
}

describe("RailPanelApp", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("structure 슬롯 — 구조 트리를 실물 렌더하고 노드 클릭이 canvas.select 로 흐른다", () => {
    const execute = vi.fn(okExec);
    const { container } = mount("structure", makeStore(), execute);
    expect(container.querySelector('[data-testid="structure-tree"]')).toBeTruthy();
    const row = [...container.querySelectorAll<HTMLElement>("*")].find(
      (n) => n.textContent === "Button" && n.children.length === 0,
    );
    expect(row).toBeTruthy();
    act(() => {
      row!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(execute).toHaveBeenCalledWith("canvas.select", { pageId: "pg", nodeId: "btn" });
  });

  it("inspector 슬롯 — 미선택은 안내, 선택하면 그 노드에 바인딩한다(node.type 표면화)", () => {
    const { container } = mount("inspector", makeStore());
    expect(container.textContent).toContain("Select a node");

    document.body.innerHTML = "";
    // vitest 엔 카탈로그 define 이 없어 entry 는 방어 고지로 떨어진다 — 어느 경로든 선택 노드의
    // type 이 표면화되는 것이 바인딩의 증거다(빈 화면·안내 잔존 금지).
    const sel = mount("inspector", makeStore({ selection: { pageId: "pg", nodeId: "btn" } }));
    expect(sel.container.textContent).not.toContain("Select a node");
    expect(sel.container.textContent).toContain("Button");
  });

  it("스냅샷 갱신(notify)에 라이브 반응한다 — 선택이 스토어에서 바뀌면 인스펙터가 따라온다", () => {
    const store = makeStore();
    const { container, emitter } = mount("inspector", store);
    expect(container.textContent).toContain("Select a node");
    act(() => {
      (store as { selection: Selection | null }).selection = { pageId: "pg", nodeId: "btn" };
      emitter.notify();
    });
    expect(container.textContent).not.toContain("Select a node");
    expect(container.textContent).toContain("Button");
  });
});
