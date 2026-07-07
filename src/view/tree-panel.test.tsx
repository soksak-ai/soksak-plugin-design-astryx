// @vitest-environment jsdom
// 구조 패널 검증(§7 Chrome law·Selection law) — 순수 투영(buildStructureItems·propHint·activeSelectedNodeId,
// RED-first)과 TreePanel 의 노드 클릭 → canvas.select 라우팅(세 진입점 수렴)을 jsdom 에서 실제로 친다.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act } from "react";
import { createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import type { CommandOutcome, DesignNode, DesignPage } from "../types";
import {
  buildStructureItems,
  propHint,
  activeSelectedNodeId,
  TSX_ROW_ID,
  TreePanel,
} from "./tree-panel";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function node(id: string, type: string, props: DesignNode["props"] = {}, children: DesignNode[] = []): DesignNode {
  return { id, type, props, children };
}
function treePage(root: DesignNode, id = "p1"): DesignPage {
  return { id, name: id, source: { kind: "tree", root } };
}
function tsxPage(id = "t1"): DesignPage {
  return { id, name: id, source: { kind: "tsx", code: "export default () => null;" } };
}

describe("activeSelectedNodeId", () => {
  it("선택 없음·활성 페이지 없음 → null", () => {
    expect(activeSelectedNodeId(null, "p1")).toBeNull();
    expect(activeSelectedNodeId(undefined, "p1")).toBeNull();
    expect(activeSelectedNodeId({ pageId: "p1", nodeId: "n1" }, null)).toBeNull();
  });
  it("선택이 활성 페이지에 속할 때만 그 nodeId", () => {
    expect(activeSelectedNodeId({ pageId: "p1", nodeId: "n1" }, "p1")).toBe("n1");
    expect(activeSelectedNodeId({ pageId: "other", nodeId: "n1" }, "p1")).toBeNull();
    expect(activeSelectedNodeId({ pageId: "p1", nodeId: null }, "p1")).toBeNull(); // 페이지-only.
  });
});

describe("propHint", () => {
  it("variant 만 있으면 variant", () => {
    expect(propHint(node("n", "Button", { variant: "primary" }))).toBe("primary");
  });
  it("variant + label 은 둘 다", () => {
    expect(propHint(node("n", "Button", { variant: "ghost", label: "저장" }))).toBe('ghost · "저장"');
  });
  it("label 없으면 children 문자열을 텍스트로", () => {
    expect(propHint(node("n", "Text", { children: "안녕" }))).toBe('"안녕"');
  });
  it("긴 텍스트는 절단(…)", () => {
    const long = "x".repeat(40);
    const h = propHint(node("n", "Text", { children: long }));
    expect(h.length).toBeLessThan(long.length);
    expect(h).toContain("…");
  });
  it("관련 prop 없으면 빈 문자열", () => {
    expect(propHint(node("n", "Stack", { gap: 2 }))).toBe("");
  });
});

describe("buildStructureItems", () => {
  it("페이지 없음 → 빈 배열", () => {
    expect(buildStructureItems(null, null, () => {})).toEqual([]);
  });

  it("tsx 페이지 → 읽기 전용 코드 한 행", () => {
    const items = buildStructureItems(tsxPage(), null, () => {});
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(TSX_ROW_ID);
    expect(items[0].label).toBe("⌁ code");
    expect(items[0].isDisabled).toBe(true);
    expect(items[0].description).toContain("page.code");
    expect(items[0].onClick).toBeUndefined();
  });

  it("트리 페이지 → root 부터 재귀(type 라벨·prop 힌트·항상 펼침)", () => {
    const root = node("r", "Stack", {}, [
      node("b", "Button", { variant: "primary" }),
      node("t", "Text", { children: "hi" }),
    ]);
    const items = buildStructureItems(treePage(root), null, () => {});
    expect(items).toHaveLength(1);
    const top = items[0];
    expect(top.id).toBe("r");
    expect(top.label).toBe("Stack");
    expect(top.isExpanded).toBe(true);
    expect(top.children).toHaveLength(2);
    expect(top.children![0].label).toBe("Button");
    expect(top.children![0].description).toBe("primary");
    expect(top.children![1].description).toBe('"hi"');
  });

  it("selNodeId 로 선택 노드만 isSelected", () => {
    const root = node("r", "Stack", {}, [node("b", "Button", {})]);
    const items = buildStructureItems(treePage(root), "b", () => {});
    expect(items[0].isSelected).toBe(false);
    expect(items[0].children![0].isSelected).toBe(true);
  });

  it("노드 onClick 은 onSelect(nodeId) 를 부른다(선택 진입점)", () => {
    const root = node("r", "Stack", {}, [node("b", "Button", {})]);
    const onSelect = vi.fn();
    const items = buildStructureItems(treePage(root), null, onSelect);
    items[0].children![0].onClick!();
    expect(onSelect).toHaveBeenCalledWith("b");
  });
});

describe("TreePanel", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  function mount(el: ReactElement): HTMLElement {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(el);
    });
    return container;
  }

  it("페이지 없음 → 담백한 안내(빈 화면 금지)", () => {
    const container = mount(
      createElement(TreePanel, {
        page: null,
        selectedNodeId: null,
        execute: async () => ({ ok: true, code: "OK", message: "" }) as CommandOutcome,
      }),
    );
    expect(container.textContent).toContain("페이지가 없습니다");
  });

  it("노드 클릭 → canvas.select({pageId,nodeId}) 를 execute 로 라우팅", () => {
    const root = node("r", "Stack", {}, [node("btn", "Button", {})]);
    const execute = vi.fn(async () => ({ ok: true, code: "OK", message: "" }) as CommandOutcome);
    const container = mount(
      createElement(TreePanel, {
        page: treePage(root, "pg"),
        selectedNodeId: null,
        execute,
      }),
    );
    // 리프 라벨("Button")을 든 최하위 요소를 클릭 → 버블링이 TreeList 행 onClick 에 닿는다.
    const leaf = [...container.querySelectorAll<HTMLElement>("*")].find(
      (e) => e.children.length === 0 && e.textContent?.trim() === "Button",
    );
    expect(leaf).toBeTruthy();
    act(() => {
      leaf!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(execute).toHaveBeenCalledWith("canvas.select", { pageId: "pg", nodeId: "btn" });
  });
});
