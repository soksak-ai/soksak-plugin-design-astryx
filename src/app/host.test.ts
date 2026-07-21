// @vitest-environment jsdom
// 사이드카 호스트의 레일 방출 검증 — 결부 캔버스 뷰(viewId)의 레일 컨테이너가 브리지에 등록되면 호스트가
// 그 컨테이너에 패널 서피스(standalone.html#vid=…&panel=…)를 열고, 스냅샷 push 에 rails 를 실어 캔버스
// 앱이 인라인 패널을 접게 하며, 해제되면 서피스를 닫고 rails 를 되돌리는지. 상태는 호스트 스토어 소유
// 그대로 — 레일은 표면만 옮긴다(이중 진실 0).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSidecarView, type SidecarApp, type SidecarHandle } from "./host";
import { registerRailContainer } from "./railBridge";
import { createStore } from "../commands/store";

// jsdom 미제공 관찰자·rAF 스텁 — bounds-follow 는 이 검증의 대상이 아니다(메시지 흐름만 본다).
class NoopObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
(globalThis as Record<string, unknown>).ResizeObserver ??= NoopObserver;
(globalThis as Record<string, unknown>).IntersectionObserver ??= NoopObserver;
(globalThis as Record<string, unknown>).requestAnimationFrame ??= () => 0;
(globalThis as Record<string, unknown>).cancelAnimationFrame ??= () => {};

interface Sent {
  type?: string;
  url?: string;
  id?: number;
  queryId?: number;
  response?: string;
  [k: string]: unknown;
}

function makeHarness() {
  const sent: Sent[] = [];
  const handlers = new Map<string, Array<(p: Record<string, unknown>) => void>>();
  let nextId = 100;
  const handle: SidecarHandle = {
    send: vi.fn(async (msg: Record<string, unknown>) => {
      sent.push(msg as Sent);
      if (msg.type === "create") return { id: nextId++ };
      return {};
    }),
    on(event, cb) {
      const list = handlers.get(event) ?? [];
      list.push(cb);
      handlers.set(event, list);
      return { dispose: () => {} };
    },
    close: async () => {},
  };
  const app: SidecarApp = {
    sidecar: { open: async () => handle },
    commands: { execute: vi.fn(async () => ({ ok: true, code: "OK", message: "" })) },
  };
  const store = createStore({ projectId: "p1", dir: "/plug" });
  const view = createSidecarView({ app, store, pluginId: "soksak-plugin-design-astryx", dir: "/plug" });
  const flush = async (): Promise<void> => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  };
  const emitQuery = (payload: Record<string, unknown>): void => {
    for (const cb of handlers.get("query") ?? []) cb(payload);
  };
  const creates = (): Sent[] => sent.filter((m) => m.type === "create");
  const closes = (): Sent[] => sent.filter((m) => m.type === "close");
  const lastRails = (): unknown => {
    const pushes = sent.filter((m) => m.type === "query-reply" && m.queryId === 7);
    const last = pushes[pushes.length - 1];
    return last ? (JSON.parse(last.response ?? "{}") as { rails?: unknown }).rails : undefined;
  };
  return { sent, handle, app, store, view, flush, emitQuery, creates, closes, lastRails };
}

function div(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

describe("createSidecarView — 레일 방출", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    sessionStorage.clear();
  });

  it("캔버스 서피스 URL 에 자기식별(vid)을 싣는다", async () => {
    const h = makeHarness();
    h.view.provider.mount(div(), { projectId: "p1", viewId: "v1" });
    await h.flush();
    expect(h.creates()).toHaveLength(1);
    expect(h.creates()[0].url).toBe("file:///plug/standalone.html#vid=v1");
  });

  it("레일 컨테이너 등록 → 패널 서피스 생성 + rails push, 해제 → 서피스 close + rails 복귀", async () => {
    const h = makeHarness();
    h.view.provider.mount(div(), { projectId: "p1", viewId: "v1" });
    await h.flush();
    h.emitQuery({ queryId: 7, request: JSON.stringify({ kind: "subscribe" }) });
    await h.flush();
    expect(h.lastRails()).toEqual({ v1: { structure: false, inspector: false } });

    const off = registerRailContainer("v1", "structure", div());
    await h.flush();
    const panelCreates = h.creates().filter((m) => String(m.url).includes("panel=structure"));
    expect(panelCreates).toHaveLength(1);
    expect(panelCreates[0].url).toBe("file:///plug/standalone.html#vid=v1&panel=structure");
    expect(h.lastRails()).toEqual({ v1: { structure: true, inspector: false } });

    off();
    await h.flush();
    expect(h.closes().length).toBeGreaterThanOrEqual(1);
    expect(h.lastRails()).toEqual({ v1: { structure: false, inspector: false } });
  });

  it("다른 뷰의 레일 등록에는 반응하지 않는다(결부 키 = 자기 viewId)", async () => {
    const h = makeHarness();
    h.view.provider.mount(div(), { projectId: "p1", viewId: "v1" });
    await h.flush();
    const off = registerRailContainer("other-view", "structure", div());
    await h.flush();
    expect(h.creates().filter((m) => String(m.url).includes("panel="))).toHaveLength(0);
    off();
  });

  it("캔버스 unmount → 패널 서피스까지 닫고 rails 항목을 제거한다", async () => {
    const h = makeHarness();
    const canvasEl = div();
    h.view.provider.mount(canvasEl, { projectId: "p1", viewId: "v1" });
    await h.flush();
    h.emitQuery({ queryId: 7, request: JSON.stringify({ kind: "subscribe" }) });
    const off = registerRailContainer("v1", "inspector", div());
    await h.flush();
    expect(h.lastRails()).toEqual({ v1: { structure: false, inspector: true } });

    h.view.provider.unmount?.(canvasEl);
    await h.flush();
    expect(h.closes().length).toBeGreaterThanOrEqual(2); // 패널 + 캔버스.
    expect(h.lastRails()).toEqual({});
    off();
  });
});
