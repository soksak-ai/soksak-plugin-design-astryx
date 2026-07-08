// @vitest-environment jsdom
// 발견 패널 검증 — Meta CommandPalette 마운트 + 발견 트리(browser-panel)를 jsdom 에서 실제로 친다. 순수
// 판정(resolveDispatch 등)은 browser.test 가 소유하고, 여기는 얇은 배선(트리 리프 클릭 → execute, 검색 버튼
// → 팔레트 open)만 확인한다.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act } from "react";
import { createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import type { CommandOutcome } from "../types";
import { BrowserPanel } from "./browser-panel";
import type { ComponentRef, TemplateRef } from "./browser";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TEMPLATES: TemplateRef[] = [
  { id: "pages/dashboard", kind: "page", name: "Dashboard", available: true },
  { id: "blocks/components/AlertDialog/AlertDialogAsyncAction", kind: "block", name: "Alert Dialog Async Action", available: true },
];
const COMPONENTS: ComponentRef[] = [{ type: "Button", group: "Button", description: "A button." }];

function mount(el: ReactElement): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(el);
  });
  return container;
}

function panel(execute = vi.fn(async () => ({ ok: true, code: "OK", message: "" }) as CommandOutcome)) {
  return {
    execute,
    el: createElement(BrowserPanel, {
      templates: TEMPLATES,
      components: COMPONENTS,
      activeId: null,
      dispatchCtx: { activeTreePageId: null, selectedNodeId: null },
      execute,
    }),
  };
}

describe("BrowserPanel", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("발견 트리 두 루트(Templates·Components)와 검색 버튼을 그린다", () => {
    const { el } = panel();
    const container = mount(el);
    expect(container.textContent).toContain("Templates");
    expect(container.textContent).toContain("Components");
    expect(container.textContent).toContain("Dashboard");
    expect(container.querySelector('[data-testid="browser-search"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="discovery-tree"]')).toBeTruthy();
  });

  it("템플릿 리프 클릭 → template.apply({id}) 를 execute 로 라우팅", () => {
    const { el, execute } = panel();
    const container = mount(el);
    const leaf = [...container.querySelectorAll<HTMLElement>("*")].find(
      (e) => e.children.length === 0 && e.textContent?.trim() === "Dashboard",
    );
    expect(leaf).toBeTruthy();
    act(() => {
      leaf!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(execute).toHaveBeenCalledWith("template.apply", { id: "pages/dashboard" });
  });

  it("Components 그룹 리프(block)도 template.apply 로 적용", () => {
    // 그룹은 활성 자식이 있을 때만 펼침 → activeId 로 AlertDialog 그룹을 펼쳐 리프를 DOM 에 낸다.
    const execute = vi.fn(async () => ({ ok: true, code: "OK", message: "" }) as CommandOutcome);
    const el = createElement(BrowserPanel, {
      templates: TEMPLATES,
      components: COMPONENTS,
      activeId: "blocks/components/AlertDialog/AlertDialogAsyncAction",
      dispatchCtx: { activeTreePageId: null, selectedNodeId: null },
      execute,
    });
    const container = mount(el);
    const leaf = [...container.querySelectorAll<HTMLElement>("*")].find(
      (e) => e.children.length === 0 && e.textContent?.trim() === "Async Action",
    );
    expect(leaf).toBeTruthy();
    act(() => {
      leaf!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(execute).toHaveBeenCalledWith("template.apply", {
      id: "blocks/components/AlertDialog/AlertDialogAsyncAction",
    });
  });

  // 팔레트 open 후 동작(검색 선택 → resolveDispatch → execute)은 순수 판정(browser.test resolveDispatch)이
  // 소유한다. astryx CommandPalette 는 jsdom 에서 open 전이 시 자체 훅 규칙을 위반하므로(useTransition 조건부)
  // open 상태를 여기서 렌더하지 않는다 — 닫힌 팔레트 마운트만 검증한다.
});
