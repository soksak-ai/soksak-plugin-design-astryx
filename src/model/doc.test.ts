import { describe, it, expect } from "vitest";
import { getPage, pageSummaries, setTheme } from "./doc";
import { createPage, createTsxPage } from "./pages";
import { makeDoc as createDoc, unwrap } from "./fixtures";

describe("setTheme", () => {
  it("sets a known theme and returns the plain record", () => {
    const doc = createDoc();
    expect(unwrap(setTheme(doc, "gothic"))).toEqual({ theme: "gothic" });
    expect(doc.activeTheme).toBe("gothic");
  });

  it("rejects an unknown theme with THEME_UNKNOWN and leaves activeTheme intact", () => {
    const doc = createDoc();
    const r = setTheme(doc, "aqua");
    expect("ok" in r && r.ok === false).toBe(true);
    if ("ok" in r && r.ok === false) expect(r.code).toBe("THEME_UNKNOWN");
    expect(doc.activeTheme).toBe("neutral");
  });
});

describe("pageSummaries / getPage", () => {
  it("summarizes every page kind (tree carries rootType/nodeCount, tsx carries only kind)", () => {
    const doc = createDoc();
    setTheme(doc, "matcha");
    createPage(doc, { name: "Home" });
    createTsxPage(doc, { name: "Code", code: "// x", origin: "pages/x" });
    const summaries = pageSummaries(doc);
    expect(summaries.map((p) => p.name)).toEqual(["Home", "Code"]);
    expect(summaries[0]).toEqual({
      id: doc.pages[0].id,
      name: "Home",
      kind: "tree",
      rootType: "Stack",
      nodeCount: 1,
    });
    expect(summaries[1]).toEqual({ id: doc.pages[1].id, name: "Code", kind: "tsx" });
  });

  it("getPage returns the page object or undefined", () => {
    const doc = createDoc();
    const { pageId } = unwrap(createPage(doc, { name: "P" }));
    expect(getPage(doc, pageId)?.name).toBe("P");
    expect(getPage(doc, "pX")).toBeUndefined();
  });
});
