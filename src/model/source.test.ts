import { describe, it, expect } from "vitest";
import type { DesignNode, DesignPage } from "../types";
import { coercePage, coercePageSource, requireTreeRoot, requireTsxSource } from "./source";
import { isErr } from "./result";

const node: DesignNode = { id: "n1", type: "Stack", props: {}, children: [] };

// mintNodeId 를 세는 스텁 — 훼손 폴백에서만 호출되어야 한다.
function counter(): { mint: () => string; count: () => number } {
  let calls = 0;
  return { mint: () => `n${++calls}`, count: () => calls };
}

describe("coercePageSource", () => {
  it("passes through a valid v2 tree source (no mint)", () => {
    const c = counter();
    expect(coercePageSource({ source: { kind: "tree", root: node } }, c.mint)).toEqual({
      kind: "tree",
      root: node,
    });
    expect(c.count()).toBe(0);
  });

  it("passes through a valid v2 tsx source with and without origin (no mint)", () => {
    const c = counter();
    expect(coercePageSource({ source: { kind: "tsx", code: "x", origin: "pages/a" } }, c.mint)).toEqual({
      kind: "tsx",
      code: "x",
      origin: "pages/a",
    });
    expect(coercePageSource({ source: { kind: "tsx", code: "y" } }, c.mint)).toEqual({
      kind: "tsx",
      code: "y",
    });
    expect(c.count()).toBe(0);
  });

  it("promotes a v1 root-only page to a tree source (no mint)", () => {
    const c = counter();
    expect(coercePageSource({ root: node }, c.mint)).toEqual({ kind: "tree", root: node });
    expect(c.count()).toBe(0);
  });

  it("coerces a missing source to an empty tree page (mints the root id)", () => {
    const c = counter();
    const out = coercePageSource({}, c.mint);
    expect(out).toEqual({ kind: "tree", root: { id: "n1", type: "Stack", props: {}, children: [] } });
    expect(c.count()).toBe(1);
  });

  it("coerces a malformed source (bad kind, non-string code, non-nodeish root) to an empty tree page", () => {
    expect(coercePageSource({ source: { kind: "weird" } }, counter().mint).kind).toBe("tree");
    expect(coercePageSource({ source: { kind: "tsx", code: 5 } }, counter().mint).kind).toBe("tree");
    expect(coercePageSource({ source: { kind: "tree", root: { id: "x" } } }, counter().mint).kind).toBe("tree");
  });
});

describe("coercePage", () => {
  it("builds a DesignPage from a valid record", () => {
    const page = coercePage({ id: "p1", name: "Home", source: { kind: "tsx", code: "x" } }, () => "n1");
    expect(page).toEqual({ id: "p1", name: "Home", source: { kind: "tsx", code: "x" } });
  });

  it("promotes a v1 root-only page record", () => {
    const page = coercePage({ id: "p1", name: "Home", root: node }, () => "n1");
    expect(page).toEqual({ id: "p1", name: "Home", source: { kind: "tree", root: node } });
  });

  it("returns null for a non-object or a record missing id/name", () => {
    expect(coercePage(null, () => "n1")).toBeNull();
    expect(coercePage("nope", () => "n1")).toBeNull();
    expect(coercePage({ name: "no id" }, () => "n1")).toBeNull();
    expect(coercePage({ id: "p1" }, () => "n1")).toBeNull();
  });
});

describe("requireTreeRoot / requireTsxSource (kind gates)", () => {
  const treePage: DesignPage = { id: "p1", name: "T", source: { kind: "tree", root: node } };
  const tsxPage: DesignPage = { id: "p2", name: "C", source: { kind: "tsx", code: "x", origin: "pages/a" } };
  const tsxBare: DesignPage = { id: "p3", name: "B", source: { kind: "tsx", code: "y" } };

  it("requireTreeRoot returns the root for a tree page, INVALID_TARGET for a tsx page", () => {
    expect(requireTreeRoot(treePage)).toBe(node);
    const e = requireTreeRoot(tsxPage);
    expect(isErr(e) && e.code).toBe("INVALID_TARGET");
  });

  it("requireTsxSource returns code(+origin) for a tsx page, INVALID_TARGET for a tree page", () => {
    expect(requireTsxSource(tsxPage)).toEqual({ code: "x", origin: "pages/a" });
    expect(requireTsxSource(tsxBare)).toEqual({ code: "y" });
    const e = requireTsxSource(treePage);
    expect(isErr(e) && e.code).toBe("INVALID_TARGET");
  });
});
