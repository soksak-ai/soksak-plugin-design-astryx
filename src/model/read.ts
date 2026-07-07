// 파라미터 판독 — 명령 계층은 코어 registry 가 스키마 검증한 원시 params(Record<string,unknown>)를
// 그대로 모델에 넘긴다(commands/index.ts). 여기서 필드를 타입 안전하게 좁힌다(형 불일치=미지정 취급).
import type { JsonValue } from "../types";

export function readStr(p: Record<string, unknown>, key: string): string | undefined {
  const v = p[key];
  return typeof v === "string" ? v : undefined;
}

export function readNum(p: Record<string, unknown>, key: string): number | undefined {
  const v = p[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function readBool(p: Record<string, unknown>, key: string): boolean {
  return p[key] === true;
}

// prop 맵 — 순수 객체만. 배열/스칼라/null 은 빈 맵으로 무시.
export function readProps(p: Record<string, unknown>, key: string): Record<string, JsonValue> {
  const v = p[key];
  if (v !== null && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, JsonValue>;
  }
  return {};
}
