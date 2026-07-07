// 인스펙터 폼 모델 파생(순수) — 선택 노드의 카탈로그 엔트리 → 필드 모델 목록(§7 Inspector law).
// 손으로 쓴 컴포넌트별 폼이 없다: 이 파생이 99개 컴포넌트를 한 규칙으로 덮는다. 컨트롤 매핑:
//   enum(문자열 리터럴 유니온)→Selector · boolean→Switch · spacing(0~10 간격 스케일)→stepper ·
//   number(원시/비-간격 수치 유니온)→numeric TextInput · string→TextInput ·
//   style/className→raw TextInput · 콜백/ReactNode/기타→readonly note.
// 인스펙터 컴포넌트는 이 모델을 얇게 그리고, 편집은 comp.set 로 인프로세스 dispatch 한다(단일 진실).
// 시간·React·astryx 는 이 파일에 없다 — 순수 로직만(테스트 seam).
import type { CatalogEntry, CatalogPropSpec, JsonValue } from "../types";

// Astryx SpacingStep 스케일(utils/types.d.ts) — 0~10 이산 간격. spacing stepper 의 허용 값 집합.
export const SPACING_SCALE: readonly number[] = [0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10];

export type FieldKind = "enum" | "boolean" | "spacing" | "number" | "string" | "raw" | "readonly";

export interface FieldModel {
  name: string; // prop 이름(= comp.set 키).
  kind: FieldKind; // 컨트롤 종류.
  typeLabel: string; // 카탈로그 원본 타입 문자열(힌트·readonly 표시).
  required: boolean; // 카탈로그 required.
  description: string; // 카탈로그 설명(빈 문자열 가능).
  value: JsonValue | undefined; // 노드 props 의 현재 값(미설정 = undefined).
  default?: string; // 카탈로그 default 원문(placeholder 힌트).
  options?: string[]; // enum: 멤버.
  steps?: number[]; // spacing: 정렬된 허용 스텝.
  min?: number; // spacing/number: 하한(스텝/멤버 파생).
  max?: number; // spacing/number: 상한.
  step?: number; // spacing: stepper 증분(최소 스텝 간격).
  readonlyReason?: "callback" | "component" | "unsupported"; // readonly 사유.
}

// 콜백 타입("=>") · React 노드 타입("ReactNode"/"ReactElement") 판별.
function isCallback(t: string): boolean {
  return t.includes("=>");
}
function isReactNode(t: string): boolean {
  return /\bReactNode\b|\bReactElement\b/.test(t);
}

// "0 | 0.5 | 1 …" 처럼 모든 멤버가 유한 수치인 리터럴 유니온이면 숫자 배열, 아니면 null.
function parseNumericUnion(t: string): number[] | null {
  const parts = t.split("|").map((s) => s.trim());
  if (parts.length < 2) return null;
  const nums: number[] = [];
  for (const p of parts) {
    if (!/^-?\d+(\.\d+)?$/.test(p)) return null;
    nums.push(Number(p));
  }
  return nums;
}

// spacing 판별 → 정렬된 스텝(아니면 null). SpacingStep 별칭이거나, 0 또는 소수를 포함한 수치 유니온
// (간격 스케일 마커 — headingLevel(1..6)·numberOfMonths(1|2) 같은 순수 정수 유니온은 배제된다).
function spacingSteps(spec: CatalogPropSpec): number[] | null {
  if (spec.type === "SpacingStep") return [...SPACING_SCALE];
  const nums = parseNumericUnion(spec.type);
  if (!nums) return null;
  const isSpacing = nums.includes(0) || nums.some((n) => !Number.isInteger(n));
  return isSpacing ? [...nums].sort((a, b) => a - b) : null;
}

// 최소 양(+) 스텝 간격 — stepper 증분. 유일 스텝이면 1 로 폴백.
function minGap(steps: number[]): number {
  let g = Infinity;
  for (let i = 1; i < steps.length; i++) g = Math.min(g, steps[i] - steps[i - 1]);
  return Number.isFinite(g) && g > 0 ? g : 1;
}

// 한 prop → 컨트롤 종류(§7 Inspector law). 첫 매치 승. style/className 은 타입 불문 이름으로 raw.
export function classifyProp(name: string, spec: CatalogPropSpec): FieldKind {
  if (name === "style" || name === "className") return "raw";
  if (spec.enum && spec.enum.length > 0) return "enum";
  if (spec.type === "boolean") return "boolean";
  if (spacingSteps(spec)) return "spacing";
  if (spec.type === "number" || parseNumericUnion(spec.type)) return "number";
  if (spec.type === "string") return "string";
  return "readonly";
}

