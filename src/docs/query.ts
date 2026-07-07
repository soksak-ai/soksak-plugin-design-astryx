// docs 질의 — docs.list / docs.get 명령의 데이터 성형. 순수 함수(입력 DocsIndex, 부수효과 0).
import type { DocsIndex, DocTopic, DocListRow } from "./types";

// 프로토타입 오염 방지 조회(상속 키가 토픽으로 오인되지 않게 own-property 만).
export function getTopic(docs: DocsIndex, topic: string): DocTopic | undefined {
  return Object.prototype.hasOwnProperty.call(docs, topic)
    ? (docs as Record<string, DocTopic>)[topic]
    : undefined;
}

// docs.list — 토픽 + 한 줄 요약(본문 text 제외). 토픽 id 오름차순 정렬(결정적).
export function listDocs(docs: DocsIndex): DocListRow[] {
  return Object.entries(docs)
    .map(([topic, e]) => ({
      topic,
      title: e.title,
      dense: e.dense,
      description: e.description,
    }))
    .sort((a, b) => (a.topic < b.topic ? -1 : a.topic > b.topic ? 1 : 0));
}

// 토픽 개수.
export function docsCount(docs: DocsIndex): number {
  return Object.keys(docs).length;
}
