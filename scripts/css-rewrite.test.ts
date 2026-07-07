import { describe, it, expect } from "vitest";
import { rewriteRootToHost } from "./css-rewrite.mjs";

describe("rewriteRootToHost — :root→:host (§7 Mount law, §12 build-time single point)", () => {
  it("rewrites the astryx token selector pair `:root, .xhash{…}`", () => {
    const src = ":root, .xafi2nm{--border-width:1px;}";
    expect(rewriteRootToHost(src)).toBe(":host, .xafi2nm{--border-width:1px;}");
  });

  it("rewrites the theme color-scheme line `:root { color-scheme: … }`", () => {
    const src = ":root { color-scheme: light dark; }\n\n@scope ([data-astryx-theme=\"neutral\"]) to ([data-astryx-theme]) {}";
    expect(rewriteRootToHost(src)).toBe(
      ":host { color-scheme: light dark; }\n\n@scope ([data-astryx-theme=\"neutral\"]) to ([data-astryx-theme]) {}",
    );
  });

  it("rewrites every occurrence and leaves no `:root` behind", () => {
    const src = ":root, .a{--x:1;}\n:root, .b{--y:2;}\n:root{color-scheme:dark;}";
    const out = rewriteRootToHost(src);
    expect(out).not.toContain(":root");
    expect(out.match(/:host/g)).toHaveLength(3);
  });

  it("is idempotent — a second pass is a no-op", () => {
    const src = ":root, .a{--x:1;}";
    const once = rewriteRootToHost(src);
    expect(rewriteRootToHost(once)).toBe(once);
  });

  it("does not touch a longer identifier that merely starts with :root", () => {
    // :root 뒤가 단어문자/하이픈이면 별개 토큰 — 재작성 금지.
    expect(rewriteRootToHost(":rootx { color: red; }")).toBe(":rootx { color: red; }");
    expect(rewriteRootToHost(":root-thing { color: red; }")).toBe(":root-thing { color: red; }");
  });

  it("does not touch a `--root` custom property or a `.root` class", () => {
    expect(rewriteRootToHost(".root { --root: 4px; }")).toBe(".root { --root: 4px; }");
  });

  it("leaves CSS with no :root untouched (gothic theme case)", () => {
    const src = "@scope ([data-astryx-theme=\"gothic\"]) to ([data-astryx-theme]) { .x{color:#000;} }";
    expect(rewriteRootToHost(src)).toBe(src);
  });

  it("throws on a non-string input (no silent fallback)", () => {
    // @ts-expect-error 계약 위반을 명시적으로 검증한다.
    expect(() => rewriteRootToHost(undefined)).toThrow(TypeError);
  });
});
