import { describe, it, expect, vi } from "vitest";
import {
  freshDoc,
  docKey,
  coerceDoc,
  createStore,
  activePagePayload,
  reconcileSelection,
  type DataKv,
} from "./store";
import type { DesignDoc, DesignNode, DesignPage } from "../types";

const goodNode = (): DesignNode => ({ id: "n1", type: "Stack", props: {}, children: [] });
// v2 페이지 — 소스 판별 유니온. tree 페이지는 source.root, tsx 페이지는 source.code 가 진실.
const treePage = (): DesignPage => ({
  id: "p1",
  name: "Home",
  source: { kind: "tree", root: goodNode() },
});
const tsxPage = (): DesignPage => ({
  id: "p2",
  name: "Landing",
  source: { kind: "tsx", code: "export default function P(){return null;}", origin: "pages/landing" },
});
const goodDoc = (): DesignDoc => ({
  version: 1,
  activeTheme: "matcha",
  mode: "system",
  pages: [treePage()],
  seq: 1,
});

describe("freshDoc", () => {
  it("빈 문서는 neutral 테마·system 모드·페이지 0·seq 0", () => {
    expect(freshDoc()).toEqual({
      version: 1,
      activeTheme: "neutral",
      mode: "system",
      pages: [],
      seq: 0,
    });
  });
});

describe("docKey", () => {
  it("프로젝트 id 로 파티션, 없으면 _global", () => {
    expect(docKey("proj-a")).toBe("doc:proj-a");
    expect(docKey(null)).toBe("doc:_global");
    expect(docKey(undefined)).toBe("doc:_global");
  });
});

describe("coerceDoc", () => {
  it("유효 v2 tree 문서는 통과", () => {
    expect(coerceDoc(goodDoc())).toEqual(goodDoc());
  });

  it("v2 tsx 페이지는 code·origin 보존", () => {
    const raw = { version: 1, activeTheme: "neutral", mode: "system", pages: [tsxPage()], seq: 2 };
    const d = coerceDoc(raw);
    expect(d.pages[0]).toEqual(tsxPage());
  });

  it("tsx 페이지의 origin 부재는 그대로(키 없음) 보존", () => {
    const raw = {
      version: 1,
      activeTheme: "neutral",
      pages: [{ id: "p9", name: "Bare", source: { kind: "tsx", code: "export default ()=>null" } }],
      seq: 9,
    };
    const d = coerceDoc(raw);
    expect(d.pages[0].source).toEqual({ kind: "tsx", code: "export default ()=>null" });
  });

  it("v1 root-only 페이지는 tree source 로 승격(마이그레이션 파일 없음)", () => {
    const v1 = {
      version: 1,
      activeTheme: "neutral",
      pages: [{ id: "p1", name: "Home", root: goodNode() }],
      seq: 1,
    };
    const d = coerceDoc(v1);
    expect(d.pages[0]).toEqual({ id: "p1", name: "Home", source: { kind: "tree", root: goodNode() } });
  });

  it("소스 부재·손상 페이지는 빈 tree 페이지로 복구(드랍 아님), 루트 id 는 seq 에서 발급", () => {
    const raw = {
      version: 1,
      activeTheme: "neutral",
      pages: [{ id: "p3", name: "x", root: { id: "n" } }], // root 가 nodeish 아님 + source 부재
      seq: 1,
    };
    const d = coerceDoc(raw);
    expect(d.pages).toHaveLength(1);
    expect(d.pages[0].id).toBe("p3");
    const src = d.pages[0].source;
    expect(src.kind).toBe("tree");
    if (src.kind === "tree") {
      expect(src.root.type).toBe("Stack");
      expect(src.root.props).toEqual({});
      expect(src.root.children).toEqual([]);
      expect(src.root.id).toBe("n2"); // ++seq: 1 → 2
    }
    expect(d.seq).toBe(2); // 발급으로 seq 증가
  });

  it("id/name 없는 항목만 드랍(id 만·junk·숫자), 페이지-ish 는 복구", () => {
    const raw = {
      version: 1,
      activeTheme: "neutral",
      pages: [treePage(), { id: "p2" }, "junk", 42],
      seq: 1,
    };
    const d = coerceDoc(raw);
    expect(d.pages).toHaveLength(1);
    expect(d.pages[0].id).toBe("p1");
  });

  it("객체가 아니면 신선 문서", () => {
    expect(coerceDoc(null)).toEqual(freshDoc());
    expect(coerceDoc("x")).toEqual(freshDoc());
    expect(coerceDoc(42)).toEqual(freshDoc());
  });

  it("version 이 1 이 아니면 신선 문서", () => {
    expect(coerceDoc({ version: 2, activeTheme: "matcha", pages: [], seq: 0 })).toEqual(freshDoc());
  });

  it("미지 테마는 neutral 로 강제", () => {
    const d = coerceDoc({ version: 1, activeTheme: "rainbow", pages: [], seq: 0 });
    expect(d.activeTheme).toBe("neutral");
  });

  it("mode 부재(구 문서)·미지 값은 system 으로 강제, 유효 값은 보존", () => {
    // 구 문서엔 mode 필드가 없다 → system.
    expect(coerceDoc({ version: 1, activeTheme: "neutral", pages: [], seq: 0 }).mode).toBe("system");
    // 미지 값도 system.
    expect(
      coerceDoc({ version: 1, activeTheme: "neutral", mode: "sepia", pages: [], seq: 0 }).mode,
    ).toBe("system");
    // 유효 값은 그대로.
    expect(
      coerceDoc({ version: 1, activeTheme: "neutral", mode: "dark", pages: [], seq: 0 }).mode,
    ).toBe("dark");
    expect(
      coerceDoc({ version: 1, activeTheme: "gothic", mode: "light", pages: [], seq: 0 }).mode,
    ).toBe("light");
  });

  it("seq 는 음수·비수를 0 으로", () => {
    expect(coerceDoc({ version: 1, activeTheme: "neutral", pages: [], seq: -5 }).seq).toBe(0);
    expect(coerceDoc({ version: 1, activeTheme: "neutral", pages: [], seq: "x" }).seq).toBe(0);
    expect(coerceDoc({ version: 1, activeTheme: "neutral", pages: [], seq: 7.9 }).seq).toBe(7);
  });

  it("pages 가 배열이 아니면 빈 배열", () => {
    expect(coerceDoc({ version: 1, activeTheme: "neutral", pages: {}, seq: 0 }).pages).toEqual([]);
  });
});

