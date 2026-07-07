import { describe, it, expect } from "vitest";
import type { DesignDoc, DesignNode, PageSource } from "../types";
import {
  applyTsxSource,
  createPage,
  createTsxPage,
  duplicatePage,
  getPageCode,
  removePage,
  renamePage,
  setPageCode,
} from "./pages";
import { addNode } from "./nodes";
import { allIds } from "./tree";
import { fixtureCatalog, makeDoc as createDoc, unwrap, errCode } from "./fixtures";

const cat = fixtureCatalog();

// tree/tsx 페이지의 source 를 좁히는 테스트 헬퍼.
function source(doc: DesignDoc, i = 0): PageSource {
  return doc.pages[i].source;
}
function treeRoot(doc: DesignDoc, i = 0): DesignNode {
  const s = source(doc, i);
  if (s.kind !== "tree") throw new Error("expected tree page");
  return s.root;
}

describe("createPage", () => {
  it("creates a bare Stack tree page and shares the seq space (page id before node id)", () => {
    const doc = createDoc();
    const data = unwrap(createPage(doc, { name: "Home" }));
    expect(data).toEqual({ pageId: "p1", name: "Home", kind: "tree", rootType: "Stack", nodeCount: 1 });
    expect(treeRoot(doc).id).toBe("n2");
    expect(doc.seq).toBe(2);
  });

  it("creates a tsx page with a starter component (only a page id minted, no node id)", () => {
    const doc = createDoc();
    const data = unwrap(createPage(doc, { name: "Code", kind: "tsx" }));
    expect(data).toEqual({ pageId: "p1", name: "Code", kind: "tsx" });
    const s = source(doc);
    expect(s.kind).toBe("tsx");
    if (s.kind === "tsx") {
      expect(s.code).toContain("export default function");
      expect(s.origin).toBeUndefined();
    }
    expect(doc.seq).toBe(1); // page id 만 발급.
  });

  it("rejects a blank name with INVALID_ARG", () => {
    const doc = createDoc();
    expect(errCode(createPage(doc, { name: "   " }))).toBe("INVALID_ARG");
    expect(doc.pages).toHaveLength(0);
  });

  it("rejects an unknown kind with INVALID_ARG", () => {
    const doc = createDoc();
    expect(errCode(createPage(doc, { name: "X", kind: "widget" }))).toBe("INVALID_ARG");
    expect(doc.pages).toHaveLength(0);
  });
});

describe("renamePage", () => {
  it("renames an existing page (kind-agnostic)", () => {
    const doc = createDoc();
    const { pageId } = unwrap(createPage(doc, { name: "Old" }));
    expect(unwrap(renamePage(doc, { pageId, name: "New" }))).toEqual({ pageId, name: "New" });
    expect(doc.pages[0].name).toBe("New");
  });
  it("rejects blank name and unknown page", () => {
    const doc = createDoc();
    const { pageId } = unwrap(createPage(doc, { name: "Old" }));
    expect(errCode(renamePage(doc, { pageId, name: "" }))).toBe("INVALID_ARG");
    expect(errCode(renamePage(doc, { pageId: "pX", name: "New" }))).toBe("NOT_FOUND");
  });
});

