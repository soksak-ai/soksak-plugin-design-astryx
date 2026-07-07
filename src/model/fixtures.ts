// 테스트 픽스처 카탈로그 + 결과 판독 헬퍼 — 모델 단위테스트 전용.
// 프로덕션 번들에는 포함되지 않는다(plugin-entry 가 import 하지 않음).
import type { Catalog, CatalogEntry, DesignDoc, Err } from "../types";
import { isErr } from "./result";

// 결과 판별은 모델 단일 진실(result.isErr)을 재사용한다 — 테스트 전용 재정의 금지.
export { isErr };

// 빈 문서 빌더(테스트 전용) — 런타임 단일 진실은 commands/store.freshDoc. 모델 테스트는 계층을
// 넘지 않으려(model→commands 금지) 여기서 동형 리터럴을 만든다.
export function makeDoc(): DesignDoc {
  return { version: 1, activeTheme: "neutral", mode: "system", pages: [], seq: 0 };
}

export function unwrap<D>(r: D | Err): D {
  if (isErr(r)) throw new Error(`expected ok, got ${r.code}: ${r.message}`);
  return r as D;
}

export function errCode<D>(r: D | Err): string {
  if (!isErr(r)) throw new Error("expected err");
  return r.code;
}

function entry(
  type: string,
  acceptsChildren: boolean,
  props: CatalogEntry["props"],
): CatalogEntry {
  return { type, importName: type, description: type, props, acceptsChildren };
}

// Stack/Card/Text = 자식 수용, Button = 잎(자식 불가).
export function fixtureCatalog(): Catalog {
  return {
    Stack: entry("Stack", true, {
      direction: {
        type: "'row' | 'column'",
        required: false,
        enum: ["row", "column"],
        description: "",
      },
      gap: { type: "number", required: false, description: "" },
      children: { type: "ReactNode", required: false, description: "" },
    }),
    Card: entry("Card", true, {
      title: { type: "string", required: false, description: "" },
      children: { type: "ReactNode", required: false, description: "" },
    }),
    Text: entry("Text", true, {
      children: { type: "ReactNode", required: false, description: "" },
    }),
    Button: entry("Button", false, {
      label: { type: "string", required: true, description: "" },
      variant: {
        type: "'primary' | 'secondary'",
        required: false,
        enum: ["primary", "secondary"],
        description: "",
      },
      disabled: { type: "boolean", required: false, description: "" },
      count: { type: "number", required: false, description: "" },
      onClick: { type: "() => void", required: false, description: "" },
      data: { type: "Record<string, unknown>", required: false, description: "" },
    }),
  };
}
