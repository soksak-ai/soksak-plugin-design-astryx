// 카탈로그 질의 — catalog.list / catalog.doc 명령의 데이터 성형 + 트리 핸들러가 쓰는 카탈로그 원자 조회.
// 순수 함수(입력 Catalog, 부수효과 0). 핸들러는 결과를 §4 성공 데이터 레코드로 그대로 반환한다.

import type { Catalog, CatalogEntry } from "../types";

// catalog.list 한 행. → { components: CatalogListRow[] }.
export interface CatalogListRow {
  type: string;
  description: string;
  acceptsChildren: boolean;
  propCount: number;
}

export interface CatalogListOptions {
  group?: string; // 정확 일치(빈 문자열은 필터 없음으로 취급).
  query?: string; // type/description 에 대한 대소문자 무시 부분일치.
}

// 프로토타입 오염 방지 조회("__proto__" 등 상속 키가 엔트리로 오인되지 않게 own-property 만).
export function getEntry(catalog: Catalog, type: string): CatalogEntry | undefined {
  return Object.prototype.hasOwnProperty.call(catalog, type)
    ? (catalog as Record<string, CatalogEntry>)[type]
    : undefined;
}

// INV3(known type) 게이트가 쓰는 존재 검사.
export function hasType(catalog: Catalog, type: string): boolean {
  return getEntry(catalog, type) !== undefined;
}

// INV4(children gate) 가 쓰는 자식 허용 여부. 미지 type 은 false.
export function acceptsChildren(catalog: Catalog, type: string): boolean {
  return getEntry(catalog, type)?.acceptsChildren ?? false;
}

// 엔트리 prop 개수(catalog.list 행·catalog.doc 메시지용).
export function propCount(entry: CatalogEntry): number {
  return Object.keys(entry.props).length;
}

// group 은 types.ts CatalogEntry 미선언 확장 필드 — catalog.json 이 실어보낸다. 방어적으로 읽는다.
export function entryGroup(entry: CatalogEntry): string | undefined {
  const g = (entry as { group?: unknown }).group;
  return typeof g === "string" && g.length > 0 ? g : undefined;
}

// catalog.doc — 전체 CatalogEntry. 없으면 undefined(핸들러가 INVALID_TYPE 로 매핑).
export function catalogDoc(catalog: Catalog, type: string): CatalogEntry | undefined {
  return getEntry(catalog, type);
}

// catalog.list — group(정확)·query(부분일치)로 좁힌 행 목록. 둘 다 주어지면 AND. type 오름차순 정렬(결정적).
export function listCatalog(catalog: Catalog, opts: CatalogListOptions = {}): CatalogListRow[] {
  const group = opts.group && opts.group.length > 0 ? opts.group : undefined;
  const query = opts.query && opts.query.length > 0 ? opts.query.toLowerCase() : undefined;

  const rows: CatalogListRow[] = [];
  for (const entry of Object.values(catalog)) {
    if (group !== undefined && entryGroup(entry) !== group) continue;
    if (query !== undefined) {
      const hay = `${entry.type} ${entry.description}`.toLowerCase();
      if (!hay.includes(query)) continue;
    }
    rows.push({
      type: entry.type,
      description: entry.description,
      acceptsChildren: entry.acceptsChildren,
      propCount: propCount(entry),
    });
  }
  rows.sort((a, b) => (a.type < b.type ? -1 : a.type > b.type ? 1 : 0));
  return rows;
}
