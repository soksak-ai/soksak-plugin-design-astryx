// prop 검증 — CONTRACT §2 prop validation law. 위반 시 첫 Err 반환, 통과 시 null.
// 실패 봉투에는 교정 데이터(validProps/validValues/example) 를 실어 LLM 자기교정을 돕는다(§3 actionable).
import type { CatalogEntry, JsonValue } from "../types";
import { err } from "../types";
import {
  buildExample,
  errData,
  forwardedExample,
  validPropNames,
  type ErrData,
} from "./actionable";

function isPlainObject(v: unknown): v is Record<string, JsonValue> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// childrenNonEmpty = 대상 노드가 이미 구조적 자식(node.children)을 가졌는가(INV5 게이트).
// incoming 은 "설정할" 값만 담긴다(comp.set 의 null=삭제 항목은 호출부에서 제외됨).
export function validateProps(
  entry: CatalogEntry,
  incoming: Record<string, JsonValue>,
  childrenNonEmpty: boolean,
): ErrData | null {
  for (const [name, value] of Object.entries(incoming)) {
    // INV5: 자식 노드가 있는 동안 children 속성 금지(구조적 사안 — 교정 데이터 없음).
    if (name === "children" && childrenNonEmpty) {
      return err("INVALID_PROP", "자식 노드가 있어 children 속성을 둘 수 없음.");
    }
    // 보편 forward prop(className/style) — 모든 노드가 루트로 전달하는 스타일 탈출구(공식 doctrine).
    // 카탈로그 99종에 주입하지 않고 여기 한 곳에서 허용한다. className=문자열, style=평범한 객체.
    if (name === "className") {
      if (typeof value !== "string") {
        return errData("INVALID_PROP", "속성 'className' 은 문자열이어야 함.", {
          example: forwardedExample(entry, "className"),
        });
      }
      continue;
    }
    if (name === "style") {
      if (!isPlainObject(value)) {
        return errData("INVALID_PROP", "속성 'style' 은 평범한 객체여야 함.", {
          example: forwardedExample(entry, "style"),
        });
      }
      continue;
    }
    const spec = entry.props[name];
    if (!spec) {
      return errData("INVALID_PROP", `미지 속성 '${name}'.`, {
        validProps: validPropNames(entry),
        example: buildExample(entry),
      });
    }
    // 콜백(=>)은 JSON 직렬화 불가 → v1 미리보기는 비대화형.
    if (spec.type.includes("=>")) {
      return errData("INVALID_PROP", `속성 '${name}' 은 콜백이라 직렬화 불가.`, {
        validProps: validPropNames(entry),
        example: buildExample(entry),
      });
    }
    // enum: 문자열 리터럴 유니온 멤버여야 함.
    if (spec.enum && spec.enum.length > 0) {
      if (typeof value !== "string" || !spec.enum.includes(value)) {
        return errData(
          "INVALID_PROP",
          `속성 '${name}' 값 '${String(value)}' 은 허용 목록 밖(${spec.enum.join(", ")}).`,
          { validValues: [...spec.enum], example: buildExample(entry, name) },
        );
      }
      continue;
    }
    // 원시 타입: 정확히 그 타입이어야 함.
    if (spec.type === "string") {
      if (typeof value !== "string") return typeMismatch(entry, name, "문자열");
      continue;
    }
    if (spec.type === "number") {
      if (typeof value !== "number") return typeMismatch(entry, name, "숫자");
      continue;
    }
    if (spec.type === "boolean") {
      if (typeof value !== "boolean") return typeMismatch(entry, name, "불리언");
      continue;
    }
    // 그 외 타입(유니온·ReactNode·배열·객체)은 임의 JsonValue 허용(더 검사 불가).
  }
  return null;
}

// 원시 타입 불일치 — 속성 이름은 유효하므로 validProps + focus prop 을 채운 예시로 교정을 유도한다.
function typeMismatch(entry: CatalogEntry, name: string, kor: string): ErrData {
  return errData("INVALID_PROP", `속성 '${name}' 은 ${kor}이어야 함.`, {
    validProps: validPropNames(entry),
    example: buildExample(entry, name),
  });
}
