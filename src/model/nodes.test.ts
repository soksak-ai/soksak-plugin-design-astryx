import { describe, it, expect } from "vitest";
import type { DesignDoc, DesignNode } from "../types";
import { createPage, createTsxPage } from "./pages";
import {
  addNode,
  findNodes,
  getNode,
  moveNode,
  removeNode,
  setProps,
} from "./nodes";
import { fixtureCatalog, makeDoc as createDoc, unwrap, errCode, isErr } from "./fixtures";

const cat = fixtureCatalog();

// tree 페이지의 root(테스트 헬퍼 — source 유니온을 좁힌다).
function treeRoot(doc: DesignDoc, i = 0): DesignNode {
  const s = doc.pages[i].source;
  if (s.kind !== "tree") throw new Error("expected tree page");
  return s.root;
}

// Stack 루트 페이지 하나를 가진 문서.
function seeded(): { doc: DesignDoc; pageId: string; rootId: string } {
  const doc = createDoc();
  const { pageId } = unwrap(createPage(doc, { name: "P" }));
  return { doc, pageId, rootId: treeRoot(doc).id };
}

describe("addNode", () => {
  it("adds a node under the root by default", () => {
    const { doc, pageId, rootId } = seeded();
    const data = unwrap(addNode(doc, { pageId, type: "Button", props: { label: "Go" } }, cat));
    expect(data.node.type).toBe("Button");
    expect(data.node.props.label).toBe("Go");
    expect(data.parentId).toBe(rootId); // §5 message 가 parentId 를 참조하므로 데이터에 포함.
    expect(treeRoot(doc).children.map((c) => c.id)).toEqual([data.nodeId]);
    expect(treeRoot(doc).id).toBe(rootId);
  });

  it("inserts at an explicit index", () => {
    const { doc, pageId } = seeded();
    const a = unwrap(addNode(doc, { pageId, type: "Button", props: { label: "A" } }, cat));
    const b = unwrap(addNode(doc, { pageId, type: "Button", props: { label: "B" }, index: 0 }, cat));
    expect(treeRoot(doc).children.map((c) => c.id)).toEqual([b.nodeId, a.nodeId]);
  });

  it("allows props.children string on an accepts-children node with no children", () => {
    const { doc, pageId } = seeded();
    const r = addNode(doc, { pageId, type: "Text", props: { children: "Hello" } }, cat);
    expect(isErr(r)).toBe(false);
  });

  it("NOT_FOUND for missing page", () => {
    const { doc } = seeded();
    expect(errCode(addNode(doc, { pageId: "pX", type: "Button" }, cat))).toBe("NOT_FOUND");
  });

  it("NOT_FOUND for missing parent", () => {
    const { doc, pageId } = seeded();
    expect(errCode(addNode(doc, { pageId, type: "Button", parentId: "nX" }, cat))).toBe("NOT_FOUND");
  });

  it("INVALID_TYPE for unknown type", () => {
    const { doc, pageId } = seeded();
    expect(errCode(addNode(doc, { pageId, type: "Ghost" }, cat))).toBe("INVALID_TYPE");
  });

  it("INVALID_TYPE carries similarity suggestions from the catalog", () => {
    const { doc, pageId } = seeded();
    const r = addNode(doc, { pageId, type: "Buton" }, cat);
    expect(errCode(r)).toBe("INVALID_TYPE");
    const data = (r as { data?: { suggestions?: string[] } }).data;
    expect(data?.suggestions).toContain("Button");
  });

  it("accepts universal className and style props (not in the catalog entry)", () => {
    const { doc, pageId } = seeded();
    const r = addNode(
      doc,
      { pageId, type: "Button", props: { label: "Go", className: "hero", style: { color: "var(--color-fg)" } } },
      cat,
    );
    expect(isErr(r)).toBe(false);
    const node = unwrap(r).node;
    expect(node.props.className).toBe("hero");
    expect(node.props.style).toEqual({ color: "var(--color-fg)" });
  });

  it("INVALID_PROP for a style function value", () => {
    const { doc, pageId } = seeded();
    const r = addNode(
      doc,
      { pageId, type: "Button", props: { label: "Go", style: (() => ({})) as never } },
      cat,
    );
    expect(errCode(r)).toBe("INVALID_PROP");
  });

  it("INVALID_TARGET when parent does not accept children", () => {
    const { doc, pageId } = seeded();
    const btn = unwrap(addNode(doc, { pageId, type: "Button", props: { label: "A" } }, cat));
    const r = addNode(doc, { pageId, type: "Text", parentId: btn.nodeId }, cat);
    expect(errCode(r)).toBe("INVALID_TARGET");
  });

  it("INVALID_PROP for unknown / enum / primitive / callback", () => {
    const { doc, pageId } = seeded();
    expect(errCode(addNode(doc, { pageId, type: "Button", props: { foo: 1 } }, cat))).toBe("INVALID_PROP");
    expect(errCode(addNode(doc, { pageId, type: "Button", props: { variant: "ghost" } }, cat))).toBe("INVALID_PROP");
    expect(errCode(addNode(doc, { pageId, type: "Button", props: { label: 9 } }, cat))).toBe("INVALID_PROP");
    expect(errCode(addNode(doc, { pageId, type: "Button", props: { onClick: "x" } }, cat))).toBe("INVALID_PROP");
  });

  it("INVALID_ARG for out-of-range index; doc unchanged on rejection", () => {
    const { doc, pageId } = seeded();
    expect(errCode(addNode(doc, { pageId, type: "Button", index: 5 }, cat))).toBe("INVALID_ARG");
    expect(treeRoot(doc).children).toHaveLength(0);
  });

  it("INVALID_PROP (INV5) when adding a child under a node that holds a children prop; doc unchanged", () => {
    const { doc, pageId, rootId } = seeded();
    // Text 는 자식 수용이지만 아직 구조적 자식이 없어 children 텍스트를 허용.
    const txt = unwrap(addNode(doc, { pageId, type: "Text", props: { children: "Hello" } }, cat)).nodeId;
    const r = addNode(doc, { pageId, type: "Button", parentId: txt, props: { label: "B" } }, cat);
    expect(errCode(r)).toBe("INVALID_PROP");
    // 거부 시 대상 노드는 자식이 붙지 않는다(불변).
    const txtNode = unwrap(getNode(doc, { pageId, nodeId: txt })).node;
    expect(txtNode.children).toHaveLength(0);
    void rootId;
  });
});

