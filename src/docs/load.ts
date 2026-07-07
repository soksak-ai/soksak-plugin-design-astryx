// docs 로더 — 구운 docs 데이터(DOCS)를 파싱·검증해 타입 있는 DocsIndex 로 만든다. 생성기가 유효성을
// 보장하지만 로더가 구조를 실제로 검사한다(런타임 방어·테스트 seam). 형식 위반은 명확한 메시지로 throw.
import type { DocsIndex, DocTopic } from "./types";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function fail(msg: string): never {
  throw new Error(`[design-astryx] docs 형식 오류: ${msg}`);
}

function validateTopic(key: string, entry: unknown): asserts entry is DocTopic {
  if (!isPlainObject(entry)) fail(`토픽 '${key}' 가 객체가 아님`);
  if (typeof entry.title !== "string" || entry.title.length === 0) {
    fail(`토픽 '${key}'.title 이 비었거나 문자열이 아님`);
  }
  if (typeof entry.dense !== "boolean") fail(`토픽 '${key}'.dense 가 불리언이 아님`);
  if (typeof entry.description !== "string" || entry.description.length === 0) {
    fail(`토픽 '${key}'.description 이 비었거나 문자열이 아님`);
  }
  if (typeof entry.text !== "string" || entry.text.length === 0) {
    fail(`토픽 '${key}'.text 가 비었거나 문자열이 아님`);
  }
}

// unknown → 검증된 DocsIndex. 최소 하나의 토픽을 요구한다(빈 산출 금지 — 완전성 규율).
export function loadDocs(raw: unknown): DocsIndex {
  if (!isPlainObject(raw)) fail("최상위가 객체가 아님");
  const keys = Object.keys(raw);
  if (keys.length === 0) fail("토픽이 0개");
  for (const [key, entry] of Object.entries(raw)) {
    validateTopic(key, entry);
  }
  return raw as DocsIndex;
}
