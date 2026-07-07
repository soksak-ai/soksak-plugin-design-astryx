import { describe, it, expect, afterEach } from "vitest";
import {
  acceptsChildren,
  catalogHas,
  getEntry,
  resolveCatalog,
  useCatalog,
} from "./catalog";
import { createPage } from "./pages";
import { addNode } from "./nodes";
import { fixtureCatalog, makeDoc as createDoc, isErr, unwrap } from "./fixtures";

// 등록 소스는 모듈 전역이므로 각 테스트 후 빈 소스로 원복(다른 테스트 격리).
afterEach(() => useCatalog({ getEntry: () => undefined }));

describe("resolveCatalog", () => {
  it("wraps a Catalog map into a source", () => {
    const src = resolveCatalog(fixtureCatalog());
    expect(catalogHas(src, "Button")).toBe(true);
    expect(catalogHas(src, "Nope")).toBe(false);
    expect(acceptsChildren(src, "Stack")).toBe(true);
    expect(acceptsChildren(src, "Button")).toBe(false);
    expect(getEntry(src, "Button")?.type).toBe("Button");
  });

  it("accepts a source object as-is", () => {
    const source = { getEntry: (t: string) => fixtureCatalog()[t] };
    const src = resolveCatalog(source);
    expect(catalogHas(src, "Card")).toBe(true);
  });
});

describe("useCatalog registration (command layer passes no catalog arg)", () => {
  it("mutations without an explicit catalog use the registered source", () => {
    useCatalog({ getEntry: (t) => fixtureCatalog()[t] });
    const doc = createDoc();
    const { pageId } = unwrap(createPage(doc, { name: "P" }));
    const r = addNode(doc, { pageId, type: "Button", props: { label: "X" } });
    expect(isErr(r)).toBe(false);
  });

  it("with no source registered, every type is unknown (INVALID_TYPE)", () => {
    useCatalog({ getEntry: () => undefined });
    const doc = createDoc();
    const { pageId } = unwrap(createPage(doc, { name: "P" }));
    const r = addNode(doc, { pageId, type: "Button" });
    expect(isErr(r) && r.code).toBe("INVALID_TYPE");
  });
});
