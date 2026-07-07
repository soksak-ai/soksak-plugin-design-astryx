// 메시지 프로토콜 v1 보조 — 봉투 판정과 파라미터 강제(coercion). 순수 함수만(콜로케이트 테스트).
// 성공 축엔 헬퍼가 없다(핸들러가 데이터 레코드를 그대로 return). 실패 축은 types.ts 의 err() 로.
import type { Err } from "../types";

// Err 판정 — 모델/서브모듈이 돌려준 값이 실패 봉투인지. 성공 데이터 레코드엔 ok 키가 없다.
// (핸들러 반환 규약: 성공 = 평문 데이터 레코드, 실패 = {ok:false,code,message}.)
export function isErr(v: unknown): v is Err {
  return typeof v === "object" && v !== null && (v as { ok?: unknown }).ok === false;
}

// 예외 → 문자열. Tauri invoke 는 문자열로 reject 하므로(Error 아님) (e as Error).message 가
// undefined 가 된다 → 문자열/임의 throw 까지 안전하게 문자열화한다.
export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

// ── 파라미터 강제 ────────────────────────────────────────────────────────────
// 코어 registry 가 ParamSpec 로 일부를 강제하나 핸들러가 최종 방어(꼼수 아니라 구조로 안전).

export function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export function asNonEmptyString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v : undefined;
}

export function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function asRecord(v: unknown): Record<string, unknown> | undefined {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
}
