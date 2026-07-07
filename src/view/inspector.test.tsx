// @vitest-environment jsdom
// 인스펙터 렌더·dispatch 검증(§7 Inspector law) — 실 react+astryx 로 상태 분기(빈/​tsx/​미지/​폼)와
// 편집→comp.set 디바운스 dispatch, 실패 인라인 오류를 jsdom 에서 실제로 돌린다. 순수 파생은 prop-form
// 테스트가 덮고, 여기선 컨트롤 배선(값 바인딩·onChange→execute·상태 텍스트)만 얇게 친다.
import { describe, it, expect, beforeEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Inspector } from "./inspector";
import type { CatalogEntry, CatalogPropSpec, CommandOutcome, DesignNode, DesignPage } from "../types";
import type { ExecuteCommand } from "./model";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function spec(p: Partial<CatalogPropSpec> & { type: string }): CatalogPropSpec {
  return { required: false, description: "", ...p };
}

// Button 유사 엔트리 — label(string) 이 첫 텍스트 입력이 되도록 순서 고정.
function buttonEntry(): CatalogEntry {
  return {
    type: "Button",
    importName: "Button",
    description: "button",
    acceptsChildren: true,
    props: {
      label: spec({ type: "string", required: true, description: "the label" }),
      variant: spec({ type: "'primary' | 'secondary'", enum: ["primary", "secondary"], default: "'secondary'" }),
      isLoading: spec({ type: "boolean" }),
      gap: spec({ type: "SpacingStep" }),
      onClick: spec({ type: "(e: MouseEvent) => void" }),
    },
  };
}

function treePage(id: string, node: DesignNode): DesignPage {
  return { id, name: id, source: { kind: "tree", root: node } };
}

let container: HTMLDivElement;
let root: Root;

function render(props: Parameters<typeof Inspector>[0]): void {
  act(() => {
    root.render(<Inspector {...props} />);
  });
}

// jsdom 네이티브 세터로 값 주입 후 input 이벤트 발화 → React onChange 경로.
function typeInto(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  document.body.innerHTML = "";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

const noopExec: ExecuteCommand = async () => ({ ok: true, code: "OK", message: "" });

describe("Inspector — 상태 분기", () => {
  it("선택 노드 없음 → 안내", () => {
    render({ page: null, node: null, entry: null, execute: noopExec });
    expect(container.textContent).toContain("Select a node");
  });

  it("tsx 페이지 → 읽기전용 고지(page.code.get/set 로 안내)", () => {
    const page: DesignPage = { id: "t1", name: "T", source: { kind: "tsx", code: "x" } };
    render({ page, node: null, entry: null, execute: noopExec });
    expect(container.textContent).toContain("This page is TSX");
    expect(container.textContent).toContain("page.code");
  });

  it("미지 타입(엔트리 없음) → 방어 고지", () => {
    const node: DesignNode = { id: "n1", type: "Ghost", props: {}, children: [] };
    render({ page: treePage("p1", node), node, entry: null, execute: noopExec });
    expect(container.textContent).toContain("Unknown component");
    expect(container.textContent).toContain("Ghost");
  });

  it("폼: 편집 필드 라벨을 그리고 readonly(콜백) 를 요약한다", () => {
    const node: DesignNode = { id: "n2", type: "Button", props: { label: "Save" }, children: [] };
    render({ page: treePage("p1", node), node, entry: buttonEntry(), execute: noopExec });
    const txt = container.textContent ?? "";
    // 헤더(type + id).
    expect(txt).toContain("Button");
    expect(txt).toContain("n2");
    // 편집 필드 라벨.
    expect(txt).toContain("label");
    expect(txt).toContain("variant");
    expect(txt).toContain("gap");
    // 현재 값 바인딩(label 텍스트 입력에 "Save").
    const first = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(first.value).toBe("Save");
    // 콜백 prop 은 편집 컨트롤이 아니라 readonly 요약에.
    expect(txt).toContain("Read-only");
    expect(txt).toContain("onClick");
  });
});

describe("Inspector — 편집 dispatch", () => {
  it("string 필드 편집이 comp.set 을 디바운스 dispatch(300ms 전엔 미발화)", async () => {
    const calls: { name: string; params?: Record<string, unknown> }[] = [];
    const execute: ExecuteCommand = async (name, params) => {
      calls.push({ name, params });
      return { ok: true, code: "OK", message: "" };
    };
    const node: DesignNode = { id: "n5", type: "Button", props: { label: "Save" }, children: [] };
    render({ page: treePage("p1", node), node, entry: buttonEntry(), execute });

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    typeInto(input, "Cancel");
    // 디바운스 창 안 — 아직 미발화.
    expect(calls.length).toBe(0);

    await act(async () => {
      await sleep(360);
    });
    expect(calls.length).toBe(1);
    expect(calls[0].name).toBe("comp.set");
    expect(calls[0].params).toEqual({ pageId: "p1", nodeId: "n5", props: { label: "Cancel" } });
  });

  it("연속 입력은 마지막 한 번만 dispatch(디바운스 병합)", async () => {
    const calls: unknown[] = [];
    const execute: ExecuteCommand = async (_n, p) => {
      calls.push(p);
      return { ok: true, code: "OK", message: "" };
    };
    const node: DesignNode = { id: "n6", type: "Button", props: { label: "A" }, children: [] };
    render({ page: treePage("p1", node), node, entry: buttonEntry(), execute });
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    typeInto(input, "AB");
    typeInto(input, "ABC");
    await act(async () => {
      await sleep(360);
    });
    expect(calls.length).toBe(1);
    expect(calls[0]).toEqual({ pageId: "p1", nodeId: "n6", props: { label: "ABC" } });
  });

  it("실패 outcome(INVALID_PROP)은 필드에 인라인 오류로 뜬다", async () => {
    const execute: ExecuteCommand = async (): Promise<CommandOutcome> => ({
      ok: false,
      code: "INVALID_PROP",
      message: "bad-prop-value",
    });
    const node: DesignNode = { id: "n7", type: "Button", props: { label: "Save" }, children: [] };
    render({ page: treePage("p1", node), node, entry: buttonEntry(), execute });
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    typeInto(input, "X");
    await act(async () => {
      await sleep(360);
    });
    expect(container.textContent).toContain("bad-prop-value");
  });
});