// 인메모리 가짜 kv — get/set/watch. set 이 watch 콜백을 발화(코어 data-change 브로드캐스트 모사).
function fakeKv(initial?: unknown): DataKv & { fire: (key: string | null) => void; store: Map<string, unknown> } {
  const map = new Map<string, unknown>();
  const watchers = new Set<(k: string | null) => void>();
  if (initial !== undefined) map.set("doc:_global", initial);
  return {
    store: map,
    async get(k) {
      return map.get(k);
    },
    async set(k, v) {
      map.set(k, v);
    },
    watch(cb) {
      watchers.add(cb);
      return { dispose: () => watchers.delete(cb) };
    },
    fire(k) {
      for (const w of watchers) w(k);
    },
  };
}

describe("createStore", () => {
  it("kv 없으면 신선 문서로 시작", () => {
    const s = createStore({ kv: undefined, projectId: null, dir: "/x" });
    expect(s.doc).toEqual(freshDoc());
    expect(s.dir).toBe("/x");
    // v3 세션 상태는 활성 캔버스 페이지 하나뿐 — engine/url/server 는 제거됐다(§7·§11).
    expect(s.preview).toEqual({ activePageId: null });
  });

  it("hydrate 는 kv 에서 문서를 복원", async () => {
    const kv = fakeKv(goodDoc());
    const s = createStore({ kv, projectId: null, dir: "/x" });
    expect(s.doc).toEqual(freshDoc()); // 동기 구성 시점엔 신선
    await s.hydrate();
    expect(s.doc).toEqual(goodDoc()); // 하이드레이트 후 복원
  });

  it("hydrate 는 깨진 값을 신선 문서로 강제", async () => {
    const kv = fakeKv({ version: 9 });
    const s = createStore({ kv, projectId: null, dir: "/x" });
    await s.hydrate();
    expect(s.doc).toEqual(freshDoc());
  });

  it("persist 는 현재 doc 를 kv 키에 기록", async () => {
    const kv = fakeKv();
    const s = createStore({ kv, projectId: "proj-a", dir: "/x" });
    s.doc = goodDoc();
    await s.persist();
    expect(kv.store.get("doc:proj-a")).toEqual(goodDoc());
  });

  it("외부 변경(watch)은 재수화 + onChange 호출", async () => {
    const kv = fakeKv(freshDoc());
    const onChange = vi.fn();
    const s = createStore({ kv, projectId: null, dir: "/x", onChange });
    await s.hydrate();
    // 다른 창이 문서를 바꿈.
    await kv.set("doc:_global", goodDoc());
    kv.fire("doc:_global");
    await Promise.resolve(); // rehydrate microtask
    await Promise.resolve();
    expect(s.doc).toEqual(goodDoc());
    expect(onChange).toHaveBeenCalled();
  });

  it("다른 프로젝트 키 변경은 무시", async () => {
    const kv = fakeKv(goodDoc());
    const s = createStore({ kv, projectId: null, dir: "/x" });
    await s.hydrate();
    const before = s.doc;
    kv.fire("doc:other");
    await Promise.resolve();
    expect(s.doc).toBe(before);
  });

  it("dispose 후에는 watch 발화가 재수화를 안 일으킨다", async () => {
    const kv = fakeKv(freshDoc());
    const s = createStore({ kv, projectId: null, dir: "/x" });
    s.dispose();
    await kv.set("doc:_global", goodDoc());
    kv.fire("doc:_global");
    await Promise.resolve();
    expect(s.doc).toEqual(freshDoc());
  });
});