describe("setProps", () => {
  function withButton(): { doc: DesignDoc; pageId: string; nodeId: string } {
    const { doc, pageId } = seeded();
    const b = unwrap(addNode(doc, { pageId, type: "Button", props: { label: "A", count: 1 } }, cat));
    return { doc, pageId, nodeId: b.nodeId };
  }

  it("merges props", () => {
    const { doc, pageId, nodeId } = withButton();
    unwrap(setProps(doc, { pageId, nodeId, props: { count: 5 } }, cat));
    const node = unwrap(getNode(doc, { pageId, nodeId })).node;
    expect(node.props).toEqual({ label: "A", count: 5 });
  });

  it("null deletes a key", () => {
    const { doc, pageId, nodeId } = withButton();
    unwrap(setProps(doc, { pageId, nodeId, props: { count: null } }, cat));
    expect(unwrap(getNode(doc, { pageId, nodeId })).node.props).toEqual({ label: "A" });
  });

  it("replace=true swaps all props", () => {
    const { doc, pageId, nodeId } = withButton();
    unwrap(setProps(doc, { pageId, nodeId, props: { label: "B" }, replace: true }, cat));
    expect(unwrap(getNode(doc, { pageId, nodeId })).node.props).toEqual({ label: "B" });
  });

  it("NOT_FOUND for missing node", () => {
    const { doc, pageId } = withButton();
    expect(errCode(setProps(doc, { pageId, nodeId: "nX", props: {} }, cat))).toBe("NOT_FOUND");
  });

  it("INVALID_PROP for invalid value", () => {
    const { doc, pageId, nodeId } = withButton();
    expect(errCode(setProps(doc, { pageId, nodeId, props: { count: "no" } }, cat))).toBe("INVALID_PROP");
  });

  it("INVALID_PROP (INV5) when setting children on a node that has structural children", () => {
    const { doc, pageId, rootId } = seeded();
    addNode(doc, { pageId, type: "Button", parentId: rootId, props: { label: "A" } }, cat);
    const r = setProps(doc, { pageId, nodeId: rootId, props: { children: "text" } }, cat);
    expect(errCode(r)).toBe("INVALID_PROP");
  });
});

