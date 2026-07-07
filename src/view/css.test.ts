// CSS 조립 순수 검증(§7 Mount law) — :root→:host 재작성과 7테마 블록 합침.
import { describe, it, expect } from "vitest";
import { rewriteRootToHost, buildShadowCss } from "./css";

describe("rewriteRootToHost", () => {
  it("셀렉터 :root 를 :host 로 바꾼다(토큰쌍·color-scheme 줄 모두)", () => {
    expect(rewriteRootToHost(":root, .xhash { --x: 1; }")).toBe(":host, .xhash { --x: 1; }");
    expect(rewriteRootToHost(":root { color-scheme: dark; }")).toBe(":host { color-scheme: dark; }");
  });

  it("data-astryx-theme @scope 셀렉터는 건드리지 않는다", () => {
    const css = '[data-astryx-theme="neutral"] { --t: n; }';
    expect(rewriteRootToHost(css)).toBe(css);
  });
});

describe("buildShadowCss", () => {
  it("astryx(재작성) 다음 모든 테마 블록(재작성)을 순서대로 잇는다", () => {
    const out = buildShadowCss(":root, .xhash { --a: 1; }", {
      neutral: ':root { color-scheme: light; } [data-astryx-theme="neutral"]{}',
      gothic: ':root { color-scheme: dark; } [data-astryx-theme="gothic"]{}',
    });
    expect(out).toContain(":host, .xhash");
    expect(out).not.toContain(":root");
    expect(out.indexOf("--a: 1")).toBeLessThan(out.indexOf("neutral"));
    expect(out).toContain('[data-astryx-theme="neutral"]');
    expect(out).toContain('[data-astryx-theme="gothic"]');
  });
});
