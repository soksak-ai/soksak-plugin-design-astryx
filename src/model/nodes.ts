// 노드 mutation·조회 — 실패 시 문서 불변(검증 후 변경). 성공 시 CONTRACT §5 평문 데이터 레코드,
// 실패 시 Err. 명령 계층은 원시 params 를 그대로, catalog 인자 없이 넘긴다(useCatalog 등록 소스 사용).
import type { DesignDoc, DesignNode, DesignPage, JsonValue } from "../types";
import { err, type Err } from "../types";
import { makeNode } from "./ids";
import { isErr } from "./result";
import { requireTreeRoot } from "./source";
import { acceptsChildren, allTypes, catalogHas, resolveCatalog, type CatalogInput } from "./catalog";
import { readBool, readNum, readProps, readStr } from "./read";
import { validateProps } from "./props";
import { errData, suggestTypes } from "./actionable";
import {
  cloneJson,
  countNodes,
  findInPage,
  isSelfOrDescendant,
  serializePropSearch,
  walk,
} from "./tree";

// comp.add — parentId 기본=페이지 루트, index 기본=말미. 루트를 새로 만들지 않음(INV1).
export function addNode(
  doc: DesignDoc,
  params: Record<string, unknown>,
  catalog?: CatalogInput,
): { nodeId: string; parentId: string; node: DesignNode } | Err {
  const src = resolveCatalog(catalog);
  const pageId = readStr(params, "pageId") ?? "";
  const page = doc.pages.find((p) => p.id === pageId);
  if (!page) return err("NOT_FOUND", `페이지 '${pageId}' 없음.`);
  const root = requireTreeRoot(page); // 종류 게이트(§2): tsx 페이지면 INVALID_TARGET.
  if (isErr(root)) return root;
  const type = readStr(params, "type") ?? "";
  if (!catalogHas(src, type)) {
    // 유사한 카탈로그 type 이름을 제시(오류 + 유효 옵션 → LLM 자기교정).
    return errData("INVALID_TYPE", `'${type}' 는 카탈로그에 없는 컴포넌트.`, {
      suggestions: suggestTypes(type, allTypes(src)),
    });
  }
  const parentId = readStr(params, "parentId") ?? root.id;
  const located = findInPage(page, parentId);
  if (!located) return err("NOT_FOUND", `노드 '${parentId}' 없음.`);
  const parent = located.node;
  if (!acceptsChildren(src, parent.type)) {
    return err("INVALID_TARGET", `'${parent.type}' 는 자식을 받지 않음.`);
  }
  // INV5: props.children(텍스트)와 구조적 자식은 공존 불가. 부모가 이미 children 속성을 가졌으면
  // 구조적 자식을 붙이지 못한다(먼저 children 속성 제거). 러너·내보내기가 구조적 자식을 우선해
  // props.children 을 조용히 버리므로, 여기서 막지 않으면 텍스트가 소실된다.
  if (Object.prototype.hasOwnProperty.call(parent.props, "children")) {
    return err("INVALID_PROP", `'${parent.type}' 노드에 children 속성이 있어 자식 노드를 추가할 수 없음.`);
  }
  const incoming = readProps(params, "props");
  const entry = src.getEntry(type)!; // catalogHas 통과 → 존재.
  const invalid = validateProps(entry, incoming, false); // 새 노드는 자식 없음.
  if (invalid) return invalid;
  const max = parent.children.length;
  const index = readNum(params, "index") ?? max;
  if (index < 0 || index > max) return err("INVALID_ARG", `index ${index} 가 범위 밖(0..${max}).`);
  // 검증 완료 → 변경.
  const node = makeNode(doc, type);
  for (const [k, v] of Object.entries(incoming)) node.props[k] = cloneJson(v);
  parent.children.splice(index, 0, node);
  return { nodeId: node.id, parentId: parent.id, node };
}