describe("moveNode", () => {
  // root(Stack) > [Card, Button]; Card > [Text]
  function tree() {
    const { doc, pageId, rootId } = seeded();
    const card = unwrap(addNode(doc, { pageId, type: "Card" }, cat)).nodeId;
    const btn = unwrap(addNode(doc, { pageId, type: "Button", props: { label: "B" } }, cat)).nodeId;
    const txt = unwrap(addNode(doc, { pageId, type: "Text", parentId: card }, cat)).nodeId;
    return { doc, pageId, rootId, card, btn, txt };
  }

  it("reparents across parents", () => {
    const { doc, pageId, card, btn } = tree();
    const data = unwrap(moveNode(doc, { pageId, nodeId: btn, parentId: card }, cat));
    expect(data).toEqual({ nodeId: btn, parentId: card, index: 1 });
    expect(treeRoot(doc).children.map((c) => c.type)).toEqual(["Card"]);
    const cardNode = treeRoot(doc).children[0];
    expect(cardNode.children.map((c) => c.id)).toContain(btn);
  });

  it("reorders within the same parent (index interpreted post-removal)", () => {
    const { doc, pageId, rootId, btn } = tree();
    // root children = [Card, Button]; move Button to index 0 -> [Button, Card]
    unwrap(moveNode(doc, { pageId, nodeId: btn, parentId: rootId, index: 0 }, cat));
    expect(treeRoot(doc).children.map((c) => c.type)).toEqual(["Button", "Card"]);
  });

  it("default index appends", () => {
    const { doc, pageId, card, txt } = tree();
    // move Text (in Card) to root, no index -> append at end of root
    unwrap(moveNode(doc, { pageId, nodeId: txt, parentId: treeRoot(doc).id }, cat));
    expect(treeRoot(doc).children.map((c) => c.type)).toEqual(["Card", "Button", "Text"]);
    void card;
  });

  it("INVALID_TARGET when moving the root", () => {
    const { doc, pageId, rootId, card } = tree();
    expect(errCode(moveNode(doc, { pageId, nodeId: rootId, parentId: card }, cat))).toBe("INVALID_TARGET");
  });

  it("INVALID_TARGET on self-move (cycle)", () => {
    const { doc, pageId, card } = tree();
    expect(errCode(moveNode(doc, { pageId, nodeId: card, parentId: card }, cat))).toBe("INVALID_TARGET");
  });

  it("INVALID_TARGET when target is a descendant (cycle)", () => {
    const { doc, pageId, card, txt } = tree();
    // move Card under its own descendant Text
    expect(errCode(moveNode(doc, { pageId, nodeId: card, parentId: txt }, cat))).toBe("INVALID_TARGET");
  });

  it("INVALID_TARGET when target does not accept children", () => {
    const { doc, pageId, card, btn } = tree();
    // move Card under Button (leaf)
    expect(errCode(moveNode(doc, { pageId, nodeId: card, parentId: btn }, cat))).toBe("INVALID_TARGET");
  });

  it("NOT_FOUND for missing node or target", () => {
    const { doc, pageId, card } = tree();
    expect(errCode(moveNode(doc, { pageId, nodeId: "nX", parentId: card }, cat))).toBe("NOT_FOUND");
    expect(errCode(moveNode(doc, { pageId, nodeId: card, parentId: "nX" }, cat))).toBe("NOT_FOUND");
  });

  it("INVALID_ARG for out-of-range index; doc unchanged", () => {
    const { doc, pageId, card, btn } = tree();
    const before = JSON.stringify(doc);
    expect(errCode(moveNode(doc, { pageId, nodeId: btn, parentId: card, index: 9 }, cat))).toBe("INVALID_ARG");
    expect(JSON.stringify(doc)).toBe(before);
  });

  it("INVALID_PROP (INV5) when moving a node under a target that holds a children prop; doc unchanged", () => {
    const { doc, pageId, rootId } = seeded();
    // 구조적 자식이 없는 Card 에 children 텍스트를 설정(허용), 그 뒤 형제 Button 을 그 밑으로 이동 시도.
    const card = unwrap(addNode(doc, { pageId, type: "Card" }, cat)).nodeId;
    unwrap(setProps(doc, { pageId, nodeId: card, props: { children: "text of card" } }, cat));
    const btn = unwrap(addNode(doc, { pageId, type: "Button", props: { label: "B" } }, cat)).nodeId;
    const before = JSON.stringify(doc);
    expect(errCode(moveNode(doc, { pageId, nodeId: btn, parentId: card }, cat))).toBe("INVALID_PROP");
    expect(JSON.stringify(doc)).toBe(before);
    void rootId;
  });
});

