// 카탈로그 로더 — generated/catalog.json(런타임엔 build define __CATALOG_JSON__ 문자열)을 파싱·검증해
// 타입 있는 Catalog 로 만든다. 빌드가 유효성을 보장하지만, 로더는 구조를 실제로 검사한다(런타임 방어·테스트 seam).
// 형식 위반은 명확한 메시지로 throw — 침묵 통과 금지.

import type { Catalog, CatalogEntry, CatalogPropSpec } from "../types";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function fail(msg: string): never {
  throw new Error(`[design-astryx] catalog 형식 오류: ${msg}`);
}

function validatePropSpec(where: string, spec: unknown): asserts spec is CatalogPropSpec {
  if (!isPlainObject(spec)) fail(`${where} — prop 스펙이 객체가 아님`);
  if (typeof spec.type !== "string") fail(`${where}.type 이 문자열이 아님`);
  if (typeof spec.required !== "boolean") fail(`${where}.required 가 불리언이 아님`);
  if (typeof spec.description !== "string") fail(`${where}.description 이 문자열이 아님`);
  if (spec.enum !== undefined) {
    if (!Array.isArray(spec.enum) || !spec.enum.every((m) => typeof m === "string")) {
      fail(`${where}.enum 이 문자열 배열이 아님`);
    }
  }
  if (spec.default !== undefined && typeof spec.default !== "string") {
    fail(`${where}.default 가 문자열이 아님`);
  }
}

function validateEntry(key: string, entry: unknown): asserts entry is CatalogEntry {
  if (!isPlainObject(entry)) fail(`엔트리 '${key}' 가 객체가 아님`);
  if (entry.type !== key) fail(`엔트리 '${key}'.type(${String(entry.type)}) 가 키와 불일치`);
  if (entry.importName !== key) fail(`엔트리 '${key}'.importName(${String(entry.importName)}) 가 키와 불일치`);
  if (typeof entry.description !== "string" || entry.description.length === 0) {
    fail(`엔트리 '${key}'.description 이 비었거나 문자열이 아님`);
  }
  if (typeof entry.acceptsChildren !== "boolean") fail(`엔트리 '${key}'.acceptsChildren 이 불리언이 아님`);
  if (!isPlainObject(entry.props)) fail(`엔트리 '${key}'.props 가 객체가 아님`);
  for (const [pn, ps] of Object.entries(entry.props)) {
    validatePropSpec(`엔트리 '${key}'.props.${pn}`, ps);
  }
}

// JSON 문자열 → 검증된 Catalog. 미선언 확장 필드(group 등)는 보존한다(catalog.list group 필터가 소비).
export function loadCatalog(json: string): Catalog {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    fail(`JSON 파싱 실패: ${(e as Error).message}`);
  }
  if (!isPlainObject(parsed)) fail("최상위가 객체가 아님");
  for (const [key, entry] of Object.entries(parsed)) {
    validateEntry(key, entry);
  }
  return parsed as Catalog;
}
