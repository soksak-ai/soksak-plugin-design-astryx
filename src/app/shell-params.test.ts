// 셸 URL 해시 파라미터 검증 — 호스트가 서피스 create URL 에 싣는 자기식별(vid)·패널 모드(panel)를
// 앱 부트가 순수 함수로 읽는다. 잘못된 값은 null 로 무해화(빈 뷰어/캔버스 폴백).
import { describe, it, expect } from "vitest";
import { parseShellHash } from "./shell-params";

describe("parseShellHash", () => {
  it("vid·panel 을 읽는다(# 유무 무관)", () => {
    expect(parseShellHash("#vid=v1&panel=structure")).toEqual({ vid: "v1", panel: "structure" });
    expect(parseShellHash("vid=v2&panel=inspector")).toEqual({ vid: "v2", panel: "inspector" });
  });

  it("vid 만 있는 캔버스 모드 — panel 은 null", () => {
    expect(parseShellHash("#vid=v1")).toEqual({ vid: "v1", panel: null });
  });

  it("빈 해시·미지 panel 값은 null 로 무해화", () => {
    expect(parseShellHash("")).toEqual({ vid: null, panel: null });
    expect(parseShellHash("#")).toEqual({ vid: null, panel: null });
    expect(parseShellHash("#vid=v1&panel=bogus")).toEqual({ vid: "v1", panel: null });
  });

  it("URL 인코딩된 vid 를 복원한다", () => {
    expect(parseShellHash(`#vid=${encodeURIComponent("v/1 x")}&panel=structure`).vid).toBe("v/1 x");
  });
});