describe("removeNode", () => {
  it("removes a subtree and reports the count", () => {
    const { doc, pageId } = seeded();
    const card = unwrap(addNode(doc, { pageId, type: "Card" }, cat)).nodeId;
    unwrap(addNode(doc, { pageId, type: "Text", parentId: card }, cat));
    const data = unwrap(removeNode(doc, { pageId, nodeId: card }));
    expect(data).toEqual({ removedId: card, removedCount: 2 });
    expect(treeRoot(doc).children).toHaveLength(0);
  });

  it("INVALID_TARGET when removing the root", () => {
    const { doc, pageId, rootId } = seeded();
    expect(errCode(removeNode(doc, { pageId, nodeId: rootId }))).toBe("INVALID_TARGET");
  });

  it("NOT_FOUND for missing node", () => {
    const { doc, pageId } = seeded();
    expect(errCode(removeNode(doc, { pageId, nodeId: "nX" }))).toBe("NOT_FOUND");
  });
});

describe("getNode", () => {
  it("returns the full subtree", () => {
    const { doc, pageId } = seeded();
    const card = unwrap(addNode(doc, { pageId, type: "Card", props: { title: "T" } }, cat)).nodeId;
    unwrap(addNode(doc, { pageId, type: "Text", parentId: card }, cat));
    const node = unwrap(getNode(doc, { pageId, nodeId: card })).node;
    expect(node.type).toBe("Card");
    expect(node.children).toHaveLength(1);
  });
  it("NOT_FOUND for missing page or node", () => {
    const { doc, pageId } = seeded();
    expect(errCode(getNode(doc, { pageId: "pX", nodeId: "n1" }))).toBe("NOT_FOUND");
    expect(errCode(getNode(doc, { pageId, nodeId: "nX" }))).toBe("NOT_FOUND");
  });
});

