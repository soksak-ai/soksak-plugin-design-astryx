// prop-form 순수 파생 검증(RED-first) — 카탈로그 엔트리 → 인스펙터 필드 모델(§7 Inspector law).
// 컨트롤 매핑(enum→Selector·boolean→Switch·spacing→stepper·number→numeric TextInput·string→TextInput·
// style/className→raw·callback/ReactNode/기타→readonly)과 값 강제(dispatch/표시)를 픽스처로 직접 친다.
// 렌더(React/astryx) 없이 순수 함수만 — 인스펙터 컴포넌트는 이 파생을 얇게 그리기만 한다.
import { describe, it, expect } from "vitest";
import type { CatalogEntry, CatalogPropSpec } from "../types";
import {
  SPACING_SCALE,
  classifyProp,
  deriveForm,
  parseRawValue,
  coerceRaw,
  coerceFieldValue,
  displayValue,
  numericValue,
  compSetParams,
  type FieldModel,
} from "./prop-form";

// 한 prop 스펙 픽스처(기본값 채움).
function spec(p: Partial<CatalogPropSpec> & { type: string }): CatalogPropSpec {
  return { required: false, description: "", ...p };
}

// 엔트리 픽스처 — props 는 선언 순서 보존(카탈로그 동형).
function entry(props: Record<string, CatalogPropSpec>, over?: Partial<CatalogEntry>): CatalogEntry {
  return {
    type: "Fixture",
    importName: "Fixture",
    description: "fixture",
    props,
    acceptsChildren: false,
    ...over,
  };
}

// 파생 필드를 이름으로 찾는다.
function field(fs: FieldModel[], name: string): FieldModel {
  const f = fs.find((x) => x.name === name);
  if (!f) throw new Error(`no field ${name}`);
  return f;
}

describe("classifyProp — 컨트롤 매핑", () => {
  it("string enum 이 있으면 enum", () => {
    expect(classifyProp("variant", spec({ type: "'a' | 'b'", enum: ["a", "b"] }))).toBe("enum");
  });

  it("boolean 은 boolean", () => {
    expect(classifyProp("isLoading", spec({ type: "boolean" }))).toBe("boolean");
  });

  it("SpacingStep 는 spacing", () => {
    expect(classifyProp("gap", spec({ type: "SpacingStep" }))).toBe("spacing");
  });

  it("0·소수를 포함한 수치 리터럴 유니온은 spacing(간격 스케일)", () => {
    expect(classifyProp("padding", spec({ type: "0 | 0.5 | 1 | 1.5 | 2 | 3 | 4" }))).toBe("spacing");
  });

  it("0·소수 없는 정수 유니온은 spacing 이 아니라 number", () => {
    expect(classifyProp("headingLevel", spec({ type: "1 | 2 | 3 | 4 | 5 | 6" }))).toBe("number");
    expect(classifyProp("numberOfMonths", spec({ type: "1 | 2" }))).toBe("number");
  });

  it("number 원시는 number", () => {
    expect(classifyProp("maxLines", spec({ type: "number" }))).toBe("number");
  });

  it("string 원시는 string", () => {
    expect(classifyProp("name", spec({ type: "string" }))).toBe("string");
  });

  it("style·className 은 이름으로 raw(타입 불문)", () => {
    expect(classifyProp("className", spec({ type: "string" }))).toBe("raw");
    expect(classifyProp("style", spec({ type: "React.CSSProperties" }))).toBe("raw");
  });

  it("콜백·ReactNode·미지 타입은 readonly", () => {
    expect(classifyProp("onClick", spec({ type: "(e: MouseEvent) => void" }))).toBe("readonly");
    expect(classifyProp("children", spec({ type: "ReactNode" }))).toBe("readonly");
    expect(classifyProp("icon", spec({ type: "ReactElement<IconProps>" }))).toBe("readonly");
    expect(classifyProp("width", spec({ type: "SizeValue" }))).toBe("readonly");
  });
});