describe("duplicatePage", () => {
  function seeded(): { doc: DesignDoc; pageId: string } {
    const doc = createDoc();
    const { pageId } = unwrap(createPage(doc, { name: "Src" }));
    addNode(doc, { pageId, type: "Button", props: { label: "A" } }, cat);
    addNode(doc, { pageId, type: "Card" }, cat);
    return { doc, pageId };
  }

  it("deep-clones a tree page with fresh disjoint ids and default '{name} copy'", () => {
    const { doc, pageId } = seeded();
    const before = new Set(allIds(doc));
    const data = unwrap(duplicatePage(doc, { pageId }));
    expect(data.name).toBe("Src copy");
    expect(data.nodeCount).toBe(3); // root + 2 children
    const dup = doc.pages[1];
    for (const id of allIds({ ...doc, pages: [dup] } as DesignDoc)) {
      expect(before.has(id)).toBe(false);
    }
    const ids = allIds(doc);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("duplicates a tsx page copying code+origin with a fresh page id and nodeCount 0", () => {
    const doc = createDoc();
    unwrap(createTsxPage(doc, { name: "Code", code: "const x = 1;", origin: "pages/x" }));
    const data = unwrap(duplicatePage(doc, { pageId: doc.pages[0].id }));
    expect(data.name).toBe("Code copy");
    expect(data.nodeCount).toBe(0);
    const dup = source(doc, 1);
    expect(dup.kind).toBe("tsx");
    if (dup.kind === "tsx") {
      expect(dup.code).toBe("const x = 1;");
      expect(dup.origin).toBe("pages/x");
    }
    expect(doc.pages[1].id).not.toBe(doc.pages[0].id);
  });

  it("honors a custom name and rejects unknown page", () => {
    const { doc, pageId } = seeded();
    expect(unwrap(duplicatePage(doc, { pageId, name: "Clone" })).name).toBe("Clone");
    expect(errCode(duplicatePage(doc, { pageId: "pX" }))).toBe("NOT_FOUND");
  });
});

describe("removePage", () => {
  it("removes a page (doc may hold zero pages)", () => {
    const doc = createDoc();
    const { pageId } = unwrap(createPage(doc, { name: "Only" }));
    expect(unwrap(removePage(doc, { pageId }))).toEqual({ removedId: pageId });
    expect(doc.pages).toHaveLength(0);
  });
  it("rejects unknown page", () => {
    const doc = createDoc();
    expect(errCode(removePage(doc, { pageId: "pX" }))).toBe("NOT_FOUND");
  });
});

describe("createTsxPage (template.apply, no pageId)", () => {
  it("creates a new tsx page from verbatim code with origin, minting only a page id", () => {
    const doc = createDoc();
    const data = unwrap(createTsxPage(doc, { name: "Dashboard", code: "// tsx", origin: "pages/dashboard" }));
    expect(data).toEqual({ pageId: "p1", name: "Dashboard", kind: "tsx", origin: "pages/dashboard" });
    const s = source(doc);
    expect(s).toEqual({ kind: "tsx", code: "// tsx", origin: "pages/dashboard" });
    expect(doc.seq).toBe(1);
  });
});

describe("applyTsxSource (template.apply with pageId)", () => {
  it("overwrites a tree page's source with tsx (kind flips, origin recorded)", () => {
    const doc = createDoc();
    const { pageId } = unwrap(createPage(doc, { name: "P" }));
    const data = unwrap(applyTsxSource(doc, { pageId, code: "// new", origin: "pages/hero" }));
    expect(data).toEqual({ pageId, name: "P", kind: "tsx", origin: "pages/hero" });
    expect(source(doc)).toEqual({ kind: "tsx", code: "// new", origin: "pages/hero" });
  });

  it("overwrites an existing tsx page's source (code + origin replaced)", () => {
    const doc = createDoc();
    unwrap(createTsxPage(doc, { name: "P", code: "old", origin: "pages/a" }));
    const pageId = doc.pages[0].id;
    unwrap(applyTsxSource(doc, { pageId, code: "fresh", origin: "pages/b" }));
    expect(source(doc)).toEqual({ kind: "tsx", code: "fresh", origin: "pages/b" });
  });

  it("rejects an unknown page with NOT_FOUND", () => {
    const doc = createDoc();
    expect(errCode(applyTsxSource(doc, { pageId: "pX", code: "x", origin: "pages/x" }))).toBe("NOT_FOUND");
  });
});

describe("getPageCode / setPageCode (page.code.* kind gate)", () => {
  function tsxDoc(origin?: string): { doc: DesignDoc; pageId: string } {
    const doc = createDoc();
    if (origin !== undefined) {
      unwrap(createTsxPage(doc, { name: "Code", code: "const a = 1;", origin }));
    } else {
      unwrap(createPage(doc, { name: "Code", kind: "tsx" }));
    }
    return { doc, pageId: doc.pages[0].id };
  }

  it("getPageCode returns code (+origin) of a tsx page", () => {
    const { doc, pageId } = tsxDoc("pages/dash");
    expect(unwrap(getPageCode(doc, { pageId }))).toEqual({
      pageId,
      code: "const a = 1;",
      origin: "pages/dash",
    });
  });

  it("getPageCode omits origin when the tsx page has none", () => {
    const { doc, pageId } = tsxDoc();
    const data = unwrap(getPageCode(doc, { pageId }));
    expect(data.pageId).toBe(pageId);
    expect(data).not.toHaveProperty("origin");
  });

  it("getPageCode on a tree page returns INVALID_TARGET; missing page NOT_FOUND", () => {
    const doc = createDoc();
    const { pageId } = unwrap(createPage(doc, { name: "Tree" }));
    expect(errCode(getPageCode(doc, { pageId }))).toBe("INVALID_TARGET");
    expect(errCode(getPageCode(doc, { pageId: "pX" }))).toBe("NOT_FOUND");
  });

  it("setPageCode replaces code and reports bytes, preserving origin", () => {
    const { doc, pageId } = tsxDoc("pages/keep");
    const data = unwrap(setPageCode(doc, { pageId, code: "const b = 2;" }));
    expect(data).toEqual({ pageId, bytes: "const b = 2;".length });
    expect(source(doc)).toEqual({ kind: "tsx", code: "const b = 2;", origin: "pages/keep" });
  });

  it("setPageCode leaves a starter tsx page origin-less", () => {
    const { doc, pageId } = tsxDoc();
    unwrap(setPageCode(doc, { pageId, code: "const c = 3;" }));
    expect(source(doc)).toEqual({ kind: "tsx", code: "const c = 3;" });
  });

  it("setPageCode rejects a tree page (INVALID_TARGET), blank code (INVALID_ARG), missing page (NOT_FOUND)", () => {
    const doc = createDoc();
    const { pageId } = unwrap(createPage(doc, { name: "Tree" }));
    expect(errCode(setPageCode(doc, { pageId, code: "x" }))).toBe("INVALID_TARGET");
    const tsx = tsxDoc();
    expect(errCode(setPageCode(tsx.doc, { pageId: tsx.pageId, code: "   " }))).toBe("INVALID_ARG");
    expect(errCode(setPageCode(doc, { pageId: "pX", code: "x" }))).toBe("NOT_FOUND");
  });
});
