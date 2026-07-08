// anchor-fallback 순수 배치 계산 검증. position-area 문자열별로 팝오버 좌상단이 트리거 rect 대비
// 올바른지, 뷰포트 flip/clamp 가 도는지 확인한다. 실측(WKWebView)에서 폴리필 무효를 대체한 로직이라
// 이 계산이 곧 팝오버 위치의 진실이다.
import { describe, it, expect } from "vitest";
import { computePlacement, positionPopover, type Rect } from "./anchor-fallback";

const trigger: Rect = { top: 400, bottom: 420, left: 600, right: 700, width: 100, height: 20 };
const pop = { width: 150, height: 80 };
const vp = { width: 1200, height: 900 };

describe("computePlacement — position-area 역산", () => {
  it("bottom span-right = 트리거 하단, 좌측 정렬", () => {
    const p = computePlacement("bottom span-right", trigger, pop, vp);
    expect(p.top).toBe(424); // bottom(420) + gap(4)
    expect(p.left).toBe(600); // trigger.left
  });

  it("bottom span-left = 트리거 하단, 우측 정렬", () => {
    const p = computePlacement("bottom span-left", trigger, pop, vp);
    expect(p.top).toBe(424);
    expect(p.left).toBe(550); // trigger.right(700) - pop.width(150)
  });

  it("bottom(center) = 트리거 하단, 중앙 정렬", () => {
    const p = computePlacement("bottom", trigger, pop, vp);
    expect(p.top).toBe(424);
    expect(p.left).toBe(575); // trigger.left + (100-150)/2
  });

  it("top = 트리거 위(뷰포트 여유 있으면)", () => {
    const p = computePlacement("top", trigger, pop, vp);
    expect(p.top).toBe(316); // 400 - 80 - 4
    expect(p.left).toBe(575);
  });

  it("right = 트리거 우측", () => {
    const p = computePlacement("right", trigger, pop, vp);
    expect(p.left).toBe(704); // right(700) + gap
    expect(p.top).toBe(400); // trigger.top
  });

  it("left = 트리거 좌측", () => {
    const p = computePlacement("left", trigger, pop, vp);
    expect(p.left).toBe(446); // 600 - 150 - 4
  });
});

describe("computePlacement — flip", () => {
  it("bottom 이 뷰포트 하단 넘치면 위로 flip", () => {
    const low: Rect = { top: 850, bottom: 870, left: 600, right: 700, width: 100, height: 20 };
    const p = computePlacement("bottom", low, pop, vp); // vp.height=900, below=874+80>900 → above
    expect(p.top).toBe(766); // 850 - 80 - 4
  });

  it("top 이 뷰포트 위 넘치면 아래로 flip", () => {
    const high: Rect = { top: 30, bottom: 50, left: 600, right: 700, width: 100, height: 20 };
    const p = computePlacement("top", high, pop, vp); // above = 30-80-4 <0 → below
    expect(p.top).toBe(54); // 50 + 4
  });
});

describe("computePlacement — clamp", () => {
  it("좌측 넘침을 gap 으로 클램프", () => {
    const edge: Rect = { top: 400, bottom: 420, left: 5, right: 20, width: 15, height: 20 };
    const p = computePlacement("bottom", edge, pop, vp); // center → 5+(15-150)/2 음수
    expect(p.left).toBe(4); // gap 클램프
  });

  it("우측 넘침을 클램프", () => {
    const edge: Rect = { top: 400, bottom: 420, left: 1180, right: 1195, width: 15, height: 20 };
    const p = computePlacement("bottom span-right", edge, pop, vp);
    expect(p.left).toBe(vp.width - pop.width - 4); // 1046
  });
});

describe("positionPopover — 트리거 기준 fixed 배치", () => {
  function fakeEl(rect: Partial<DOMRect>, style: Record<string, string> = {}) {
    const s: Record<string, string> = { ...style };
    return {
      style: {
        ...s,
        position: "",
        margin: "",
        top: "",
        left: "",
        getPropertyValue: (k: string) => s[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] ?? "",
      },
      getBoundingClientRect: () =>
        ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, ...rect }) as DOMRect,
    } as unknown as HTMLElement;
  }

  it("positionArea 를 읽어 트리거 하단 좌측정렬(bottom span-right)로 fixed 배치", () => {
    (globalThis as { window?: unknown }).window = { innerWidth: 1200, innerHeight: 900 };
    const pop = fakeEl({ width: 150, height: 80 }, { positionArea: "bottom span-right" });
    const trigger = fakeEl({ top: 400, bottom: 420, left: 600, right: 700, width: 100, height: 20 });
    positionPopover(pop, trigger);
    expect(pop.style.position).toBe("fixed");
    expect(pop.style.top).toBe("424px"); // trigger.bottom + gap
    expect(pop.style.left).toBe("600px"); // trigger.left
    delete (globalThis as { window?: unknown }).window;
  });

  it("positionArea 미직렬화 시 bottom 기본(WKWebView 방어)", () => {
    (globalThis as { window?: unknown }).window = { innerWidth: 1200, innerHeight: 900 };
    const pop = fakeEl({ width: 150, height: 80 }); // positionArea 없음
    const trigger = fakeEl({ top: 400, bottom: 420, left: 600, right: 700, width: 100, height: 20 });
    positionPopover(pop, trigger);
    expect(pop.style.top).toBe("424px");
    delete (globalThis as { window?: unknown }).window;
  });

  it("트리거가 렌더 안 됨(0x0) 이면 배치하지 않는다", () => {
    const pop = fakeEl({ width: 150, height: 80 }, { positionArea: "bottom" });
    const trigger = fakeEl({ width: 0, height: 0 });
    positionPopover(pop, trigger);
    expect(pop.style.position).toBe(""); // 미변경
  });
});
