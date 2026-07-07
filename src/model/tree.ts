// 순수 트리 유틸 — 순회·조회·복제·검색. I/O 없음.
import type { DesignDoc, DesignNode, DesignPage, JsonValue, PageKind } from "../types";
import { nextNodeId } from "./ids";

// 전위 순회(부모 먼저).
export function walk(node: DesignNode, visit: (n: DesignNode) => void): void {
  visit(node);
  for (const child of node.children) walk(child, visit);
}

// 서브트리 노드 수(자신 포함).
export function countNodes(node: DesignNode): number {
  let n = 1;
  for (const child of node.children) n += countNodes(child);
  return n;
}

// 서브트리의 모든 id(전위).
export function collectIds(node: DesignNode): string[] {
  const ids: string[] = [];
  walk(node, (n) => ids.push(n.id));
  return ids;
}

// id 가 node 자신이거나 그 자손인지 — 이동 사이클 방지(INV2)에 사용.
export function isSelfOrDescendant(node: DesignNode, id: string): boolean {
  let hit = false;
  walk(node, (n) => {
    if (n.id === id) hit = true;
  });
  return hit;
}

export interface Located {
  node: DesignNode;
  parent: DesignNode | null; // 루트면 null.
  index: number; // 부모의 children 내 위치. 루트면 -1.
}

// 페이지 내에서 nodeId 를 찾아 노드·부모·인덱스를 돌려준다. 없으면 null.
// tsx 페이지엔 노드가 없으므로 항상 null(호출부는 comp.* 가 이미 종류 게이트를 통과한 뒤 부른다).
export function findInPage(page: DesignPage, nodeId: string): Located | null {
  if (page.source.kind !== "tree") return null;
  const root = page.source.root;
  if (root.id === nodeId) return { node: root, parent: null, index: -1 };
  const stack: DesignNode[] = [root];
  while (stack.length > 0) {
    const cur = stack.pop() as DesignNode;
    for (let i = 0; i < cur.children.length; i++) {
      const child = cur.children[i];
      if (child.id === nodeId) return { node: child, parent: cur, index: i };
      stack.push(child);
    }
  }
  return null;
}

// JSON 값 깊은 복제(외부 참조 격리).
export function cloneJson(value: JsonValue): JsonValue {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(cloneJson);
  const out: { [k: string]: JsonValue } = {};
  for (const [k, v] of Object.entries(value)) out[k] = cloneJson(v);
  return out;
}

// 서브트리 깊은 복제 + 새 id 할당(전위) — page.duplicate·template.apply·page.create(template) 용.
export function cloneWithFreshIds(doc: DesignDoc, node: DesignNode): DesignNode {
  const id = nextNodeId(doc);
  const props: Record<string, JsonValue> = {};
  for (const [k, v] of Object.entries(node.props)) props[k] = cloneJson(v);
  const children = node.children.map((c) => cloneWithFreshIds(doc, c));
  return { id, type: node.type, props, children };
}

// prop 값 직렬화 — comp.find propContains 검색 대상(값만, 키 제외).
export function serializePropSearch(props: Record<string, JsonValue>): string {
  return Object.values(props)
    .map((v) => (typeof v === "string" ? v : JSON.stringify(v)))
    .join("\n");
}

// 문서 전체 id(페이지 id + 트리 페이지의 모든 노드 id). tsx 페이지는 노드가 없어 page.id 만 낸다.
export function allIds(doc: DesignDoc): string[] {
  const ids: string[] = [];
  for (const page of doc.pages) {
    ids.push(page.id);
    if (page.source.kind === "tree") ids.push(...collectIds(page.source.root));
  }
  return ids;
}

// 페이지 요약 — state·page.list 데이터 레코드용. rootType/nodeCount 는 트리 페이지에만 있다(§5).
export interface PageSummary {
  id: string;
  name: string;
  kind: PageKind;
  rootType?: string;
  nodeCount?: number;
}

export function summarizePage(page: DesignPage): PageSummary {
  if (page.source.kind === "tree") {
    return {
      id: page.id,
      name: page.name,
      kind: "tree",
      rootType: page.source.root.type,
      nodeCount: countNodes(page.source.root),
    };
  }
  return { id: page.id, name: page.name, kind: "tsx" };
}
