// 실행 가능한 오류 데이터 — 실패 봉투(§4 {ok,code,message,data?})의 data 축에 교정 정보를 싣는다.
// 공식 연구: 오류 + 유효 옵션 + 예시 → LLM 이 스스로 교정한다. INVALID_TYPE 은 유사 후보(suggestions),
// INVALID_PROP 은 유효 prop 목록(validProps) 또는 enum 값(validValues) + 최소 올바른 예시(example) 를 싣는다.
import type { CatalogEntry, CatalogPropSpec, Err, JsonValue } from "../types";
import { err } from "../types";

// 보편 forward prop — 카탈로그 99종에 주입하지 않고 검증 계층 한 곳에서 허용하는 스타일 탈출구.
export const FORWARDED_PROPS = ["className", "style"] as const;

// 실패 봉투에 data 를 실은 확장형. v2 에서 Err 자체가 data?:Record<string,unknown> 를 가지므로(§4)
// ErrData 는 그와 형이 맞아야 한다 — err() 반환(Err)이 ErrData 반환 자리에 그대로 대입되려면 data 형이
// 일치해야 한다(좁히면 불가). 값은 JsonValue 로 채우되(errData 인자가 강제), 형은 Err 와 통일한다.
export interface ErrData extends Err {
  data?: Record<string, unknown>;
}

// err() 재료에 data 를 붙인다 — code/message 는 여전히 err() 가 단일 소유한다.
export function errData(
  code: Err["code"],
  message: string,
  data: Record<string, JsonValue>,
): ErrData {
  return { ...err(code, message), data };
}

// 케이스 무시 Levenshtein 편집거리(순수, 의존 0).
function editDistance(a: string, b: string): number {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  const m = s.length;
  const n = t.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}

// bad 와 후보들의 유사도 상위 N(케이스 무시). 정규화 편집거리 유사도 + 부분일치 가산. 문턱 미달은 버린다
// (엉뚱한 후보로 오도하지 않게). 동점은 이름 오름차순으로 결정적 정렬.
export function suggestTypes(bad: string, candidates: string[], limit = 5): string[] {
  const b = bad.toLowerCase();
  const scored = candidates.map((c) => {
    const cl = c.toLowerCase();
    const dist = editDistance(bad, c);
    const maxLen = Math.max(bad.length, c.length) || 1;
    let score = 1 - dist / maxLen;
    if (cl.includes(b) || b.includes(cl)) score = Math.max(score, 0.7); // 부분일치 = 강한 신호.
    return { c, score };
  });
  scored.sort((x, y) => y.score - x.score || (x.c < y.c ? -1 : x.c > y.c ? 1 : 0));
  return scored
    .filter((s) => s.score >= 0.34)
    .slice(0, limit)
    .map((s) => s.c);
}

// 이 컴포넌트가 받는 유효 prop 이름 — 카탈로그 선언분 + 보편 forward(className/style). 중복 제거, 순서 보존.
export function validPropNames(entry: CatalogEntry): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (n: string) => {
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  };
  for (const n of Object.keys(entry.props)) push(n);
  for (const n of FORWARDED_PROPS) push(n);
  return out;
}

// prop 스펙 → 유효 placeholder 값(예시용). enum→첫 멤버, 원시→타입별 기본, 그 외→"…"(임의 JsonValue 허용).
function placeholder(spec: CatalogPropSpec): JsonValue {
  if (spec.enum && spec.enum.length > 0) return spec.enum[0];
  if (spec.type === "string") return "text";
  if (spec.type === "number") return 0;
  if (spec.type === "boolean") return true;
  return "…";
}

// 최소 올바른 사용례 — 필수 스칼라 prop placeholder(+ focus 가 실제 prop 이면 그 올바른 값). children 은
// 구조적 채널(node.children)로 채우므로 예시 props 에 넣지 않는다. CONTRACT §2 는 쓰기 시점에 필수 prop 을
// 강제하지 않지만, 예시는 이 컴포넌트를 어떻게 올바르게 채우는지 보여 준다.
export function buildExample(
  entry: CatalogEntry,
  focusProp?: string,
): { type: string; props: Record<string, JsonValue> } {
  const props: Record<string, JsonValue> = {};
  for (const [name, spec] of Object.entries(entry.props)) {
    if (spec.required && name !== "children") props[name] = placeholder(spec);
  }
  if (focusProp && entry.props[focusProp]) props[focusProp] = placeholder(entry.props[focusProp]);
  return { type: entry.type, props };
}

// 보편 forward prop 오류용 예시 — className 은 문자열, style 은 토큰 기반 객체(공식 doctrine: var(--…)).
export function forwardedExample(
  entry: CatalogEntry,
  prop: "className" | "style",
): { type: string; props: Record<string, JsonValue> } {
  const props: Record<string, JsonValue> =
    prop === "className"
      ? { className: "my-class" }
      : { style: { color: "var(--color-fg)" } };
  return { type: entry.type, props };
}
