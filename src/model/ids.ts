// id 생성 — DesignDoc.seq 단조 증가(재사용 없음). page/node id 는 seq 공간 공유 → 전역 유일(CONTRACT §2).
import type { DesignDoc, DesignNode, JsonValue } from "../types";

export function nextSeq(doc: DesignDoc): number {
  return ++doc.seq;
}

export function nextPageId(doc: DesignDoc): string {
  return "p" + nextSeq(doc);
}

export function nextNodeId(doc: DesignDoc): string {
  return "n" + nextSeq(doc);
}

// 빈 노드 생성(자식 없음). props 기본 {}.
export function makeNode(
  doc: DesignDoc,
  type: string,
  props: Record<string, JsonValue> = {},
): DesignNode {
  return { id: nextNodeId(doc), type, props, children: [] };
}