describe("deriveForm — 필드 모델 파생", () => {
  it("선언 순서를 보존하고 각 prop 을 1:1 필드로 낳는다", () => {
    const e = entry({
      label: spec({ type: "string", required: true, description: "the label" }),
      variant: spec({ type: "'a' | 'b'", enum: ["a", "b"], default: "'a'" }),
      isLoading: spec({ type: "boolean" }),
    });
    const fs = deriveForm(e, {});
    expect(fs.map((f) => f.name)).toEqual(["label", "variant", "isLoading"]);
    expect(field(fs, "label").required).toBe(true);
    expect(field(fs, "label").description).toBe("the label");
  });

  it("현재 값을 props 에서 바인딩하고, 미설정은 undefined", () => {
    const e = entry({ label: spec({ type: "string" }), size: spec({ type: "'sm' | 'md'", enum: ["sm", "md"] }) });
    const fs = deriveForm(e, { label: "Save" });
    expect(field(fs, "label").value).toBe("Save");
    expect(field(fs, "size").value).toBeUndefined();
  });

  it("enum 필드는 options 로 멤버를 싣는다", () => {
    const e = entry({ variant: spec({ type: "'a' | 'b'", enum: ["a", "b"] }) });
    expect(field(deriveForm(e, {}), "variant").options).toEqual(["a", "b"]);
  });

  it("spacing 필드는 정렬된 steps·min·max·step 을 싣는다(SpacingStep 전체 스케일)", () => {
    const e = entry({ gap: spec({ type: "SpacingStep" }) });
    const f = field(deriveForm(e, {}), "gap");
    expect(f.kind).toBe("spacing");
    expect(f.steps).toEqual(SPACING_SCALE);
    expect(f.min).toBe(0);
    expect(f.max).toBe(10);
    expect(f.step).toBe(0.5);
  });

  it("잘린 간격 유니온은 자기 멤버로 steps 를 싣는다", () => {
    const e = entry({ gap: spec({ type: "0 | 0.5 | 1 | 1.5 | 2 | 3 | 4" }) });
    const f = field(deriveForm(e, {}), "gap");
    expect(f.steps).toEqual([0, 0.5, 1, 1.5, 2, 3, 4]);
    expect(f.max).toBe(4);
  });

  it("number 유니온(비-간격)은 멤버 min·max 를 싣는다", () => {
    const e = entry({ headingLevel: spec({ type: "1 | 2 | 3 | 4 | 5 | 6" }) });
    const f = field(deriveForm(e, {}), "headingLevel");
    expect(f.kind).toBe("number");
    expect(f.min).toBe(1);
    expect(f.max).toBe(6);
  });

  it("readonly 필드는 사유(callback·component·unsupported)를 싣는다", () => {
    const e = entry({
      onClick: spec({ type: "(e: MouseEvent) => void" }),
      icon: spec({ type: "ReactNode" }),
      width: spec({ type: "SizeValue" }),
    });
    const fs = deriveForm(e, {});
    expect(field(fs, "onClick").readonlyReason).toBe("callback");
    expect(field(fs, "icon").readonlyReason).toBe("component");
    expect(field(fs, "width").readonlyReason).toBe("unsupported");
  });

  it("default·typeLabel 를 힌트로 싣는다", () => {
    const e = entry({ variant: spec({ type: "'a' | 'b'", enum: ["a", "b"], default: "'a'" }) });
    const f = field(deriveForm(e, {}), "variant");
    expect(f.default).toBe("'a'");
    expect(f.typeLabel).toBe("'a' | 'b'");
  });
});