describe("findNodes", () => {
  function twoPages(): DesignDoc {
    const doc = createDoc();
    const p1 = unwrap(createPage(doc, { name: "P1" })).pageId;
    const p2 = unwrap(createPage(doc, { name: "P2" })).pageId;
    addNode(doc, { pageId: p1, type: "Button", props: { label: "Save Changes" } }, cat);
    addNode(doc, { pageId: p1, type: "Card", props: { title: "Panel" } }, cat);
    addNode(doc, { pageId: p2, type: "Button", props: { label: "Cancel" } }, cat);
    return doc;
  }

  it("filters by type across all pages", () => {
    const doc = twoPages();
    const matches = unwrap(findNodes(doc, { type: "Button" })).matches;
    expect(matches).toHaveLength(2);
    expect(matches.every((m) => m.type === "Button")).toBe(true);
  });

  it("filters by propContains (case-insensitive substring over values)", () => {
    const doc = twoPages();
    const matches = unwrap(findNodes(doc, { propContains: "save" })).matches;
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe("Button");
  });

  it("combines type AND propContains", () => {
    const doc = twoPages();
    expect(unwrap(findNodes(doc, { type: "Card", propContains: "panel" })).matches).toHaveLength(1);
    expect(unwrap(findNodes(doc, { type: "Button", propContains: "panel" })).matches).toHaveLength(0);
  });

  it("scopes to a given page", () => {
    const doc = twoPages();
    const p2 = doc.pages[1].id;
    const matches = unwrap(findNodes(doc, { pageId: p2, type: "Button" })).matches;
    expect(matches).toHaveLength(1);
    expect(matches[0].pageId).toBe(p2);
  });

  it("no filter matches every node", () => {
    const doc = twoPages();
    // p1: root + 2, p2: root + 1 = 5
    expect(unwrap(findNodes(doc, {})).matches).toHaveLength(5);
  });

  it("skips tsx pages in the all-pages walk (no nodes to match)", () => {
    const doc = twoPages();
    createTsxPage(doc, { name: "Code", code: "const x = 1;", origin: "pages/x" });
    // tsx 페이지는 노드가 없어 전 페이지 검색 결과에 영향 없음.
    expect(unwrap(findNodes(doc, {})).matches).toHaveLength(5);
  });

  it("NOT_FOUND when the given page is absent", () => {
    const doc = twoPages();
    expect(errCode(findNodes(doc, { pageId: "pX" }))).toBe("NOT_FOUND");
  });
});

// 종류 게이트(§2): comp.* 는 tree 페이지에만 작동. tsx 페이지를 겨냥하면 INVALID_TARGET.
describe("comp.* kind gate on a tsx page", () => {
  function tsx(): { doc: DesignDoc; pageId: string } {
    const doc = createDoc();
    unwrap(createTsxPage(doc, { name: "Code", code: "const x = 1;", origin: "pages/x" }));
    return { doc, pageId: doc.pages[0].id };
  }

  it("addNode → INVALID_TARGET", () => {
    const { doc, pageId } = tsx();
    expect(errCode(addNode(doc, { pageId, type: "Button", props: { label: "X" } }, cat))).toBe("INVALID_TARGET");
  });
  it("setProps → INVALID_TARGET", () => {
    const { doc, pageId } = tsx();
    expect(errCode(setProps(doc, { pageId, nodeId: "n1", props: { label: "X" } }, cat))).toBe("INVALID_TARGET");
  });
  it("moveNode → INVALID_TARGET", () => {
    const { doc, pageId } = tsx();
    expect(errCode(moveNode(doc, { pageId, nodeId: "n1", parentId: "n2" }, cat))).toBe("INVALID_TARGET");
  });
  it("removeNode → INVALID_TARGET", () => {
    const { doc, pageId } = tsx();
    expect(errCode(removeNode(doc, { pageId, nodeId: "n1" }))).toBe("INVALID_TARGET");
  });
  it("getNode → INVALID_TARGET", () => {
    const { doc, pageId } = tsx();
    expect(errCode(getNode(doc, { pageId, nodeId: "n1" }))).toBe("INVALID_TARGET");
  });
  it("findNodes with an explicit tsx pageId → INVALID_TARGET", () => {
    const { doc, pageId } = tsx();
    expect(errCode(findNodes(doc, { pageId }))).toBe("INVALID_TARGET");
  });
});
