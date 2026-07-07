// canvas.select / canvas.set 핸들러 통합(§5·§7·§11) — registerCommands 로 실제 등록되는 핸들러를 잡아
// 계약(세션 변이·재렌더 통지·헤드리스 ok·닫힌 에러코드)을 못박는다. 둘 다 문서가 아닌 뷰-세션을 변이하고
// store.notify() 로 재렌더를 넛지한다(persist 없음 — kv 문서엔 안 들어감). 뷰 미마운트여도 성공(§5 headless).
import { describe, it, expect, vi } from "vitest";
import { registerCommands } from "./index";
import { createStore } from "./store";
import type { CommandOutcome, DesignPage } from "../types";

type Handler = (
  params: Record<string, unknown>,
  inv?: { execute: (name: string, params?: Record<string, unknown>) => Promise<CommandOutcome> },
) => Promise<unknown> | unknown;

function harness() {
  const handlers = new Map<string, Handler>();
  const ctx = {
    subscriptions: [] as Array<{ dispose(): void } | (() => void)>,
    dir: "/tmp/soksak-design-astryx-canvas",
    manifest: { id: "soksak-plugin-design-astryx", version: "0.1.0" },
    app: {
      commands: {
        register(name: string, spec: { handler: Handler }) {
          handlers.set(name, spec.handler);
          return { dispose() {} };
        },
      },
    },
  };
  const store = createStore({ projectId: null, dir: ctx.dir });
  registerCommands(ctx as unknown as Parameters<typeof registerCommands>[0], store);
  return { handlers, store };
}

const treePage = (): DesignPage => ({
  id: "p1",
  name: "Home",
  source: {
    kind: "tree",
    root: {
      id: "n1",
      type: "Stack",
      props: {},
      children: [{ id: "n2", type: "Button", props: {}, children: [] }],
    },
  },
});
const tsxPage = (): DesignPage => ({
  id: "p2",
  name: "Landing",
  source: { kind: "tsx", code: "export default () => null", origin: "pages/landing" },
});

function isErr(v: unknown): v is { ok: false; code: string; message: string; data?: Record<string, unknown> } {
  return typeof v === "object" && v !== null && (v as { ok?: unknown }).ok === false;
}

describe("canvas.select", () => {
  it("존재 노드 선택 → 세션 변이·재렌더 통지·{pageId,nodeId,type} 반환", async () => {
    const { handlers, store } = harness();
    store.doc.pages = [treePage()];
    const rerender = vi.fn();
    store.subscribe(rerender);
    const r = await handlers.get("canvas.select")!({ pageId: "p1", nodeId: "n2" });
    expect(r).toEqual({ pageId: "p1", nodeId: "n2", type: "Button" });
    expect(store.selection).toEqual({ pageId: "p1", nodeId: "n2" });
    expect(rerender).toHaveBeenCalledTimes(1);
  });

  it("pageId 생략 시 활성 캔버스 페이지에서 선택", async () => {
    const { handlers, store } = harness();
    store.doc.pages = [treePage()];
    store.preview.activePageId = "p1";
    const r = await handlers.get("canvas.select")!({ nodeId: "n1" });
    expect(r).toEqual({ pageId: "p1", nodeId: "n1", type: "Stack" });
  });

  it("nodeId null → 노드 해제(페이지-only), type null", async () => {
    const { handlers, store } = harness();
    store.doc.pages = [treePage()];
    store.selection = { pageId: "p1", nodeId: "n2" };
    const r = await handlers.get("canvas.select")!({ pageId: "p1", nodeId: null });
    expect(r).toEqual({ pageId: "p1", nodeId: null, type: null });
    expect(store.selection).toEqual({ pageId: "p1", nodeId: null });
  });

  it("없는 노드 → NOT_FOUND(선택 불변·통지 없음)", async () => {
    const { handlers, store } = harness();
    store.doc.pages = [treePage()];
    const rerender = vi.fn();
    store.subscribe(rerender);
    const r = await handlers.get("canvas.select")!({ pageId: "p1", nodeId: "n9" });
    expect(isErr(r) && r.code).toBe("NOT_FOUND");
    expect(store.selection).toBeNull();
    expect(rerender).not.toHaveBeenCalled();
  });

  it("없는 페이지 → NOT_FOUND", async () => {
    const { handlers, store } = harness();
    store.doc.pages = [treePage()];
    const r = await handlers.get("canvas.select")!({ pageId: "p9", nodeId: null });
    expect(isErr(r) && r.code).toBe("NOT_FOUND");
  });

  it("tsx 페이지의 비-null nodeId → NOT_FOUND(노드 id 없음, §5)", async () => {
    const { handlers, store } = harness();
    store.doc.pages = [tsxPage()];
    const r = await handlers.get("canvas.select")!({ pageId: "p2", nodeId: "n2" });
    expect(isErr(r) && r.code).toBe("NOT_FOUND");
  });

  it("헤드리스(구독자 0)여도 선택은 스토어에 남는다(다음 마운트가 하이라이트)", async () => {
    const { handlers, store } = harness();
    store.doc.pages = [treePage()];
    const r = await handlers.get("canvas.select")!({ pageId: "p1", nodeId: "n2" });
    expect(isErr(r)).toBe(false);
    expect(store.selection).toEqual({ pageId: "p1", nodeId: "n2" });
  });
});

describe("canvas.set", () => {
  it("viewport 설정 → 프레이밍 변이·재렌더 통지·{viewport,background} 반환", async () => {
    const { handlers, store } = harness();
    const rerender = vi.fn();
    store.subscribe(rerender);
    const r = await handlers.get("canvas.set")!({ viewport: 768 });
    expect(r).toEqual({ viewport: 768, background: "" });
    expect(store.canvasControls).toEqual({ width: 768, background: "" });
    expect(rerender).toHaveBeenCalledTimes(1);
  });

  it("background 설정 → 원시 CSS 색(width 보존)", async () => {
    const { handlers, store } = harness();
    const r = await handlers.get("canvas.set")!({ background: "#0b1021" });
    expect(r).toEqual({ viewport: "fill", background: "#0b1021" });
    expect(store.canvasControls).toEqual({ width: "fill", background: "#0b1021" });
  });

  it("background 'neutral' → 중립 기본('')", async () => {
    const { handlers, store } = harness();
    store.canvasControls = { width: 375, background: "#000" };
    const r = await handlers.get("canvas.set")!({ background: "neutral" });
    expect(r).toEqual({ viewport: 375, background: "" });
  });

  it("나쁜 viewport → INVALID_PROP + data.validValues(프레이밍 불변·통지 없음)", async () => {
    const { handlers, store } = harness();
    const rerender = vi.fn();
    store.subscribe(rerender);
    const r = await handlers.get("canvas.set")!({ viewport: 640 });
    expect(isErr(r) && r.code).toBe("INVALID_PROP");
    if (isErr(r)) expect(r.data?.validValues).toEqual(["fill", 1280, 768, 375]);
    expect(store.canvasControls).toEqual({ width: "fill", background: "" });
    expect(rerender).not.toHaveBeenCalled();
  });

  it("viewport·background 둘 다 없음 → INVALID_ARG", async () => {
    const { handlers } = harness();
    const r = await handlers.get("canvas.set")!({});
    expect(isErr(r) && r.code).toBe("INVALID_ARG");
  });
});
