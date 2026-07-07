// 제어 입력 컴포넌트 집합 파생(단일 진실) — 트리 경로 정적 목업 입력 법칙(render-core/tree
// sanitizeProps)이 쓰는 집합. value prop 이 있고 on* 콜백 prop 을 하나라도 가진 컴포넌트만.
// ProgressBar/Timestamp 처럼 value 를 표시용으로만 읽는(콜백 없는) 컴포넌트는 제외돼 손상되지 않는다.
// (v2 build-runner.mjs 가 빌드타임에 하던 파생을 뷰가 런타임에 카탈로그에서 직접 하도록 이전.)
import type { CatalogEntry } from "../types";

function isCallback(type: unknown): boolean {
  return typeof type === "string" && type.includes("=>");
}

export function deriveControlledInputs(entries: Iterable<CatalogEntry>): Set<string> {
  const out = new Set<string>();
  for (const e of entries) {
    const props = e.props;
    if (!props || !props.value) continue;
    const hasHandler = Object.entries(props).some(
      ([k, p]) => /^on[A-Z]/.test(k) && isCallback(p?.type),
    );
    if (hasHandler) out.add(e.type);
  }
  return out;
}
