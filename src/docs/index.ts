// docs 싱글턴 표면 — 명령 계층(src/commands)이 `import * as docs from "../docs"` 로 쓴다.
// 구운 토픽 독트린은 이 플러그인의 정적 자산이므로(빌드 시 고정) 모듈이 소유한다. 카탈로그가
// build.mjs __CATALOG_JSON__ define 을 쓰는 것과 달리, docs 는 커밋 소스(docs.embedded.ts)를 직접
// import 한다 — build.mjs(계약 소유·이 패스 밖)에 define 을 못 넣고, 커밋 소스라야 클린빌드·vitest
// 양쪽에서 항상 존재하기 때문. 순수 로직(load/query)은 DocsIndex 를 인자로 받는다(테스트 seam).
import type { DocsIndex, DocTopic, DocListRow } from "./types";
import { DOCS } from "./docs.embedded";
import { loadDocs } from "./load";
import { getTopic, listDocs as listPure, docsCount as countPure } from "./query";

let singleton: DocsIndex | null = null;

// 지연 초기화 — 첫 호출에서 한 번만 검증. DOCS 는 생성기가 구운 커밋 데이터.
function docsIndex(): DocsIndex {
  if (singleton) return singleton;
  singleton = loadDocs(DOCS);
  return singleton;
}

// docs.list — 토픽 + 한 줄 요약 행.
export function listDocs(): DocListRow[] {
  return listPure(docsIndex());
}

// docs.get — 한 토픽의 전체 엔트리(없으면 undefined → 핸들러가 NOT_FOUND).
export function getDoc(topic: string): DocTopic | undefined {
  return getTopic(docsIndex(), topic);
}

// 토픽 개수(진단·메시지용).
export function docsCount(): number {
  return countPure(docsIndex());
}

export { loadDocs };
export type { DocTopic, DocListRow, DocsIndex };
