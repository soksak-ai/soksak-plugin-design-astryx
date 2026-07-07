import { describe, it, expect } from "vitest";
import { resolveThemeMode } from "./theme-mode";
import { isErr } from "./envelope";

describe("resolveThemeMode (§9)", () => {
  it("mode 미지정이면 현재 모드를 실효로, explicit=false", () => {
    expect(resolveThemeMode("neutral", undefined, "dark")).toEqual({
      effective: "dark",
      explicit: false,
    });
    // 현재 모드도 없으면 system.
    expect(resolveThemeMode("neutral", undefined, undefined)).toEqual({
      effective: "system",
      explicit: false,
    });
    // null 도 미지정 취급.
    expect(resolveThemeMode("neutral", null, "light")).toEqual({
      effective: "light",
      explicit: false,
    });
  });

  it("유효 mode 는 실효로 채택하고 explicit=true", () => {
    expect(resolveThemeMode("butter", "light", "dark")).toEqual({
      effective: "light",
      explicit: true,
    });
    expect(resolveThemeMode("butter", "system", undefined)).toEqual({
      effective: "system",
      explicit: true,
    });
  });

  it("light|dark|system 밖의 mode 는 INVALID_PROP", () => {
    const r = resolveThemeMode("neutral", "sepia", "system");
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.code).toBe("INVALID_PROP");
    // 숫자·객체 등 비문자열도 거부.
    expect(isErr(resolveThemeMode("neutral", 1, "system"))).toBe(true);
    expect(isErr(resolveThemeMode("neutral", {}, "system"))).toBe(true);
  });

  it("gothic + 명시 light 는 INVALID_PROP(actionable)", () => {
    const r = resolveThemeMode("gothic", "light", "system");
    expect(isErr(r)).toBe(true);
    if (isErr(r)) {
      expect(r.code).toBe("INVALID_PROP");
      expect(r.message).toContain("gothic");
    }
  });

  it("gothic + 현재 모드가 light 인데 이번엔 mode 무명시여도 거부(실효 light)", () => {
    // gothic 으로 바꾸는데 doc 의 기존 모드가 light 면 실효 모드가 light → 거부.
    expect(isErr(resolveThemeMode("gothic", undefined, "light"))).toBe(true);
  });

  it("gothic + dark/system 은 허용", () => {
    expect(resolveThemeMode("gothic", "dark", "light")).toEqual({
      effective: "dark",
      explicit: true,
    });
    expect(resolveThemeMode("gothic", "system", "light")).toEqual({
      effective: "system",
      explicit: true,
    });
    // 무명시 + 현재 system 도 허용.
    expect(resolveThemeMode("gothic", undefined, "system")).toEqual({
      effective: "system",
      explicit: false,
    });
  });
});
