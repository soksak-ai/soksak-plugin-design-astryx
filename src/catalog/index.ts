// 카탈로그 싱글턴 표면 — 명령 계층(src/commands)이 `import * as catalog from "../catalog"` 로 쓴다.
// 카탈로그는 이 플러그인의 정적 자산이므로(빌드 시 고정) 모듈이 소유한다: build.mjs 의 esbuild define
// __CATALOG_JSON__(generated/catalog.json 원문 문자열)을 지연 파싱해 단일 인스턴스로 든다.
//
// 순수 로직(load.ts·query.ts)은 catalog 를 인자로 받는다(테스트 seam). 이 파일은 그 인스턴스를 싱글턴으로
// 고정하고 인자 없는(또는 type 만 받는) 편의 표면으로 위임한다. 트리/모델 계층은 별도의 pure
// src/model/catalog.ts(카탈로그를 파라미터로 받음)를 쓴다 — 두 계층의 소유 경계가 다르다.
import type { Catalog, CatalogEntry } from "../types";
import { loadCatalog } from "./load";
import {
  listCatalog,
  getEntry as getEntryPure,
  catalogDoc as catalogDocPure,
  type CatalogListRow,
  type CatalogListOptions,
} from "./query";

// build.mjs 의 esbuild define. 런타임 값 = generated/catalog.json 원문 JSON 문자열.
// vitest 등 define 없는 환경에선 typeof 가드가 빈 카탈로그로 폴백한다(모듈 import 만으로 크래시 없음;
// 순수 로직 검증은 load/query 를 픽스처로 직접 테스트한다).
declare const __CATALOG_JSON__: string;

let singleton: Catalog | null = null;

// 지연 초기화 — 첫 호출에서 한 번만 파싱. define 은 빌드에서 문자열 리터럴로 치환된다.
function catalog(): Catalog {
  if (singleton) return singleton;
  const json = typeof __CATALOG_JSON__ !== "undefined" ? __CATALOG_JSON__ : "{}";
  singleton = loadCatalog(json);
  return singleton;
}

// ping — 컴포넌트 종 수.
export function catalogCount(): number {
  return Object.keys(catalog()).length;
}

// 전체 type 이름 — model.CatalogSource.types() 계약(INVALID_TYPE 유사 후보 제안에 필요).
export function types(): string[] {
  return Object.keys(catalog());
}

// catalog.list — group/query 로 좁힌 행 목록.
export function listComponents(opts?: CatalogListOptions): CatalogListRow[] {
  return listCatalog(catalog(), opts);
}

// catalog.doc — 한 컴포넌트의 전체 엔트리(없으면 undefined → 핸들러가 INVALID_TYPE).
export function getEntry(type: string): CatalogEntry | undefined {
  return getEntryPure(catalog(), type);
}

// catalog.doc 별칭(의미 명시용). getEntry 와 동일.
export function catalogDoc(type: string): CatalogEntry | undefined {
  return catalogDocPure(catalog(), type);
}

export { loadCatalog };
export type { CatalogListRow, CatalogListOptions };
