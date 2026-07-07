// 미리보기 색 모드 해소 규칙(mode.ts) — 러너/emit 공유 단일 진실.
import { describe, it, expect } from "vitest";
import { resolvePreviewMode } from "./mode";

describe("resolvePreviewMode", () => {
  it("gothic 은 항상 dark(다크 전용 테마)", () => {
    expect(resolvePreviewMode(undefined, "gothic")).toBe("dark");
    expect(resolvePreviewMode("light", "gothic")).toBe("dark");
    expect(resolvePreviewMode("system", "gothic")).toBe("dark");
  });

  it("명시 light/dark/system 을 존중", () => {
    expect(resolvePreviewMode("light", "neutral")).toBe("light");
    expect(resolvePreviewMode("dark", "neutral")).toBe("dark");
    expect(resolvePreviewMode("system", "matcha")).toBe("system");
  });

  it("없거나 이상값은 system(reset.css 가 OS 를 따름)", () => {
    expect(resolvePreviewMode(undefined, "neutral")).toBe("system");
    expect(resolvePreviewMode("bogus", "neutral")).toBe("system");
    expect(resolvePreviewMode(null, "stone")).toBe("system");
    expect(resolvePreviewMode(3, "y2k")).toBe("system");
  });
});