// readonly 사유 — 콜백 > ReactNode > 기타(SizeValue·ElementType·StyleXStyles 등 컨트롤 없음).
function readonlyReason(spec: CatalogPropSpec): FieldModel["readonlyReason"] {
  if (isCallback(spec.type)) return "callback";
  if (isReactNode(spec.type)) return "component";
  return "unsupported";
}

// 카탈로그 엔트리 + 현재 노드 props → 필드 모델 목록. props 선언 순서를 보존(카탈로그·docs 동형).
// 모든 prop 이 한 필드가 된다 — 편집 가능(컨트롤)이든 readonly(note)이든. 인스펙터가 둘을 갈라 그린다.
export function deriveForm(entry: CatalogEntry, props: Record<string, JsonValue>): FieldModel[] {
  const out: FieldModel[] = [];
  for (const [name, spec] of Object.entries(entry.props)) {
    const kind = classifyProp(name, spec);
    const model: FieldModel = {
      name,
      kind,
      typeLabel: spec.type,
      required: spec.required,
      description: spec.description ?? "",
      value: name in props ? props[name] : undefined,
    };
    if (spec.default !== undefined) model.default = spec.default;
    if (kind === "enum") model.options = spec.enum ? [...spec.enum] : [];
    if (kind === "spacing") {
      const steps = spacingSteps(spec) as number[];
      model.steps = steps;
      model.min = steps[0];
      model.max = steps[steps.length - 1];
      model.step = minGap(steps);
    }
    if (kind === "number") {
      const nums = parseNumericUnion(spec.type);
      if (nums) {
        const s = [...nums].sort((a, b) => a - b);
        model.min = s[0];
        model.max = s[s.length - 1];
      }
    }
    if (kind === "readonly") model.readonlyReason = readonlyReason(spec);
    out.push(model);
  }
  return out;
}

// raw 텍스트 → JsonValue. JSON 으로 파싱되면 그 값(style 객체), 아니면 원문 문자열(className).
export function parseRawValue(text: string): JsonValue {
  const t = text.trim();
  if (t === "") return "";
  try {
    return JSON.parse(t) as JsonValue;
  } catch {
    return text;
  }
}

// raw 필드 dispatch 값. className(typeLabel==="string")은 파싱 없이 원문 — "true" 가 boolean 으로
// 새지 않게. style(객체 타입)은 JSON 파싱을 시도하고 실패 시 원문(부분 입력 관용, §2 는 JsonValue 허용).
export function coerceRaw(field: FieldModel, text: string): JsonValue {
  if (field.typeLabel === "string") return text;
  return parseRawValue(text);
}

// 컨트롤 UI 값 → comp.set 에 실을 JsonValue. 빈/비수치 number 는 null(§2: 키 삭제).
export function coerceFieldValue(field: FieldModel, raw: unknown): JsonValue {
  switch (field.kind) {
    case "boolean":
      return Boolean(raw);
    case "enum":
    case "string":
      return String(raw);
    case "number":
    case "spacing": {
      if (raw === "" || raw === null || raw === undefined) return null;
      const n = typeof raw === "number" ? raw : Number(raw);
      return Number.isFinite(n) ? n : null;
    }
    case "raw":
      return coerceRaw(field, String(raw));
    default:
      return raw as JsonValue; // readonly 는 dispatch 되지 않음.
  }
}

// 텍스트/raw 입력의 현재 표시 문자열. 객체(style)는 JSON 문자열로, 미설정/​null 은 빈 문자열.
export function displayValue(field: FieldModel): string {
  const v = field.value;
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

// NumberInput(스텝퍼) 값 — 숫자거나 수치 문자열만 숫자로, 그 외 null(빈 스텝퍼).
export function numericValue(field: FieldModel): number | null {
  const v = field.value;
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

// comp.set 파라미터 빌더(순수) — 단일 prop 편집. null 값은 그대로 실어 키 삭제 신호로 쓴다(§2).
export function compSetParams(
  pageId: string,
  nodeId: string,
  name: string,
  value: JsonValue,
): { pageId: string; nodeId: string; props: Record<string, JsonValue> } {
  return { pageId, nodeId, props: { [name]: value } };
}
