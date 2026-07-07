// 템플릿 데이터 로직(순수) — template.list / template.apply 핸들러가 쓰는 조회·요약 함수.
// 임베드된 generated/templates.json 을 인자로 받아 처리하므로(전역 define 미의존) 단위 테스트가
// 그대로 검증한다. 바인딩(define 파싱)은 src/templates/index.ts 가 담당한다.
//
// v2(CONTRACT §13): 엔트리는 원본 TSX 를 verbatim 담는다. template.apply 는 getTemplate 으로 엔트리를
// 얻어 그 code 로 tsx 페이지를 만든다(available=false 는 핸들러가 TEMPLATE_UNAVAILABLE+reason 으로 거부).

import type { TemplateEntry, TemplateKind } from "../types";

// template.list 표시용 요약(code 본문 제외 — 메타만). available=false 면 reason 동반.
export interface TemplateSummary {
  id: string;
  kind: TemplateKind;
  name: string;
  requires: string[];
  available: boolean;
  reason?: string;
}

// 미가용 꼬리(꺼져있어도 늘 개수+사유로 보고).
export interface UnavailableSummary {
  id: string;
  name: string;
  reason: string;
}

// template.list 반환 데이터(CONTRACT §5). available = 목록에 담긴 가용 템플릿 수.
export interface TemplateListing {
  templates: TemplateSummary[];
  available: number;
  unavailableCount: number;
  unavailable: UnavailableSummary[];
}

function summarize(t: TemplateEntry): TemplateSummary {
  const s: TemplateSummary = {
    id: t.id,
    kind: t.kind,
    name: t.name,
    requires: t.requires,
    available: t.available,
  };
  if (!t.available && t.reason !== undefined) s.reason = t.reason;
  return s;
}

// template.list 데이터. 기본은 available===true 만 목록에 담고 미가용은 개수+사유로 보고한다.
// includeUnavailable=true 면 목록 배열에도 미가용 엔트리(available·reason 동반)를 싣는다(§5·§13).
export function listTemplates(
  all: TemplateEntry[],
  opts: { kind?: TemplateKind; includeUnavailable?: boolean } = {},
): TemplateListing {
  const scoped = opts.kind ? all.filter((t) => t.kind === opts.kind) : all;
  const availableEntries = scoped.filter((t) => t.available);
  const unavailableEntries = scoped.filter((t) => !t.available);
  const listing = opts.includeUnavailable ? scoped : availableEntries;
  return {
    templates: listing.map(summarize),
    available: availableEntries.length,
    unavailableCount: unavailableEntries.length,
    unavailable: unavailableEntries.map((t) => ({ id: t.id, name: t.name, reason: t.reason ?? "" })),
  };
}

// template.apply 용 원본 엔트리 조회(code·available·reason 완비). 없으면 undefined(핸들러가 TEMPLATE_UNKNOWN).
export function getTemplate(all: TemplateEntry[], id: string): TemplateEntry | undefined {
  return all.find((t) => t.id === id);
}
