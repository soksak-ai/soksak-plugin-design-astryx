// preview.open / preview.refresh / theme.set 핸들러 통합 — v3 인앱 캔버스 뷰 배선(§5·§7 View law).
// 브라우저 구동(v2 emitAndDrive/probe/navigate)이 제거되고, preview.* 는 store.activePageId 를 세팅하고
// inv.execute("plugin.view.open") 로 캔버스를 열거나 store.notify 로 라이브 재렌더를 넛지한다. 이 파일은
// registerCommands 로 실제 등록되는 핸들러를 잡아 그 계약(활성 페이지·뷰 열기 호출·opened 매핑·헤드리스
// 완결·재렌더 통지)을 못박는다. 모델은 순수(catalog 불요 — preview.* 는 노드를 안 만든다)라 doc 를 직접 만든다.
import { describe, it, expect, vi } from "vitest";
import { registerCommands } from "./index";
import { createStore } from "./store";
import type { CommandOutcome, DesignPage } from "../types";

type Handler = (
  params: Record<string, unknown>,
  inv?: { execute: (name: string, params?: Record<string, unknown>) => Promise<CommandOutcome> },
) => Promise<unknown> | unknown;

// registerCommands 를 가짜 ctx 로 구동해 name→handler 를 수집한다(핸들러는 지연 — 등록 시 호출 안 함).
function harness() {
  const handlers = new Map<string, Handler>();
  const ctx = {
    subscriptions: [] as Array<{ dispose(): void } | (() => void)>,
    dir: "/tmp/soksak-design-astryx-preview",
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
  source: { kind: "tree", root: { id: "n1", type: "Stack", props: {}, children: [] } },
});
const tsxPage = (): DesignPage => ({
  id: "p2",
  name: "Landing",
  source: { kind: "tsx", code: "export default () => null", origin: "pages/landing" },
});

// 가짜 inv — plugin.view.open 호출을 기록하고 지정한 결과를 돌려준다.
function fakeInv(result: CommandOutcome) {
  const calls: Array<{ name: string; params?: Record<string, unknown> }> = [];
  return {
    calls,
    execute: async (name: string, params?: Record<string, unknown>) => {
      calls.push({ name, params });
      return result;
    },
  };
}
const opened = (existing?: boolean): CommandOutcome => ({
  ok: true,
  code: "OK",
  message: "opened",
  data: existing === undefined ? {} : { existing },
});

function isErr(v: unknown): v is { ok: false; code: string; message: string } {
  return typeof v === "object" && v !== null && (v as { ok?: unknown }).ok === false;
}

describe("preview.open", () => {
  it("pageId 없으면 NOT_FOUND(뷰를 열지 않음)", async () => {
    const { handlers, store } = harness();
    store.doc.pages = [treePage()];
    const inv = fakeInv(opened());
    const r = await handlers.get("preview.open")!({}, inv);
    expect(isErr(r) && r.code).toBe("NOT_FOUND");
    expect(inv.calls).toHaveLength(0);
    expect(store.preview.activePageId).toBeNull();
  });

  it("없는 페이지면 NOT_FOUND(활성 페이지 미변경)", async () => {
    const { handlers, store } = harness();
    store.doc.pages = [treePage()];
    const inv = fakeInv(opened());
    const r = await handlers.get("preview.open")!({ pageId: "p9" }, inv);
    expect(isErr(r) && r.code).toBe("NOT_FOUND");
    expect(store.preview.activePageId).toBeNull();
  });

  it("활성 페이지를 먼저 세팅하고 재렌더 통지 후 캔버스 뷰를 연다(§5 순서)", async () => {
    const { handlers, store } = harness();
    store.doc.pages = [treePage(), tsxPage()];
    const rerender = vi.fn();
    store.subscribe(rerender);
    const inv = fakeInv(opened(false));
    const r = await handlers.get("preview.open")!({ pageId: "p2" }, inv);
    expect(r).toEqual({ pageId: "p2", opened: true });
    expect(store.preview.activePageId).toBe("p2");
    expect(rerender).toHaveBeenCalled(); // 이미 열린 뷰 즉시 재렌더
    // 계약 고정: plugin.view.open{ view:"<id>.canvas", placement:"content" } 를 inv.execute 로.
    expect(inv.calls).toEqual([
      {
        name: "plugin.view.open",
        params: { view: "soksak-plugin-design-astryx.canvas", placement: "content" },
      },
    ]);
  });

  it("existing=true(기존 탭 포커스) → opened=false", async () => {
    const { handlers, store } = harness();
    store.doc.pages = [treePage()];
    const r = await handlers.get("preview.open")!({ pageId: "p1" }, fakeInv(opened(true)));
    expect(r).toEqual({ pageId: "p1", opened: false });
  });

  it("existing 부재 → opened=true(새 탭)", async () => {
    const { handlers, store } = harness();
    store.doc.pages = [treePage()];
    const r = await handlers.get("preview.open")!({ pageId: "p1" }, fakeInv(opened()));
    expect(r).toEqual({ pageId: "p1", opened: true });
  });

  it("plugin.view.open 비-ok → PREVIEW_FAILED(활성 페이지는 세팅된 채 유지)", async () => {
    const { handlers, store } = harness();
    store.doc.pages = [treePage()];
    const inv = fakeInv({ ok: false, code: "INTERNAL", message: "no active project" });
    const r = await handlers.get("preview.open")!({ pageId: "p1" }, inv);
    expect(isErr(r) && r.code).toBe("PREVIEW_FAILED");
    expect(store.preview.activePageId).toBe("p1");
  });

  it("실행 컨텍스트(inv) 부재 → PREVIEW_FAILED", async () => {
    const { handlers, store } = harness();
    store.doc.pages = [treePage()];
    const r = await handlers.get("preview.open")!({ pageId: "p1" });
    expect(isErr(r) && r.code).toBe("PREVIEW_FAILED");
  });
});