// comp.set — props 병합(replace=true 면 전면 교체). 값 null = 그 키 삭제.
export function setProps(
  doc: DesignDoc,
  params: Record<string, unknown>,
  catalog?: CatalogInput,
): { nodeId: string; node: DesignNode } | Err {
  const src = resolveCatalog(catalog);
  const pageId = readStr(params, "pageId") ?? "";
  const page = doc.pages.find((p) => p.id === pageId);
  if (!page) return err("NOT_FOUND", `페이지 '${pageId}' 없음.`);
  const root = requireTreeRoot(page); // 종류 게이트(§2): tsx 페이지면 INVALID_TARGET.
  if (isErr(root)) return root;
  const nodeId = readStr(params, "nodeId") ?? "";
  const located = findInPage(page, nodeId);
  if (!located) return err("NOT_FOUND", `노드 '${nodeId}' 없음.`);
  const node = located.node;
  const childrenNonEmpty = node.children.length > 0;
  const incoming = readProps(params, "props");
  const replace = readBool(params, "replace");
  // null = 삭제, 그 외 = 설정(검증 대상).
  const sets: Record<string, JsonValue> = {};
  const deletes: string[] = [];
  for (const [k, v] of Object.entries(incoming)) {
    if (v === null) deletes.push(k);
    else sets[k] = v;
  }
  const entry = src.getEntry(node.type);
  if (!entry) {
    if (Object.keys(sets).length > 0) {
      return err("INVALID_PROP", `'${node.type}' 카탈로그 항목 없음.`);
    }
  } else {
    const invalid = validateProps(entry, sets, childrenNonEmpty);
    if (invalid) return invalid;
  }
  // 검증 완료 → 변경.
  if (replace) {
    const next: Record<string, JsonValue> = {};
    for (const [k, v] of Object.entries(sets)) next[k] = cloneJson(v);
    node.props = next;
  } else {
    for (const k of deletes) delete node.props[k];
    for (const [k, v] of Object.entries(sets)) node.props[k] = cloneJson(v);
  }
  return { nodeId: node.id, node };
}

// comp.move — nodeId 를 parentId 아래 index(기본 말미)로 재부모. 루트 이동/사이클/비수용 부모 거부.
export function moveNode(
  doc: DesignDoc,
  params: Record<string, unknown>,
  catalog?: CatalogInput,
): { nodeId: string; parentId: string; index: number } | Err {
  const src = resolveCatalog(catalog);
  const pageId = readStr(params, "pageId") ?? "";
  const page = doc.pages.find((p) => p.id === pageId);
  if (!page) return err("NOT_FOUND", `페이지 '${pageId}' 없음.`);
  const root = requireTreeRoot(page); // 종류 게이트(§2): tsx 페이지면 INVALID_TARGET.
  if (isErr(root)) return root;
  const nodeId = readStr(params, "nodeId") ?? "";
  const located = findInPage(page, nodeId);
  if (!located) return err("NOT_FOUND", `노드 '${nodeId}' 없음.`);
  if (located.parent === null) return err("INVALID_TARGET", "루트 노드는 이동 불가.");
  const parentId = readStr(params, "parentId") ?? "";
  const target = findInPage(page, parentId);
  if (!target) return err("NOT_FOUND", `노드 '${parentId}' 없음.`);
  // 사이클(INV2): 대상이 이동 노드 자신이거나 그 자손.
  if (isSelfOrDescendant(located.node, parentId)) {
    return err("INVALID_TARGET", `대상 '${parentId}' 는 이동 노드 자신이거나 그 자손.`);
  }
  if (!acceptsChildren(src, target.node.type)) {
    return err("INVALID_TARGET", `'${target.node.type}' 는 자식을 받지 않음.`);
  }
  // INV5: 대상이 이미 children 속성(텍스트)을 가졌으면 구조적 자식을 받지 못한다(공존 금지).
  if (Object.prototype.hasOwnProperty.call(target.node.props, "children")) {
    return err("INVALID_PROP", `'${target.node.type}' 노드에 children 속성이 있어 자식 노드를 옮길 수 없음.`);
  }
  const oldParent = located.parent;
  const sameParent = oldParent === target.node;
  // 같은 부모 내 재정렬이면 제거 후 길이가 1 줄어든 배열 기준으로 index 를 해석한다.
  const effectiveLen = sameParent ? target.node.children.length - 1 : target.node.children.length;
  const index = readNum(params, "index") ?? effectiveLen;
  if (index < 0 || index > effectiveLen) {
    return err("INVALID_ARG", `index ${index} 가 범위 밖(0..${effectiveLen}).`);
  }
  // 검증 완료 → 변경. 옛 부모에서 제거 후 대상에 삽입.
  oldParent.children.splice(located.index, 1);
  target.node.children.splice(index, 0, located.node);
  return { nodeId: located.node.id, parentId: target.node.id, index };
}

