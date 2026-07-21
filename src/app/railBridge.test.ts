// @vitest-environment jsdom
// 레일 브리지 검증 — rail 뷰(구조/인스펙터)가 등록한 컨테이너를 결부 캔버스 뷰 id 로 찾고, 등록/해제가
// 구독자에게 통지되는지. 브리지는 순수 레지스트리다(상태 소유 없음) — 키 = 결부 콘텐츠 뷰 viewId.
import { describe, it, expect, vi } from "vitest";
import { registerRailContainer, railContainer, subscribeRail } from "./railBridge";

function el(): HTMLElement {
  return document.createElement("div");
}

describe("railBridge", () => {
  it("등록한 컨테이너를 (viewId, slot) 으로 찾는다 — 미등록·null viewId 는 null", () => {
    const a = el();
    const off = registerRailContainer("v1", "structure", a);
    expect(railContainer("v1", "structure")).toBe(a);
    expect(railContainer("v1", "inspector")).toBeNull();
    expect(railContainer("v2", "structure")).toBeNull();
    expect(railContainer(null, "structure")).toBeNull();
    expect(railContainer(undefined, "structure")).toBeNull();
    off();
    expect(railContainer("v1", "structure")).toBeNull();
  });

  it("두 슬롯을 독립 등록·해제한다(한 슬롯 해제가 다른 슬롯을 지우지 않음)", () => {
    const s = el();
    const i = el();
    const offS = registerRailContainer("v1", "structure", s);
    const offI = registerRailContainer("v1", "inspector", i);
    offS();
    expect(railContainer("v1", "structure")).toBeNull();
    expect(railContainer("v1", "inspector")).toBe(i);
    offI();
    expect(railContainer("v1", "inspector")).toBeNull();
  });

  it("등록·해제마다 그 viewId 구독자에게 통지한다(다른 viewId 구독자는 조용)", () => {
    const onV1 = vi.fn();
    const onV2 = vi.fn();
    const offSub1 = subscribeRail("v1", onV1);
    const offSub2 = subscribeRail("v2", onV2);
    const off = registerRailContainer("v1", "structure", el());
    expect(onV1).toHaveBeenCalledTimes(1);
    expect(onV2).not.toHaveBeenCalled();
    off();
    expect(onV1).toHaveBeenCalledTimes(2);
    offSub1();
    offSub2();
    registerRailContainer("v1", "structure", el())();
    expect(onV1).toHaveBeenCalledTimes(2); // 구독 해제 후 조용.
  });

  it("낡은 해제는 no-op — 같은 슬롯을 새 컨테이너가 차지한 뒤 이전 해제가 그걸 지우지 않는다", () => {
    const first = el();
    const second = el();
    const offFirst = registerRailContainer("v1", "structure", first);
    const offSecond = registerRailContainer("v1", "structure", second);
    offFirst(); // first 는 이미 교체됨 — second 를 건드리면 안 된다.
    expect(railContainer("v1", "structure")).toBe(second);
    offSecond();
    expect(railContainer("v1", "structure")).toBeNull();
  });
});