// ── 라이브 바인딩(§7 Live law): subscribe/notify/persist 재렌더 통지 ─────────────
describe("subscribe/notify", () => {
  it("persist 는 kv 없이도 구독자를 발화한다(변이 재렌더 — 뷰가 마운트만 되면 kv 무관)", async () => {
    const s = createStore({ kv: undefined, projectId: null, dir: "/x" });
    const cb = vi.fn();
    s.subscribe(cb);
    await s.persist();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("notify 는 구독자를 직접 발화한다(preview.open/refresh 의 activePageId 변경 경로)", () => {
    const s = createStore({ kv: undefined, projectId: null, dir: "/x" });
    const cb = vi.fn();
    s.subscribe(cb);
    s.notify();
    s.notify();
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("subscribe 반환 함수로 해제하면 더 이상 발화하지 않는다", () => {
    const s = createStore({ kv: undefined, projectId: null, dir: "/x" });
    const cb = vi.fn();
    const off = s.subscribe(cb);
    s.notify();
    off();
    s.notify();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("한 구독자의 예외가 다른 구독자를 막지 않는다(격리)", () => {
    const s = createStore({ kv: undefined, projectId: null, dir: "/x" });
    const boom = vi.fn(() => {
      throw new Error("render crash");
    });
    const ok = vi.fn();
    s.subscribe(boom);
    s.subscribe(ok);
    expect(() => s.notify()).not.toThrow();
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it("opts.onChange 는 하나의 구독자로 등록된다(하이드레이트가 발화)", async () => {
    const kv = fakeKv(goodDoc());
    const onChange = vi.fn();
    const s = createStore({ kv, projectId: null, dir: "/x", onChange });
    await s.hydrate();
    expect(onChange).toHaveBeenCalled();
  });
});

// ── activePagePayload: 활성 페이지 → 렌더 코어 페이로드 투영(§7) ─────────────────
describe("activePagePayload", () => {
  it("활성 페이지가 없으면 null", () => {
    const s = createStore({ kv: undefined, projectId: null, dir: "/x" });
    s.doc = goodDoc();
    expect(activePagePayload(s)).toBeNull();
  });

  it("활성 페이지 id 가 문서에 없으면 null(삭제된 페이지 방어)", () => {
    const s = createStore({ kv: undefined, projectId: null, dir: "/x" });
    s.doc = goodDoc();
    s.preview.activePageId = "p-gone";
    expect(activePagePayload(s)).toBeNull();
  });

  it("tree 페이지 → tree RunnerPage + 문서 테마/모드", () => {
    const s = createStore({ kv: undefined, projectId: null, dir: "/x" });
    s.doc = goodDoc(); // matcha·system, tree 페이지 p1
    s.preview.activePageId = "p1";
    expect(activePagePayload(s)).toEqual({
      theme: "matcha",
      mode: "system",
      page: { kind: "tree", root: goodNode() },
    });
  });

  it("tsx 페이지 → tsx RunnerPage(code, origin 제외)", () => {
    const s = createStore({ kv: undefined, projectId: null, dir: "/x" });
    s.doc = { version: 1, activeTheme: "gothic", mode: "dark", pages: [tsxPage()], seq: 2 };
    s.preview.activePageId = "p2";
    expect(activePagePayload(s)).toEqual({
      theme: "gothic",
      mode: "dark",
      page: { kind: "tsx", code: "export default function P(){return null;}" },
    });
  });

  it("문서 mode 부재 시 페이로드 mode 는 system(§9)", () => {
    const s = createStore({ kv: undefined, projectId: null, dir: "/x" });
    s.doc = { version: 1, activeTheme: "neutral", pages: [treePage()], seq: 1 };
    s.preview.activePageId = "p1";
    expect(activePagePayload(s)?.mode).toBe("system");
  });
});

// ── 뷰-세션 필드(§7·§11): selection·canvasControls — 영속 안 함, 명령으로 몰아 헤드리스 ─────────
describe("뷰-세션 필드 초기값", () => {
  it("selection 은 null, canvasControls 는 fill·중립 배경(freshCanvasControls)", () => {
    const s = createStore({ kv: undefined, projectId: null, dir: "/x" });
    expect(s.selection).toBeNull();
    expect(s.canvasControls).toEqual({ width: "fill", background: "" });
  });
});

describe("reconcileSelection", () => {
  it("null 선택은 null", () => {
    expect(reconcileSelection(goodDoc(), null)).toBeNull();
  });

  it("페이지가 사라지면 선택 전체 해제(null)", () => {
    expect(reconcileSelection(goodDoc(), { pageId: "p-gone", nodeId: "n1" })).toBeNull();
  });

  it("페이지-only 선택(nodeId null)은 페이지가 있으면 유지", () => {
    const sel = { pageId: "p1", nodeId: null };
    expect(reconcileSelection(goodDoc(), sel)).toEqual(sel);
  });

  it("살아있는 노드 선택은 그대로 유지(동일 참조)", () => {
    const sel = { pageId: "p1", nodeId: "n1" };
    expect(reconcileSelection(goodDoc(), sel)).toBe(sel);
  });

  it("사라진 노드 선택은 nodeId 만 null 로(페이지는 유지)", () => {
    expect(reconcileSelection(goodDoc(), { pageId: "p1", nodeId: "n-gone" })).toEqual({
      pageId: "p1",
      nodeId: null,
    });
  });

  it("tsx 페이지의 노드 선택은 정리(노드 id 없음)", () => {
    const d: DesignDoc = { version: 1, activeTheme: "neutral", mode: "system", pages: [tsxPage()], seq: 2 };
    expect(reconcileSelection(d, { pageId: "p2", nodeId: "n2" })).toEqual({ pageId: "p2", nodeId: null });
  });
});

describe("persist 는 선택을 정합한다(재렌더 통지 전)", () => {
  it("죽은 노드 선택은 persist 후 nodeId 가 정리된다", async () => {
    const s = createStore({ kv: undefined, projectId: null, dir: "/x" });
    s.doc = goodDoc();
    s.selection = { pageId: "p1", nodeId: "n-removed" }; // 문서에 없는 노드
    await s.persist();
    expect(s.selection).toEqual({ pageId: "p1", nodeId: null });
  });

  it("살아있는 선택은 persist 후 보존", async () => {
    const s = createStore({ kv: undefined, projectId: null, dir: "/x" });
    s.doc = goodDoc();
    s.selection = { pageId: "p1", nodeId: "n1" };
    await s.persist();
    expect(s.selection).toEqual({ pageId: "p1", nodeId: "n1" });
  });
});