describe("preview.refresh", () => {
  it("명시 pageId 를 활성으로 세팅하고 재렌더 통지(뷰 미마운트여도 성공 no-op)", async () => {
    const { handlers, store } = harness();
    store.doc.pages = [treePage(), tsxPage()];
    const rerender = vi.fn();
    store.subscribe(rerender);
    const r = await handlers.get("preview.refresh")!({ pageId: "p2" });
    expect(r).toEqual({ pageId: "p2" });
    expect(store.preview.activePageId).toBe("p2");
    expect(rerender).toHaveBeenCalledTimes(1);
  });

  it("명시 pageId 가 없는 페이지면 NOT_FOUND", async () => {
    const { handlers, store } = harness();
    store.doc.pages = [treePage()];
    const r = await handlers.get("preview.refresh")!({ pageId: "p9" });
    expect(isErr(r) && r.code).toBe("NOT_FOUND");
  });

  it("미설정 상태에서 pageId 없이 부르면 첫 페이지로 정렬", async () => {
    const { handlers, store } = harness();
    store.doc.pages = [treePage(), tsxPage()];
    const r = await handlers.get("preview.refresh")!({});
    expect(r).toEqual({ pageId: "p1" });
    expect(store.preview.activePageId).toBe("p1");
  });

  it("활성 페이지가 삭제됐으면 첫 페이지로 재정렬", async () => {
    const { handlers, store } = harness();
    store.doc.pages = [treePage(), tsxPage()];
    store.preview.activePageId = "p-gone";
    const r = await handlers.get("preview.refresh")!({});
    expect(r).toEqual({ pageId: "p1" });
  });

  it("페이지가 없으면 활성은 null(헤드리스 완결, 실패 아님)", async () => {
    const { handlers, store } = harness();
    store.doc.pages = [];
    const r = await handlers.get("preview.refresh")!({});
    expect(r).toEqual({ pageId: null });
  });
});

describe("theme.set (라이브 재렌더 — 브라우저 구동 없음)", () => {
  it("성공은 {theme, mode} 만(previewRefreshed 제거) + persist 로 재렌더 통지", async () => {
    const { handlers, store } = harness();
    const rerender = vi.fn();
    store.subscribe(rerender);
    const r = await handlers.get("theme.set")!({ theme: "matcha", mode: "dark" });
    expect(r).toEqual({ theme: "matcha", mode: "dark" });
    expect(store.doc.activeTheme).toBe("matcha");
    expect(store.doc.mode).toBe("dark");
    expect(rerender).toHaveBeenCalled();
  });

  it("gothic + light 는 INVALID_PROP 로 거부(문서 불변·재렌더 없음)", async () => {
    const { handlers, store } = harness();
    store.doc.activeTheme = "neutral";
    const rerender = vi.fn();
    store.subscribe(rerender);
    const r = await handlers.get("theme.set")!({ theme: "gothic", mode: "light" });
    expect(isErr(r) && r.code).toBe("INVALID_PROP");
    expect(store.doc.activeTheme).toBe("neutral");
    expect(rerender).not.toHaveBeenCalled();
  });
});
