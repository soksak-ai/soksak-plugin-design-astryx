// 카탈로그 소스 — 모델은 카탈로그를 소유하지 않는다(generated/catalog.json 은 catalog 서브모듈 소유).
// 명령 계층은 mutate 호출에 catalog 를 넘기지 않으므로(commands/index.ts 참조), 활성화 시 plugin-entry
// 가 useCatalog(source) 로 실사용 소스를 등록한다. 단위테스트는 fixtureCatalog 를 명시 인자로 주입한다.
import type { Catalog, CatalogEntry } from "../types";

// 최소 의존 표면 — type→CatalogEntry 조회 하나. catalog 서브모듈의 getEntry(type) 와 동형.
// types() 는 선택(INVALID_TYPE 유사 후보 제안에 전체 type 이름이 필요). 없으면 후보는 빈 목록.
export interface CatalogSource {
  getEntry(type: string): CatalogEntry | undefined;
  types?(): string[];
}

// 함수에 넘길 수 있는 형태: 완전 카탈로그 맵(테스트) 또는 소스 객체.
export type CatalogInput = Catalog | CatalogSource;

let registered: CatalogSource | null = null;

// plugin-entry(activate)가 실사용 카탈로그 소스를 등록한다. 명령 계층은 catalog 인자 없이 mutate 를 호출.
export function useCatalog(source: CatalogSource): void {
  registered = source;
}

const EMPTY: CatalogSource = { getEntry: () => undefined };

function isSource(x: CatalogInput): x is CatalogSource {
  return typeof (x as CatalogSource).getEntry === "function";
}

// 인자 우선(테스트 주입) → 없으면 등록 소스 → 둘 다 없으면 빈 소스(모든 type 미지).
export function resolveCatalog(input?: CatalogInput): CatalogSource {
  if (input) {
    if (isSource(input)) return input;
    const map = input as Catalog;
    return { getEntry: (t) => map[t], types: () => Object.keys(map) };
  }
  return registered ?? EMPTY;
}

// 카탈로그가 아는 전체 type 이름(INVALID_TYPE 유사 후보용). 소스가 types() 를 안 주면 빈 목록.
export function allTypes(src: CatalogSource): string[] {
  return src.types ? src.types() : [];
}

export function getEntry(src: CatalogSource, type: string): CatalogEntry | undefined {
  return src.getEntry(type);
}

export function catalogHas(src: CatalogSource, type: string): boolean {
  return src.getEntry(type) !== undefined;
}

export function acceptsChildren(src: CatalogSource, type: string): boolean {
  return src.getEntry(type)?.acceptsChildren === true;
}
