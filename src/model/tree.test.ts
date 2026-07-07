import { describe, it, expect } from "vitest";
import type { DesignDoc, DesignNode, DesignPage } from "../types";
import {
  allIds,
  cloneJson,
  cloneWithFreshIds,
  collectIds,
  countNodes,
  findInPage,
  isSelfOrDescendant,
  serializePropSearch,
  summarizePage,
  walk,
} from "./tree";
import { createPage, createTsxPage } from "./pages";
import { addNode } from "./nodes";
import { fixtureCatalog, makeDoc as createDoc } from "./fixtures";

function leaf(id: string, type: string, props: Record<string, unknown> = {}): DesignNode {
  return { id, type, props: props as DesignNode["props"], children: [] };
}

// tree 페이지의 root 를 꺼내는 테스트 헬퍼(source 유니온을 좁힌다).
function treeRoot(doc: DesignDoc, i = 0): DesignNode {
  const s = doc.pages[i].source;
  if (s.kind !== "tree") throw new Error("expected tree page");
  return s.root;
}

describe("walk / countNodes / collectIds", () => {
  const tree: DesignNode = {
    id: "a",
    type: "Stack",
    props: {},
    children: [leaf("b", "Button"), { id: "c", type: "Card", props: {}, children: [leaf("d", "Text")] }],
  };

  it("walk visits pre-order (parent before children)", () => {
    const order: string[] = [];
    walk(tree, (n) => order.push(n.id));
    expect(order).toEqual(["a", "b", "c", "d"]);
  });

  it("countNodes counts self + descendants", () => {
    expect(countNodes(tree)).toBe(4);
    expect(countNodes(leaf("x", "Button"))).toBe(1);
  });

  it("collectIds returns every id", () => {
    expect(collectIds(tree)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("isSelfOrDescendant", () => {
  const tree: DesignNode = {
    id: "a",
    type: "Stack",
    props: {},
    children: [{ id: "b", type: "Card", props: {}, children: [leaf("c", "Text")] }],
  };
  it("true for self", () => expect(isSelfOrDescendant(tree, "a")).toBe(true));
  it("true for descendant", () => expect(isSelfOrDescendant(tree, "c")).toBe(true));
  it("false for unrelated id", () => expect(isSelfOrDescendant(tree, "z")).toBe(false));
});

describe("findInPage", () => {
  const page: DesignPage = {
    id: "p1",
    name: "P",
    source: {
      kind: "tree",
      root: {
        id: "r",
        type: "Stack",
        props: {},
        children: [leaf("k1", "Button"), leaf("k2", "Button")],
      },
    },
  };

  it("finds root with null parent, index -1", () => {
    const loc = findInPage(page, "r");
    expect(loc).not.toBeNull();
    expect(loc!.parent).toBeNull();
    expect(loc!.index).toBe(-1);
  });

  it("finds child with parent + index", () => {
    const loc = findInPage(page, "k2");
    expect(loc!.parent!.id).toBe("r");
    expect(loc!.index).toBe(1);
  });

  it("returns null for absent id", () => {
    expect(findInPage(page, "nope")).toBeNull();
  });

  it("returns null for any id on a tsx page (no nodes)", () => {
    const tsxPage: DesignPage = { id: "p2", name: "T", source: { kind: "tsx", code: "x" } };
    expect(findInPage(tsxPage, "r")).toBeNull();
  });
});

describe("cloneJson", () => {
  it("deep-clones nested structures independently", () => {
    const src = { a: 1, b: [{ c: "x" }], d: null };
    const out = cloneJson(src as import("../types").JsonValue) as { b: { c: string }[] };
    expect(out).toEqual(src);
    out.b[0].c = "mutated";
    expect(src.b[0].c).toBe("x");
  });
});

describe("cloneWithFreshIds", () => {
  it("assigns fresh pre-order ids, preserves structure, isolates props, bumps seq", () => {
    const doc: DesignDoc = createDoc();
    const src: DesignNode = {
      id: "old1",
      type: "Stack",
      props: { gap: 2, nested: { k: "v" } },
      children: [leaf("old2", "Button", { label: "A" })],
    };
    const clone = cloneWithFreshIds(doc, src);
    // 전위 id 할당: 부모 n1, 자식 n2.
    expect(clone.id).toBe("n1");
    expect(clone.children[0].id).toBe("n2");
    expect(doc.seq).toBe(2);
    // 구조·값 보존.
    expect(clone.type).toBe("Stack");
    expect(clone.props.gap).toBe(2);
    expect(clone.children[0].props.label).toBe("A");
    // props 참조 격리.
    (clone.props.nested as Record<string, unknown>).k = "changed";
    expect((src.props.nested as Record<string, unknown>).k).toBe("v");
    // 원본 id 불변.
    expect(src.id).toBe("old1");
  });
});

describe("serializePropSearch", () => {
  it("serializes values (not keys), strings raw, others JSON", () => {
    const s = serializePropSearch({ label: "Save Changes", count: 3, data: { k: "v" } });
    expect(s.toLowerCase()).toContain("save changes");
    expect(s).toContain("3");
    expect(s).toContain('{"k":"v"}');
    // 키 이름은 검색 대상 아님.
    expect(s).not.toContain("label");
  });
});

describe("allIds / summarizePage", () => {
  it("allIds is unique after a workflow (tree + tsx pages)", () => {
    const doc = createDoc();
    const cat = fixtureCatalog();
    createPage(doc, { name: "P1" });
    const pid = doc.pages[0].id;
    addNode(doc, { pageId: pid, type: "Card" }, cat);
    const cardId = treeRoot(doc).children[0].id;
    addNode(doc, { pageId: pid, type: "Button", parentId: cardId, props: { label: "X" } }, cat);
    createPage(doc, { name: "P2" });
    createTsxPage(doc, { name: "Code", code: "x", origin: "pages/x" });
    const ids = allIds(doc);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("allIds contributes only the page id for a tsx page (no node ids)", () => {
    const doc = createDoc();
    const { pageId } = createTsxPage(doc, { name: "Code", code: "x", origin: "pages/x" }) as {
      pageId: string;
    };
    expect(allIds(doc)).toEqual([pageId]);
  });

  it("summarizePage reports kind/rootType/nodeCount for a tree page", () => {
    const doc = createDoc();
    createPage(doc, { name: "Home" });
    const s = summarizePage(doc.pages[0]);
    expect(s).toEqual({
      id: doc.pages[0].id,
      name: "Home",
      kind: "tree",
      rootType: "Stack",
      nodeCount: 1,
    });
  });

  it("summarizePage reports only kind:tsx for a tsx page (no rootType/nodeCount)", () => {
    const doc = createDoc();
    createTsxPage(doc, { name: "Code", code: "x", origin: "pages/x" });
    const s = summarizePage(doc.pages[0]);
    expect(s).toEqual({ id: doc.pages[0].id, name: "Code", kind: "tsx" });
    expect(s).not.toHaveProperty("rootType");
    expect(s).not.toHaveProperty("nodeCount");
  });
});