describe("parseRawValue / coerceRaw", () => {
  it("JSON 객체 문자열은 객체로 파싱", () => {
    expect(parseRawValue('{"color":"red"}')).toEqual({ color: "red" });
  });

  it("비-JSON 은 원문 문자열로", () => {
    expect(parseRawValue("my-class")).toBe("my-class");
  });

  it("빈 문자열은 빈 문자열", () => {
    expect(parseRawValue("   ")).toBe("");
  });

  it("className(raw·string 타입)은 파싱 없이 원문(‘true’ 가 boolean 으로 새지 않음)", () => {
    const f: FieldModel = { name: "className", kind: "raw", typeLabel: "string", required: false, description: "", value: undefined };
    expect(coerceRaw(f, "true")).toBe("true");
    expect(coerceRaw(f, "btn primary")).toBe("btn primary");
  });

  it("style(raw·객체 타입)은 JSON 객체로 파싱, 실패 시 원문", () => {
    const f: FieldModel = { name: "style", kind: "raw", typeLabel: "React.CSSProperties", required: false, description: "", value: undefined };
    expect(coerceRaw(f, '{"color":"red"}')).toEqual({ color: "red" });
    expect(coerceRaw(f, "not json")).toBe("not json");
    expect(coerceRaw(f, "")).toBe("");
  });
});

describe("coerceFieldValue — dispatch 값 강제", () => {
  const mk = (kind: FieldModel["kind"], typeLabel = ""): FieldModel => ({
    name: "p", kind, typeLabel, required: false, description: "", value: undefined,
  });

  it("boolean → 불리언", () => {
    expect(coerceFieldValue(mk("boolean"), true)).toBe(true);
    expect(coerceFieldValue(mk("boolean"), false)).toBe(false);
  });

  it("enum·string → 문자열", () => {
    expect(coerceFieldValue(mk("enum"), "primary")).toBe("primary");
    expect(coerceFieldValue(mk("string"), "hi")).toBe("hi");
  });

  it("number·spacing → 숫자, 빈/비수치는 null(삭제)", () => {
    expect(coerceFieldValue(mk("number"), "3")).toBe(3);
    expect(coerceFieldValue(mk("spacing"), 2)).toBe(2);
    expect(coerceFieldValue(mk("number"), "")).toBeNull();
    expect(coerceFieldValue(mk("number"), "abc")).toBeNull();
  });

  it("raw(className)·raw(style) 은 coerceRaw 규칙을 탄다", () => {
    expect(coerceFieldValue(mk("raw", "string"), "cls")).toBe("cls");
    expect(coerceFieldValue(mk("raw", "React.CSSProperties"), '{"a":1}')).toEqual({ a: 1 });
  });
});

describe("displayValue / numericValue — 입력 표시값", () => {
  const mk = (value: FieldModel["value"]): FieldModel => ({
    name: "p", kind: "string", typeLabel: "", required: false, description: "", value,
  });

  it("문자열·숫자·불리언은 문자열로, 미설정은 빈 문자열", () => {
    expect(displayValue(mk("hi"))).toBe("hi");
    expect(displayValue(mk(3))).toBe("3");
    expect(displayValue(mk(true))).toBe("true");
    expect(displayValue(mk(undefined))).toBe("");
    expect(displayValue(mk(null))).toBe("");
  });

  it("객체는 JSON 문자열로", () => {
    expect(displayValue(mk({ color: "red" }))).toBe('{"color":"red"}');
  });

  it("numericValue 는 숫자·수치 문자열만 숫자로, 그 외 null", () => {
    expect(numericValue(mk(4))).toBe(4);
    expect(numericValue(mk("2"))).toBe(2);
    expect(numericValue(mk(undefined))).toBeNull();
    expect(numericValue(mk("x"))).toBeNull();
  });
});

describe("compSetParams — comp.set 파라미터 빌더", () => {
  it("pageId·nodeId·단일 prop 을 담는다", () => {
    expect(compSetParams("p1", "n2", "variant", "primary")).toEqual({
      pageId: "p1",
      nodeId: "n2",
      props: { variant: "primary" },
    });
  });

  it("null 값은 그대로 담는다(키 삭제 신호)", () => {
    expect(compSetParams("p1", "n2", "gap", null)).toEqual({
      pageId: "p1",
      nodeId: "n2",
      props: { gap: null },
    });
  });
});