// comp.remove — 노드와 서브트리 삭제. 루트 삭제 불가(INV1).
export function removeNode(
  doc: DesignDoc,
  params: Record<string, unknown>,
): { removedId: string; removedCount: number } | Err {
  const pageId = readStr(params, "pageId") ?? "";
  const page = doc.pages.find((p) => p.id === pageId);
  if (!page) return err("NOT_FOUND", `페이지 '${pageId}' 없음.`);
  const root = requireTreeRoot(page); // 종류 게이트(§2): tsx 페이지면 INVALID_TARGET.
  if (isErr(root)) return root;
  const nodeId = readStr(params, "nodeId") ?? "";
  const located = findInPage(page, nodeId);
  if (!located) return err("NOT_FOUND", `노드 '${nodeId}' 없음.`);
  if (located.parent === null) return err("INVALID_TARGET", "루트 노드는 삭제 불가.");
  const removedCount = countNodes(located.node);
  located.parent.children.splice(located.index, 1);
  return { removedId: nodeId, removedCount };
}

// comp.get — 서브트리 전체 반환.
export function getNode(
  doc: DesignDoc,
  params: Record<string, unknown>,
): { node: DesignNode } | Err {
  const pageId = readStr(params, "pageId") ?? "";
  const page = doc.pages.find((p) => p.id === pageId);
  if (!page) return err("NOT_FOUND", `페이지 '${pageId}' 없음.`);
  const root = requireTreeRoot(page); // 종류 게이트(§2): tsx 페이지면 INVALID_TARGET.
  if (isErr(root)) return root;
  const nodeId = readStr(params, "nodeId") ?? "";
  const located = findInPage(page, nodeId);
  if (!located) return err("NOT_FOUND", `노드 '${nodeId}' 없음.`);
  return { node: located.node };
}

// comp.find — 전 페이지(또는 한 페이지)에서 type 정확 + propContains 부분일치(대소문자 무시).
export function findNodes(
  doc: DesignDoc,
  params: Record<string, unknown>,
): { matches: { pageId: string; nodeId: string; type: string }[] } | Err {
  const pageId = readStr(params, "pageId");
  const type = readStr(params, "type");
  const propContains = readStr(params, "propContains");
  // 명시 pageId 는 존재해야 하고 tree 여야 한다(tsx → 종류 게이트 INVALID_TARGET, §2).
  // 무명시(전 페이지)는 tsx 페이지를 조용히 건너뛴다 — tsx 엔 검색 대상 노드가 없다.
  let pages: DesignPage[];
  if (pageId !== undefined) {
    const page = doc.pages.find((p) => p.id === pageId);
    if (!page) return err("NOT_FOUND", `페이지 '${pageId}' 없음.`);
    const root = requireTreeRoot(page);
    if (isErr(root)) return root;
    pages = [page];
  } else {
    pages = doc.pages.filter((p) => p.source.kind === "tree");
  }
  const needle = propContains?.toLowerCase();
  const matches: { pageId: string; nodeId: string; type: string }[] = [];
  for (const page of pages) {
    if (page.source.kind !== "tree") continue; // 방어(위에서 tree 만 남김).
    walk(page.source.root, (n) => {
      if (type !== undefined && n.type !== type) return;
      if (needle !== undefined && !serializePropSearch(n.props).toLowerCase().includes(needle)) {
        return;
      }
      matches.push({ pageId: page.id, nodeId: n.id, type: n.type });
    });
  }
  return { matches };
}
