// docs 명령(docs.list / docs.get)의 데이터 shape — 빌드타임에 구운 Astryx 토픽 독트린.
// 단일 진실은 scripts/gen-docs.mjs 산출(generated/docs.json + src/docs/docs.embedded.ts).

// 한 토픽 엔트리. text = 전 섹션을 평문으로 렌더한 전체 문서(docs.get 이 그대로 반환).
export interface DocTopic {
  title: string; // 사람용 제목.
  dense: boolean; // dense 변형(.doc.dense.mjs)을 썼는가(토큰 절약 압축).
  description: string; // 한 줄 요약(docs.list 행).
  text: string; // 전 섹션 렌더 평문(docs.get 본문).
}

// key = 토픽 id(예: "layout", "principles", "getting-started").
export type DocsIndex = Record<string, DocTopic>;

// docs.list 한 행 — 본문 text 는 빼고 발견용 메타만.
export interface DocListRow {
  topic: string;
  title: string;
  dense: boolean;
  description: string;
}
